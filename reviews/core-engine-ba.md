# BA review: `docs/core-engine-plan.md` (v0.1, 2026-10-01)

Reviewer: BA agent. Scope: requirement traceability (plan §10), consistency with `PRD.md` v0.2 and the decision log (`reviews/ba-review.md` §4). Point-in-time snapshot. No other file was edited. Formulas and architecture placement are out of scope; flagged where relevant.

Severity: High = a developer or QA could build or test the wrong thing; Medium = ambiguity or gap that will cause rework; Low = hygiene.

## Summary

| Severity | Count |
|---|---|
| High | 4 |
| Medium | 6 |
| Low | 3 |

## Findings

### CE-BA-01 (High) Plan builds behaviour that the decision log defaults to "not built"
- **Evidence:** Plan §3 and §4 define `cancel`, `expireApprovals`, `lapseEscalations`, `findDueForExpiry`, `findDueForEscalationLapse`; §6.3 says expiry (BQ-3) and escalation window (BQ-5) are "deadline columns plus indexed sweeps"; §7.1 S-07 "escalation once within window", S-12 "expiry and lapse sweeps". `ba-review.md` §4: Q7 default "No timers; aging is shown in the queue; no cancel"; DL-N04 default "once; no time limit". PRD FR-26 (cancel, M, REL-1) and FR-27 (expiry, S, REL-3) are both `[TBD-Stakeholder]`.
- **Consequence:** Under the stated defaults the sweeps and `cancel` do not exist, and S-07/S-12 cannot be written. If the plan is followed, QA tests timers nobody requested.
- **Fix:** Mark these handlers, ports, S-07 (window part) and S-12 as **conditional on Q7/DL-N04/BQ-3/4/5**, and add "default if unanswered: absent" in §3 and §9. Do not let E6/E7 backlog rows assume them.

### CE-BA-02 (High) §10 traces at section level with FR ranges, not requirement level
- **Evidence:** §10 row 1 maps §2/§3 to "PRD FR-10 to FR-19, FR-26, FR-27". That range includes FR-17, FR-18 and FR-19, which §3 does not implement, and omits FR-05, FR-06, FR-07, FR-08, FR-20 to FR-24, FR-28 which §3 handlers (`escalate`, `resubmit`, `complete`, `decide`) do implement. §5 row mapping cites "NFR-04, NFR-07, NFR-09; FR-08, FR-34" but the invariants also implement FR-12/13/14/15 (INV-DET-1, INV-3VL-1), FR-17 (INV-PLACEHOLDER-1, which cites ADR-021 only), FR-23/24 (INV-CONC-1), FR-44 (INV-AUD-1), FR-19 (`KeySigner.hmac`, `VelocityRepository`), FR-60 to FR-64 (`Authorizer`), NFR-02 and NFR-14 (engine budgets, outbox lag).
- **Fix:** Replace §10 with an invariant/port/handler → FR/NFR/UC table (one row each). Add a reverse check: every REL-1 FR in PRD §10 has a handler, invariant or an explicit "not core" note. Include UC IDs (UC-01 to UC-10); §10 has none.

### CE-BA-03 (High) Open decisions are recorded in the plan, not the single decision log
- **Evidence:** Plan §7.3 ("assumption to confirm ... decision for the sponsor in the review summary") and §10 last paragraph (non-deployed hosts gate PRs or run nightly; spike ownership; `AuditChain` vs `KeySigner` port placement). `CLAUDE.md`: "The open questions and decision log live in one place: `reviews/ba-review.md` §4." Plan header: Owner "Technical lead (to be assigned)".
- **Fix:** Log them (proposed IDs below), each with owner, default and blocks. The plan then references the IDs.

