# Delivery review: `docs/research/canada-credit-union-fx-requirements.md` v0.1 (manager)

**Reviewer:** manager (delivery lead). **Date:** 2026-10-01. **Snapshot review**; does not edit the research or main docs.
**Compared with:** `application-project-plan.md` v0.3 (§5, §6, §9 R1–R21, §12), `application-elaboration-plan.md`, `azure-architecture-proposal.md` (AZ-2, AZ-5, §14), `PRD.md` NFR-08, NFR-10, `reviews/ba-review.md` §4 (DL-N01 to DL-N08).

**Caution on the source:** the research read most pages through a summarising tool, many sources are secondary and flagged **verify**, and several are "Not found". It is a planning input, not a baseline. Everything below treats its findings as scope questions, not as legal requirements. No thresholds are added here.

**Estimation assumptions (flagged, unconfirmed):** team 2–3 people; 1 point is about 1 to 1.5 person-days; iterations are 2 weeks; external lead times (compliance, counsel, vendor procurement) are guesses and dominate the plan.

## Verdict

The research does not change the architecture. It adds **one new role and store (restricted compliance channel)**, **a set of compliance-owned guardrail facts**, **a handful of cheap rules for REL-1**, and **19 stakeholder questions** that are mostly answered by people the project plan does not yet name (compliance officer, privacy officer, counsel). The main delivery risk is not engineering effort; it is **stakeholder and counsel availability** and **province-dependent unknowns**. The plan stays feasible only if the questions are tiered and a default of "ExchangeFlow records and routes; it does not file reports" is accepted.

## Findings

### REG-MGR-01 · High · DL-N26 (province, federal or provincial) blocks scope and must be a REL-0 exit criterion

- **Evidence:** research headline 1 and §6 row 19 ("blocks everything marked Province-specific"); §2 "keep a `regulatoryProfile`". Project plan §12 (end of REL-0) does not mention regulator, province or compliance owner.
- **Impact:** the answer decides privacy regime (PIPEDA vs AB/BC/QC), outsourcing guidance (DL-N25), deposit insurer, retention periods, Quebec automated-decision rule (DL-N24), and hosting region (DL-N22). Region matters only at the production build (non-prod uses synthetic data, NFR-08; AZ-2 is "Provisional It1; confirmed before prod build", azure proposal §14), so it does not block REL-1, but it is a creation-time setting (R20) and drives the allowed-locations policy and DR plan.
- **Fix:** add to the REL-0 go/no-go: (a) DL-N26 answered; (b) a named compliance officer and privacy officer (extends item 4, "product owner, policy owner and platform owner are named"). Add `regulatoryProfile` as configuration, designed in E2 or E3 (about 2 points). Do not start provincial-specific design (Quebec, outsourcing notifications) until answered.

### REG-MGR-02 · High · Reporting ownership (DL-N14, DL-N15, DL-N16) must be settled; default to "ExchangeFlow does not file"

- **Evidence:** research §1.5 deadlines (LCTR 15 days, EFTR 5 working days, STR "as soon as practicable", LPEPR "immediately"); cross-cutting implication 2 ("reporting is mostly outside the engine"); project plan §3 says the app does not replace existing transaction, identity and compliance systems.
- **Impact:** if nobody owns a trigger, a statutory deadline can be missed because a request moved through ExchangeFlow; if ExchangeFlow is asked to file, REL-1 to REL-4 gain a FINTRAC integration, credentials, evidence retention and an operational on-call for reportable events (not planned anywhere). Filing integration estimate: 8 to 15 points per report type plus FINTRAC onboarding (assumption) and would likely push REL-3.
- **Fix:** adopt as the planning default (needs product owner and compliance confirmation): ExchangeFlow stores flags, references and timestamps and provides an export (FR-43/44); compliance and the core system own LCTR/EFTR/STR/LPEPR filing. Add a **documented handoff procedure** (who sees a referred request, within what time) as a pilot go/no-go criterion. Revisit only if compliance asks for filing; then treat as a new release item with an ADR.

### REG-MGR-03 · High · Screening integration and the "screening clear" fact gate the first auto-approve

