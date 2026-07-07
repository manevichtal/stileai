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
    out = dict(args)  # copy — never mutate the caller's args

    rcpt = _first_recipient(args)
    if rcpt and "@" in rcpt:
        out["recipient_domain"] = rcpt.split("@", 1)[1].lower()
    count = _recipient_count(args)
    if count is not None:
        out["recipient_count"] = count

    if any(k in args for k in ("where", "filter", "table")):
        out["has_where"] = bool(args.get("where") or args.get("filter"))

    if getattr(cfg, "env", ""):
        out["env"] = cfg.env

    bh = _business_hours(getattr(cfg, "business_hours", "") or "")
    if bh:
        start, end = bh
        out["off_hours"] = now_hour < start or now_hour >= end

    out["freeze"] = bool(getattr(cfg, "freeze", False))

    for k in ("actor_action_count_1h", "daily_total"):
        if k in (usage or {}):
            out[k] = usage[k]
    return out
