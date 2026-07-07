# tests/test_usage.py
import httpx
from interlock.config import Config
from interlock.usage import ApiUsageStore

def _cfg(monkeypatch, url):
    monkeypatch.setenv("INTERLOCK_STORE", "api")
    monkeypatch.setenv("INTERLOCK_DASHBOARD_URL", url)
    monkeypatch.setenv("INTERLOCK_API_KEY", "sk_test")
    return Config.from_env()

def test_get_usage_returns_dict(monkeypatch):
    def handler(request):
        assert request.url.path == "/api/usage"
        assert request.url.params.get("actor") == "agent:default"
        assert request.headers.get("authorization") == "Bearer sk_test"
        return httpx.Response(200, json={"actor_action_count_1h": 3, "daily_total": 1200})
    cfg = _cfg(monkeypatch, "http://dash.test")
    store = ApiUsageStore(cfg, transport=httpx.MockTransport(handler))
    usage = store.get_usage("agent:default")
    assert usage == {"actor_action_count_1h": 3, "daily_total": 1200}

def test_get_usage_empty_when_unreachable(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("down")
    cfg = _cfg(monkeypatch, "http://dash.test")
    store = ApiUsageStore(cfg, transport=httpx.MockTransport(handler))
    assert store.get_usage("agent:default") == {}
