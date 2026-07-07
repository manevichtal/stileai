"""AES-256-GCM secret encryption, interoperable with the dashboard (node:crypto).

Format: "enc:" + base64( iv(12) || ciphertext || tag(16) ). Key is base64 of
exactly 32 bytes in INTERLOCK_ENC_KEY. Fail closed: raise if the key is missing
or the wrong length. Used to protect downstream tool credentials at rest.
"""
from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_PREFIX = "enc:"


def _key() -> bytes:
    raw = os.environ.get("INTERLOCK_ENC_KEY", "")
    if not raw:
        raise RuntimeError("INTERLOCK_ENC_KEY is required to handle encrypted secrets")
    key = base64.b64decode(raw)
    if len(key) != 32:
        raise RuntimeError("INTERLOCK_ENC_KEY must be base64 of exactly 32 bytes")
    return key


def encrypt_secret(plain: str, *, _iv: bytes | None = None) -> str:
    iv = _iv or os.urandom(12)
    # AESGCM.encrypt returns ciphertext with the 16-byte tag appended.
    ct = AESGCM(_key()).encrypt(iv, plain.encode("utf-8"), None)
    return _PREFIX + base64.b64encode(iv + ct).decode("ascii")


def decrypt_secret(enc: str) -> str:
    if not enc.startswith(_PREFIX):
        raise ValueError("not an encrypted secret (missing enc: prefix)")
    blob = base64.b64decode(enc[len(_PREFIX):])
    iv, ct = blob[:12], blob[12:]
    return AESGCM(_key()).decrypt(iv, ct, None).decode("utf-8")
