# BA review: `docs/research/canada-credit-union-fx-requirements.md` (draft v0.1, 2026-10-01)

Reviewer: BA agent. Compared against `PRD.md` v0.2 (FR/NFR, §10 release plan, §13), `reviews/ba-review.md` §4 (Q1 to Q10, D1 to D9, DL-N01 to DL-N08) and `CLAUDE.md` (compliance values stay `[TBD-Stakeholder]`). Point-in-time snapshot. The PRD and the decision log were not edited. This is a requirements review, not legal advice; no legal claim was checked against primary sources by this reviewer.

Severity: High = requirements could be written from an unverified claim, or a question is not answerable as written; Medium = rework risk; Low = hygiene.

## Summary

| Severity | Count |
|---|---|
| High | 6 |
| Medium | 6 |
| Low | 2 |

## Findings

### REG-BA-01 (High) Several proposed questions are compound, so they cannot be answered yes/no or pick-one
- **Evidence (research §6 "Q" column):**
  - DL-N09: "Where is ID verification performed and recorded...? Is the 3,000 threshold applied per request or aggregated?" (two).
  - DL-N14: "Who files LCTRs and EFTRs today? Does ExchangeFlow need to compute 24-hour aggregation or only flag? Fixed or rolling 24-hour window?" (three; the last is a legal-research gap, §7, not a stakeholder question).
  - DL-N15: "How are suspicions raised and who files? Should ExchangeFlow offer a 'refer to compliance' action...?" (two).
  - DL-N22: province and members; Quebec PIA or Canada East; processing outside Canada (four).
  - DL-N12, DL-N20, DL-N27, DL-N24, DL-N16 each carry two or more.
- **Consequence:** A partial answer leaves the item "answered" while half is open; blocks cannot be released.
- **Fix:** Split as in the table below (one question per item). Drop the fixed/rolling-window question from the stakeholder list (it is for counsel).

### REG-BA-02 (High) Questions have no owner, default or "blocks", and are not ordered by what they block
- **Evidence:** Research §6 gives only question text, in requirement order (rows 1 to 20). §7 says DL-N26, DL-N22, DL-N14 are "first to answer", which differs from table order. The log format in `ba-review.md` §4 requires Owner, Why it matters, Default if unanswered, Blocks, Status.
- **Consequence:** Nothing tells the sponsor which answer unblocks which build step.
- **Fix:** Use the ready-to-paste table below. Order: gating questions (DL-N09, DL-N10), then those blocking the REL-1 field list and the E3a input schema, then the guardrail and rule values (REL-2), then activation and real-data items (REL-3/REL-4).

### REG-BA-03 (High) Duplication against the existing log is not checked
- **Evidence and fix:**

| Proposed | Overlaps | Treatment |
|---|---|---|
| DL-N21 (retention of decision records, snapshots, audit; legal hold) | BQ-7 (PRD §13: "Retention and erasure versus immutable audit"), NFR-10 | Do not add a new ID. Amend BQ-7 ("extends" is stated in the research but the table still lists it as new). |
| DL-N20 (retention clock per record type; provincial periods) | BQ-7 | Merge into the BQ-7 amendment. |
| DL-N10 (system of record for FX ticket) and part of DL-N09 | Q1 / D8 (staff complete in existing system) | Keep as a narrower question; cite Q1 as the premise; default follows Q1. |
| DL-N13 (entity requests in scope), DL-N11 (third party), DL-N18 (member risk rating) | Q5 / D7 (which fields and customer data are permitted; D7 default "no customer identity data") | Keep, but record "Duplicate of: Q5/D7 (field list)" and answer together; they are inputs to the Q5 answer. |
| DL-N12, DL-N17 (PEP approver, directive countries) | Q3 / D4 (restricted categories) | Keep as concrete sub-questions; Q3 answer may subsume them. Link both ways. |
| DL-N24 (member told of automated decision, human review on request) | D9 (customer notification out of scope), DL-N04 (escalation window) | Keep; D9 and DL-N04 default must be re-confirmed if Quebec members exist. |
| (missing) conversion of non-CAD amounts for the CAD 3,000 threshold | DL-N06 (thresholds per currency), Q10 (no rate source), research §1.2 "Not found" | Add as a question linked to DL-N06/Q10. Without a rate source a CAD threshold cannot be evaluated (same issue as IC-24). |
| DL-N23 (privacy officer, breach procedure), DL-N25 (outsourcing notice) | None | New. DL-N25 is conditional on DL-N09, so it is folded into the research-gap list. |

