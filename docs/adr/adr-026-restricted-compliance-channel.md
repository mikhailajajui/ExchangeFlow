# ADR-026: Restricted compliance channel

- **Status:** Accepted as scope (product owner, 2026-10-01: built in REL-1). Design details Proposed.
- **Date:** 2026-10-01
- **Sources:** research §5 and §6; `reviews/regulatory-architect.md` REG-ARCH-02/04/05; `reviews/regulatory-security.md` REG-SEC-01/02/03/06; `reviews/regulatory-manager.md` REG-MGR-04

## Context

Some outcomes and facts must not be visible to ordinary staff, reviewers or members, so that a suspicion, screening match or politically-exposed-person determination is not tipped off. The law's offence concerns disclosing a suspicious transaction report with intent to prejudice an investigation (verify with counsel); the design recommends a stricter product rule.

## Decision

- **Partitioned context.** Evaluation input is split into a general part and a restricted part. Compliance facts and restricted reasons live only in the restricted part and in a separate restricted store with its own database role and column-level encryption.
- **Projection for general readers.** `Decision` records read by staff, reviewers, managers, search, exports, notifications and telemetry are projected from the general part: restricted fallback causes appear as generic `HUMAN_REVIEW`. Restricted topics (STR, suspicion, sanctions, listed person, PEP, FINTRAC) never appear in `reasonText`, staff screens, notifications or telemetry; reason text is an approved enum (EN and FR), not free text.
- **Referral.** A "refer to compliance" action exists on every decided, declined or cancelled request. It is visible only to compliance and the referrer's own confirmation is generic. A hold flag keeps referred requests in a neutral display state.
- **Role.** A `compliance-restricted` permission, held by a compliance officer role that no other role inherits (including administrator), with the role-conflict matrix extended (a person cannot raise and clear the same hit or referral; PEP approval is never the submitter or reviewer). Compliance grants need two-person approval.
- **Audit.** Opaque event names in the general chain; every read of restricted data is audited and alerts on unusual access. The chain holds IDs and hashes only.
- **Multi-step approval.** Senior-management approval of a PEP/HIO relationship is a separate approval record (not the review decision per cycle).
- **Purge.** PII and restricted data are separable and can be deleted or crypto-shredded without breaking the chain; replay after purge verifies the hash and reports "input purged".
- Reporting (LCTR, EFTR, STR, LPEPR) stays with compliance and the core system; ExchangeFlow stores flags, references and timestamps and provides an export (default of DL-N15).

## Consequences

- New role, store, queue, permission-matrix rows and a leak-path test suite (canary values across responses, notifications, logs, metrics, exports and search).
- Estimated 8 to 13 points; the product owner scheduled it in REL-1, which extends REL-1. Production auto-approve and auto-decline stay off until this channel and a named source for each fact exist.
- Amends `policy-engine-design.md` §6.1, §7 and the permission matrix.
