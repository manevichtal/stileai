"""
Interlock policy engine.

The engine evaluates a proposed *action* against an ordered list of *policies*
and returns a decision: ALLOW, DENY, or REQUIRE_APPROVAL. It is deliberately
simple, deterministic, and free of `eval` — conditions are structured data, not
code — so it is safe to feed rules from a file an operator edits.

An "action" is described by four fields plus free-form parameters:
    actor     - who/what is asking (e.g. "agent:support-bot", "user:alice")
    action    - the verb (e.g. "email.send", "db.delete", "payment.charge")
    resource  - what it touches (e.g. "customer:1234", "table:orders")
    params    - a dict of extra detail the rules can inspect (e.g. {"amount": 5000})

Matching uses shell-style globs (fnmatch) on actor/action/resource so rules can
be broad ("db.*") or narrow ("payment.charge"). Parameter conditions are
explicit comparisons. Rules are evaluated in ascending `priority` order and the
first match wins; if nothing matches, the file-level `default_effect` applies.
"""

from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass, field
from enum import Enum
from typing import Any


class Effect(str, Enum):
    ALLOW = "allow"
    DENY = "deny"
    REQUIRE_APPROVAL = "require_approval"


# Comparison operators available to parameter conditions. Keeping this an
# explicit table (rather than eval) is what makes operator-authored rules safe.
_OPS = {
    "eq": lambda a, b: a == b,
    "ne": lambda a, b: a != b,
    "gt": lambda a, b: a is not None and a > b,
    "gte": lambda a, b: a is not None and a >= b,
    "lt": lambda a, b: a is not None and a < b,
    "lte": lambda a, b: a is not None and a <= b,
    "in": lambda a, b: a in b,
    "not_in": lambda a, b: a not in b,
    "contains": lambda a, b: b in a if a is not None else False,
    "regex": lambda a, b: a is not None and re.search(b, str(a)) is not None,
    "exists": lambda a, b: (a is not None) == bool(b),
}


@dataclass
class Condition:
    field: str
    op: str
    value: Any = None

    def matches(self, params: dict[str, Any]) -> bool:
        if self.op not in _OPS:
            raise ValueError(f"unknown condition operator: {self.op!r}")
        actual = params.get(self.field)
        try:
            return bool(_OPS[self.op](actual, self.value))
        except TypeError:
            # e.g. comparing a string amount with a number — treat as no-match
            # rather than crashing the whole evaluation.
            return False


@dataclass
class Policy:
    id: str
    effect: Effect
    description: str = ""
    actor: str = "*"
    action: str = "*"
    resource: str = "*"
    priority: int = 100
    conditions: list[Condition] = field(default_factory=list)
    # A rule can require that N approvers sign off (only meaningful for
    # require_approval). Defaults to 1.
    approvals_required: int = 1

    def matches(self, actor: str, action: str, resource: str,
                params: dict[str, Any]) -> bool:
        if not fnmatch.fnmatch(actor, self.actor):
            return False
        if not fnmatch.fnmatch(action, self.action):
            return False
        if not fnmatch.fnmatch(resource, self.resource):
            return False
        # ALL conditions must hold for the rule to match.
        return all(c.matches(params) for c in self.conditions)


@dataclass
class Decision:
    effect: Effect
    matched_policy: str | None
    reason: str
    approvals_required: int = 0

    @property
    def allowed(self) -> bool:
        return self.effect == Effect.ALLOW


class PolicyEngine:
    def __init__(self, policies: list[Policy],
                 default_effect: Effect = Effect.REQUIRE_APPROVAL,
                 default_reason: str = "No policy matched; default applied."):
        # Evaluation order: lowest priority number first ("priority" == urgency).
        self._policies = sorted(policies, key=lambda p: p.priority)
        self._default_effect = default_effect
        self._default_reason = default_reason

    @property
    def policies(self) -> list[Policy]:
        return list(self._policies)

    def evaluate(self, actor: str, action: str, resource: str,
                 params: dict[str, Any] | None = None) -> Decision:
        params = params or {}
        for policy in self._policies:
            if policy.matches(actor, action, resource, params):
                reason = policy.description or f"Matched policy {policy.id}."
                approvals = (policy.approvals_required
                             if policy.effect == Effect.REQUIRE_APPROVAL else 0)
                return Decision(
                    effect=policy.effect,
                    matched_policy=policy.id,
                    reason=reason,
                    approvals_required=approvals,
                )
        approvals = 1 if self._default_effect == Effect.REQUIRE_APPROVAL else 0
        return Decision(
            effect=self._default_effect,
            matched_policy=None,
            reason=self._default_reason,
            approvals_required=approvals,
        )


# --- Loading -----------------------------------------------------------------

def _coerce_effect(value: str) -> Effect:
    try:
        return Effect(str(value).lower())
    except ValueError as exc:
        raise ValueError(
            f"invalid effect {value!r}; use allow / deny / require_approval"
        ) from exc


def load_policies_from_dict(data: dict[str, Any]) -> PolicyEngine:
    """Build an engine from a parsed policies file (see policies.yaml)."""
    default_effect = _coerce_effect(data.get("default_effect", "require_approval"))
    default_reason = data.get(
        "default_reason", "No policy matched; default applied."
    )
    policies: list[Policy] = []
    for raw in data.get("policies", []):
        conditions = [
            Condition(field=c["field"], op=c["op"], value=c.get("value"))
            for c in raw.get("conditions", [])
        ]
        policies.append(Policy(
            id=raw["id"],
            effect=_coerce_effect(raw["effect"]),
            description=raw.get("description", ""),
            actor=raw.get("actor", "*"),
            action=raw.get("action", "*"),
            resource=raw.get("resource", "*"),
            priority=int(raw.get("priority", 100)),
            conditions=conditions,
            approvals_required=int(raw.get("approvals_required", 1)),
        ))
    return PolicyEngine(policies, default_effect, default_reason)
