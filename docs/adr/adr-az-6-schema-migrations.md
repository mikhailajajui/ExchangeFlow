# ADR-AZ-6: Schema migrations

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-validation AV-07; azure-qa-validation QA-AZ-02 (in `reviews/`)

## Context

Revision traffic splitting runs old and new code against one database.

## Decision

- Expand/contract migrations only.
- Run by a Container Apps manual job with the migrator identity before the new revision.
- Each release rehearsed in test with the previous revision on the new schema.

## Consequences

- Rollback is a traffic shift, which works because the schema stays compatible.
