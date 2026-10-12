# Security review: `docs/research/canada-credit-union-fx-requirements.md` v0.1

**Reviewer:** security-reviewer agent. **Saved by:** main session (the agent has no write tool). **Date:** 2026-10-01.
**Scope:** §1 to §5, the impact table rows 1 to 20 and the cross-cutting implications. Compared with SEC-nn in `reviews/security-review.md`. The research is "not legal advice" and mixes confirmed and **verify** items; the controls below do not depend on the legal answers, so they can be built before those answers arrive.

*Point-in-time snapshot: do not edit after consolidation.*

## Findings

### REG-SEC-01 (High): the restricted compliance channel has no access model
- **Evidence:** research §5 and cross-cutting item 4; rows 8, 9, 20; DL-N27 asks only who may see the field.
- **Risk:** restricted fields could leak through search (FR-43), exports (FR-43/44), audit export, replay of stored decision input, notifications and the decision snapshot.
- **Fix:** separate restricted table or schema with its own DB role and column-level encryption; a dedicated `compliance-restricted` permission that no other role inherits, including Admin (SEC-02); exclude restricted data from search indexes, exports, replay bundles and telemetry; audit every read (SEC-30) with alerts on unusual access; Admin cannot self-grant; general audit holds only the existence of the referral event with IDs.

### REG-SEC-02 (High): tipping-off controls rely on a reason-text lint, but metadata still reveals the referral
- **Evidence:** research §5 recommendations 2 and 5; rows 8 and 20.
- **Risk:** observable side effects tip off without any forbidden word: a changed status, different latency or queue, a missing "escalate" option, a notification, a hold visible to some staff, or an audit event name such as `compliance_referral` visible to a manager.
- **Fix:** make member-visible and staff-visible outcomes indistinguishable from an ordinary decline or review; neutral event names in general audit views; a reserved status value that maps to a generic display state; canary test that no restricted token appears in any non-compliance response, push, email, log or metric (extends INV-LOG-1); reason text as an approved enum, not free text (SEC-16); decide submitter-visible behaviour for "refer to compliance" (DL-N15), since showing it to the submitter may reveal suspicion to a staff member who could be the subject (SEC-25).

### REG-SEC-03 (High): PII in decision snapshots versus retention and purge is unresolved
- **Evidence:** `policy-engine-design.md` stores the full input per decision for replay; research rows 14 and 15 keep PII out of audit but the snapshot holds the input; Quebec s.23 requires destruction or irreversible anonymisation; retention is `[TBD-Stakeholder]`; SEC-32 only partly answered.
- **Risk:** a purge either breaks INV-DET-1 replay or is never done. "Chain unaffected by purge" holds only if the snapshot is not part of the chain hash.
- **Fix:** classify each snapshot field as PII, restricted or non-PII; store PII in a separable table keyed by reference and keep the canonical-input hash in the chain; crypto-shredding with per-record or per-period keys; define replay after purge (verify hash, report "input purged"); retention clock per record type (DL-N20) with legal hold overriding purge; backups on the same schedule or a documented expiry.

### REG-SEC-04 (High): screening integration has no security design
- **Evidence:** row 9, cross-cutting item 1, DL-N16. The engine consumes a "screening clear" fact.
- **Risk:** forged or stale facts (UNKNOWN must block auto-approve, but an injected fact could mark "clear", SEC-28); the vendor receives member and counterparty names (third-party disclosure and cross-border question); match details must not enter general audit or logs; outbound calls are an SSRF and secret surface (SEC-39).
- **Fix:** facts written only by a service identity with provenance (source, timestamp, TTL, signature) and stored with the evaluation input; staleness gives UNKNOWN; allow-listed vendor endpoint with managed identity or mTLS; data-minimisation contract and data-processing agreement with Canadian region and retention terms; fail closed on outage (route to human, never approve); match payloads go only to the restricted store.

