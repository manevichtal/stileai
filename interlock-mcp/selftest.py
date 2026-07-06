"""
Quick self-test for the Interlock engine + audit store. No MCP client needed.

Run:  python selftest.py
It loads policies.yaml, runs a batch of sample actions, prints each decision,
and checks a few expected outcomes so you can see the checkpoint working.
"""

import sys
from pathlib import Path

import yaml

from interlock.audit import AuditStore, PendingDecision
from interlock.engine import Effect, load_policies_from_dict

BASE = Path(__file__).resolve().parent


def load_engine():
    data = yaml.safe_load((BASE / "policies.yaml").read_text())
    return load_policies_from_dict(data)


def main() -> int:
    engine = load_engine()
    audit = AuditStore(BASE / "data" / "selftest_audit.log")

    # (actor, action, resource, params, expected_effect)
    cases = [
        ("agent:bot", "customer.read", "customer:1", {}, Effect.ALLOW),
        ("agent:bot", "db.drop_table", "table:orders", {}, Effect.DENY),
        ("agent:bot", "db.delete", "table:orders", {}, Effect.DENY),
        ("agent:bot", "payment.charge", "customer:1", {"amount": 50}, Effect.ALLOW),
        ("agent:bot", "payment.charge", "customer:1", {"amount": 5000},
         Effect.REQUIRE_APPROVAL),
        ("agent:bot", "email.send", "email:joe@yourcompany.com", {}, Effect.ALLOW),
        ("agent:bot", "email.send", "email:someone@gmail.com", {},
         Effect.REQUIRE_APPROVAL),
        ("agent:bot", "db.delete", "orders:42", {}, Effect.REQUIRE_APPROVAL),
        ("user:admin_kate", "db.delete", "orders:42", {}, Effect.ALLOW),
        ("agent:bot", "weird.unknown", "thing:1", {}, Effect.REQUIRE_APPROVAL),
    ]

    failures = 0
    print(f"{'ACTOR':18} {'ACTION':16} {'EFFECT':17} RULE")
    print("-" * 72)
    for actor, action, resource, params, expected in cases:
        d = engine.evaluate(actor, action, resource, params)
        ok = d.effect == expected
        failures += not ok
        flag = "  " if ok else "XX"
        print(f"{flag}{actor:16} {action:16} {d.effect.value:17} "
              f"{d.matched_policy or '(default)'}")
        audit.record(actor=actor, action=action, resource=resource,
                     params=params, effect=d.effect.value,
                     matched_policy=d.matched_policy, reason=d.reason,
                     status=d.effect.value)

    # Exercise the approval workflow.
    print("\nApproval workflow:")
    d = engine.evaluate("agent:bot", "payment.charge", "customer:1",
                        {"amount": 5000})
    pending = PendingDecision(
        decision_id="test-123", actor="agent:bot", action="payment.charge",
        resource="customer:1", params={"amount": 5000}, reason=d.reason,
        matched_policy=d.matched_policy,
        approvals_required=d.approvals_required)
    audit.add_pending(pending)
    print(f"  created pending {pending.decision_id} "
          f"(needs {pending.approvals_required} approval)")
    resolved = audit.resolve("test-123", "user:manager", True, "looks fine")
    print(f"  after approval -> status = {resolved.status}")
    failures += resolved.status != "approved"

    print("\n" + ("ALL CHECKS PASSED" if failures == 0
                   else f"{failures} CHECK(S) FAILED"))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
