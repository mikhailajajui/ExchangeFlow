# ADR-013: Notifications

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-13; azure-architecture-validation AV-01 (in `reviews/`)

## Context

Notifications must never be lost or undo a decision, and the queue is the source of truth.

## Decision

- Outbox row written in the decision transaction.
- Always-on worker relays it to an in-app inbox table; the browser polls every 15–30 s.
- Delivery is at least once; consumers deduplicate by outbox ID; messages carry IDs and codes only.

## Consequences

- No WebSocket service until polling proves too slow (ADR-AZ-7).
