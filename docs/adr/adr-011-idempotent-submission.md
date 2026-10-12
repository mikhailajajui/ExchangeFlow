# ADR-011: Idempotent submission

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-07; security-review SEC-18 (in `reviews/`)

## Context

Retries, double clicks and database failover must not create duplicate requests.

## Decision

- Client generates an idempotency key when the form opens.
- `UNIQUE(submitter_id, idempotency_key)` with a stored payload hash; same payload replays the response, different payload gives 422.

## Consequences

- Keys are kept at least 24 hours.
