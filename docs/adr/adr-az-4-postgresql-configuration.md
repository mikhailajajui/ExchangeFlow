# ADR-AZ-4: PostgreSQL configuration

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-validation AV-10, AV-11 (in `reviews/`)

## Context

Several PostgreSQL settings cannot change after creation.

## Decision

- Flexible Server, General Purpose or higher in test and prod.
- Private endpoint networking mode with public access disabled, in every environment.
- Zone-redundant HA and geo-redundant backup in prod, set at creation.
- Built-in PgBouncer in transaction mode; Entra authentication only.

## Consequences

- Code avoids session state (use SET LOCAL and transaction-level advisory locks).
- Verify Entra authentication through PgBouncer in the spike.
