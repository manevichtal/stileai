# Plan 2 — Security Hardenings + Downstream Credential Encryption

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** Apply the "before a paying customer" hardenings from the enforced-gateway spec §6 that aren't done yet — make the audit trail tamper-proof, lock admin tables to admins, fail closed on a missing auth token, tighten error hygiene, and **encrypt downstream tool credentials at rest** (Node writes / Python reads the same AES-256-GCM).

**Architecture:** Mostly a Supabase RLS migration + a few focused code changes. Encryption uses one shared secret `INTERLOCK_ENC_KEY` (32 bytes, base64) set on both the dashboard (Vercel) and the gateway host; ciphertext is stored as `enc:<base64(iv‖ciphertext‖tag)>` (the `connected_tools.auth` CHECK already requires the `enc:` prefix).

**Tech Stack:** Supabase Postgres/RLS; Next.js API + `node:crypto`; Python `cryptography` (AES-GCM). Package mgrs: uv (Python), npm (JS).

## Global Constraints

- Never fail open. Fail CLOSED on a missing security-relevant env var (token in HTTP mode; enc key when a `enc:` value must be decrypted).
- `org_id`/tenant always from the authenticated identity, never a request body.
- Service role bypasses RLS and is the ONLY writer of `audit_log`; tenants are read-only there.
- Secrets never logged. API errors return a generic message + a request id; the real error is logged server-side only.
- Python via `interlock-mcp/.venv`; add `cryptography` to `requirements.txt` + install in the venv. Node: `NODE_OPTIONS=--use-system-ca`. Run pytest scoped to `tests/`.
- Encryption format is a strict contract shared by Node and Python: `"enc:" + base64( iv(12 bytes) ‖ ciphertext ‖ tag(16 bytes) )`, AES-256-GCM, key = base64-decoded `INTERLOCK_ENC_KEY` (32 bytes). Both sides MUST interoperate (proven by a cross-language round-trip in the live batch).

---

## File Structure

**New:**
- `supabase/migration_rls_hardening.sql` — audit_log append-only; api_keys + org_policy_settings admin-only; profiles role CHECK.
- `dashboard/lib/crypto.ts` — `encryptSecret(plain) -> "enc:..."`, `decryptSecret("enc:...") -> plain`.
- `interlock-mcp/interlock/crypto.py` — `decrypt_secret("enc:...") -> str` (+ `encrypt_secret` for tests).
- `dashboard/lib/apiError.ts` — `apiError(e, status?)` → generic JSON `{error, request_id}` + `console.error(request_id, e)`.
- `interlock-mcp/tests/test_crypto.py`, `dashboard/scripts/verify-rls-hardening.mjs`, `dashboard/scripts/verify-crypto-interop.mjs`.

**Modified:**
- `interlock-mcp/interlock/server.py` — fail-closed token in `main()` (http mode).
- `interlock-mcp/interlock/downstream.py` — decrypt `auth` before using as Bearer.
- `interlock-mcp/requirements.txt` — add `cryptography`.
- `dashboard/app/(app)/connected-tools/*` — optional "Access token" field (encrypted on save) for the web-tool path.
- MCP-facing routes that currently return `error.message` (e.g. `app/api/approvals/route.ts`, `app/api/audit/route.ts`) → use `apiError`.

---

## Task 1: RLS hardening migration

**Files:** Create `supabase/migration_rls_hardening.sql`, `dashboard/scripts/verify-rls-hardening.mjs`

**Interfaces:** Produces a migration the human applies; makes `audit_log` tenant-read-only and `api_keys`/`org_policy_settings` admin-only; adds a `profiles.role` CHECK.

- [ ] **Step 1: Write the migration**

```sql
-- 1) audit_log is APPEND-ONLY for tenants: they may read their org's rows, but
--    only the service role (checkpoint/gateway) may write. Prevents an org user
--    from tampering with their own compliance trail.
drop policy if exists org_rw_audit on audit_log;
create policy org_ro_audit on audit_log
  for select using (org_id = current_org_id());
-- (no insert/update/delete policy for authenticated/anon → denied by RLS;
--  service role bypasses RLS and remains the sole writer.)

-- 2) api_keys + org_policy_settings are ADMIN-ONLY (they mint credentials / set
--    the org's default posture). Was: any org member. Now: role='admin' + org.
drop policy if exists org_rw_api_keys on api_keys;
create policy admin_rw_api_keys on api_keys
  for all
  using (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists org_rw_settings on org_policy_settings;
create policy admin_rw_settings on org_policy_settings
  for all
  using (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'))
  with check (org_id = current_org_id() and exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- 3) constrain the role vocabulary.
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('admin','approver','viewer'));
```

- [ ] **Step 2: Human applies it** in Supabase SQL editor (controller prompts). Expected "Success. No rows returned." (If the role CHECK fails, an existing profile has a role outside the set — report the offending value; do not force it.)

