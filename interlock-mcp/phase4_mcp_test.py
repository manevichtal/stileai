"""Phase 4: drive the REAL Interlock MCP (api store) against the local dashboard.

Sets the api-store env, imports the actual server module (which builds the real
ApiPolicyStore / ApiAuditSink / PolicyProvider), and calls the real request_action
tool. Two modes:
  scenarios  - pull policies from the dashboard, evaluate several actions, assert
               the effects match, and (side effect) push audit + approvals back.
  failsafe   - point at a dead dashboard with no cache; assert it DENIES, never
               allows.
"""
import json
import os
import sys

HANDOFF = os.environ["HANDOFF"]
MODE = os.environ.get("MODE", "scenarios")

with open(HANDOFF) as fh:
    info = json.load(fh)

# Configure the api store BEFORE importing the server (Config reads env at import).
os.environ["INTERLOCK_STORE"] = "api"
os.environ["INTERLOCK_TRANSPORT"] = "stdio"
os.environ["INTERLOCK_API_KEY"] = info["apiKey"]
os.environ["INTERLOCK_POLL_INTERVAL"] = "0"          # always re-check version
os.environ["INTERLOCK_UNAVAILABLE_EFFECT"] = "deny"  # fail-safe
os.environ.setdefault("INTERLOCK_DASHBOARD_URL", "http://localhost:3000")

import interlock.server as srv  # noqa: E402  (env must be set first)

failed = False
def ok(m): print("  OK  " + m)
def bad(m):
    global failed
    print("  BAD " + m); failed = True

if MODE == "failsafe":
    # dead dashboard, nothing cached -> must deny (never allow)
    d = srv.request_action("agent:bot", "customer.read", "customer:1", {})
    if d["effect"] == "deny" and not d["allowed"]:
        ok("dashboard unreachable -> DENY (fail-safe), reason: " + d["reason"])
    else:
        bad("fail-safe did not deny: " + json.dumps(d))
    print("\nPHASE 4 FAILSAFE: " + ("FAILED" if failed else "PASSED"))
    sys.exit(1 if failed else 0)

# --- scenarios (live dashboard) ---
cases = [
    ("agent:bot",       "customer.read",  "customer:1",   {},                                    "allow",            "allow-reads"),
    ("agent:bot",       "db.drop_table",  "table:orders", {},                                    "deny",             "deny-prod-db-drop"),
    ("agent:bot",       "payment.charge", "customer:1",   {"amount": 50},                        "allow",            "allow-small-payments"),
    ("agent:bot",       "payment.charge", "customer:1234",{"amount": 5000, "card_number": "4111111111111111"}, "require_approval", "approve-large-payments"),
    ("user:admin_kate", "db.delete",      "customer:9",   {},                                    "allow",            "allow-admin-writes"),
    ("agent:bot",       "email.send",     "email:x@external.com", {"to": "x@external.com"},       "require_approval", "approve-external-email"),
]

large_payment_decision_id = None
for actor, action, resource, params, want_effect, want_policy in cases:
    d = srv.request_action(actor, action, resource, params)
    tag = f"{actor} {action}"
    if d["effect"] == want_effect and d["matched_policy"] == want_policy:
        ok(f"{tag:38s} -> {d['effect']:16s} ({d['matched_policy']})")
    else:
        bad(f"{tag} -> got {d['effect']}/{d['matched_policy']}, want {want_effect}/{want_policy}")
    if want_policy == "approve-large-payments":
        large_payment_decision_id = d["decision_id"]

# The MCP reads its own audit log back through the dashboard (GET /api/audit).
log = srv.get_audit_log(limit=50)
if any(e.get("matched_policy") == "deny-prod-db-drop" for e in log):
    ok("get_audit_log round-trips decisions back from the dashboard")
else:
    bad("audit log did not contain expected entries")

# The large payment should be in the pending-approval queue (POST /api/approvals).
pend = srv.list_pending()
if any(p.get("decision_id") == large_payment_decision_id for p in pend):
    ok("large payment is in the pending-approval queue")
else:
    bad("pending approval not found for large payment")

with open(os.environ["RESULTS"], "w") as fh:
    json.dump({"large_payment_decision_id": large_payment_decision_id}, fh)

print("\nPHASE 4 SCENARIOS: " + ("FAILED" if failed else "PASSED"))
sys.exit(1 if failed else 0)
