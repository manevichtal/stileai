# interlock/enrichment.py
"""Derive trustworthy policy fields from the REAL action + operator config.

Every field here is computed by the gateway, never taken from the agent: the
returned dict overrides any same-named key the agent sent. Used only for policy
evaluation — the real tool call keeps the original args.
"""
from __future__ import annotations

from typing import Any


def _first_recipient(args: dict[str, Any]) -> str | None:
    for k in ("to", "recipient", "email"):
        v = args.get(k)
        if isinstance(v, str) and v:
            return v
        if isinstance(v, list) and v and isinstance(v[0], str):
            return v[0]
    return None


def _recipient_count(args: dict[str, Any]) -> int | None:
    for k in ("recipients", "to", "cc", "bcc"):
        v = args.get(k)
        if isinstance(v, list):
            return len(v)
    if _first_recipient(args) is not None:
        return 1
    return None


def _business_hours(spec: str) -> tuple[int, int] | None:
    try:
        start, end = spec.split("-")
        return int(start), int(end)
    except Exception:
        return None


def enrich(args: dict[str, Any], cfg, usage: dict[str, Any], now_hour: int) -> dict[str, Any]:
    """Return a copy of args with the reserved policy fields ALWAYS set.

    Security-critical: every reserved field below is assigned unconditionally,
    so a value the agent injected into `args` is always overwritten — even when
    there is no signal to derive from (then a safe default of None/0/False is
    used, which does not trip a rule). Conditional assignment would let an agent
    smuggle a field (e.g. has_where=true, env="dev", daily_total=0) whenever the
    trigger data is absent; never do that.
    """
    out = dict(args)  # copy — never mutate the caller's args
    usage = usage or {}

    rcpt = _first_recipient(args)
    out["recipient_domain"] = rcpt.split("@", 1)[1].lower() if (rcpt and "@" in rcpt) else None

    count = _recipient_count(args)
    out["recipient_count"] = count if count is not None else 0

    out["has_where"] = bool(args.get("where") or args.get("filter"))

    out["env"] = cfg.env if getattr(cfg, "env", "") else None

    bh = _business_hours(getattr(cfg, "business_hours", "") or "")
    out["off_hours"] = (now_hour < bh[0] or now_hour >= bh[1]) if bh else None

    out["freeze"] = bool(getattr(cfg, "freeze", False))

    out["actor_action_count_1h"] = usage.get("actor_action_count_1h", 0)
    out["daily_total"] = usage.get("daily_total", 0)
    return out
