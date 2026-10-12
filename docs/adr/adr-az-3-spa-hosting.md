# ADR-AZ-3: SPA hosting

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** azure-architecture-validation AV-09 (in `reviews/`)

## Context

Static Web Apps would be a second, publicly reachable origin.

## Decision

- The api container serves the SPA behind Front Door.

## Consequences

- One origin, one CSP, simpler cookies.
