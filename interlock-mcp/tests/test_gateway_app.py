import httpx
from starlette.routing import Mount
from interlock.gateway import build_gateway_app


class _Cfg:  # minimal cfg stand-in
    poll_interval = 30
    hold_timeout = 300


def test_gateway_app_mounts_gw():
    app = build_gateway_app([], provider=None, audit=None, cfg=_Cfg())
    assert any(isinstance(r, Mount) and r.path == "/gw" for r in app.routes)


async def test_token_gate_rejects_without_key():
    from interlock import server
    # Wrap a trivial ASGI app so we test the gate, not the gateway internals.
    async def ok(scope, receive, send):
        await send({"type": "http.response.start", "status": 200,
                    "headers": [(b"content-type", b"text/plain")]})
        await send({"type": "http.response.body", "body": b"ok"})

    import os
    os.environ["INTERLOCK_MCP_AUTH_TOKEN"] = "secret-t"
    gated = server._token_gate(ok)
    transport = httpx.ASGITransport(app=gated)
    async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
        assert (await c.get("/gw")).status_code == 401              # no key
        assert (await c.get("/gw?key=secret-t")).status_code == 200  # good key
    del os.environ["INTERLOCK_MCP_AUTH_TOKEN"]
