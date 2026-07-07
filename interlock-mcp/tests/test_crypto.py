import base64

import pytest

from interlock import crypto

# A fixed, known 32-byte key (base64) for deterministic tests.
_KEY = base64.b64encode(bytes(range(32))).decode("ascii")


def test_round_trip(monkeypatch):
    monkeypatch.setenv("INTERLOCK_ENC_KEY", _KEY)
    enc = crypto.encrypt_secret("s3cr3t-token")
    assert enc.startswith("enc:")
    assert crypto.decrypt_secret(enc) == "s3cr3t-token"


def test_ciphertext_is_not_plaintext(monkeypatch):
    monkeypatch.setenv("INTERLOCK_ENC_KEY", _KEY)
    enc = crypto.encrypt_secret("hello world")
    assert "hello world" not in enc


def test_decrypt_rejects_unprefixed(monkeypatch):
    monkeypatch.setenv("INTERLOCK_ENC_KEY", _KEY)
    with pytest.raises(ValueError):
        crypto.decrypt_secret("plain-not-encrypted")


def test_missing_key_fails_closed(monkeypatch):
    monkeypatch.delenv("INTERLOCK_ENC_KEY", raising=False)
    with pytest.raises(RuntimeError):
        crypto.encrypt_secret("x")


def test_wrong_key_length_fails_closed(monkeypatch):
    monkeypatch.setenv("INTERLOCK_ENC_KEY", base64.b64encode(b"tooshort").decode("ascii"))
    with pytest.raises(RuntimeError):
        crypto.encrypt_secret("x")
