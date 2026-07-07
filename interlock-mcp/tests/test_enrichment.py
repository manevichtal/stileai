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


class Cfg0:  # operator left env + business_hours unset
    env = ""; business_hours = ""; tz = "UTC"; freeze = False


def test_enrich_overrides_injected_fields_when_no_signal():
    # Agent injects reserved fields but provides NO real trigger data, and config
    # is unset. Every reserved field must be overwritten with a safe default so
    # the agent can't smuggle a value past the policy engine.
    args = {
        "recipient_domain": "safe.com", "recipient_count": 1, "has_where": True,
        "env": "dev", "off_hours": False, "daily_total": 0, "actor_action_count_1h": 0,
    }
    out = enrich(args, Cfg0(), {}, now_hour=22)
    assert out["recipient_domain"] is None   # no recipient -> agent's "safe.com" dropped
    assert out["recipient_count"] == 0       # no recipients -> agent's 1 dropped
    assert out["has_where"] is False         # no where/filter -> agent's True dropped
    assert out["env"] is None                # cfg.env unset -> agent's "dev" dropped
    assert out["off_hours"] is None          # business_hours unset -> agent's False dropped
    assert out["freeze"] is False
    assert out["daily_total"] == 0 and out["actor_action_count_1h"] == 0


def test_enrich_config_env_overrides_injected_env():
    # Even with no `env` in args, an agent-injected env must lose to cfg.env.
    out = enrich({"env": "dev"}, Cfg(), {"daily_total": 12000}, now_hour=3)
    assert out["env"] == "prod"              # cfg wins
    assert out["off_hours"] is True          # 3am
    assert out["daily_total"] == 12000       # usage wins over any injected value


def test_enrich_usage_overrides_injected_counts():
    # Agent injects a small daily_total to look under a cap; real usage must win.
    out = enrich({"daily_total": 0, "actor_action_count_1h": 0}, Cfg(),
                 {"daily_total": 9000, "actor_action_count_1h": 150}, now_hour=10)
    assert out["daily_total"] == 9000 and out["actor_action_count_1h"] == 150
