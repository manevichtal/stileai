# tests/test_gateway.py — uses a fake downstream + a real engine
from interlock.engine import PolicyEngine, load_policies_from_dict
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
