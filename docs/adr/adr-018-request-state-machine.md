# ADR-018: Request state machine

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-05 (in `reviews/`)

## Context

The first lifecycle had unobservable states and no cancel, expiry or escalation limit.

## Decision

- Transition table held as data (from, command, guard, to, roles, reason required).
- Submitted and Evaluated are events. States: DRAFT, UNDER_REVIEW, MORE_INFO_NEEDED, APPROVED, AUTO_DECLINED, DECLINED, COMPLETED, EXPIRED, CANCELLED.
- One escalation per auto-decline, within a window.

## Consequences

- Timings for expiry, cancellation and escalation are TBD with stakeholders (BQ-3/4/5).
