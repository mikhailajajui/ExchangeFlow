# ADR-AZ-8: Disaster recovery

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-validation AV-17; azure-qa-validation QA-AZ-07 (in `reviews/`)

## Context

RTO and RPO are not yet agreed (AZ-5).

## Decision

- Minimum DR: IaC-redeployable Canada East stack and PostgreSQL geo-restore, with a written runbook.
- Drill twice a year with measured RTO and RPO and audit-chain verification.

## Consequences

- Warm standby is out of scope for REL-1 to REL-4.
- Verify Canada East availability-zone support.
