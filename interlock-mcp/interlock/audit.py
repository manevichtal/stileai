"""
Audit trail + pending-decision store for Interlock.

Every evaluation is written as one JSON object per line (JSONL) to an append-only
log. Decisions that come back as REQUIRE_APPROVAL are also held in an in-memory
store until a human resolves them, so the approval workflow has something to look
up. The in-memory store is intentionally simple; for real deployments you would
back this with a database (see README).
"""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Parameter keys whose values should never be written to disk in the clear.
_SENSITIVE_KEYS = {
    "password", "passwd", "secret", "token", "api_key", "apikey",
    "authorization", "ssn", "card_number", "cardnumber", "cvv", "pin",
    "private_key", "access_token", "refresh_token",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def redact(params: dict[str, Any]) -> dict[str, Any]:
    """Return a copy of params with sensitive values masked."""
    out: dict[str, Any] = {}
    for key, value in (params or {}).items():
        if key.lower() in _SENSITIVE_KEYS:
            out[key] = "***REDACTED***"
        elif isinstance(value, dict):
            out[key] = redact(value)
        else:
            out[key] = value
    return out


@dataclass
class PendingDecision:
    decision_id: str
    actor: str
    action: str
    resource: str
    params: dict[str, Any]
    reason: str
    matched_policy: str | None
    approvals_required: int
    created_at: str = field(default_factory=_now)
    status: str = "pending"          # pending | approved | denied
    approvals: list[dict[str, Any]] = field(default_factory=list)

    def to_public(self) -> dict[str, Any]:
        d = asdict(self)
        d["params"] = redact(self.params)
        d["approvals_remaining"] = max(
            0, self.approvals_required - self._approved_count()
        )
        return d

    def _approved_count(self) -> int:
        return sum(1 for a in self.approvals if a.get("approved"))


class AuditStore:
    def __init__(self, log_path: str | Path):
        self._log_path = Path(log_path)
        self._log_path.parent.mkdir(parents=True, exist_ok=True)
        self._pending: dict[str, PendingDecision] = {}
        self._lock = threading.Lock()

    # --- writing -------------------------------------------------------------

    def record(self, *, actor: str, action: str, resource: str,
               params: dict[str, Any], effect: str, matched_policy: str | None,
               reason: str, status: str, decision_id: str | None = None
               ) -> str:
        decision_id = decision_id or uuid.uuid4().hex
        entry = {
            "decision_id": decision_id,
            "timestamp": _now(),
            "actor": actor,
            "action": action,
            "resource": resource,
            "params": redact(params),
            "effect": effect,
            "matched_policy": matched_policy,
            "reason": reason,
            "status": status,
        }
        line = json.dumps(entry, ensure_ascii=False)
        with self._lock:
            with self._log_path.open("a", encoding="utf-8") as fh:
                fh.write(line + "\n")
        return decision_id

    # --- pending / approvals -------------------------------------------------

    def add_pending(self, pending: PendingDecision) -> None:
        with self._lock:
            self._pending[pending.decision_id] = pending

    def get_pending(self, decision_id: str) -> PendingDecision | None:
        with self._lock:
            return self._pending.get(decision_id)

    def list_pending(self) -> list[PendingDecision]:
        with self._lock:
            return [p for p in self._pending.values() if p.status == "pending"]

    def resolve(self, decision_id: str, approver: str, approved: bool,
                note: str = "") -> PendingDecision | None:
        """Record one approver's vote and update status when threshold met."""
        with self._lock:
            pending = self._pending.get(decision_id)
            if pending is None or pending.status != "pending":
                return pending
            pending.approvals.append({
                "approver": approver,
                "approved": approved,
                "note": note,
                "at": _now(),
            })
            if not approved:
                pending.status = "denied"
            elif pending._approved_count() >= pending.approvals_required:
                pending.status = "approved"
            return pending

    # --- reading -------------------------------------------------------------

    def read_log(self, limit: int = 50, actor: str | None = None,
                 effect: str | None = None) -> list[dict[str, Any]]:
        if not self._log_path.exists():
            return []
        rows: list[dict[str, Any]] = []
        with self._log_path.open("r", encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if actor and row.get("actor") != actor:
                    continue
                if effect and row.get("effect") != effect:
                    continue
                rows.append(row)
        return rows[-limit:]
