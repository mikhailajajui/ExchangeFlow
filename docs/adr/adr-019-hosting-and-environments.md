# ADR-019: Hosting and environments

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-proposal §10 (in `reviews/`)

## Context

Summary decision; detail in the Azure ADRs.

## Decision

- Single container image on Azure Container Apps in Canada Central (ADR-AZ-1).
- dev, test, perf profile and demo use synthetic data only; production in its own subscription.

## Consequences

- See ADR-AZ-1 to ADR-AZ-8.