### REG-BA-04 (High) Certainty flags: "Confirmed (primary)" is applied to text read through a summarising tool, and the impact table drops flags entirely
- **Evidence:** Method row ("Most government pages were read through a summarising fetch tool... several returned 403 or 404"); flag table ("Confirmed (primary): ... fetched (through the summarising tool). Still re-check exact wording"). Examples of a confirmed flag with caveats: §1.3 PEP/HIO "Confirmed (primary, via summary); exact timing verify"; §4 "Confirmed (primary, via summary)". The §6 impact table has no flag column, yet turns **verify** and **Not found** items into requirement-shaped cells: row 3 (third party, "FX alone does not appear ... tool's reading"), row 10 (directive countries, **verify**, "decline per directive"), row 15 (Quebec PIA, **verify**, inference about Canada Central), row 16 (Quebec register period unverified), row 17 (Quebec s.12.1, secondary only), row 18 (outsourcing, varies by province).
- **Consequence:** A reader of §6 cannot tell which rows are law and which are inference; requirements written from them may be wrong.
- **Fix (rule for the PRD pass):** introduce three tiers and cite only the top one in an FR/NFR:
  1. **Verified in primary text** (statute, regulation or FINTRAC guidance read in full by compliance/counsel);
  2. **Read via summary** (today's "Confirmed (primary)");
  3. **Verify / secondary / Not found / inference**.
  Add a "Tier" column to §6 and to each §1 to §5 table. Tier 2 or 3 items may appear only as a `[TBD-Stakeholder]` or as a design option, never as a "shall".
- **Rows currently safe to cite as Tier 2 (re-check wording first):** FX ID trigger CAD 3,000; FX ticket for every FX transaction; five-year record retention; STR "attempted transactions" and no dollar threshold; LCTR/EFTR thresholds and deadlines; PCMLTFA s.8 intent element. All others stay Tier 3 until verified.

### REG-BA-05 (High) Conflict with FR-16, D7 and NFR-07 on individual-level facts
- **Evidence:** Research §6 rows 1, 3, 4, 5, 8, 9, 11 add per-person facts (identity-verified, PEP/HIO, entity, screening result, risk rating, compliance hold). `PRD.md` FR-16: "Rules cannot reference user identity or individual-level fields"; D7 default: "no customer identity data"; Q5 default: "Minimal non-sensitive synthetic fields only"; NFR-07 telemetry allow-list; FR-19 uses a pseudonymous key.
- **Two readings:** (a) compliance facts are individual-level, so even the guardrail cannot use them: then any request that needs one must go to human review (safe, no automation of anything near the 3,000 line); (b) the guardrail may read categorical facts (booleans, codes) that carry no identity, while rules still cannot: then FR-16 needs a clarifying sentence and the stored `EvaluationInput` includes them.
- **Consequence:** (a) shrinks automation; (b) changes FR-16/FR-18 text and the replay input.
- **Fix:** Log as DL-N12 (below). Recommended: (b), restricted to boolean/code facts supplied by compliance systems, used only by the guardrail (can only downgrade), missing = UNKNOWN. Architect to decide placement.

### REG-BA-06 (Medium) Legal duty and design choice are mixed in the impact table and headlines
- **Evidence:** Headline 4 "Declines are reportable events in their own right ... Every decline ... needs a route to a suspicion check by a person" but §1.5 says an attempted transaction is reportable only with reasonable grounds to suspect, and §5 labels the same text "design recommendations, not legal requirements". Row 4 "**Always human review** for PEP/HIO" while §1.3 lists PEP determination triggers as account relationships, EFT 100,000+ and periodic review, and says FX alone does not appear; row 6 "cash at or above a compliance-set trigger goes to human review" is a design choice (the law requires a report, not a review).
- **Fix:** Add a column "Basis" with values Law (tier), Guidance, Design choice, and reword headline 4 to "every decline must be *able* to route...". Design choices are acceptable defaults only if labelled.

### REG-BA-07 (High) Which PRD requirements need new or changed text (traceability)

Not applied; for the PRD pass after DL-N09 and DL-N10 are answered. "Tier" is the certainty of the underlying claim (REG-BA-04); anything Tier 3 stays `[TBD-Stakeholder]`.

| PRD item | Change | Type | Research row | Depends on | Tier of basis |
|---|---|---|---|---|---|
| FR-01 (field list, REL-1) | Add candidates: payment method (cash or not), identity-verified reference, third-party flag, entity flag, source/destination country. Conflicts with D7 default until answered | Changed | 1, 3, 5, 6, 10 | DL-N11, N12, N16, N21, N22, N23, Q5 | 2 for ID trigger; 3 others |
| FR-05 (escalate once, within window) | If Quebec members: human review on request outside the window | Changed (conditional) | 17 | DL-N27, DL-N04 | 3 |
| FR-12 (human-review causes) and design §4.3 fallback precedence | New causes: compliance hold, screening not clear or missing, directive country, cash over trigger, PEP/HIO. Precedence is fixed by design; design owner must place them | Changed | 4, 6, 8, 9, 10 | DL-N12, N16, N19, N20, N23 | 3 |
| FR-13 (decision record) | Restricted internal reason, separate from generic `reasonText` | Changed | 8, 20 | DL-N17, N18 | design rec |
| FR-16 (no individual-level fields in rules) | Clarify guardrail facts vs rule fields (REG-BA-05) | Changed | cross-cutting 1 | DL-N12 | n/a |
| FR-18 (guardrail) | Inputs beyond amount/type/currency; thresholds as compliance parameters, not literals | Changed | 1, 6 | DL-N12, N13, N14 | 2 for CAD 3,000 |
| FR-19 (velocity, pseudonymous key) | State whether the key satisfies "same person" aggregation for the 3,000 and 24-hour rules; a pseudonymous key may not reliably identify the same person across ID types | Changed | 1, 6 | DL-N13, N15 | 3 |
| FR-21, FR-43, FR-62, FR-61 | Reviewers and branch staff must not see restricted fields; permission matrix needs an action "read restricted compliance information" | Changed | 8, 20 | DL-N18 | design rec |
| FR-26 (cancel), FR-27 (expiry) | A cancelled or expired request is also an "attempt"; decide whether referral is available there | Changed (conditional) | 8 | DL-N17, Q7 | 2 (attempted) |
| FR-44, NFR-10 (retention) | Floor of "at least five years" for AML records is Tier 2; provincial and internal periods may be longer; legal hold | Changed | 13, 14 | BQ-7 | 2 |
| FR-60 | Roles: "senior-management approver", "compliance officer" if PEP in scope | Changed (conditional) | 4 | DL-N20 | 2 |
| NFR-07 (privacy), NFR-08 | Add: restricted topics (STR, suspicion, sanctions, PEP, FINTRAC) never in `reasonText`, staff screens, notifications or telemetry; canary test extended. NFR-08 synthetic-only unaffected | Changed | 20 | DL-N18 | design rec |
| NFR-14 (alerts) | Privacy-incident path (who is told, within what time) | Changed | 16 | DL-N26 | 2 PIPEDA; 3 others |
| NFR for record production | "Records retrievable within 30 days"; the existing audit export (FR-43/44) is the mechanism | **New NFR** | 13 | DL-N10 | 2 |
| NFR for data residency | Conditional: hosting region and cross-border statement, depends on province/Quebec | **New NFR (conditional)** | 15 | DL-N24, N25 | 3 |
| FR-NEW-a: refer to compliance | Staff or reviewer can refer any decided or cancelled request to compliance; visible only to compliance | **New FR**, new use case (compliance referral; UC-06/UC-10 do not cover it) | 8 | DL-N17, N18 | design rec |
| FR-NEW-b: compliance facts intake | Accept references/flags from the system of record with source, time, version, stored in the replay input | **New FR** | 1 to 11 | DL-N11, N12 | n/a |
| FR-NEW-c: regulatory profile | Province, federal or provincial, regulator, privacy regime as configuration | **New FR** | 19 | DL-N09 | 2 |
| PRD §3 non-goals ("replacing identity-verification or compliance systems") and D9 | Confirm unchanged; D9 may need revisiting if Quebec members exist | Confirm | 17 | DL-N27 | 3 |
| PRD §12 risks | Add: compliance parameter missing or wrong; regulatory status unknown | New risk (plan owner assigns ID) | all | DL-N09 | n/a |

### REG-BA-08 (Medium) Most proposed questions do not block REL-1, but the research implies they do
- **Evidence:** PRD §10: REL-1 uses synthetic data and non-production placeholder rules (FR-17, NFR-08); REL-2 adds the guardrail (FR-18); REL-4 introduces real data after privacy approval. Residency, breach, Quebec items matter at REL-4/go-live; PEP/screening matter when rules activate (REL-3).
- **Fix:** State "blocks" per question using REL-n (the decision log's R1/R2/R3 collide with risk IDs R1 to R21; CLAUDE.md says use REL-n). Only DL-N09 to DL-N12 plausibly shape the REL-1 field list and E3a input schema.

### REG-BA-09 (Medium) Decision-log hygiene found while comparing
- `ba-review.md` §4 has no BQ-x rows although PRD §13 cites BQ-2, BQ-6, BQ-7 and "BQ-3/4/5"; "duplicate of BQ-x" cannot be checked from the log alone.
- DL-N01 and DL-N02 are still "New" though PRD §13 records both decided on 2026-10-01 and ADR-022 is Accepted. Update status (not done here).
- The research text says DL-N21 "extends BQ-7" but lists it as new (REG-BA-03).

### REG-BA-10 (Medium) Lifecycle gaps surfaced by the research
- Auto-decline is escalatable once within a window (FR-05, DL-N04), which does not satisfy "human review on request" (research row 17) if applicable.
- FR-06/ADR-022: resubmission always human; compatible with the research (no change).
- Reviewer "more information needed" must not request unusual information that would tip off (STR guidance); FR-22 reason wording should stay on the approved reason set (SEC-16). Confirm in the question set (DL-N18).

### REG-BA-11 (Medium) No preserved claim register
- Research tail: "Raw per-topic research notes ... are not preserved." Claims cannot be re-checked or diffed when counsel reviews them.
- **Fix:** Keep a claim table (claim ID, quote or paraphrase, URL, how read, date, tier) in the repo; counsel marks tier 1 per row.

### REG-BA-12 (Medium) Release and traceability scope for "reporting is outside ExchangeFlow"
- Cross-cutting item 2 says filing LCTR/EFTR/STR/LPEPR belongs to compliance and the core system. That is consistent with Q1 and the PRD non-goals but is stated as a design implication, not a recorded decision. Log it as the default of DL-N15 so that "export for compliance" (FR-43/44) is the only reporting-related FR.

### REG-BA-13 (Low) One column mixes certainty and jurisdiction
- "Province-specific" and "Verify" are in the same flag column (e.g. §2, §3). Split into Tier and Scope.

### REG-BA-14 (Low) Language and member-facing obligations not covered
- Quebec adds French-language considerations for any member-facing text; the research did not look. Note as a research gap only if DL-N24 confirms Quebec members.

## Ready-to-paste decision-log table

IDs continue after DL-N08 and stop at DL-N27 (the core-engine review proposes DL-N28 to DL-N30). Order is by what each question blocks. Defaults are conservative and compatible with CLAUDE.md (no invented thresholds) and with FR-12/ADR-022.

| ID | Question | Duplicate of | Owner | Why it matters | Default if unanswered | Blocks | Status |
|---|---|---|---|---|---|---|---|
| DL-N09 | Is the credit union provincially or federally regulated, and in which province? | (research DL-N26) | Sponsor, compliance officer | Prudential, privacy, outsourcing and retention rules differ; FINTRAC duties do not | Treat as provincial, province unknown; build a regulatory profile as configuration; no province-specific rule is coded | DL-N10 to DL-N27 Province-specific items; FR-NEW-c; hosting region (ADR-019) | New |
| DL-N10 | Who is the designated compliance officer, and will they and counsel review the research (tiers 1 to 3) before any FR cites it? | Part of (research DL-N19) | Sponsor | No requirement may rest on an unverified claim; compliance parameters need an owner | Research stays advisory; every compliance value stays `[TBD-Stakeholder]` | Any FR change from the research (REG-BA-07); REL-2 guardrail values | New |
| DL-N11 | Is ExchangeFlow only holding references to the FX ticket and identity-verification record, with the existing system as the record of truth? | Q1/D8 (premise), Q5/D7 | Product owner, compliance | Decides which personal fields exist in ExchangeFlow, privacy exposure and FR-07 | Yes: references only | FR-01 field list (REL-1), E3a input schema, FR-07 | New |
| DL-N12 | May the guardrail read compliance facts (identity-verified, PEP/HIO flag, screening result, risk rating, compliance hold) supplied as booleans/codes by other systems, even though rules may not read individual-level fields? | Q5/D7, FR-16 | Policy owner, compliance, privacy | Resolves REG-BA-05; fixes the stored replay input | No: any request needing such a fact goes to human review (missing fact = UNKNOWN) | FR-16, FR-18, FR-NEW-b, E3a schema, REL-2 | New |
| DL-N13 | Is the CAD 3,000 identity trigger applied per request, or aggregated per person across requests? | (research DL-N09b); FR-19 | Compliance | Changes velocity facts and structuring controls | Per request; no auto-approve rule activated where structuring risk applies (FR-19) | FR-18 thresholds, FR-19, REL-3 activation | New |
| DL-N14 | How are non-CAD amounts converted for the CAD threshold, and from which rate source? | DL-N06, Q10 | Compliance, product owner | Without a rate source a CAD threshold cannot be evaluated | Per-currency thresholds set by compliance; no live rate (FR-70 dormant) | FR-18, DES §6.2 thresholds, REL-2 | New |
| DL-N15 | Who files LCTR and EFTR today, and does ExchangeFlow only flag and reference them (no filing, no 24-hour aggregation)? | (research DL-N14a/b) | Compliance, operations | Defines integrations and scope boundary | Existing process files; ExchangeFlow flags and references only | Scope of REL-1 to REL-3; FR-NEW-b | New |
| DL-N16 | Is the payment method (cash, EFT, other) known at request time and required as a request field? | (new) | Operations, compliance | Cash and international EFT drive LCTR/EFTR triggers | Required field; cash or unknown goes to human review | FR-01, FR-12 causes, REL-1 field list | New |
| DL-N17 | Is there a "refer to compliance" action on any decided, declined or cancelled request, and who files an STR? | (research DL-N15) | Compliance | Attempted transactions are reportable on reasonable grounds; no route today | Existing compliance procedure outside ExchangeFlow; no suspicion text stored | FR-NEW-a, FR-26 interplay, UC list | New |
| DL-N18 | If a restricted compliance field exists, which roles may see it? | (research DL-N27a) | Compliance, security | Tipping-off risk; permission matrix | Compliance role only; absent from queues, audit export for general roles, notifications and telemetry | FR-61, FR-21, FR-43, NFR-07 | New |
| DL-N19 | Which sanctions lists are screened, by which system, and does ExchangeFlow receive only a result? | (research DL-N16) | Compliance | A potential match must not be disposed of automatically | Screening outside ExchangeFlow; auto-approve needs a "screening clear" fact; none means human review | FR-18, FR-12, REL-3 activation | New |
| DL-N20 | Is PEP/HIO handling in scope, and which role is the senior-management approver? | Q3/D4 | Compliance | SoD and role model | Out of scope for REL-1; any known PEP goes to human review; approver is never the submitter | FR-60, FR-12, REL-3 | New |
| DL-N21 | Is third-party determination collected for FX requests? | Q5/D7 | Compliance | Possible trigger gap; basis is unverified (tier 3) | Not collected; confirm with counsel | FR-01 | New |
| DL-N22 | Are entity (non-individual) requests in scope? | Q5/D7 | Product owner | Beneficial ownership duties apply | Individuals only; entity requests go to human review | FR-01, REL-1 scope | New |
| DL-N23 | Which ministerial directives and countries apply, and who maintains the list? | Q3/D4 | Compliance | Country-linked routing needs a maintained parameter | None coded; compliance maintains a parameter list, unset means no country rule | FR-12, FR-18, REL-2 | New |
| BQ-7 (amend) | Retention periods for decisions, context snapshots, audit and restricted fields; clock start per record type; provincial periods; legal hold | BQ-7 (absorbs research DL-N20, DL-N21) | Compliance | At least five years is a tier-2 floor for AML records; longer periods may apply | Keep all, purge nothing, until set; PII stays out of audit rows | NFR-10, FR-44, REL-4 real data | Open (amend) |
| DL-N24 | Does the credit union have Quebec members, and is Canada Central acceptable as the primary region for them? | (research DL-N22a) | Sponsor, privacy | Quebec rules may require a privacy impact assessment | Assume Quebec members exist until stated; no real data in any environment before answered | Hosting region, NFR for residency, REL-4 | New |
| DL-N25 | Is any personal data processed or accessed outside Canada (vendor support, telemetry, backups)? | (research DL-N22c) | IT, privacy | Notice and contract duties | Assume none permitted | Azure proposal region and support access, REL-4 | New |
| DL-N26 | Who is the privacy officer, and what is the breach notification procedure? | (research DL-N23) | Privacy officer | Incident path and NFR-14 alert target | Security owner receives alerts; no external notification procedure assumed | NFR-14, go-live | New |
| DL-N27 | If Quebec members exist, is an auto-decline "based exclusively on automated processing", and who explains it to the member? | D9, DL-N04 | Compliance, privacy | Member notice and human review on request | Staff explain on request; human review on request outside the window | FR-05, D9, FR-NEW-e | New |

Dropped from the proposed list as stakeholder questions: fixed vs rolling 24-hour window (counsel), "stricter than law" tipping-off rule (covered by DL-N10 and DL-N18), compliance program documentation (covered by DL-N10), outsourcing notification (conditional on DL-N09; kept in research gaps).

## Decisions the product owner must make

1. Approve the three-tier certainty rule (REG-BA-04): no FR cites a claim below tier 1 or 2 with re-checked wording.
2. Name the compliance officer and a counsel review route (DL-N10); without them nothing in REG-BA-07 can move.
3. Confirm "references only, reporting outside ExchangeFlow" as scope (DL-N11, DL-N15).
4. Decide the FR-16 question: may the guardrail read categorical compliance facts (DL-N12), recommended yes, boolean/codes only.
5. Accept that questions DL-N13 to DL-N27 block REL-2 to REL-4, not REL-1, apart from those that shape the field list (DL-N11, N12, N16, N22).
6. Authorize updating BQ-7 rather than adding retention questions, and refreshing DL-N01/DL-N02 status in the log.
7. Decide whether to preserve a claim register (REG-BA-11) as a repository artefact.
