# Architect review: `docs/research/canada-credit-union-fx-requirements.md` (v0.1)

**Reviewer:** architect agent. **Date:** 2026-10-01. **Point-in-time snapshot; main docs not edited.**
**Checked against:** `policy-engine-design.md` §3, §4.1, §4.3 (row 9), §6.1, §7, §9; `PRD.md` FR-19, NFR-07/08/09/10; `docs/adr/` (ADR-006, 012, 015, 016, 018); `docs/core-engine-plan.md` §4-5.
**Scope.** I did not re-verify the legal claims. The research is explicit that most sources were read through a summarising tool and flags secondary sources. I took its Confirmed/Verify flags as given and reviewed only the **design consequences**. Anything I add from background knowledge is labelled **background, verify**.

## Verdict

The impact table is directionally right, and "reporting is mostly outside the engine" is the right boundary. The proposed design changes, however, are listed as input and flag changes. Several of them break existing design properties: the "guardrail only downgrades approvals" rule, the "full input stored for replay" rule, and the single audit chain's visibility. A restricted compliance channel is an architectural subsystem, not a field. Its cost belongs in the plan before REL-1.

| Severity | Count |
|---|---|
| High | 5 |
| Medium | 6 |
| Low | 2 |

---

## High

### REG-ARCH-01 (High): the guardrail (row 9) only downgrades `AUTO_APPROVE`, but the research needs it to gate declines and holds
**Evidence.**
- Design §4.3 rows 7-9: `AUTO_DECLINE` is returned at row 7 with no guardrail step. Row 9 acts only after row 8 (`AUTO_APPROVE`). P7: "guardrail only downgrades".
- Research §6 rows 4, 8, 9, 10: "always human review" for PEP/HIO and potential listed-person match; "no automated outcome when a compliance hold is set"; "decline per directive"; research §5 point 5: every decline, including auto-decline, must be able to reach a compliance suspicion check.
- Design §3: an `AUTO_DECLINED` request lapses to `DECLINED` with no human unless staff escalate.

**Problem.** A sanctions or PEP-related request that matches an auto-decline rule is declined and closed with no human ever seeing it, which is the case the research says is reportable (attempted transaction, listed-person). Nothing in the engine lets compliance force a human on the decline path.
**Required design change.**
1. Run the guardrail over **every** automated outcome. The rule becomes "the guardrail may turn any automated outcome into `HUMAN_REVIEW`, never the reverse" (restate P7 accordingly). Add a property: for any compliance fact set, outcome is never *more* automated than without the guardrail.
2. Extend `GUARDRAIL_VERSION.limits` (a limits object today) into a small typed condition set over a closed list of compliance facts. Evaluate it three-valued: UNKNOWN on a required fact gives `HUMAN_REVIEW`.
3. Add a distinct `fallbackCause` sub-cause for compliance, stored restricted (see REG-ARCH-02). The externally visible cause stays one generic value.
4. Add DT vectors: auto-decline plus hold, auto-decline plus potential match, approve plus missing screening fact, approve plus stale screening fact.

### REG-ARCH-02 (High): "full input stored for replay" and the restricted channel are in direct conflict; compliance facts would leak through the existing outputs
**Evidence.**
- Design §6.1 and ADR-006: `DECISION_RECORD` stores `context_snapshot`, `matched_rules`, `shadow_results`, `fallback_cause`, `reason_code`, `paused_rule_ids`; "The full input is stored on every decision".
- Design §4.1 `Decision` fields `matchedRules`, `unknownRules`, `pausedMatches`, `shadowResults`, `alerts`.
- Research §5 point 2-4 and §6 rows 4, 8-10, 20: never reveal PEP, sanctions, STR or directive routing in reason text, staff UI, notifications or telemetry.
- Core plan §4 `Telemetry`, `rule-metrics` job; design §10.2-10.3 metrics by rule and cause.