### REG-SEC-05 (Medium): sanctions and PEP data handling
- **Evidence:** rows 4, 9, 10; PEP retention "Not found".
- **Risk:** PEP/HIO flags, source-of-wealth references and directive-country flags are sensitive derived data. Lists kept as "parameters" (row 10) could be edited by a rule author to bypass a control (SEC-04, SEC-06).
- **Fix:** treat these facts as restricted-class fields under REG-SEC-01; directive-country list and guardrail inputs are compliance-owned, separately versioned, two-person approved and not editable by rule authors or Admin; log list changes as security events (SEC-37); confirm PEP retention with counsel before storing the first record.

### REG-SEC-06 (Medium): segregation of duties for compliance roles is not specified
- **Evidence:** row 4 ("named senior-management role, not the submitter"); SEC-01 and SEC-03 remain open for new roles.
- **Gap:** no role-conflict matrix covers compliance officer, screening operator, senior-management approver and restricted-field reader. One person could submit, review and clear a screening hit, or approve their own PEP relationship.
- **Fix:** extend the SEC-01 matrix to the new roles, enforced per object (the same user cannot raise and clear a hit or referral); PEP approval by someone other than submitter and reviewer; compliance-role grants need two-person approval and alerts (SEC-02); define coverage for absence so break-glass (SEC-40) is not the routine path.

### REG-SEC-07 (Medium): Quebec cross-border PIA and residency
- **Evidence:** research §3 (Canada Central counts as "outside Quebec" for Quebec members, flagged as inference); DL-N22.
- **Risk:** hosting and every processor (Entra, App Insights, a screening vendor, a notification provider) move personal information outside Quebec. The PIA and written agreement are preconditions, not after-the-fact paper.
- **Fix:** make "Quebec members in scope" a go/no-go gate before REL-1; build a data-flow inventory of every processor and region including telemetry and backups; consider Canada East for the data tier if the PIA is not complete; keep `regulatoryProfile` as configuration and add a per-member province attribute only if needed (minimisation).

### REG-SEC-08 (Medium): breach and incident reporting has no technical hooks
- **Evidence:** row 16; PIPEDA breach records kept 24 months; Quebec register period unverified; BC guideline 72-hour notice of material incidents.
- **Fix:** define the incident event schema, severity mapping and privacy-officer alert path (extends SEC-37, SEC-40); a separately retained breach register with exportable fields for the "real risk of significant harm" assessment; detection covering reads of restricted data and exports (SEC-30); record the awareness timestamp, since notification clocks start at awareness; test the runbook against the strictest timeline pending DL-N26.

### REG-SEC-09 (Low): Quebec s.12.1 transparency conflicts with tipping-off
- **Evidence:** rows 17 and 20.
- **Risk:** a "principal factors" explanation could expose AML factors.
- **Fix:** explanations use the generic approved reason set only; compliance factors stay in the restricted channel; rate-limit and abuse-check the human-review-on-request path because it can probe thresholds (SEC-34, SEC-16); resolve with counsel (DL-N24) before writing member-facing text.

### REG-SEC-10 (Low): research rests on summarised fetches and secondary sources
- **Evidence:** header "Method".
- **Fix:** do not turn an unverified section number or retention figure into a control parameter or schema constraint until compliance confirms it.

## Decisions the product owner must make

1. Who may read restricted compliance fields, whether Admin is excluded, and whether the submitter may see "refer to compliance" (DL-N27, DL-N15; REG-SEC-01, -02).
2. Retention period per record type, purge method (crypto-shredding versus deletion) and replay behaviour after purge (DL-N20, DL-N21; REG-SEC-03).
3. Whether ExchangeFlow calls the screening service or receives its result, the vendor, and fail-closed behaviour (DL-N16; REG-SEC-04).
4. The role-conflict matrix for compliance roles and the two-person rule for compliance grants (REG-SEC-06).
5. Whether Quebec members are in scope, the hosting region, and whether the PIA is a go/no-go gate (DL-N22; REG-SEC-07).
6. The privacy officer, incident-notification owner and target timeline (DL-N23; REG-SEC-08).
7. Whether an auto-decline counts as an exclusively automated decision, and what the member sees (DL-N24; REG-SEC-09).
