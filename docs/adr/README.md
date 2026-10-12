# Architecture Decision Records

Each record states its context, decision and consequences. **Proposed** records await review by the technical lead and, where noted, IT, security or compliance. **Accepted** records were decided by the product owner.

To change a decision, add a new ADR that supersedes the old one; do not edit an accepted record.

| ADR | Title | Status |
|---|---|---|
| [ADR-001](adr-001-architecture-style.md) | Architecture style | Proposed |
| [ADR-002](adr-002-primary-datastore-and-job-queue.md) | Primary datastore and job queue | Proposed |
| [ADR-003](adr-003-rule-expression-format.md) | Rule expression format | Proposed |
| [ADR-004](adr-004-rule-storage.md) | Rule storage | Proposed |
| [ADR-005](adr-005-policy-version-and-control-plane.md) | Policy version and control plane | Proposed |
| [ADR-006](adr-006-determinism-and-decision-snapshot.md) | Determinism and decision snapshot | Proposed |
| [ADR-007](adr-007-missing-data-semantics-and-precedence.md) | Missing-data semantics and precedence | Proposed |
| [ADR-008](adr-008-money-representation.md) | Money representation | Proposed |
| [ADR-009](adr-009-time-handling.md) | Time handling | Proposed |
| [ADR-010](adr-010-concurrency-control.md) | Concurrency control | Proposed |
| [ADR-011](adr-011-idempotent-submission.md) | Idempotent submission | Proposed |
| [ADR-012](adr-012-audit-integrity.md) | Audit integrity | Proposed |
| [ADR-013](adr-013-notifications.md) | Notifications | Proposed |
| [ADR-014](adr-014-authentication.md) | Authentication | Proposed |
| [ADR-015](adr-015-authorization-and-separation-of-duties.md) | Authorization and separation of duties | Proposed |
| [ADR-016](adr-016-pause-semantics-and-caching.md) | Pause semantics and caching | Proposed |
| [ADR-017](adr-017-evaluation-time-budget.md) | Evaluation time budget | Proposed |
| [ADR-018](adr-018-request-state-machine.md) | Request state machine | Proposed |
| [ADR-019](adr-019-hosting-and-environments.md) | Hosting and environments | Proposed |
| [ADR-020](adr-020-frontend-stack.md) | Frontend stack | Proposed |
| [ADR-021](adr-021-placeholder-rules-by-environment.md) | Placeholder rules by environment | Accepted |
| [ADR-022](adr-022-resubmission-is-always-human-reviewed.md) | Resubmission is always human-reviewed | Accepted |
| [ADR-023](adr-023-hosting-agnostic-core.md) | Hosting-agnostic core with ports and thin host adapters | Proposed |
| [ADR-024](adr-024-no-durable-functions.md) | No Durable Functions; PostgreSQL is the only request-state store | Proposed |
| [ADR-025](adr-025-guardrail-covers-all-outcomes.md) | Compliance guardrail covers all automated outcomes and reads compliance facts | Accepted |
| [ADR-026](adr-026-restricted-compliance-channel.md) | Restricted compliance channel | Accepted (scope); design Proposed |
| [ADR-027](adr-027-lock-first-evaluation.md) | Lock first, then evaluate | Proposed |
| [ADR-028](adr-028-regulatory-profile.md) | Regulatory profile as configuration | Proposed |
| [ADR-029](adr-029-interim-branch-desk.md) | Interim branch desk, with a scoped deviation from ADR-021 | Accepted |
| [ADR-AZ-1](adr-az-1-azure-hosting.md) | Azure hosting | Proposed |
| [ADR-AZ-2](adr-az-2-messaging.md) | Messaging | Proposed |
| [ADR-AZ-3](adr-az-3-spa-hosting.md) | SPA hosting | Proposed |
| [ADR-AZ-4](adr-az-4-postgresql-configuration.md) | PostgreSQL configuration | Proposed |
| [ADR-AZ-5](adr-az-5-identity-on-azure.md) | Identity on Azure | Proposed |
| [ADR-AZ-6](adr-az-6-schema-migrations.md) | Schema migrations | Proposed |
| [ADR-AZ-7](adr-az-7-in-app-notifications.md) | In-app notifications | Proposed |
| [ADR-AZ-8](adr-az-8-disaster-recovery.md) | Disaster recovery | Proposed |
