"""Loads the org's connected downstream tools from the dashboard (GET /api/tools).

Mirrors ApiPolicyStore: caches last-known-good; on any failure returns the cache,
or [] if nothing has ever loaded. Never raises to the caller and never fails open.
"""
from __future__ import annotations

import threading
from typing import Any

import httpx

from .config import Config


class ApiToolsStore:
    def __init__(self, cfg: Config, transport: httpx.BaseTransport | None = None):
        self._cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.dashboard_url,
            headers=cfg.auth_headers(),
            timeout=cfg.request_timeout,
            verify=cfg.verify_tls,
            transport=transport,  # None in prod; MockTransport in tests
        )
        self._cache: list[dict[str, Any]] | None = None
        self._lock = threading.Lock()

    def get_tools(self) -> list[dict[str, Any]]:
        try:
            r = self._client.get(self._cfg.ep_tools)
            r.raise_for_status()
            tools = r.json().get("tools", [])
            with self._lock:
                self._cache = tools
            return tools
        except Exception:
            with self._lock:
                return self._cache if self._cache is not None else []
