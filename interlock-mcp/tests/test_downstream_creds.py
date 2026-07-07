import base64
import json

from interlock.downstream import _credentials

_KEY = base64.b64encode(bytes(range(32))).decode("ascii")


def _enc(plain, monkeypatch):
    monkeypatch.setenv("INTERLOCK_ENC_KEY", _KEY)
    from interlock.crypto import encrypt_secret
    return encrypt_secret(plain)


def test_credentials_env_bundle(monkeypatch):
    bundle = _enc(json.dumps({"env": {"SLACK_BOT_TOKEN": "xoxb-1", "SLACK_TEAM_ID": "T1"}}), monkeypatch)
    assert _credentials({"auth": bundle}) == {"env": {"SLACK_BOT_TOKEN": "xoxb-1", "SLACK_TEAM_ID": "T1"}}


def test_credentials_bearer_bundle(monkeypatch):
    assert _credentials({"auth": _enc(json.dumps({"bearer": "b-tok"}), monkeypatch)}) == {"bearer": "b-tok"}


def test_credentials_headers_bundle(monkeypatch):
    bundle = _enc(json.dumps({"headers": {"X-Api-Key": "k"}}), monkeypatch)
    assert _credentials({"auth": bundle}) == {"headers": {"X-Api-Key": "k"}}


def test_credentials_legacy_plain_token_is_bearer(monkeypatch):
    # A pre-catalog value: a plain (non-JSON) token encrypted → treated as bearer.
    assert _credentials({"auth": _enc("legacy-token", monkeypatch)}) == {"bearer": "legacy-token"}


def test_credentials_empty():
    assert _credentials({}) == {}
    assert _credentials({"auth": None}) == {}
    assert _credentials({"auth": ""}) == {}
