# ADR-002: Primary datastore and job queue

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review §2; azure-architecture-validation AV-02 (in `reviews/`)

## Context

The product needs decimals, time zones, row locks, partial unique indexes, append-only grants, an outbox and a job queue.

## Decision

- Managed PostgreSQL 16 (Azure Database for PostgreSQL Flexible Server).
- Outbox and job queue in PostgreSQL using pg-boss. No Redis and no message broker.

## Consequences

- No extra infrastructure to secure and pay for.
- If an external consumer needs events later, add Service Bus Premium behind the outbox (ADR-AZ-2).
