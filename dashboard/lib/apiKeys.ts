import { createHash, randomBytes } from "crypto";

// API key format: sk_live_<48 hex chars>. The raw key is shown to the admin
// exactly once at creation; we store only its SHA-256 hash + a short prefix for
// display. The MCP sends the raw key as `Authorization: Bearer <key>`.
export function generateApiKey(): string {
  return "sk_live_" + randomBytes(24).toString("hex");
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key.trim()).digest("hex");
}

// First 12 chars, e.g. "sk_live_a1b2" — safe to display/store for identification.
export function keyPrefix(key: string): string {
  return key.slice(0, 12);
}
