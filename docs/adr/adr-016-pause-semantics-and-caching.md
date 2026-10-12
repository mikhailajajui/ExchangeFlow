# ADR-016: Pause semantics and caching

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** qa-review H1; security-review SEC-13, SEC-19; architecture-review D6 (in `reviews/`)

## Context

Pausing must never make outcomes more permissive, and must take effect immediately.

## Decision

- A paused rule is still evaluated; any request it would affect goes to HUMAN_REVIEW (RULE_PAUSED).
- Control state is read on every evaluation and never cached; policy content is cached by immutable ID.
- Commit-time guard: `FOR SHARE` on the control row; on revision change re-evaluate once, else ENGINE_PAUSED.

## Consequences

- Invariant: no automated outcome commits after a pause commits.
- Pause is safe, so it can be quick; resume needs an approver, and two people for auto-approve rules.