- [ ] **Step 3: Verify script** `verify-rls-hardening.mjs` (runs in the live batch): using an **authenticated** session (anon client + a signed-in non-admin test user), assert the user CANNOT update/delete an `audit_log` row and CANNOT insert an `api_keys` row for their org (RLS denies), while an admin CAN, and both can still `select` their org's rows. Use the REST/anon path (NOT the service role, which bypasses RLS). Assert actual row effects, not just 2xx.

- [ ] **Step 4: Commit** — `git commit -m "feat(db): RLS hardening — audit_log append-only, admin-only api_keys/org_policy_settings, profiles role CHECK"`

---

## Task 2: Fail closed on the auth token (HTTP mode)

**Files:** Modify `interlock-mcp/interlock/server.py` (`main`)

**Interfaces:** In HTTP transport (checkpoint OR gateway mode), if `INTERLOCK_MCP_AUTH_TOKEN` is unset/empty, the process REFUSES to start with a clear error — never serves an open endpoint. (stdio/local dev is unaffected.)

- [ ] **Step 1:** In `main()`, before building the http app, add:

```python
        if not os.environ.get("INTERLOCK_MCP_AUTH_TOKEN", "").strip():
            raise SystemExit(
                "INTERLOCK_MCP_AUTH_TOKEN is required in HTTP transport — refusing "
                "to start an unauthenticated endpoint. Set it (a long random secret) "
                "and restart."
            )
```
(Place it inside the `if cfg.transport in (...):` branch, before `_build_gateway_http_app()/_build_http_app()`.)

- [ ] **Step 2:** Test (`tests/test_server_failclosed.py`): with `INTERLOCK_TRANSPORT=http` and no token, calling the guard raises SystemExit. Since `main()` also binds a port, factor the check into a tiny `_require_http_token()` helper and unit-test that (set env, assert `pytest.raises(SystemExit)`; with a token set, it returns None). Run → pass.

- [ ] **Step 3: Commit** — `git commit -m "feat(mcp): fail closed — refuse to start HTTP transport without INTERLOCK_MCP_AUTH_TOKEN"`

---

## Task 3: Encryption helpers (Node + Python, interoperable)

**Files:** Create `dashboard/lib/crypto.ts`, `interlock-mcp/interlock/crypto.py`, `interlock-mcp/tests/test_crypto.py`; modify `interlock-mcp/requirements.txt`

**Interfaces:**
- `dashboard/lib/crypto.ts`: `encryptSecret(plain: string): string` → `"enc:" + base64(iv‖ct‖tag)`; `decryptSecret(enc: string): string`. Key from `process.env.INTERLOCK_ENC_KEY` (base64 → 32 bytes). Throws if key missing/invalid (fail closed).
- `interlock-mcp/interlock/crypto.py`: `decrypt_secret(enc: str) -> str`, `encrypt_secret(plain: str) -> str` (for tests). Key from `INTERLOCK_ENC_KEY`. Raises if key missing/invalid.
- Contract: AES-256-GCM, iv=12 random bytes, tag=16 bytes appended, whole blob base64'd after the `enc:` prefix.

- [ ] **Step 1: Python failing test** (`tests/test_crypto.py`): with `INTERLOCK_ENC_KEY` set to a known base64 32-byte key, `decrypt_secret(encrypt_secret("hello")) == "hello"`; a value without `enc:` prefix passes through unchanged OR raises (choose: raise `ValueError`); missing key → raises.

- [ ] **Step 2: Implement `crypto.py`** using `cryptography`:

```python
# interlock/crypto.py
"""AES-256-GCM secret encryption, interoperable with the dashboard (node:crypto).
Format: "enc:" + base64( iv(12) ‖ ciphertext ‖ tag(16) ). Key: base64 of 32 bytes
in INTERLOCK_ENC_KEY. Fail closed: raise if the key is missing/invalid."""
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
    ct = AESGCM(_key()).encrypt(iv, plain.encode("utf-8"), None)  # ct includes the 16-byte tag
    return _PREFIX + base64.b64encode(iv + ct).decode("ascii")


def decrypt_secret(enc: str) -> str:
    if not enc.startswith(_PREFIX):
        raise ValueError("not an encrypted secret (missing enc: prefix)")
    blob = base64.b64decode(enc[len(_PREFIX):])
    iv, ct = blob[:12], blob[12:]
    return AESGCM(_key()).decrypt(iv, ct, None).decode("utf-8")
```
Add `cryptography` to `requirements.txt`; `UV_SYSTEM_CERTS=1 uv pip install --python .venv cryptography`.

- [ ] **Step 3: Run Python test → pass.**

- [ ] **Step 4: Implement `dashboard/lib/crypto.ts`** (`node:crypto`, AES-256-GCM) matching the exact format:

```ts
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

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
  const tag = c.getAuthTag();
  return PREFIX + Buffer.concat([iv, ct, tag]).toString("base64");
}
export function decryptSecret(enc: string): string {
  if (!enc.startsWith(PREFIX)) throw new Error("not an encrypted secret");
  const blob = Buffer.from(enc.slice(PREFIX.length), "base64");
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(blob.length - 16);
  const ct = blob.subarray(12, blob.length - 16);
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
```
(Node's GCM keeps the tag separate; Python's AESGCM appends it to ciphertext — the byte layout `iv‖ct‖tag` is identical, verified by the interop test.)

- [ ] **Step 5:** `verify-crypto-interop.mjs` (live batch): Node `encryptSecret("s3cr3t")` → write to a temp file → Python `decrypt_secret` reads it back == "s3cr3t", AND Python `encrypt_secret` → Node `decryptSecret` == same. Same `INTERLOCK_ENC_KEY` in both env. Commit.

- [ ] **Step 6: Commit** — `git commit -m "feat: interoperable AES-256-GCM secret encryption (dashboard + gateway)"`

---

## Task 4: Encrypt downstream credentials — form field + gateway decrypt

**Files:** Modify `dashboard/app/(app)/connected-tools/actions.ts` (+ the form client), `interlock-mcp/interlock/downstream.py`

**Interfaces:**
- Web-tool add path gains an optional **Access token** input; when provided, `addTool` stores `auth = encryptSecret(token)` (so it's `enc:…`, satisfying the CHECK); when blank, `auth = null`.
- `GET /api/tools` already returns `auth` verbatim (the `enc:` value) to the gateway. The gateway's http `Downstream` decrypts it before use.

- [ ] **Step 1:** In `connected-tools/actions.ts`, import `encryptSecret`; in the web-tool branch accept `token` and set `auth: token ? encryptSecret(token) : null`. (Local/stdio path keeps `auth: null`.) Add the optional "Access token (optional)" field to the web-tool form section (password-type input; helper: "If your tool needs an API key/bearer token, paste it here — stored encrypted.").
- [ ] **Step 2:** In `downstream.py`, in the http branch, decrypt before building the header:

```python
            auth = self._cfg.get("auth")
            if auth:
                from .crypto import decrypt_secret
                token = decrypt_secret(auth) if auth.startswith("enc:") else auth
                headers["Authorization"] = f"Bearer {token}"
```
(Fail closed: if `INTERLOCK_ENC_KEY` is unset, `decrypt_secret` raises → the downstream connection fails rather than sending a broken token; that's acceptable — an operator using encrypted creds must set the key.)

- [ ] **Step 3:** Build the dashboard (`npm run build`) succeeds; run the Python suite (`tests/`) green.
- [ ] **Step 4: Commit** — `git commit -m "feat: encrypt downstream tool credentials (form stores enc:, gateway decrypts before use)"`

---

## Task 5: Error hygiene on MCP-facing routes

**Files:** Create `dashboard/lib/apiError.ts`; modify the routes that currently return `error.message`.

**Interfaces:** `apiError(e: unknown, status = 500)` → logs `console.error(request_id, e)` and returns `NextResponse.json({ error: "internal error", request_id }, { status })` where `request_id` is a short random id (`crypto.randomUUID().slice(0,8)`). No raw DB strings to the client.

- [ ] **Step 1:** Write `apiError.ts`. Grep for `error.message` / `err.message` in `dashboard/app/api/**` and replace those client-facing leaks with `apiError(error)` (keep intended 400/401 messages like "invalid JSON"/"unauthorized"). Keep behavior otherwise identical.
- [ ] **Step 2:** `npm run build` succeeds. **Commit** — `git commit -m "feat(api): generic error responses with request id (no raw DB errors leaked)"`

---

## Live batch (controller + human)
1. Human applies `supabase/migration_rls_hardening.sql`.
2. Human sets `INTERLOCK_ENC_KEY` (base64 of 32 random bytes) on Vercel (dashboard) — controller generates one to paste; and on the gateway host when used.
3. Run `verify-rls-hardening.mjs` (append-only + admin-only enforced as a real authenticated user), `verify-crypto-interop.mjs` (Node↔Python round-trip), rebuild + re-run the gateway e2e (regression), then merge → deploy.

## Self-Review
- Spec §6 coverage: fail-closed token (T2) ✅; audit append-only (T1) ✅; admin-only api_keys/org_policy_settings + profiles CHECK (T1) ✅; downstream creds encrypted at rest + CHECK already present, now populated + decrypted (T3,T4) ✅; error hygiene (T5) ✅; RLS verified as a real authenticated user via REST (T1 verify) ✅. Platform-admin allowlist + SECURITY DEFINER hygiene already satisfied (PLATFORM_ADMIN_EMAILS; sum_recent_amount is security-invoker + revoked + search_path).
- Type consistency: `encryptSecret`/`decryptSecret` ↔ `encrypt_secret`/`decrypt_secret` share the exact `enc:` + base64(iv‖ct‖tag) AES-256-GCM format (interop-tested); `apiError(e,status)`.
- Simplicity: one migration; two small crypto modules; one form field; a thin error helper. No new services.
