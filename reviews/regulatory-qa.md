# QA review: `docs/research/canada-credit-union-fx-requirements.md` (v0.1)

Reviewer: QA. Date: 2026-10-01. Scope: §6 impact table, §5 tipping-off, cross-cutting implications, certainty flags. Question: can each regulatory requirement become an acceptance criterion with a vector whose expected result is knowable today?

Verdict: the research is honest about uncertainty, but most table rows are design intentions, not testable criteria. The engine as designed cannot yet express several of them (REG-QA-01). Tests must not depend on any numeric value or date below until compliance confirms it as a parameter.

## Testability of the impact table

| # | Requirement | Testable now? | Needs |
|---|---|---|---|
| 1 | ID verification at CAD 3,000 | No | Threshold semantics, conversion, aggregation (DL-N09); vectors in REG-QA-02 |
| 2 | FX ticket | Partly | System of record (DL-N10); then field-presence test on completion |
| 3 | Third party | No | Row says "cash at or above 10,000" but §1.3 says FX alone is not a trigger |
| 4 | PEP/HIO always human | Not as designed | Declines bypass guardrail (REG-QA-01) |
| 5 | Beneficial ownership | After DL-N13 | Scope decision |
| 6-7 | LCTR, EFTR | Flag and reference only | Aggregation window (DL-N14) |
| 8 | STR / refer to compliance | Partly | State machine and visibility tests (REG-QA-04) |
| 9 | Listed person | Not as designed | Auto-decline path (REG-QA-01) |
| 10 | Directive countries | After list parameter exists | Country source |
| 12-14 | Program, 30-day production, retention | Weak | REG-QA-05 |
| 17 | Quebec s.12.1 | No | Legal reading unverified (REG-QA-08) |
| 20 | Tipping-off lint | Partly | REG-QA-03 |

## Findings

**REG-QA-01 [High] The engine cannot enforce several "human-only" rows; guardrail inputs have no vectors and no defined cause.**
Evidence: research §6 rows 4, 8, 9, 10 and cross-cutting §1; `policy-engine-design.md` §4.3 rows 7-9 and L209.
Problem: guardrail row 9 only runs on AUTO_APPROVE (row 8) and "can only downgrade". Row 7 (AUTO_DECLINE) precedes it and is not guardrailed. So "always human review" for PEP/HIO, or "no automated outcome disposes a potential listed-person match", can still end as AUTO_DECLINE by a rule. That contradicts research headline 4/5 (declines are attempted-transaction events; matches must stay with people). Also, new facts (identity-verified, screening result, compliance hold, directive-country, cash, entity) are guardrail inputs, but the design says guardrail is amount, request type and currency. When such a fact is missing, three-valued logic gives UNKNOWN, yet the cause could be `GUARDRAIL` or `MISSING_DATA`; no vector fixes it. A guardrail fact that is TRUE for a PEP but present in a decline-rule case is also undefined.
Fix: ask architect to decide whether guardrails apply to both automated outcomes (rows 7 and 8) and what cause is stored. Then add vectors (new IDs GR-xx, JSON, run through `evaluate` and `POST /requests`):
- GR-01..03 identity-verified true / false / missing at an auto-approvable request over the threshold; expect AUTO_APPROVE / HUMAN_REVIEW(GUARDRAIL) / HUMAN_REVIEW with the chosen cause.
- GR-04..06 same at below threshold; verification irrelevant, so approve.
- GR-07..09 PEP flag true / false / missing with an approve rule and with a decline rule.
- GR-10..12 screening result clear / potential match / missing, with approve and decline rules.
- GR-13 compliance hold set, with approve and decline rules.
- GR-14 directive-country flag, origin and destination.
- GR-15 cash flag with amount at 9,999.99 / 10,000.00 / 10,000.01 once the trigger parameter exists (parameter value from compliance).
- GR-16 entity flag with BO not recorded.
- GR-17 global pause plus any of the above (ENGINE_PAUSED wins, row 1).
- GR-18 shadow rule plus guardrail facts (shadow never reaches guardrail).
- GR-19 resubmission cycle: floor still wins; recorded engine outcome kept.
- Property P7 extension: adding any guardrail fact never turns HUMAN_REVIEW into automated; removing a fact never makes an outcome more automated.
- Precedence check among causes when several guardrail facts fire together (which is stored; whether all are recorded in the restricted field).

