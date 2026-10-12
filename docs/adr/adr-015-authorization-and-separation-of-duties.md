# ADR-015: Authorization and separation of duties

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-11; security-review SEC-01..03; decision AZ-10 (in `reviews/`)

## Context

Role changes must be audited in the app, and separation of duties is per object.

## Decision

- Roles and branch scope are held in the app database; Entra authenticates only.
- One central `authorize(actor, action, resource)` driven by a machine-readable permission matrix.
- Server-enforced role-conflict matrix; per-object checks (author ≠ approver; reviewer ≠ submitter); two-person role grants; no self-modification.

## Consequences

- Entra groups may feed assignments through an audited sync that still needs app approval.
