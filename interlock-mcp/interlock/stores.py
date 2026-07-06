"""
Pluggable storage for Interlock.

Two responsibilities, each with a file-based and an API-based implementation:

  PolicyStore  - where the active policy rules come from.
  AuditSink    - where decisions are recorded and where pending approvals live.

The `api` implementations make the dashboard the source of truth: policies are
pulled from it (with a cheap version check so we don't refetch every time), and
audit entries + pending approvals are pushed to it. If the dashboard is briefly
unreachable, the policy store serves the last-known-good ruleset and NEVER falls
open to "allow" (see PolicyProvider in server.py for the unreachable-on-startup
behaviour).
"""

from __future__ import annotations

import json
import threading
from pathlib import Path
from typing import Any, Protocol

import httpx

from .audit import AuditStore, PendingDecision
from .config import Config

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None


# --- interfaces --------------------------------------------------------------

class PolicyStore(Protocol):
    def version(self) -> str:
        """Cheap identifier of the current ruleset (etag/timestamp/hash)."""
        ...

    def get_policies(self) -> dict[str, Any]:
        """Return the policies dict that engine.load_policies_from_dict expects."""
        ...


class AuditSink(Protocol):
    def record(self, **entry: Any) -> str: ...
    def add_pending(self, pending: PendingDecision) -> None: ...
    def get_pending(self, decision_id: str) -> PendingDecision | None: ...
    def list_pending(self) -> list[PendingDecision]: ...
    def resolve(self, decision_id: str, approver: str, approved: bool,
                note: str = "") -> PendingDecision | None: ...
    def read_log(self, limit: int = 50, actor: str | None = None,
                 effect: str | None = None) -> list[dict[str, Any]]: ...


# --- file implementations ----------------------------------------------------