**REG-QA-02 [High] Threshold rules (3,000 and 10,000) cannot be given expected results yet.**
Evidence: research §1.2 "Not found" row; §6 rows 1, 6; DL-N09, DL-N14.
Problem: the research says aggregation toward 3,000, non-CAD conversion and window type are not found. Without them, a vector for "USD 2,200 requested" or "two requests of 1,600" has no oracle. Boundary wording is also inconsistent: row 7 says "above threshold", the source says "10,000 or more" (off-by-one at the exact boundary).
Fix: write boundary vectors now for the single-request CAD case only (2,999.99, 3,000.00, 3,000.01; "or more" is inclusive per the source) and mark foreign-currency and aggregated vectors BLOCKED on DL-N09/N14. Require that thresholds are compliance parameters (guardrail version), with a test that changing the parameter changes the outcome without a rule change, and a static check that no rule literal equals a regulatory threshold. State rate source and timestamp for conversion as a recorded fact (stored in the decision input so replay is deterministic).

**REG-QA-03 [High] Reason-text and tipping-off controls are not yet testable as stated ("lint that forbids STR, sanction, PEP, FINTRAC and suspicion terms").**
Evidence: research §5 recs 1-4, §6 row 20; PRD SEC-16 / design L176.
Problems: (a) no term list, no French (Quebec) or synonym coverage, no handling of obfuscation or substrings (e.g. "PEP" inside other words). A lint is a weak control when `reasonText` is already a closed approved set with closed placeholders: the stronger test is that every approved template and placeholder value passes a denylist at publish time and that nothing outside the set can be rendered. (b) The hard rule covers five surfaces (reasonText, staff screens, notifications, telemetry, audit) but only reasonText has a mechanism. (c) Side channels: `fallbackCause` such as `GUARDRAIL` or `MISSING_DATA` versus `NO_MATCH`, shown to staff or in exports, reveals that an indicator fired; "do not reveal which risk indicator fired" is violated unless the visible cause is normalised. (d) Restricted-field leakage by authorisation, export (FR-43/44) and search.
Fix: acceptance tests: (1) template-set scan with an agreed denylist (EN and FR) at publish and in CI; (2) indistinguishability test: for a PEP-routed, a screening-routed, a compliance-hold, and a plain NO_MATCH request, the member-visible and general-staff-visible fields (response body, reason code, text, notification text, status history) are byte-identical, only restricted-role views differ; (3) canary: put a unique token in the restricted field and in screening results, run all commands, assert it never appears in logs, telemetry, notifications, audit rows, exports for non-compliance roles (extends INV-LOG-1); (4) RBAC negative tests for the restricted field per role in the permission matrix (a new Compliance-only permission); (5) snapshot of any numeric limit never shown (design rule).

**REG-QA-04 [High] "Every decline can route to compliance" and "no auto-approve with a hold" have no workflow definition to test against.**
Evidence: research §5 rec 5, §6 row 8; design §3 state machine.
Problem: auto-decline is the end of the automated path; a "refer to compliance" action is a new transition with an actor, a visibility rule and audit event not in the transition table. DL-N15 proposes visibility to "submitter and compliance", but showing the submitter that a request was referred is itself a tipping-off risk and contradicts "no STR flag in general queues". Cancel, expiry and resubmission interplay is undefined (referral on a request that is already escalated; referral after Completed).
Fix: after the architect defines it, tests: referral allowed from each decline path (auto, reviewer) and from each state in the table, forbidden elsewhere (row-by-row transition tests); referral does not change request outcome or timers; actor and permission check; audit event holds IDs only; submitter cannot read the referral; compliance hold blocks automation (GR-13); SoD between referrer and the person who files.

**REG-QA-05 [Medium] Retention, production and monitoring requirements are not measurable.**
Evidence: research §6 rows 12-14, 16.
Problem: "at least 5 years" with a clock start that "differs per record type" cannot be tested without a per-record-type table; "retrieval within 30 days is a design target" has no pass criterion; "annual effectiveness review includes the engine" is a process, not a test. Breach register (24 months) is a process too.
Fix: define a retention table (record type, start event, minimum period, owner) as data; test purge jobs with the injected clock: nothing younger than the minimum is purged, PII purge leaves hash chain verifiable, legal hold blocks purge. For production, set a measurable export target (for example a stated dataset size returned within a stated time in the perf environment) and test export by member, date and reference. Keep process rows out of the automated suite and put them in a compliance checklist.