- **Evidence:** research §6 row 9 ("auto-approve guardrail requires a 'screening clear' fact from the screening source"); cross-cutting implication 1; project plan §12 (end of REL-3: "first low-risk category active").
- **Impact:** without a trustworthy screening fact, no auto-approve can be activated in production. A staff-typed "screening clear" checkbox is an attestation, not screening; using it silently weakens the guardrail. A vendor or list-service integration needs procurement and security review (assumption: 8 to 16 weeks elapsed, 8 to 13 points to integrate).
- **Fix:**
  1. Add a pilot go/no-go criterion: DL-N16 answered and the source of each guardrail fact (identity-verified, PEP/HIO, screening, directive country, cash, entity, compliance hold) is documented with its provenance (system, actor, timestamp).
  2. Model each fact as tri-state (true, false, UNKNOWN) with provenance, from REL-1 (schema only, about 3 points). The three-valued logic already routes UNKNOWN to a human.
  3. For REL-3, allow an interim of "auto-approve only for requests where the screening fact comes from a named system"; if no such source exists by REL-3, REL-3 activates auto-decline or shadow only, and pilot proceeds with human review for approvals. State this fallback now so it is not a surprise at It8.
  4. Do not build a vendor integration before DL-N16 is answered.

### REG-MGR-04 · High · The restricted compliance channel is new scope with a new role; schedule it before any production auto-decision

- **Evidence:** research §5 recs 3 and 5, §6 rows 8, 9, 10, 20, cross-cutting implication 4. Project plan §8 has "Compliance" as a co-signing role but no application role, no queue and no restricted audit view. PRD FR-60 role conflict matrix and permission matrix in `policy-engine-design.md` do not include it (per CLAUDE.md source ranking: design wins; changes need architect).
- **Impact:** needs a compliance role (and conflicts with submitter, author and approver), a separate store and queue, a "refer to compliance" action on every decline path (auto and reviewer), restricted audit visibility, and a no-leak rule across reason text, staff UI, notifications and telemetry (INV-LOG-1). Estimated 8 to 13 points (new item E19, assumption), plus security review and a permission-matrix change.
- **Fix:**
  1. REL-1 (cheap, do now): reason-text allow-list and lint forbidding restricted terms (about 2 points; extends the SEC-16 allow-list); add `complianceHold` as a nullable fact (part of REG-MGR-03).
  2. REL-2: E19 restricted compliance channel (role, restricted field, refer action, restricted audit view), designed with E12 guardrail work. Architect settles data model and matrix first; security reviews the leak paths.
  3. Gate: no auto-decline active in production without the refer route (go/no-go, REL-3).
  4. Because REL-2 is already full (see REG-MGR-06), the likely cost is one extra iteration.

### REG-MGR-05 · Medium · Research confidence is low in places; counsel review must be a scheduled dependency

- **Evidence:** "Method" row and the research gaps table (§7): primary text not fetched for SEMA, JVCFOA, UN Act regulations, s.83.08, Quebec Act sections; the 2026-03-26 penalty amendments and FINTRAC enrolment are "verify"; ministerial directives page returned 404.
- **Fix:** schedule a counsel or compliance review of the research as a REL-0 task (suggested 3 to 5 working days of counsel time, assumption) with output "confirmed / corrected / unknown" per row. Until done, no value from this research enters PRD requirements; only the questions do. Do not put the 3,000 or 10,000 figures into rules or code as literals (research already says: compliance parameters).

### REG-MGR-06 · Medium · Iteration plan impact: REL-2 overload and one-iteration slip

- **Evidence:** project plan §6: It5 (governance, pause, guardrail) and It6 (shadow report, inbox, step-up, Front Door/WAF, anchor job, AZ-5/AZ-13/NFR-10 decisions) are already full.
- **Fix (recommended):**
  - REL-1 (It2–It4): add `regulatoryProfile` (2), tri-state guardrail fact fields and provenance (3), reason-text lint (2): about 7 points. Combined with the core-engine plan's additions (see `reviews/core-engine-manager.md` CE-MGR-01/02) this makes four iterations (It2–It5) the realistic REL-1 plan at 2 people.
  - REL-2: add E19 (8 to 13) and the expanded guardrail inputs in E12 (about +3); add compliance co-sign review to E11. Extend REL-2 to three iterations.
  - REL-3: screening fact source (attested interim 3 points, or vendor integration 8 to 13 plus procurement), refer-to-compliance gate, identity-verification fact, Quebec transparency if applicable (3), compliance export (3).
  - REL-4: counsel sign-off on the pilot scope, privacy impact assessment approved (already §12), annual effectiveness-review hook (process, not code).
  - Net: total regulatory-driven additions about 25 to 35 points excluding any vendor integration (assumption), roughly 5 to 8 person-weeks. Expect the pilot to move by about one to two iterations versus plan v0.3.

