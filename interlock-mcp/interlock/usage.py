"""Fetches per-actor velocity counters from the dashboard (GET /api/usage).

Fail-safe: on any failure returns {} (empty dict). Never raises to the
caller and never fails open. No caching — usage counters must always be
fresh, unlike tools/policy which tolerate a last-known-good cache.
"""
from __future__ import annotations

from typing import Any

import httpx

from .config import Config


class ApiUsageStore:
    def __init__(self, cfg: Config, transport: httpx.BaseTransport | None = None):
        self._cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.dashboard_url,
            headers=cfg.auth_headers(),
            timeout=cfg.request_timeout,
            verify=cfg.verify_tls,
            transport=transport,  # None in prod; MockTransport in tests
        )

    def get_usage(self, actor: str) -> dict[str, Any]:
        try:
            r = self._client.get(self._cfg.ep_usage, params={"actor": actor})
            r.raise_for_status()
            return r.json()
        except Exception:
            return {}
