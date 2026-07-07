import pytest

from interlock.server import _require_http_token


def test_require_http_token_raises_without_token(monkeypatch):
    monkeypatch.delenv("INTERLOCK_MCP_AUTH_TOKEN", raising=False)
    with pytest.raises(SystemExit):
        _require_http_token()


def test_require_http_token_blank_is_rejected(monkeypatch):
    monkeypatch.setenv("INTERLOCK_MCP_AUTH_TOKEN", "   ")
    with pytest.raises(SystemExit):
        _require_http_token()


def test_require_http_token_ok_with_token(monkeypatch):
    monkeypatch.setenv("INTERLOCK_MCP_AUTH_TOKEN", "a-long-secret")
    assert _require_http_token() is None