### REG-MGR-07 · Medium · Nineteen new questions need tiering; the BA and compliance bandwidth is the bottleneck

- **Evidence:** research §7 lists DL-N09 to DL-N27; project plan R9 (no business owner) and R14 (policy criteria late) are already High-likelihood.
- **Fix:** answer in three tiers, recorded in `reviews/ba-review.md` §4 by the BA (the owner of the log):
  - **Tier 1, before REL-0 exit:** DL-N26 (province), DL-N14 (who files LCTR/EFTR), DL-N15 (suspicion routing and who files), DL-N16 (screening source), DL-N10 (system of record for the FX ticket and whether ExchangeFlow holds references only), DL-N09 (where ID verification is recorded; per request or aggregated).
  - **Tier 2, before REL-2 design freeze:** DL-N12 (senior-management approver), DL-N17 (directive countries), DL-N18 (member risk rating), DL-N27 (who sees the restricted field), DL-N13 (entity requests in scope), DL-N19 (program documentation).
  - **Tier 3, before the pilot go/no-go:** DL-N20, DL-N21 (retention; extends BQ-7 and NFR-10, also AZ-5 and the immutability lock), DL-N22 (Quebec members and region), DL-N23, DL-N24, DL-N25, DL-N11.
  - Proposed defaults, to be confirmed: reference-only for identity and ticket data (consistent with R3 minimal data); no entity requests until DL-N13 is answered; human review for any third-party or PEP indication.

### REG-MGR-08 · Medium · New risks (R27 onward; R22–R26 are reserved by the core-engine plan and its review)

| ID | Category | Risk | P / I | Owner | Mitigation and trigger |
|---|---|---|---|---|---|
| R27 | Compliance | Province or regulator profile unknown or changes, forcing rework of retention, privacy, hosting or reason text | High / High | Compliance + sponsor | `regulatoryProfile` as config; DL-N26 in REL-0 exit. *Trigger:* DL-N26 unanswered at end of It1 |
| R28 | Compliance / Delivery | Compliance officer, privacy officer or counsel not available; 19 questions and research verification stall | High / High | Sponsor | Tiering (REG-MGR-07); named officers in REL-0 exit; counsel review scheduled. *Trigger:* Tier 1 unanswered after It2 |
| R29 | Compliance | No owner for a reportable trigger; a statutory deadline missed after a request passes through ExchangeFlow | Medium / High | Compliance | Default "ExchangeFlow does not file"; handoff procedure in pilot go/no-go. *Trigger:* DL-N14/15 unanswered by REL-2 |
| R30 | Delivery / Integration | Screening source unavailable or late; no safe auto-approve in REL-3 | Medium / High | Compliance + project lead | Tri-state fact with provenance; shadow-only fallback for approvals. *Trigger:* DL-N16 unanswered at start of It6 |
| R31 | Security / Compliance | Tipping-off or restricted-topic leakage via reason text, staff UI, notifications or telemetry | Medium / High | Security owner | Allow-list and lint (REL-1); E19; canary test (INV-LOG-1 pattern). *Trigger:* any restricted term in a non-restricted field |
| R32 | Compliance | Legislation moves (2026-03-26 amendments, FINTRAC enrolment, Bill C-36) after design decisions | Medium / Medium | Compliance | Parameters not literals; effectiveness review includes the engine; re-read research each release. *Trigger:* new regulator notice |

Re-rate **R12** (regulation restricts automation) from Medium/High to **High/High** and link it to R27 and R29.

### REG-MGR-09 · Medium · New go/no-go criteria (additions to `application-project-plan.md` §12)

**End of REL-0, add:**
1. DL-N26 answered; compliance officer and privacy officer named.
2. Tier 1 questions (REG-MGR-07) answered or a signed default accepted.
3. Counsel or compliance review of the research scheduled with a date.

**End of REL-3 (pilot), add:**
1. Reporting ownership documented per trigger (LCTR, EFTR, STR, LPEPR), with handoff times.
2. Source and provenance of every guardrail fact documented; screening source named (or approvals stay human-reviewed).
3. Restricted compliance channel live; refer route on every decline path; no restricted term in non-restricted fields (canary test passed).
4. Retention (NFR-10) set with the 5-year floor as a published minimum, provincial rules checked; PIA approved; region decision (AZ-2) final including any Quebec decision (DL-N22).
5. Compliance co-sign on every guardrail change (already for regulated classes, §10).

