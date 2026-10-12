# ADR-010: Concurrency control

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-06 (in `reviews/`)

## Context

Concurrent reviewers and races between escalate, cancel and decide must not produce two outcomes.

## Decision

- Every command carries `expectedVersion`; zero rows updated gives 409 STALE_REQUEST.
- `UNIQUE(request_id, cycle)` on final review decisions and on decision records.

## Consequences

- Clients show the current state on 409.
