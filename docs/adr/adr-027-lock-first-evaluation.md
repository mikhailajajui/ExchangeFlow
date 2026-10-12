# ADR-027: Lock first, then evaluate (control-row ordering and isolation)

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** `reviews/core-engine-architect.md` CE-ARCH-01/02; `reviews/core-engine-qa.md` CE-QA-01/02; ADR-016

## Context

Design §5.1 evaluates, then takes `FOR SHARE` on the control row at commit and re-evaluates on a revision change. The core-engine plan's pseudocode locked first. Repeatable-read isolation or a retry closure would break the commit-time check.

## Decision

- `submit` and `resubmit` take `SELECT ... FOR SHARE` on the control row at the start of the unit of work at **READ COMMITTED**, then read policy, evaluate and write. Pause and resume take `FOR UPDATE` on the same row and increment `controlRevision`.
- Lock order is fixed and tested: control row, then velocity subject rows, then request row, then audit head row.
- The audit chain uses a single head row and a `SECURITY DEFINER` append function; the `audit_writer` role has no direct insert right. Throughput ceiling is stated and tested.
- This refines ADR-016 and design §5.1 (a named deviation: ADR-016's "re-evaluate once, else ENGINE_PAUSED" path remains only for the case where the lock wait exceeds a budget).

## Consequences

- A pause waits for in-flight submits to commit, then excludes later automated outcomes: INV-PAUSE-1 holds without a statistical race.
- Adds INV-LOCK-ORDER and a deterministic barrier test (failpoints after-lock and before-commit).
