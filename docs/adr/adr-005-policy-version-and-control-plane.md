# ADR-005: Policy version and control plane

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-04 (in `reviews/`)

## Context

Mutable mode and state columns on approved rule versions contradicted immutability.

## Decision

- A policy version is an immutable manifest of (ruleVersionId, mode ACTIVE|SHADOW) plus a guardrail version.
- Shadow, activate and retire publish a new policy version.
- Pause is a revisioned `policy_control` row, not a new policy version.

## Consequences

- Lifecycle states are derived views.
- Pause is instant and is snapshotted on every decision.