**Problem.** Whoever can read a decision record, run the simulator, read the audit export or see rule-level metrics learns that a compliance fact fired. Examples: a context snapshot containing `pepFlag: true`; `matchedRules` listing a rule `PEP-REQUIRES-REVIEW`; `fallbackCause=GUARDRAIL` with a sub-cause; a dashboard of counts by cause. If rule authors may reference compliance facts in ordinary rules (design §6.2), the leak extends to rule keys and shadow results.
**Required design change.**
1. **Partition the context.** `context.general` (today's content) and `context.restricted` (compliance facts, provenance). Separate table, separate grants (or Postgres row-level security), separate encryption key. `contextHash` covers both so INV-DET-1 and replay still work, but replay of restricted decisions requires the compliance role.
2. **Compliance facts are guardrail-only.** The rule schema's field allow-list excludes restricted facts. Rule authors cannot reference them, so matched-rule lists and shadow results cannot leak them. This also keeps compliance logic out of two-person rule governance and in the compliance-signed guardrail.
3. **Project the `Decision`.** Add `visibleOutcome`/`visibleCause` (generic, a single "review required" value) for general readers. Internal sub-causes live in the restricted partition only.
4. **Telemetry and metrics.** Add an explicit deny-list of compliance causes to the allow-list rule (NFR-07), and exclude them from rule-level metrics shown to non-compliance roles. Add a canary test for restricted values (extends core plan S-11).
5. Update the retention model: the restricted partition follows compliance retention (see REG-ARCH-09).

### REG-ARCH-03 (High): compliance facts come from outside the engine, with no provenance, freshness or trust model
**Evidence.** Research §6 "Cross-cutting 1" and rows 1, 4, 9, 11; design §4.1 (`context` built server-side, never client-supplied, SEC-28); ADR-006 (`asOf` injected, no I/O in engine); NFR-01 (2 s p95).
**Problems.**
1. **Source and trust.** "Identity verified", "PEP", "third party" may be keyed by the submitting staff member, a core-system lookup or a screening vendor. A staff-typed attestation is a self-assertion by the person who benefits from approval, which weakens a compliance guardrail. SEC-28's rule against client-supplied facts has no counterpart for attestations.
2. **Freshness.** A screening "clear" from yesterday is not a clear today. The guardrail needs `source`, `reference`, `observedAt` and a maximum age (a compliance parameter), not just a boolean.
3. **Latency and availability.** A screening call in the submit path competes with the 2 s budget and must run **before** the transaction (it must not hold the control lock). If the service is down the fact is UNKNOWN, so every request goes to humans. That is safe but should be an explicit degraded mode with its own alert.
4. **Determinism.** The fact and its provenance must be frozen into `context.restricted` at build time. The engine never calls the screening service, which is already how ADR-006 works. The context builder is the only new I/O.
5. **Sequence.** FINTRAC identification applies "when the transaction takes place" (research §1.2), i.e. at execution, after approval. A rule that requires "identity verified" at submit may be demanding a fact that does not exist yet. The control may belong at **completion**, not at auto-approve.

**Required design change.** Define a `ComplianceFact` value type `{ name, value, source: SYSTEM | STAFF_ATTESTED, ref, observedAt }`, a `ComplianceFactProvider` port (external, called before the transaction, timeout, returns UNKNOWN on failure), and a per-fact max age in the guardrail. Decide per fact whether `STAFF_ATTESTED` is acceptable (product owner, with compliance). Add a completion guard (`COMPLETE` blocked unless the identification reference is present for requests at or above the threshold) as an alternative or addition to the approval-time guardrail.

### REG-ARCH-04 (High): the restricted channel leaks through audit, status, errors and notifications
**Evidence.** Research §5, §6 rows 8 and 20, "Cross-cutting 4"; design §3 (state machine), §5.4 (error codes `INVALID_TRANSITION`, `SOD_VIOLATION`), §6.1 (`AUDIT_EVENT.action, target_type, target_id`); ADR-012 (one chain); ADR-AZ-7 (inbox via outbox); PRD FR-43/44 (audit search, export).
**Problems.**
1. **Audit.** An event named for a referral, hold or screening is visible to anyone who may search or export audit. IDs and hashes only (ADR-012) keeps suspicion text out but not the *existence* of a referral. Existence is the tipping-off risk the research cares about.
2. **State and errors.** If a held request cannot be approved, the reviewer gets `INVALID_TRANSITION` or a missing action. That reveals the hold. A held request also leaves the general queue, so the submitter sees a request stuck "under review".
3. **Outbox and notifications.** Outbox types and inbox messages (ADR-AZ-7) must never carry referral events. Nothing says the outbox type list is a closed allow-list.
4. **Authorization.** ADR-015 grants by role and branch scope. Restricted data needs head-office, per-object visibility: reviewers with branch scope cannot see a referral on a request that is otherwise theirs.
5. **A "refer to compliance" action** is a visible button and a visible audit event for the submitter and, depending on design, colleagues.

**Required design change.**
- Keep one hash chain. Append restricted events with an opaque `action` (for example `RESTRICTED`) and `target_id`; put detail in the restricted store, referenced by `after_hash`. Verification stays possible for everyone. Reading the detail needs the compliance role.
- Model a compliance hold as a **flag on the request**, not a new state: general state stays `UNDER_REVIEW`. Hide the flag in all general projections. Reject commands on a held request with the **same** error and timing as a generic stale or unavailable request.
- Add `COMPLIANCE_REFERRAL` and `COMPLIANCE_HOLD` entities (restricted table, RLS or role grants), a `compliance_officer` role in the permission matrix, and an allow-listed outbox type set.
- Decide the referral UX and who may see it (DL-N15, DL-N27). Make the referral action available on every decline path, but recorded restricted.

### REG-ARCH-05 (High): senior-management approval for PEP/HIO does not fit one review decision per cycle
**Evidence.** Research §6 row 4; design §6.1 `REVIEW_DECISION` with `UNIQUE(request_id, cycle)`; ADR-010; ADR-015 (per-object SoD); ADR-018 (transition table as data).
**Problem.** A PEP/HIO request needs a reviewer decision **and** a senior-management approval. The model allows one final review decision per cycle, and the transition table has one `UnderReview -> Approved` step. Forcing the second approval into the same row either lets one person do both or loses the second approval's audit record. Using a new cycle breaks "cycle = one evaluation or escalation" (design §3.1) and the accuracy metrics.
**Required design change.** Add `approval_requirement` (derived and frozen at decision time, restricted) and `REVIEW_STEP` or `APPROVAL` rows keyed `(request_id, cycle, step)`. Keep `UNIQUE(request_id, cycle)` for the final decision only. Transition guard: `Approved` requires all required steps present and from distinct people with the required role. This needs an ADR-018 change and a new role in ADR-015. Gate on DL-N12 (who is senior management) and DL-N04.

---

## Medium

### REG-ARCH-06 (Medium): CAD-equivalent thresholds, aggregation and key rotation need new derived facts the engine does not have
**Evidence.** Research §1.2 ("Not found: aggregation; non-CAD conversion"), §1.5 (24-hour rule), §6 rows 1, 6; DL-N06 (per-currency thresholds); FR-19 (pseudonymous key, windows TBD); design §9 (counters updated at decision time); core plan CE-ARCH-11.
**Problems.**
1. **CAD equivalent.** Thresholds (CAD 3,000 and 10,000) are in CAD. The engine holds sell and buy amounts in their own currencies and has no rate. A per-currency literal (DL-N06 default) drifts from the CAD amount as rates move. The context builder would need a rate with source and time, frozen into the context, and a rule for which side (cash received, or the amount sold) counts. The research found no source for the conversion rule. Also, LCTR conversion for foreign banknotes uses a Bank of Canada rate (research §1.5), which is not necessarily the FX desk's own rate.
2. **Aggregation.** The 24-hour rule applies to **completed** cash or EFT transactions. ExchangeFlow velocity counters update at **decision time**, include declined and later-cancelled or expired requests, and are never decremented (design §9). Counters for compliance aggregation must be driven from `Completed` with executed values. Fixed vs rolling window is open.
3. **Relationship look-back.** Business relationship starts at a second ID-triggering transaction within **5 years** (research §1.2), while velocity windows are hours or days. A pseudonymous key that rotates (CE-ARCH-11) or exists only for non-members breaks both.
**Required design change.** Add derived facts `cadEquivalent{amount, rateSource, rateAsOf}` and `aggregates{window, count, cadTotal}` to the frozen context. Split **risk velocity** (decision-time, FR-19) from **regulatory aggregation** (completion-time, compliance-owned). Store a `keyVersion` on the pseudonym and support dual-version lookup. Decide whether non-members can be requesters at all (DL-N09/N22). Mark the DL-N06 default unsafe for regulated thresholds, since the research did not find the conversion rule.

### REG-ARCH-07 (Medium): compliance parameters need a fast, monotonic control path like pause
**Evidence.** Research §6 rows 6, 9, 10, 12 (directive-country list as parameter, screening, hold); design §4.3 row 9 and §6.1 (`GUARDRAIL_VERSION` pinned by `POLICY_VERSION.guardrail_version_id`); design §7 (two-person activation); ADR-016.
**Problem.** Guardrail changes are a new `POLICY_VERSION`, which means the full publish, sign-off and activation path. A directive-country list or a sanctions-related restriction may need to change the same day. The slow path is a delay; a bypass would weaken governance.
**Required design change.** Separate **tightening** from **loosening**. Adding a country to the human-review list, or placing a global compliance hold, is monotonically safe, so it can be a single-approver control-plane change like pause (a `compliance_control` row under the same `FOR SHARE` lock, revision bumped, included in the evaluation input and snapshotted). Loosening needs the normal two-person path. Add the property: tightening a compliance parameter never produces a more automated outcome (extends P5/P7).

### REG-ARCH-08 (Medium): "province as configuration" fits for parameters, not for infrastructure, and the region question is unresolved
**Evidence.** Research §2 "Consequence", §3 (Quebec s.17 and hosting region), §6 rows 15, 17, 19, DL-N22, DL-N26; `azure-architecture-proposal.md` (Canada Central; DR region); core plan §1.
**Assessment.** A versioned `regulatoryProfile` fits for: thresholds, retention floors, reason catalogs, provincial regulator contact, breach contacts, enabled guardrail templates, languages. It does **not** fit for: hosting region, backup/DR region, customer-managed keys, third-party register entries. Those are decided per deployment, not per request, and changing them is an infrastructure change.
**Design consequences.**
1. Represent the profile as immutable, versioned, two-person-activated data pinned on the decision (reuse the guardrail pipeline), not environment variables.
2. A single deployment serves **one** profile at a time. Multi-province members, or a Quebec subset in a non-Quebec region, would need per-member profile selection and possibly region split. That is an architectural change; flag it as out of scope until DL-N22 is answered.
3. **Language** (background, verify): Quebec's language law normally requires French service and documents. The research does not cover this. The closed reason-text set and the UI need a locale dimension if Quebec members are in scope. Add a research gap.
4. If hosting moves to Canada East for Quebec, the DR pair (ADR-AZ-8) and the Front Door/identity topology change. Do not defer the DL-N22 answer past the infrastructure iteration.

### REG-ARCH-09 (Medium): retention, purge and replay interact in ways NFR-10 does not yet handle
**Evidence.** Research §1.4 (5 years), §3 (Quebec s.23), §6 rows 13-15; NFR-10; ADR-012; ADR-006 (replay, nightly sample); design §6.1 (context snapshot is personal data).
**Problems.**
1. Retention floors differ per record type and clock start (creation vs closure). One `retain_until` per request is not enough. The restricted partition (REG-ARCH-02) has its own retention.
2. After purge of the context snapshot, replay is impossible. The nightly replay sample (NFR-09) must skip purged records and report the skip, and "any stored decision can be replayed" (NFR-09) needs a qualifier: "within the retention period".
3. There is no purge port or job (see CE-ARCH-03), no legal-hold flag, and no rule on what survives purge (hash and non-PII references only, per ADR-012).
4. Record production to FINTRAC within 30 days (research §6 row 13) needs search by member and reference, but PII is purged from audit by design and the member key is pseudonymous. Search must go through the request and restricted tables.
**Required design change.** Add `retention_class` and `retain_until` on request, decision, restricted record and referral; a `LegalHold` flag; a `RetentionPurger` port with audit of purge actions; qualified replay wording. Keep the DL-N20/N21 answers as inputs.

### REG-ARCH-10 (Medium): new request fields change the intake model and the "fixed field set" default
**Evidence.** Research §6 rows 1-5, 6, 7; PRD FR-01; DL-N05 (default: fixed field set per release); design §4.1 context fields; NFR-07 ("only data the business confirms as necessary").
**Problem.** Payment method (cash or not), third-party flag, entity flag, country of origin and destination, EFT indicator are not in the current context. Each is a field staff must enter, a column, a rule input (for guardrail only, per REG-ARCH-02) and a retention item. Identity details (name, address, date of birth, occupation) should stay in the core system, with ExchangeFlow holding a reference, verifier, method and date. That is the minimum-data position and fits NFR-07, but it depends on DL-N09/N10.
**Required design change.** Default to "reference only" for identity and ticket data. Add the minimum fields behind a versioned request schema, with `schemaVersion` on the revision. Resolve DL-N05 in light of this: a fixed field set per release is workable if releases follow the compliance parameter changes.

### REG-ARCH-11 (Medium): automated-decision transparency changes the escalation guard
**Evidence.** Research §4 (Quebec s.12.1, pending federal), §6 row 17; design §3.1 (escalate once, within window), §5.3; DL-N04, DL-N24.
**Problem.** A member right to human review on request conflicts with "once, within a window" if the window has lapsed. Also, the explanation ("principal factors") must come from replay of the stored input, and that input may now be partly restricted (REG-ARCH-02), so a member-facing explanation must be built from the **general** partition only.
**Required design change.** Add a `memberRequestedReview` escalation path that bypasses the window and the once-only guard but still creates a new cycle, an audit event and a human review. Add an explanation renderer that reads only the general partition and the closed reason-text set. Gate on DL-N24.

---

## Low

### REG-ARCH-12 (Low): the "reason-text lint" is necessary but not sufficient
Research §6 row 20 proposes a lint that forbids STR, sanction, PEP, FINTRAC and suspicion terms. The reason text is already a closed approved set rendered with fixed placeholders (design §4.1), so the check is a publish-time assertion on the catalog. Terms miss paraphrases, so the real control is "no reason code maps to a restricted cause" (REG-ARCH-02 item 3), enforced by the generic projection. **Fix:** assert at publish that restricted causes map to the generic reason, and add canary tests for each restricted fact.

### REG-ARCH-13 (Low): research document hygiene
- It states "does not change the PRD or the design" yet §6 proposes decisions (restricted channel, guardrail inputs, retention). That is correct for status, but the proposed DL-N09 to DL-N27 IDs should be reserved in `reviews/ba-review.md` §4 before other agents use the numbers.
- Section references such as `s.86(1)(b)` and `s.12(l)` are marked verify, so they must not enter any spec text until checked against the consolidated Regulations.
- "Headline 3" and "row 6" assume the core system files LCTR/EFTR. That is unconfirmed (DL-N14). Until it is answered the data model should include the references compliance needs (payment method, cash currency, EFT flag) but no filing logic.

---

## Which design changes the impacts force (summary)

| Change | Where | Driver |
|---|---|---|
| Guardrail covers all automated outcomes; typed, three-valued conditions over compliance facts | Design §4.3, §6.2, P7; `GUARDRAIL_VERSION` | REG-ARCH-01 |
| Context split into general and restricted partitions; `Decision` projected for general readers | Design §4.1, §6.1; ADR-006 consequence | REG-ARCH-02 |
| `ComplianceFactProvider` port, fact provenance and freshness, completion guard | Core plan §4; design §3.2 | REG-ARCH-03 |
| Restricted store, opaque audit events, hold flag, `compliance_officer` role, outbox allow-list | Design §6.1, §7 matrix; ADR-012, ADR-015; ADR-AZ-7 | REG-ARCH-04 |
| Multi-step approval | ADR-018, ADR-010; design §6.1 | REG-ARCH-05 |
| CAD-equivalent and aggregation facts; completion-driven aggregation; pseudonym key version | Design §4.1, §9; FR-19 | REG-ARCH-06 |
| Monotonic compliance control row | Design §5.1, ADR-016 | REG-ARCH-07 |
| Profile as versioned data; infrastructure region as a deployment decision | Design §7; Azure proposal | REG-ARCH-08 |
| Retention classes, legal hold, purge port, qualified replay | NFR-09/10; ADR-012 | REG-ARCH-09 |

**Fit with existing engine properties.** Three-valued logic, pause monotonicity and the "engine computes nothing from the environment" rule all accommodate the new facts if they enter through the frozen context and the guardrail. What does not fit as stated: guardrail-only-downgrades-approve, the unpartitioned stored context, a single-visibility audit view, and one review decision per cycle.

## Decisions the product owner must make

1. **Scope of restriction.** Approve building the restricted compliance channel (partitioned context, restricted store, opaque audit events, hold flag, new role) as part of REL-1 or defer all compliance-driven automation, so auto-approve stays off in production until it exists (REG-ARCH-02, -04).
2. **Guardrail authority.** Confirm the guardrail may force human review on auto-declines, and that compliance facts are guardrail-only and not usable in ordinary rules (REG-ARCH-01, -02).
3. **Trust of facts.** Decide, per fact, whether staff attestation is acceptable or a system source is required, and the maximum age of a screening result (REG-ARCH-03).
4. **Identity check timing.** Approval-time guardrail, completion-time guard, or both (REG-ARCH-03).
5. **PEP/HIO approval.** Confirm the senior-management approver role and accept a multi-step approval model (REG-ARCH-05; DL-N12).
6. **Thresholds.** Accept a CAD-equivalent derived fact with a named rate source, or per-currency literals with a documented drift risk; decide whether regulatory aggregation is in or out of ExchangeFlow (REG-ARCH-06; DL-N06, DL-N14).
7. **Compliance controls speed.** Approve single-approver tightening and two-person loosening for compliance parameters (REG-ARCH-07).
8. **Province, region and members.** Answer DL-N26 and DL-N22 first; confirm one profile per deployment; decide whether Quebec members (and French-language service) are in scope (REG-ARCH-08).
9. **Retention.** Provide periods, clock starts and legal-hold rules (DL-N20/N21), and accept that replay is available only within retention (REG-ARCH-09).
10. **Member review right.** Decide whether a member can require human review of an auto-decline outside the escalation window (REG-ARCH-11; DL-N24).
11. **Legal check.** Have compliance or counsel confirm every item flagged verify or Not found before any value or section number enters the PRD or design (REG-ARCH-13).
