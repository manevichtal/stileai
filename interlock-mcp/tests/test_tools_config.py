# tests/test_tools_config.py
import httpx
from interlock.config import Config
from interlock.tools_config import ApiToolsStore

def _cfg(monkeypatch, url):
    monkeypatch.setenv("INTERLOCK_STORE", "api")
    monkeypatch.setenv("INTERLOCK_DASHBOARD_URL", url)
    monkeypatch.setenv("INTERLOCK_API_KEY", "sk_test")
    return Config.from_env()

def test_get_tools_returns_list_and_caches(monkeypatch):
    calls = {"n": 0}
    def handler(request):
        calls["n"] += 1
        assert request.headers.get("authorization") == "Bearer sk_test"
        return httpx.Response(200, json={"tools": [
            {"name": "sample", "transport": "stdio", "target": "[]",
             "auth": None, "enabled": True}]})
    cfg = _cfg(monkeypatch, "http://dash.test")
    store = ApiToolsStore(cfg, transport=httpx.MockTransport(handler))
    tools = store.get_tools()
    assert tools[0]["name"] == "sample"

def test_get_tools_empty_when_unreachable(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("down")
    cfg = _cfg(monkeypatch, "http://dash.test")
    store = ApiToolsStore(cfg, transport=httpx.MockTransport(handler))
    assert store.get_tools() == []   # never-loaded -> empty, never raises
