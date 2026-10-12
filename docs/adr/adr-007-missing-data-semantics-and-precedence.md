# ADR-007: Missing-data semantics and precedence

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-02, F-03; qa-review H2 (in `reviews/`)

## Context

A naive `not` on a missing field auto-declines; missing data in shadow rules changed outcomes.

## Decision

- Kleene three-valued logic: missing or ill-typed comparisons are UNKNOWN; only TRUE matches.
- Fixed precedence: ENGINE_PAUSED > ENGINE_ERROR > RULE_REQUIRES_HUMAN > RULE_PAUSED > MISSING_DATA > CONFLICT > single outcome (then GUARDRAIL) > NO_MATCH.
- Shadow rules are evaluated in an isolated pass.

## Consequences

- Out-of-scope rules never cause MISSING_DATA.
- Precedence is one table, tested row by row.
