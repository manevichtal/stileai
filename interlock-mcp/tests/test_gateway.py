# tests/test_gateway.py — uses a fake downstream + a real engine
from interlock.engine import PolicyEngine, load_policies_from_dict
from interlock.enrichment import enrich
from interlock.gateway import build_gateway_server, _decide  # _decide: pure policy step

def _engine():
    return load_policies_from_dict({
        "default_effect": "deny",
        "policies": [
            {"id": "allow-reads", "effect": "allow", "priority": 10, "action": "read_data"},
            {"id": "deny-delete", "effect": "deny", "priority": 5, "action": "delete_records"},
        ],
    })

def test_decide_allows_read_denies_delete():
    eng = _engine()
    assert _decide(eng, "agent:default", "read_data", "sample:read_data", {}).effect.value == "allow"
    assert _decide(eng, "agent:default", "delete_records", "sample:delete_records", {"table": "t"}).effect.value == "deny"


class _Cfg:
    """Tiny stand-in for interlock.config.Config — only the attrs enrich() reads."""
    env = "prod"
    business_hours = "9-17"
    tz = "UTC"
    freeze = False


def _velocity_engine():
    # Lower priority number wins: the daily_total-based deny must be checked
    # before the plain allow fallback, so a velocity field derived by enrich()
    # — never sent by the agent — is what flips the decision.
    return load_policies_from_dict({
        "default_effect": "deny",
        "policies": [
            {"id": "deny-daily-limit", "effect": "deny", "priority": 5,
             "action": "charge_card",
             "conditions": [{"field": "daily_total", "op": "gt", "value": 5000}]},
            {"id": "allow-charge", "effect": "allow", "priority": 10, "action": "charge_card"},
        ],
    })


def test_decide_denies_on_enriched_daily_total_agent_cannot_spoof():
    eng = _velocity_engine()
    # The agent sends only `amount`; it does NOT send daily_total. enrich()
    # derives daily_total from the gateway-fetched usage counters, and that
    # derived field — not anything in the raw args — trips the deny rule.
    raw_args = {"amount": 50}
    enriched = enrich(raw_args, _Cfg(), {"daily_total": 9000}, now_hour=10)
    assert "daily_total" not in raw_args
    assert enriched["daily_total"] == 9000

    decision = _decide(eng, "agent:default", "charge_card", "sample:charge_card", enriched)
    assert decision.effect.value == "deny"
    assert decision.matched_policy == "deny-daily-limit"

    # Evaluating against the raw (unenriched) args would NOT have denied —
    # proving enrichment, not the raw args, is what changed the outcome.
    raw_decision = _decide(eng, "agent:default", "charge_card", "sample:charge_card", raw_args)
    assert raw_decision.effect.value == "allow"
