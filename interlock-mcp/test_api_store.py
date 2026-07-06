"""
Round-trip test for the `api` store against a mock dashboard.

Spins up a tiny in-process HTTP server that behaves like the dashboard's API:
serves policies + a version, accepts audit posts, and holds approvals. Then
points the ApiPolicyStore / ApiAuditSink at it and exercises the full flow,
including a live policy edit that the MCP must pick up.

Run: python test_api_store.py
"""

import json
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import yaml

from interlock.config import Config
from interlock.engine import Effect
from interlock.stores import ApiAuditSink, ApiPolicyStore, _Http

# --- mock dashboard state ----------------------------------------------------

STATE = {
    "version": 1,
    "policies": {
        "default_effect": "require_approval",
        "policies": [
            {"id": "allow-reads", "effect": "allow", "priority": 30,
             "action": "*.read", "description": "reads ok"},
            {"id": "deny-drop", "effect": "deny", "priority": 10,
             "action": "db.drop*", "description": "no drops"},
        ],
    },
    "audit": [],
    "approvals": {},
    "expected_key": "Bearer test-secret-123",
}


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):  # silence
        pass

    def _auth_ok(self):
        return self.headers.get("Authorization") == STATE["expected_key"]

    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(n) or b"{}")

    def do_GET(self):
        if not self._auth_ok():
            return self._send(401, {"error": "unauthorized"})
        if self.path == "/api/policies/version":
            return self._send(200, {"version": STATE["version"]})
        if self.path == "/api/policies":
            return self._send(200, STATE["policies"])
        if self.path.startswith("/api/audit"):
            return self._send(200, STATE["audit"][-50:])
        if self.path.startswith("/api/approvals"):
            return self._send(200, list(STATE["approvals"].values()))
        return self._send(404, {"error": "not found"})

    def do_POST(self):
        if not self._auth_ok():
            return self._send(401, {"error": "unauthorized"})
        body = self._body()
        if self.path == "/api/audit":
            STATE["audit"].append(body)
            return self._send(201, {"ok": True})
        if self.path == "/api/approvals":
            STATE["approvals"][body["decision_id"]] = body
            return self._send(201, {"ok": True})
        if self.path.startswith("/api/approvals/") and self.path.endswith("/resolve"):
            did = self.path.split("/")[3]
            p = STATE["approvals"].get(did, {})
            p["status"] = "approved" if body.get("approved") else "denied"
            p.setdefault("approvals", []).append(body)
            return self._send(200, p)
        return self._send(404, {"error": "not found"})


def main() -> int:
    server = ThreadingHTTPServer(("127.0.0.1", 8791), Handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    time.sleep(0.2)

    cfg = Config.from_env()
    cfg.store = "api"
    cfg.dashboard_url = "http://127.0.0.1:8791"
    cfg.api_key = "test-secret-123"
    http = _Http(cfg)
    pstore = ApiPolicyStore(cfg, http)
    sink = ApiAuditSink(cfg, http)

    failures = 0

    # 1. pull policies from the mock dashboard
    from interlock.engine import load_policies_from_dict
    engine = load_policies_from_dict(pstore.get_policies())
    d = engine.evaluate("agent:bot", "customer.read", "customer:1", {})
    print("read decision:", d.effect.value, "->", d.matched_policy)
    failures += d.effect != Effect.ALLOW

    d = engine.evaluate("agent:bot", "db.drop_table", "table:x", {})
    print("drop decision:", d.effect.value, "->", d.matched_policy)
    failures += d.effect != Effect.DENY

    # 2. version caching: same version -> no change; bump -> new ruleset
    v1 = pstore.version()
    _ = pstore.get_policies()
    STATE["version"] = 2
    STATE["policies"]["policies"].append(
        {"id": "deny-reads-now", "effect": "deny", "priority": 5,
         "action": "*.read", "description": "reads now blocked"})
    v2 = pstore.version()
    engine2 = load_policies_from_dict(pstore.get_policies())
    d = engine2.evaluate("agent:bot", "customer.read", "customer:1", {})
    print(f"after live edit (v{v1}->v{v2}) read decision:", d.effect.value)
    failures += not (v1 != v2 and d.effect == Effect.DENY)

    # 3. audit push -> appears in dashboard
    sink.record(actor="agent:bot", action="payment.charge", resource="c:1",
                params={"amount": 5000, "token": "sekret"},
                effect="require_approval", matched_policy=None,
                reason="test", status="pending")
    log = sink.read_log(limit=10)
    print("audit rows on dashboard:", len(log),
          "| token redacted:", log[-1]["params"].get("token"))
    failures += not (len(log) >= 1 and log[-1]["params"]["token"] == "***REDACTED***")

    # 4. approval round-trip
    from interlock.audit import PendingDecision
    sink.add_pending(PendingDecision(
        decision_id="d-1", actor="agent:bot", action="payment.charge",
        resource="c:1", params={"amount": 5000}, reason="big",
        matched_policy=None, approvals_required=1))
    resolved = sink.resolve("d-1", "user:manager", True, "ok")
    print("approval resolve status:", resolved.status if resolved else None)
    failures += not (resolved and resolved.status == "approved")

    server.shutdown()
    print("\n" + ("API STORE: ALL CHECKS PASSED" if not failures
                  else f"API STORE: {failures} FAILED"))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
