import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM secret encryption, interoperable with the gateway (Python).
// Format: "enc:" + base64( iv(12) || ciphertext || tag(16) ). Key is base64 of
// exactly 32 bytes in INTERLOCK_ENC_KEY. Fail closed if the key is missing/invalid.
// Used to protect downstream tool credentials at rest.

const PREFIX = "enc:";

function key(): Buffer {
  const raw = process.env.INTERLOCK_ENC_KEY;
  if (!raw) throw new Error("INTERLOCK_ENC_KEY is required to handle encrypted secrets");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("INTERLOCK_ENC_KEY must be base64 of exactly 32 bytes");
  return k;
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  const tag = c.getAuthTag(); // 16 bytes
  return PREFIX + Buffer.concat([iv, ct, tag]).toString("base64");
}

export function decryptSecret(enc: string): string {
  if (!enc.startsWith(PREFIX)) throw new Error("not an encrypted secret (missing enc: prefix)");
  const blob = Buffer.from(enc.slice(PREFIX.length), "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(blob.length - 16);
  const ct = blob.subarray(12, blob.length - 16);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
