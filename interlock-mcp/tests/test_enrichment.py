# tests/test_enrichment.py
from interlock.enrichment import enrich

class Cfg:
    env = "prod"; business_hours = "9-17"; tz = "UTC"; freeze = True

def test_enrich_overrides_agent_and_derives_fields():
    args = {"to": "alice@gmail.com", "env": "dev", "recipient_domain": "safe.com"}
    out = enrich(args, Cfg(), {"actor_action_count_1h": 5, "daily_total": 9000}, now_hour=22)
    assert out["recipient_domain"] == "gmail.com"   # agent's "safe.com" overridden
    assert out["recipient_count"] == 1
    assert out["env"] == "prod"                      # agent's "dev" overridden by config
    assert out["off_hours"] is True                  # 22:00 is off hours
    assert out["freeze"] is True
    assert out["daily_total"] == 9000
    assert args["env"] == "dev"                      # original args untouched (copy)

def test_enrich_has_where_and_mass_recipients():
    out = enrich({"table": "orders", "where": ""}, Cfg(), {}, now_hour=10)
    assert out["has_where"] is False                 # empty where
    out2 = enrich({"recipients": ["a@x.com","b@y.com"]}, Cfg(), {}, now_hour=10)
    assert out2["recipient_count"] == 2 and out2["off_hours"] is False