class FilePolicyStore:
    def __init__(self, path: Path):
        self._path = Path(path)

    def version(self) -> str:
        try:
            return str(self._path.stat().st_mtime_ns)
        except OSError:
            return "0"

    def get_policies(self) -> dict[str, Any]:
        if yaml is None:
            raise RuntimeError("PyYAML is required for the file store")
        if not self._path.exists():
            raise FileNotFoundError(f"policy file not found: {self._path}")
        with self._path.open("r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}


class FileAuditSink:
    """Thin adapter over the existing local AuditStore."""

    def __init__(self, path: Path):
        self._store = AuditStore(path)

    def record(self, **entry: Any) -> str:
        return self._store.record(**entry)

    def add_pending(self, pending: PendingDecision) -> None:
        self._store.add_pending(pending)

    def get_pending(self, decision_id: str) -> PendingDecision | None:
        return self._store.get_pending(decision_id)

    def list_pending(self) -> list[PendingDecision]:
        return self._store.list_pending()

    def resolve(self, decision_id, approver, approved, note=""):
        return self._store.resolve(decision_id, approver, approved, note)

    def read_log(self, limit=50, actor=None, effect=None):
        return self._store.read_log(limit=limit, actor=actor, effect=effect)


# --- api (dashboard) implementations -----------------------------------------

class _Http:
    """Small shared HTTP helper bound to the dashboard base URL + auth."""

    def __init__(self, cfg: Config):
        self._cfg = cfg
        self._client = httpx.Client(
            base_url=cfg.dashboard_url,
            headers=cfg.auth_headers(),
            timeout=cfg.request_timeout,
            verify=cfg.verify_tls,
        )

    def get(self, path: str, **kw) -> httpx.Response:
        return self._client.get(path, **kw)

    def post(self, path: str, **kw) -> httpx.Response:
        return self._client.post(path, **kw)


class ApiPolicyStore:
    """Pulls policies from the dashboard; caches last-known-good."""

    def __init__(self, cfg: Config, http: _Http):
        self._cfg = cfg
        self._http = http
        self._cache: dict[str, Any] | None = None
        self._cache_version: str | None = None
        self._lock = threading.Lock()

    def version(self) -> str:
        # Cheap poll endpoint; fall back to "unknown" so callers refetch.
        try:
            r = self._http.get(self._cfg.ep_policies_version)
            r.raise_for_status()
            data = r.json()
            return str(data.get("version") or data)
        except Exception:
            return self._cache_version or "unknown"

    def get_policies(self) -> dict[str, Any]:
        remote_version = self.version()
        with self._lock:
            if self._cache is not None and remote_version == self._cache_version:
                return self._cache  # unchanged; use cache, no refetch
        try:
            r = self._http.get(self._cfg.ep_policies)
            r.raise_for_status()
            data = r.json()
            with self._lock:
                self._cache = data
                self._cache_version = remote_version
            return data
        except Exception:
            with self._lock:
                if self._cache is not None:
                    return self._cache  # last-known-good
            raise  # nothing cached yet — let caller apply fail-safe


class ApiAuditSink:
    """Sends decisions + approvals to the dashboard and reads them back."""

    def __init__(self, cfg: Config, http: _Http):
        self._cfg = cfg
        self._http = http

    def record(self, **entry: Any) -> str:
        # entry already contains redacted params (server builds it). Fire to the
        # dashboard; if it fails we still return the id so the agent isn't blocked
        # by a logging outage (the decision itself already happened).
        import uuid
        from .audit import redact
        decision_id = entry.get("decision_id") or uuid.uuid4().hex
        payload = dict(entry)
        payload["decision_id"] = decision_id
        if "params" in payload:
            payload["params"] = redact(payload.get("params") or {})
        try:
            self._http.post(self._cfg.ep_audit, json=payload)
        except Exception:
            pass
        return decision_id

    def add_pending(self, pending: PendingDecision) -> None:
        try:
            self._http.post(self._cfg.ep_approvals, json=pending.to_public())
        except Exception:
            pass

    def get_pending(self, decision_id: str) -> PendingDecision | None:
        try:
            r = self._http.get(f"{self._cfg.ep_approvals}/{decision_id}")
            r.raise_for_status()
            return _pending_from_dict(r.json())
        except Exception:
            return None

    def list_pending(self) -> list[PendingDecision]:
        try:
            r = self._http.get(self._cfg.ep_approvals, params={"status": "pending"})
            r.raise_for_status()
            return [_pending_from_dict(d) for d in r.json()]
        except Exception:
            return []

    def resolve(self, decision_id, approver, approved, note=""):
        path = self._cfg.ep_approval_resolve.format(id=decision_id)
        try:
            r = self._http.post(path, json={
                "approver": approver, "approved": approved, "note": note,
            })
            r.raise_for_status()
            return _pending_from_dict(r.json())
        except Exception:
            return None

    def read_log(self, limit=50, actor=None, effect=None):
        params: dict[str, Any] = {"limit": limit}
        if actor:
            params["actor"] = actor
        if effect:
            params["effect"] = effect
        try:
            r = self._http.get(self._cfg.ep_audit, params=params)
            r.raise_for_status()
            return r.json()
        except Exception:
            return []


def _pending_from_dict(d: dict[str, Any]) -> PendingDecision:
    return PendingDecision(
        decision_id=d.get("decision_id", ""),
        actor=d.get("actor", ""),
        action=d.get("action", ""),
        resource=d.get("resource", ""),
        params=d.get("params", {}),
        reason=d.get("reason", ""),
        matched_policy=d.get("matched_policy"),
        approvals_required=int(d.get("approvals_required", 1)),
        status=d.get("status", "pending"),
        approvals=d.get("approvals", []),
    )


# --- factory -----------------------------------------------------------------

def build_stores(cfg: Config) -> tuple[PolicyStore, AuditSink]:
    if cfg.store == "api":
        if not cfg.dashboard_url:
            raise RuntimeError("INTERLOCK_DASHBOARD_URL is required for the api store")
        http = _Http(cfg)
        return ApiPolicyStore(cfg, http), ApiAuditSink(cfg, http)
    # default: file
    return FilePolicyStore(cfg.policy_path), FileAuditSink(cfg.audit_path)