**End of REL-4, add:** counsel sign-off on pilot scope; effectiveness-review plan includes the engine (DL-N19).

### REG-MGR-10 · Medium · Data collection conflicts with the minimal-data principle (R3)

- **Evidence:** research §6 row 2: at CAD 3,000 or more the ticket holds requester name, address, DOB and occupation; project plan R3 and PRD NFR-08/PII-out-of-audit rule.
- **Fix:** keep the default of references to the core system (DL-N10); do not add those four fields to the request model unless DL-N10 says ExchangeFlow is the system of record. If it is, that is a scope change with security review (PII store, purge design, NFR-10) and likely one more iteration. Decide before E3/E4 freeze the request fields in REL-1 (ADR-018 revision).

### REG-MGR-11 · Medium · Aggregation questions (thresholds, 24-hour rule) may pull velocity (E15) forward

- **Evidence:** research §1.2 "Not found" (aggregation toward 3,000; non-CAD conversion), §6 row 6 (24-hour aggregation using FR-19 velocity facts); E15 is REL-3 and "needs Q5".
- **Fix:** default is flag-only in ExchangeFlow (DL-N14). If aggregation is required in ExchangeFlow, move E15 earlier and add pseudonymous key design to REL-2. Do not commit until counsel answers the aggregation gap. Estimate if pulled forward: no new points, but dependency change (E15 before activation).

### REG-MGR-12 · Low · Quebec-specific items should wait for DL-N22 and DL-N24

- **Evidence:** research §3 (PIA before data leaves Quebec; Canada Central is "outside Quebec" by inference), §4 (s.12.1, secondary only).
- **Fix:** do not build member-facing explanation or "human review on request" until DL-N24 is answered; staff submit on behalf of members, so the workable first step is a staff script (process). If Quebec members exist, evaluate Canada East as primary (DR is already planned there; swap is cheap only before the prod build, R20).

### REG-MGR-13 · Low · The research doc has a status disclaimer; keep it out of the PRD until reviewed

- **Evidence:** header "does not change the PRD or the design".
- **Fix:** record the doc on the status board as "research drafted, not verified by counsel". Per source ranking it carries no authority; changes to PRD, design or ADRs go through architect and BA and the decision log.

## Effort summary (rough; assumptions above)

| Item | Release | Points (assumed) | Note |
|---|---|---|---|
| `regulatoryProfile` configuration | REL-1 | 2 | Part of E2/E3 |
| Tri-state guardrail facts with provenance (schema) | REL-1 | 3 | ADR-018 revision |
| Reason-text allow-list and lint | REL-1 | 2 | Extends SEC-16 |
| Guardrail inputs in E12 | REL-2 | 3 | Architect first |
| E19 restricted compliance channel | REL-2 | 8 to 13 | New role; security review |
| Screening fact: attested interim | REL-3 | 3 | Fallback |
| Screening vendor integration | REL-3 or later | 8 to 13 plus procurement | Only after DL-N16 |
| Quebec transparency (if applicable) | REL-3 | 3 | After DL-N24 |
| Compliance export (extends FR-43/44) | REL-3 | 3 | |
| Counsel review of research | REL-0 | external, 3 to 5 days | Assumption |
| **Total regulatory additions** | | **about 25 to 35 pts** excluding vendor integration | About 5 to 8 person-weeks |

## Decisions the product owner must make

1. Province and federal or provincial status (DL-N26), and name the compliance officer and privacy officer now.
2. Confirm the default "ExchangeFlow records and routes; compliance and the core system file reports" (DL-N14, DL-N15), or ask for filing integration and accept a later pilot.
3. Name the screening source and accept the fallback (human-reviewed approvals) if none exists by REL-3 (DL-N16).
4. Approve the restricted compliance channel (E19) as REL-2 scope and the extra iteration it implies; name who may see the restricted field (DL-N27).
5. Decide whether ExchangeFlow stores identity and FX-ticket details or only references (DL-N09, DL-N10).
6. Approve the tiering of DL-N09 to DL-N27 and the added REL-0 and pilot go/no-go criteria.
7. Fund a counsel or compliance review of the research before any of it enters the PRD.
8. Whether Quebec members are in scope (DL-N22, DL-N24), which may move the primary Azure region before the production build.
9. Accept the added risks R27 to R32 and the re-rating of R12.
