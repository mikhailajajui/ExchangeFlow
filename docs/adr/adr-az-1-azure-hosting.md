# ADR-AZ-1: Azure hosting

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-validation AV-08, AV-09; azure-delivery-validation F-03 (in `reviews/`)

## Context

Four validations approved Container Apps with changes.

## Decision

- Azure Container Apps, workload-profiles environment, internal ingress, VNet-integrated; zone-redundant in prod.
- api min 3 replicas in prod; worker always on; jobs for migrate, anchor, expiry, sampling, self-checks.
- App Service (Web App for Containers) is the fallback if IT standardizes on it.
- Separate non-prod, prod and audit subscriptions.

## Consequences

- Zone redundancy and VNet type are fixed at creation.