| ID (proposed) | Question | Owner | Default | Blocks |
|---|---|---|---|---|
| DL-N28 | Does a host nobody deploys (Functions) gate every PR, or run nightly? | Tech lead, manager | Nightly | P5 CI definition, R24 |
| DL-N29 | Who owns and when is the Functions feasibility spike (P-new-1)? | Manager | Optional capacity It3+; owner unassigned means not started | R23, Option 3 viability |
| DL-N30 | Are `AuditChain` (on `Tx`) and `KeySigner` (outside `Tx`) confirmed as separate ports? | Architect | As drawn in plan §4 | ADR-023 acceptance |

(IDs continue after DL-N08; the regulatory review proposes DL-N09 to DL-N27, so these are DL-N28 to DL-N30. Renumber if the log is assembled in a different order.)

### CE-BA-04 (High) The regulatory research makes the plan's "guardrail inputs" a requirement gap
- **Evidence:** Plan §1 puts regulatory requirements out of scope, but `ConfigProvider`, `EvaluationInput` and `Tx` (§4) have no place for compliance-owned facts (identity-verified, screening-clear, compliance hold, cash flag, directive-country flag). Research §6 "Cross-cutting design implications" item 1 says the guardrail needs them. FR-16 forbids rules from referencing "individual-level fields"; D7 default is "no customer identity data".
- **Consequence:** The port set may need a `ComplianceFactsProvider` (or a context extension) and a restricted-field store/audit view. Retrofitting after INV-DET-1 (full input stored for replay) changes the stored input and the replay gate.
- **Fix:** Add to plan §1 "dependencies on unresolved regulatory decisions" naming DL-N09 and the facts decision; hold E3a input schema as `v1-draft` until the PRD decision on FR-16 vs guardrail facts is made (see `reviews/regulatory-ba.md` REG-BA-05). Architecture placement is for the architect.

### CE-BA-05 (Medium) Identifier collisions: S-xx, P-xx, P1 to P7
- **Evidence:** Plan §7.1 defines scenarios **S-01 to S-13 ("new")**; `ba-review.md` §3.5 already uses S-01 to S-03 for workshop questions (and DL-N03 cites "S-03"). Plan §7.1 "Properties P1–P7" and "P5 and P6 also end-to-end", while §9 row 10 uses **P5** for CI/CD, §9 uses P7, P14, "P-new-1/2/3" for backlog items (`application-project-plan.md` §5: P5 CI/CD, P7 PostgreSQL roles, P14 load test). INV-DET-1 says "DT-01 to DT-41"; the plan does not say where DT-xx are defined beyond "design §11".
- **Consequence:** "S-03" and "P5" are ambiguous in reviews and test reports.
- **Fix:** Rename scenarios to `CS-xx` (conformance scenario) and engine properties to `PROP-1`…`PROP-7` (or "design §11 P1–P7" always prefixed `PE-`). Replace "P-new-n" with real IDs assigned by the plan owner. CLAUDE.md already warns about R1 vs release; same hygiene.

### CE-BA-06 (Medium) FR-07 release placement inconsistent and not flagged
- **Evidence:** PRD §10: REL-1 lists "FR-01–08" and REL-3 lists FR-07. Plan §3 lists `complete` as a handler; §9 places E4/E5/E7 in It2 to It3 with no mention of FR-07 placement.
- **Fix:** Ask the PRD owner to settle FR-07's release; the plan should state which release `complete` ships in. Log as a PRD correction (Low severity upstream).

### CE-BA-07 (Medium) Status of ADR-023/024 and acceptance criteria
- **Evidence:** §9.1: both *Proposed*. §6.3 recommends dropping Durable Functions and "narrows §6 of the Azure proposal"; the plan's header lists the Azure proposal v0.2 (rank 4) as a base, ADRs rank 1.
- **Consequence:** Until accepted, the §5 invariants' "adapter obligations" for Functions have no authority; a developer could treat §6.2 as settled.
- **Fix:** State in §6 that Option 3 content is informative until ADR-023 and ADR-024 are Accepted. Add acceptance criteria for ADR-023 (conformance suite green on ACA host; one other host spike result), so "done" is testable.

