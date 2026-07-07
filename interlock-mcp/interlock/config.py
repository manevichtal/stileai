"""
Central configuration for Interlock, read from environment variables.

Two "stores" are supported (INTERLOCK_STORE):
  file  - local policies.yaml + local JSONL audit log (dev / offline).
  api   - the dashboard's HTTP API is the source of truth (production).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

_BASE = Path(__file__).resolve().parent.parent


def _env(name: str, default: str = "") -> str:
    return os.environ.get(name, default)


@dataclass
class Config:
    store: str
    transport: str

    # file store
    policy_path: Path
    audit_path: Path

    # api store (dashboard)
    dashboard_url: str
    api_key: str
    auth_header: str
    auth_scheme: str
    poll_interval: int
    request_timeout: float
    hold_timeout: float
    verify_tls: bool
    unavailable_effect: str  # what to do if the dashboard can't be reached

    # this checkpoint's own public URL (for self-registration with the dashboard,
    # so each tenant sees its own connect URL). Render sets RENDER_EXTERNAL_URL.
    public_url: str

    # endpoint paths (override to match your dashboard)
    ep_policies: str
    ep_policies_version: str
    ep_audit: str
    ep_approvals: str
    ep_approval_resolve: str  # may contain "{id}"
    ep_register: str
    ep_tools: str
    ep_usage: str

    # enrichment (gateway derives trustworthy policy fields from operator config)
    env: str            # e.g. "prod" — for env-scoped rules
    business_hours: str  # "9-17" local window; used to derive off_hours
    tz: str             # timezone name for the business-hours clock
    freeze: bool        # change-freeze mode (blocks deploys/migrations)

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            store=_env("INTERLOCK_STORE", "file").lower(),
            transport=_env("INTERLOCK_TRANSPORT", "stdio").lower(),
            policy_path=Path(_env("INTERLOCK_POLICIES", str(_BASE / "policies.yaml"))),
            audit_path=Path(_env("INTERLOCK_AUDIT_LOG", str(_BASE / "data" / "audit.log"))),
            dashboard_url=_env("INTERLOCK_DASHBOARD_URL").rstrip("/"),
            api_key=_env("INTERLOCK_API_KEY"),
            auth_header=_env("INTERLOCK_AUTH_HEADER", "Authorization"),
            auth_scheme=_env("INTERLOCK_AUTH_SCHEME", "Bearer"),
            poll_interval=int(_env("INTERLOCK_POLL_INTERVAL", "30")),
            request_timeout=float(_env("INTERLOCK_HTTP_TIMEOUT", "10")),
            hold_timeout=float(_env("INTERLOCK_HOLD_TIMEOUT", "300")),
            verify_tls=_env("INTERLOCK_VERIFY_TLS", "true").lower() != "false",
            unavailable_effect=_env("INTERLOCK_UNAVAILABLE_EFFECT", "deny").lower(),
            public_url=_env("INTERLOCK_PUBLIC_URL", _env("RENDER_EXTERNAL_URL")).rstrip("/"),
            ep_policies=_env("INTERLOCK_EP_POLICIES", "/api/policies"),
            ep_policies_version=_env("INTERLOCK_EP_POLICIES_VERSION", "/api/policies/version"),
            ep_audit=_env("INTERLOCK_EP_AUDIT", "/api/audit"),
            ep_approvals=_env("INTERLOCK_EP_APPROVALS", "/api/approvals"),
            ep_approval_resolve=_env("INTERLOCK_EP_APPROVAL_RESOLVE",
                                     "/api/approvals/{id}/resolve"),
            ep_register=_env("INTERLOCK_EP_REGISTER", "/api/checkpoint"),
            ep_tools=_env("INTERLOCK_EP_TOOLS", "/api/tools"),
            ep_usage=_env("INTERLOCK_EP_USAGE", "/api/usage"),
            env=_env("INTERLOCK_ENV", ""),
            business_hours=_env("INTERLOCK_BUSINESS_HOURS", "9-17"),
            tz=_env("INTERLOCK_TZ", "UTC"),
            freeze=_env("INTERLOCK_FREEZE", "false").lower() == "true",
        )

    def auth_headers(self) -> dict[str, str]:
        if not self.api_key:
            return {}
        value = f"{self.auth_scheme} {self.api_key}".strip() if self.auth_scheme \
            else self.api_key
        return {self.auth_header: value}