**REG-QA-06 [Medium] Reporting rows (LCTR, EFTR, STR, LPEPR) reduce to "flag and reference" but the acceptance criteria are not written.**
Evidence: research cross-cutting §2; rows 6-9.
Fix: state that REL-1 acceptance is: required facts are captured, searchable and exported (field-level checklist per report), and that ExchangeFlow files nothing. Test fact capture and export content, not report timing (15 days, 5 working days, "immediately"), which belongs to the filing system. If the sponsor later makes ExchangeFlow the filing system, each deadline becomes a clock-driven test with business-day calendar vectors.

**REG-QA-07 [Medium] Research claims a test plan must not depend on.**
Evidence: certainty flags and §7 gaps.
Do not hard-code or assert in any test fixture until confirmed by compliance or counsel:
- Every threshold and period: 3,000 (ID), 10,000 (cash/EFT/LVCTR), 100,000 (PEP EFT), 25 percent BO, 5 years, 30 days, 15 days, 5 working days, 24 months, 72 hours. They were read through a summarising tool; section numbers (s.86(1)(b), s.12(l), s.144(1), s.152) are flagged verify.
- The 24-hour window type (fixed vs rolling); non-CAD conversion; aggregation of FX requests.
- Penalty amendments "in force 2026-03-26", FINTRAC enrolment, the "very serious violation" wording (secondary).
- LPEPR rules since 2025-10-01 (both LPEPR and STR); SEMA disclosure duty; ministerial directive country list and Russia status; Iran report type.
- All Quebec points (s.12.1, s.17, s.23), Alberta s.13.1, BC breach position, Microsoft data-location terms, deposit-insurer facts.
- Bill C-36 and its content (tabled 2026-06-15): not law; keep out of acceptance criteria.
- "Human-only" statements marked design inference (STR, listed person): fine as product policy, but they are policy decisions, not regulatory fact.
- Header says "Access date 2026-10-01 for every source" yet several pages returned 403 or 404; the status of each source should be listed per URL.
Also note a draft inconsistency: the DL-N09..N27 IDs are said to continue after DL-N08, but `reviews/ba-review.md` shows DL-N01..N05 in use; check that N06-N08 exist before adopting.

**REG-QA-08 [Medium] Quebec and province-specific rows conflict with each other and with settled decisions.**
Evidence: research §6 row 17, §5 rec 4, §6 row 20; ADR-022 and escalation rule.
Problem: row 17 proposes "human review on request without waiting for a window", which changes the settled escalate-once-within-window behaviour; and Quebec s.12.1 (if it applies) gives a right to learn the principal factors, while the tipping-off rule forbids revealing which indicator fired. Both cannot be tested true at once without a defined member-facing text and a rule for which factors may be disclosed. Province-specific rows need a `regulatoryProfile` matrix: each row must say for which profiles it is active.
Fix: ask architect/ba to settle the contradiction first; then test per profile (federal, ON, QC, AB, BC, other) with a profile matrix and a default of the strictest applicable behaviour while DL-N26 is open.

**REG-QA-09 [Low] Row wording defects that would produce wrong acceptance tests.**
Evidence: row 3 (third party "if cash at or above 10,000" yet §1.3 says FX is not in the trigger list: one of the two is wrong for ExchangeFlow); row 7 "above" vs "or more"; row 6 "compliance-set trigger" is a parameter without a name; row 11 "risk rating as a guardrail input" has no scale; row 13 "retrieval within 30 days is a design target" duplicates the regulatory 30 days with no distinction.
Fix: reword each as Given/When/Then with a named parameter.

## Decisions the product owner must make

1. DL-N26 first: provincial or federal, which province. Until answered, tests run against the strictest profile.
2. Do guardrails also cover AUTO_DECLINE (so PEP/screening/hold cases never end in an automated decline)? Recommended yes; this is a design change for the architect.
3. Who owns thresholds (compliance parameters in the guardrail version) and who signs a change? Provide the values only from compliance, never from this research.
4. What does the member see on an auto-decline and on a human-review route (generic text, EN and FR), and may anything about the cause be shown to staff? Resolve against Quebec s.12.1 if Quebec members exist.
5. Is "refer to compliance" in REL-1, and who may see it (compliance only, or also the submitter)?
6. Is ExchangeFlow a filing system for any report, or only a fact provider with export? Sets whether deadline tests exist.
7. Approve the denylist (EN and FR) for reason-text scanning, and who maintains it.
8. Retention table owner and the measurable export target for FINTRAC 30-day production.
9. Must the research be re-verified by primary text (not summaries) before any value enters a spec or fixture? Recommended yes.
