# ADR-004: Rule storage

- **Status:** Proposed
- **Date:** 2026-10-01
- **Sources:** architecture-review D2; security-review SEC-23 (in `reviews/`)

## Context

Business approvers need governed, audited rule changes, and pause must not need a deployment.

## Decision

- PostgreSQL is the system of record for rules.
- Rule versions are immutable once approved (trigger-enforced) and content-hashed.
- Files are a seed format only, loaded through the same publish path; the runtime never reads rule files.

## Consequences

- Git is not the source of truth for rules.
- Placeholder seed files are excluded from production images (ADR-021).