### CE-BA-08 (Medium) Testable acceptance statements missing for several invariants
- **Evidence:** INV-OUT-1 "within 10 s of commit" has no PRD source (PRD FR-50/51 say 30 seconds visible to staff/reviewers; NFR-14 says alerts within 5 min). INV-PLACEHOLDER-1 includes "images contain no seed files" without a PRD/ADR line. INV-CONC-1 says `expectedVersion`; FR-23 specifies `409 STALE_REQUEST`.
- **Consequence:** 10 s is an unsourced target (same pattern as the orphans in `ba-review.md` §1.4, DL-N08).
- **Fix:** Add the 10 s relay target to DL-N08-style provisional list; state "10 s relay supports 30 s FR-50/51". Cite FR-23's error code in INV-CONC-1's conformance test.

### CE-BA-09 (Medium) Performance and availability requirements are traced only for NFR-01
- **Evidence:** §6.1 cold start vs NFR-01. NFR-02 (50 ms/200 ms evaluation budget), NFR-03 (availability), NFR-15 (2× peak), NFR-18 (restore drills) appear only in `AppConfig.engine` or not at all. Plan §7.1 says performance is "not a conformance test".
- **Fix:** Add NFR-02/03/15/18 rows to the traceability table, stating which are per-host acceptance (perf environment) vs core.

### CE-BA-10 (Medium) §3 evaluation-retry rule is behaviour, not marked as settled
- **Evidence:** §3: "On a changed revision: roll back, re-read and re-evaluate once; if it changes again, store HUMAN_REVIEW / ENGINE_PAUSED". Source cited: design §5.1. Not independently checked here.
- **Fix:** Confirm the sentence matches design §5.1 and FR-12 cause list; if design differs, design wins (source rank 2). Flag for the architect/QA algorithm pass (out of BA scope).

### CE-BA-11 (Low) "Owner: Technical lead (to be assigned)"
- Unassigned owner on a plan that sequences backlog. Add to DL-N29 or a manager action.

### CE-BA-12 (Low) §9 "Iteration placement" vs PRD §10
- Plan places E9 (BFF session, FR-60) in It2 to It3 while REL-1 spans It2–It4; consistent, but state release for each new item (E2a, P-new-2).

### CE-BA-13 (Low) Terminology
- Plan uses "Option 1/2/3" for hosts; Azure proposal uses ADR-AZ-1 and §4 to §9 names. Add a one-line mapping to avoid "Option" colliding with other option lists in reviews.

## Traceability status of plan content (requirement-level, as far as determinable)

| Status | Count | Notes |
|---|---|---|
| Met (traced to FR/NFR/ADR) | 11 | INV-TX-1, CTRL-1, PAUSE-1, IDEM-1, CONC-1, DET-1, 3VL-1, PLACEHOLDER-1, AUD-1, LOG-1 (source needs listing per CE-BA-02), OUT-1 partly |
| Gap (no requirement or orphan target) | 3 | INV-OUT-1 10 s (CE-BA-08), PROP/CS IDs, FR-07 placement |
| Conflict | 2 | Sweeps/cancel vs Q7 and DL-N04 defaults (CE-BA-01); FR-16 vs compliance facts (CE-BA-04) |
| Open | 3 | DL-N28 to DL-N30 |

## Decisions the product owner must make

1. Accept or reject the Q7 defaults (no timers, no cancel) as the basis for REL-1, or answer BQ-3/4/5 and DL-N04 so the sweeps can be specified.
2. Confirm that portability of non-deployed hosts is protected by nightly (not per-PR) conformance (DL-N28).
3. Name an owner and timebox for the Functions spike, or drop it (DL-N29).
4. Confirm ADR-023/024 acceptance criteria and that Option 3 content is informative only until then.
5. Decide whether the regulatory facts decision (FR-16 vs guardrail facts, REG-BA-05) must be made before E3a freezes the input schema.
