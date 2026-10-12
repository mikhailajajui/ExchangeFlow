# ADR-012: Audit integrity

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review F-10; azure-security-validation F-AU-01..04 (in `reviews/`)

## Context

Audit must be tamper-evident below the application (FR-44, SEC-10).

## Decision

- Application role has INSERT and SELECT only on audit tables; triggers block UPDATE and DELETE.
- SHA-256 hash chain; signed anchors every 5 minutes to immutable Blob storage in a separate subscription (ADR-AZ-1).
- PII is kept out of audit rows; audit references revisions and hashes.

## Consequences

- A database administrator cannot rewrite history without breaking a signed anchor.
- The immutability policy is locked only after retention is set.
