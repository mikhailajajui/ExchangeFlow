# ADR-AZ-2: Messaging

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-validation AV-01, AV-02 (in `reviews/`)

## Context

Service Bus Standard has no private endpoints, and there is no external consumer yet.

## Decision

- Transactional outbox with an always-on relay; no Service Bus.
- Add Service Bus Premium only when an external integration consumer exists.

## Consequences

- Removes a scale-to-zero stall and a cost line.
