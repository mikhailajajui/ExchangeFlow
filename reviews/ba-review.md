# ExchangeFlow: Business Analysis Review

| | |
|---|---|
| **Scope** | `project-brain-stoming.md` (proposal, "PROP"), `PRD.md` ("PRD"), `application-project-plan.md` ("PP"), `application-elaboration-plan.md` ("EP"), `policy-engine-design.md` ("DES") |
| **Review date** | 2026-10-01 |
| **Reviewer** | Business analyst (consultancy review) |
| **Status** | Review findings. No source document has been edited. Every change proposed here needs the owning document's author to make it. |

Citations use `DOC Lnn` (the line number in the file as of the review date) or `DOC §n`.

Status vocabulary:

- **Met**: traced to an upstream source, covered downstream, and consistent across the documents.
- **Gap**: traced to a source, but downstream coverage (UC, backlog or design) or required detail is missing.
- **Conflict**: two or more documents disagree.
- **Open**: depends on a stakeholder answer that has not been received.
- **Orphan**: has no upstream source (it was invented in the PRD or design).

---

## 0. Headline findings

1. **Three conflicts block the build of the R1 / first increment.**
   - **IC-01:** Can placeholder rules auto-decide in the first increment? EP §7 and PP S6 say yes. PRD FR-17, DES §6.2 and the PRD R1 exit criteria say no.
   - **IC-02:** Does a resubmitted request go back through the engine or straight back to the reviewer? PRD FR-10 and DES §3 say the engine. EP §5 use case C says the reviewer.
   - **IC-03:** Release scope and numbering differ between the PRD and PP. FR-05, FR-06 and FR-43 are scheduled in R1 by the PRD, but in iterations 6–8 by PP.
2. **Some PRD values have no source** and some thresholds are not tagged as TBD. "2 seconds p95", "under one minute" and "WCAG 2.1 AA" trace to nothing upstream. The shadow-agreement threshold, the sampling rate and the per-rule accuracy guardrail are needed but have no [TBD-Stakeholder] tag.
3. **The question registers are duplicated.** The five documents keep five separate question lists with different numbering. Section 4 consolidates them into a single decision log.
4. **Requirement status (59 total: 44 FR, 15 NFR):** Met 21 · Open 15 · Conflict 10 · Gap 10 · Orphan 3.

---

## 1. Traceability matrix

### 1.1 Upstream sources (IDs assigned by this review)

The proposal does not number its goals or needs, so this review assigns IDs that point to proposal lines.

**Proposal goals (PG)**

| ID | Goal (proposal text, abridged) | Source |
|---|---|---|
| PG-01 | Evaluate each request against policy and route it to auto-approve, auto-decline or human review | PROP L5, L35–41 |
| PG-02 | Policy is business-owned, versioned, auditable configuration that is not hard-coded | PROP L7, L47 |
| PG-03 | Fail safe to a human: no match, a conflict or an error goes to human review | PROP L7, L48 |
| PG-04 | Explainable: record which rule fired and why | PROP L49 |
| PG-05 | Reversible and contestable: escalate an auto-decline; pause per rule or globally | PROP L50, L91 |
| PG-06 | Shadow mode before activation | PROP L51, L91, L103 |
| PG-07 | Sample automated decisions for after-the-fact audit by managers | PROP L52 |
| PG-08 | Shared view of each request for workers and reviewers; status visible | PROP L5, L11, L88 |
| PG-09 | Complete decision record: path, reason, timestamp, actor or rule version | PROP L43, L78, L93 |
| PG-10 | Notifications for submission, status changes and requests needing attention | PROP L11, L94 |
| PG-11 | Measure value against a baseline (follow-up time, turnaround, backlog, completeness) | PROP L109 |
| PG-12 | Role-based staff and reviewer accounts | PROP L86 |
| PG-13 | Searchable history and basic operational summaries | PROP L95 |
| PG-14 | Admin configuration of routing **and request requirements** | PROP L96 |
| PG-15 | Optional indicative rate display from a verified source | PROP L54, L105 |
| PG-16 | Route exceptions to an authorized stakeholder | PROP L11, L128 |
| PG-17 | No execution of payments or funds; existing controls are not replaced | PROP L7, L100–101 |
| PG-18 | Status set: draft, submitted, under review, more information needed, approved, declined, completed | PROP L89 |

**Stakeholder needs (SN)**, from PROP L58–68

| ID | Stakeholder | Need |
|---|---|---|
| SN-01 | Front-line staff | Submit, check progress, and know when a decision or more information is needed |
| SN-02 | Policy owners | Define the classification, approve rule changes, own the risk |
| SN-03 | Head-office reviewers | See the queue, decide and record, return for clarification |
| SN-04 | Branch / ops managers | Monitor workload, pending items, turnaround, and consistency |
| SN-05 | Customers | Predictable service and clearer updates on a pending request |
| SN-06 | Business leadership | Operational visibility; assess whether objectives are met |
| SN-07 | IT and security | Fit with systems, access policies, security, **support practices** |
| SN-08 | Compliance and privacy | What is collected, accessed, retained and audited |
| SN-09 | Data provider | Supply rates under confirmed terms |

### 1.2 Forward trace: goal or need → requirement → UC → backlog → design

UC IDs come from PP §5A. The EP §5 use cases are mapped as A0 = UC-08, A = UC-01, B = UC-02, C = UC-03. Backlog IDs: E-xx from EP §8; S-xx and T-xx from PP §7.

| Source | PRD requirement(s) | Use case | Backlog | Design section | Trace status |
|---|---|---|---|---|---|
| PG-01 | FR-10, FR-11, FR-12 | UC-08 (EP A0) | E3a, S6 | DES §4.1–4.3, §8.1 | Conflict (IC-01, IC-06) |
| PG-02 | FR-16, FR-30 | UC-09 | E3b (content), E3a (model) | DES §6, §7 | Open (criteria TBD); FR-30 has no build backlog item |
| PG-03 | FR-12, NFR-02 | UC-08 | E3a, S6 | DES §4.2–4.3, §9 | Met (see IC-08 for the missing-data ordering) |
| PG-04 | FR-13 | UC-08 | E3a, S6 | DES §4.1, §6.1, §10 | Gap: the DECISION_RECORD entity lacks `matched_rules` and `reason_text` (IC-26) |
| PG-05 (escalate) | FR-05 | UC-10 | **none** | DES §5.3 | Conflict (IC-09, IC-11); no backlog item |
| PG-05 (pause) | FR-34 | UC-09 | **none** | DES §7, §8.2, §9 | Conflict (IC-07); no backlog item |
| PG-06 | FR-15, FR-33, FR-37 | UC-09 | E3a (shadow flag only) | DES §5.2, §7, §12 | Conflict (IC-08, IC-13) |
| PG-07 | FR-42 | UC-10 | **none** | DES §8.2, §10 | Open: the sampling rate is not specified and not tagged TBD |
| PG-08 | FR-03, FR-04, FR-20, FR-21 | UC-01, UC-02 | E4, E5, E7, S2, S3, S5 | DES §5.1 | Met |
| PG-09 | FR-13, FR-36, FR-43, FR-44, NFR-04, NFR-09 | UC-01, UC-02, UC-08 | E6, S4 | DES §6.1, §10 | Met (FR-43 conflict IC-12) |
| PG-10 | FR-50, FR-51, FR-52, FR-53 | UC-04 | E8 | DES §5.1 | Met / Open (channels) |
| PG-11 | none (PRD §9 metrics only) | UC-06 (partial) | E1 (baselines) | DES §10 | **Need without FR**: baseline capture is a discovery task, which is acceptable. The metrics segmentation in PP L31 (by request type and operating hours) is not in FR-40 |
| PG-12 | FR-60, FR-61, FR-63, NFR-05 | UC-05 | S1, E9 | DES §7 (permissions) | Gap: role set mismatch (IC-05, IC-25) |
| PG-13 | FR-40, FR-41, FR-43 | UC-06 | **none** | DES §10 | Gap / Conflict (IC-12) |
| PG-14 (routing) | FR-25 | UC-02 (implicit) | E1 (discovery only) | DES §6 (RoutingPolicy in EP §4) | Open |
| PG-14 (request requirements) | **none** | none | none | none | **Need without requirement.** No FR lets an admin configure required request fields |
| PG-15 | FR-70 | UC-07 | E10 | none (DES out of scope) | Open |
| PG-16 | **none** | none | none | none | **Need without requirement.** Exception routing is open (PRD Q7) and has no FR |
| PG-17 | PRD §3 non-goals | n/a | n/a | DES §1 out of scope | Met (pending Q1/D8) |
| PG-18 (draft) | **none** | UC-01 | none | DES §3 (Draft state) | **Need without requirement.** The Draft state exists, but no FR covers saving or editing a draft |
| PG-18 (completed) | FR-07 | none explicit | **none** | DES §3 | Gap: no backlog item |
| SN-01 | FR-01–FR-06, FR-08, FR-50 | UC-01, UC-03 | E4, E7, S2, S5 | DES §5.1, §5.3 | Open (FR-01 fields) / Conflict (FR-06, IC-02) |
| SN-02 | FR-16, FR-30–FR-37 | UC-09 | E3b; build items missing | DES §6, §7, §8.2 | Gap (no backlog for policy administration) / Conflict (IC-05) |
| SN-03 | FR-20–FR-25, FR-51 | UC-02, UC-03 | E5, E6, S3, S4 | DES §3 (review UI is out of DES scope) | Met / Open (FR-22, FR-25) |
| SN-04 | FR-40, FR-41, FR-42 | UC-06, UC-10 | **none** | DES §10 | Gap: no backlog item |
| SN-05 | **none** (PRD §3 non-goal; D9 default) | none | none | DES D9 | **Need without requirement.** It is excluded, but there is no recorded stakeholder answer (IC-14) |
| SN-06 | PRD §9 metrics; FR-40, FR-41 | UC-06 | none | DES §10 | Gap: no leadership reporting requirement |
| SN-07 | NFR-05, NFR-06, NFR-14, FR-61 | UC-05 | E2, E9, T1 | DES §8.2 | Gap: **no NFR for backup, restore or support** although PP L112, L207 and EP E9 mention them |
| SN-08 | NFR-07, NFR-08, NFR-10, FR-31, FR-44 | UC-09 | E1, E9 | DES §7, §10 | Open (retention) / Conflict (NFR-08 vs replay, IC-13) |
| SN-09 | FR-70 | UC-07 | E10 | none | Open |

### 1.3 Reverse trace: every PRD requirement → source and status

| ID | Upstream source | UC | Backlog | Design | Status | Note |
|---|---|---|---|---|---|---|
| FR-01 | SN-01, PROP L72 | UC-01 | E4, S2 | DES §4.1 | Open | Field list [TBD-Stakeholder] |
| FR-02 | PROP L73; PP UC-01 | UC-01 | E4, S2 | — | Met | |
| FR-03 | SN-01 | UC-01 | E4, E7, S2, S6 | DES §5.1 | Met | |
| FR-04 | SN-01 | UC-01 | E7, S5 | — | Met | Branch scope depends on FR-62 |
| FR-05 | PG-05 | UC-10 | none | DES §5.3 | Conflict | IC-09, IC-11, IC-03 |
| FR-06 | SN-03; PROP L76 | UC-03 | E6/E7 (implicit) | DES §3 | Conflict | IC-02, IC-03 |
| FR-07 | PG-18 | none | none | DES §3 | Gap | No UC step and no backlog item |
| FR-08 | PP R4; EP §5A failure cases | UC-01 | E4 | DES §9 | Met | |
| FR-10 | PG-01 | UC-08 | E3a, S6 | DES §4 | Conflict | IC-02 (re-evaluation on resubmit) |
| FR-11 | PG-03 | UC-08 | E3a | DES §4.2 | Open | Depends on D3 / Q4 |
| FR-12 | PG-03 | UC-08 | E3a, S6 | DES §4.2–4.3 | Met | |
| FR-13 | PG-04, PG-09 | UC-08 | E3a, S6 | DES §4.1, §6.1 | Gap | IC-26 |
| FR-14 | PP §5B L107, Iteration 5 "deterministic" | UC-08 | E3a | DES §1 principle 3, §11 | Met | |
| FR-15 | PG-06 | UC-09 | E3a | DES §5.2 | Conflict | IC-08 |
| FR-16 | PG-02 | UC-09 | E3b | DES §6.2 | Open | Criteria [TBD-Stakeholder] |
| FR-17 | DES §6.2; EP §7 "placeholder" | UC-08 | E3a, S6 | DES §6.2 | Conflict | IC-01, IC-21 |
| FR-20 | SN-03 | UC-02 | E5, S3 | DES §5.3 | Met | |
| FR-21 | SN-03 | UC-02 | E5 | DES §5.2 | Met | |
| FR-22 | SN-03 | UC-02 | E6, S4 | — | Open | Reason rules [TBD-Stakeholder]; IC-30 |
| FR-23 | PP R4 | UC-02 | E6, S4 | DES §9 | Met | |
| FR-24 | PP R4 | UC-02 | E6 | DES §9 | Met | |
| FR-25 | PG-14; EP Q5 | UC-02 | none | — | Open | Routing and authority [TBD-Stakeholder] |
| FR-30 | PG-02 | UC-09 | none (EP §7 defers the authoring UI) | DES §6.1, §8.2 | Gap | No backlog item |
| FR-31 | SN-02, SN-08 | UC-09 | none | DES §7 | Conflict | IC-05 |
| FR-32 | PP §5C L119 (replay); DES §8.2 | UC-09 | none | DES §8.2 | Gap | No backlog item |
| FR-33 | PG-06 | UC-09 | none | DES §7 | Conflict | IC-05, IC-13; sign-off threshold is not tagged TBD (IC-28) |
| FR-34 | PG-05 | UC-09 | none | DES §7, §9 | Conflict | IC-07 |
| FR-35 | DES §7 only | UC-09 | none | DES §6.1, §7 | **Orphan** | No proposal or stakeholder source |
| FR-36 | PG-09 | UC-09 | none | DES §7 | Gap | No backlog item |
| FR-37 | PG-06 | UC-09 | none (PP Iteration 5 text only) | DES §8.2, §10 | Gap | No backlog item |
| FR-40 | SN-04 | UC-06 | none | DES §10 | Gap | No backlog item; PP segmentation is missing |
| FR-41 | SN-04 | UC-06 | none | DES §10 | Gap | No backlog item |
| FR-42 | PG-07 | UC-10 | none | DES §8.2 | Open | Sample rate and flag workflow are not specified (IC-28) |
| FR-43 | PG-13 | UC-06 (implicit) | none | — | Conflict | IC-12 |
| FR-44 | PG-09 | — | E6 | DES §10, §11 | Met | |
| FR-50 | PG-10, SN-01 | UC-04 | E8 | DES §5.1 | Met | |
| FR-51 | PG-10, SN-03 | UC-04 | E8 | DES §5.1 | Met | |
| FR-52 | PP R5 | UC-04 | E8 | DES §5.1 | Met | |
| FR-53 | PG-10 | UC-04 | E8 | — | Open | Channels [TBD-Stakeholder] |
| FR-60 | PG-12 | UC-05 | S1 | DES §7 | Gap | IC-05, IC-25 |
| FR-61 | PG-12, SN-07 | UC-05 | E9 | DES §7, §8.2 | Met | |
| FR-62 | EP Q5 | UC-05 | none | — | Open | [TBD-Stakeholder] |
| FR-63 | PP UC-05 | UC-05 | none (E9 is review only) | — | Gap | No backlog item |
| FR-70 | PG-15 | UC-07 | E10 | — | Open | |
| NFR-01 | PRD goal 1 "in seconds" only | UC-08 | — | DES §8.1 | Open | The **2 s p95 value has no source** |
| NFR-02 | DES §8.1 | UC-08 | E3a | DES §8.1 | Open | Timeout value is D6 |
| NFR-03 | EP Q9 | — | — | — | Open | [TBD-Stakeholder] |
| NFR-04 | EP §5B step 6 | UC-02 | E6 | DES §5.1 | Met | |
| NFR-05 | EP §6; PP §10 | UC-05 | E9 | DES §8.2 | Met | |
| NFR-06 | PP §10 | — | E2, E9 | — | Met | |
| NFR-07 | PROP L104; EP §4 | — | E1 | DES §10 | Met | Field list is tracked under FR-01 |
| NFR-08 | PP §10; PROP L104 | — | T1, E3 | — | Conflict | IC-13 (historical replay) |
| NFR-09 | PG-09 | UC-08 | E3a | DES §6.1 | Met | |
| NFR-10 | SN-08 | — | — | — | Open | [TBD-Stakeholder] |
| NFR-11 | PP R8 (adoption), but no value | UC-01 | — | — | **Orphan** | "under one minute" has no source |
| NFR-12 | none | — | — | — | **Orphan** | WCAG 2.1 AA has no source |
| NFR-13 | PP Q2, EP Q2 | — | — | — | Open | |
| NFR-14 | DES §10 | — | E9 | DES §10 | Met | DES also alerts on "shadow disagreement spike", which NFR-14 omits |
| NFR-15 | EP Q9 | — | — | — | Open | [TBD-Stakeholder] |

**Status counts:**

| Type | Met | Open | Conflict | Gap | Orphan | Total |
|---|---|---|---|---|---|---|
| FR | 15 | 9 | 9 | 10 | 1 | 44 |
| NFR | 6 | 6 | 1 | 0 | 2 | 15 |
| **Total** | **21** | **15** | **10** | **10** | **3** | **59** |

### 1.4 Orphans

**Requirements with no upstream source.** Each should be confirmed with a stakeholder, or its value marked TBD.

| Item | Where | Action |
|---|---|---|
| FR-35 effective dating | PRD, from DES §7 | Confirm the need with the policy owner or drop it. It is low risk at Could priority |
| NFR-01 "2 seconds at p95" | PRD | Tag the value [TBD-Stakeholder] and ask in workshop session B |
| NFR-11 "under one minute"; "single screen" | PRD | Tag the value TBD; set it after the baseline observation |
| NFR-12 WCAG 2.1 AA | PRD | Confirm with IT or HR whether an accessibility standard is mandated |
| PRD §9 guardrail "must not raise error rate above the human baseline … agreed threshold" | PRD | Not traced to a stakeholder. The threshold is not tagged TBD |
| DES §9 "report most common unmatched shapes to the policy owner" | DES | No FR covers it. Add one to the PRD or drop it from DES |

**Stakeholder needs and goals with no requirement.**

| Need | Source | Action |
|---|---|---|
| Configure request requirements (required fields) | PG-14, PROP L96 | Decide whether field configuration is admin-editable or fixed per release (DL-N05) |
| Exception routing to an authorized stakeholder; reviewer timeout, urgent or cancelled requests | PG-16, PRD Q7 | No FR and no Cancelled state. Blocks the lifecycle sign-off |
| Draft status | PG-18 | No FR for saving a draft. Either add one or remove Draft from the lifecycle |
| Customer updates | SN-05 | Excluded by the PRD without a recorded answer (DL D9) |
| Leadership objective assessment | SN-06 | Covered only by PRD §9 metrics. No reporting FR |
| Support, backup and restore | SN-07; PP L112, L207 | No NFR |
| Turnaround segmented by request type and operating hours | PP L31 | FR-40 segments by decision path only |

---

## 2. Cross-document inconsistencies

Severity:

- **High**: blocks the build or changes behaviour.
- **Medium**: causes rework or mis-testing if left.
- **Low**: wording or ID hygiene.

### High

**IC-01: Can placeholder rules auto-decide in the first increment?**

The documents say:
- EP §7 L189: "A policy engine with a small placeholder rule set … showing all three paths (auto-approve, auto-decline, human review)".
- EP §7 L212: "Placeholder requests resolve to auto-approve, auto-decline or human review as configured".
- EP §7 L214: "A staff user can escalate an auto-decline".
- PP S6 L221: "I classify a request as auto-approve, auto-decline or human review using a placeholder rule set".

Against that:
- PRD FR-17: "only labelled placeholder rules exist, and they can only be shadow or human-review rules".
- PRD R1 exit: "Every request goes to human review; placeholder rules in shadow only".
- DES §6.2 L371: "can never approve or decline anything in a real environment".
- PP Workflow MVP L143: "All requests go to human review".

Consequence: under the EP/PP reading, QA tests auto-approve, auto-decline and escalation in R1. Under the PRD/DES reading, those paths cannot occur, and FR-05 escalation is untestable in R1.

The DES wording "in a real environment" hints at a demo-only exception, but no document states one.

**Change:** EP §7 and PP §7 S6 should match the PRD, or the PRD should add an explicit "demo environment only" exception to FR-17. This is decision DL-N01.

**IC-02: Where does a resubmitted request go?**

- EP §5 use case C step 4 L157: "returns the request to the configured review queue".
- PRD FR-10: "Every submitted **or resubmitted** request is evaluated against the active policy". PRD §5.1 has the edge G→B, and DES §3 has `MoreInfoNeeded → Submitted → Evaluated`.

Consequence: under the PRD/DES reading, a request that a reviewer has already taken can be auto-approved or auto-declined by a rule after the staff member resubmits, so the reviewer loses the case. Under the EP reading, the reviewer always decides it.

**Change:** depends on decision DL-N02. If "back to reviewer" is chosen, the PRD FR-10, PRD §5.1 and DES §3 change. Otherwise EP §5 use case C changes.

**IC-03: Release and iteration scope do not line up.**

- PRD §10 has R0–R4. PP §6 has seven named releases across iterations 1–9+. The PRD has no "Architecture/Foundation" or "Production Readiness" release.
- DES §14 L543 cites the release "Controlled Automation". In PP that name belongs to Iteration 7 (L197); the PP release is "Operational Pilot Candidate".
- Scope mismatches:

  | Item | PRD release | PP placement |
  |---|---|---|
  | FR-05 escalation | R1 | Iteration 7 (L200) |
  | FR-06 clarification and resubmit | R1 | Iteration 6 (L193) |
  | FR-43 search | R1 | Iteration 8 (L205) |

  EP §7 includes clarification and escalation in the first increment, which agrees with the PRD and disagrees with PP.

Consequence: the content of the R1 demo and its acceptance tests differ depending on which document is used.

**Change:** PP §6 should adopt the PRD release IDs and add an iteration-mapping column. DES §14 should cite the PRD release ID.

### Medium

| ID | Finding (verbatim evidence) | Consequence | Change |
|---|---|---|---|
| IC-04 | The PRD uses **R0–R4 for releases**, and PP uses **R1–R14 for risks** (PP L253–268). DES §5.1 L197 "see R5 in the project plan" means the risk. PP lists R10 after R14 | References such as "R3" are ambiguous | PRD: rename releases (for example REL-0…REL-4). PP: re-sort the risks |
| IC-05 | **Separation of duties:** DES principle 7 L32 "cannot approve **or activate**". DES §7 L395 "the approver cannot also be the one who activates, where team size allows". The DES permission table L409 lets only the **Policy approver** activate. DES §7 L383 "**policy owner** enables shadow", but there is no policy-owner role in DES §7 or PRD FR-60. PRD FR-31 and D5 only require author ≠ approver | It is unclear who signs off activation (FR-33). If approver ≠ activator is required, a third person is needed | DES §7 after D5 is answered; PRD FR-60 and FR-33 |
| IC-06 | EP §5 A0 step 2 L116: "If **exactly one** applicable rule yields auto-approve…". Step 3: "If the rule is in shadow mode, the engine … **returns human review**". DES §4.2: several approve-only matches give AUTO_APPROVE, and shadow rules never affect the outcome | EP implies that two matching approve rules cause human review, and that a shadow match forces human review | EP §5 A0 should defer to DES §4.2. This needs the design or formula pass to define `decidingRuleId` when several rules match |
| IC-07 | PRD FR-34: pause "takes effect from the **next evaluation**". DES §9 L461: pause flag "not cached beyond a **short, documented interval**". D6 | The PRD makes the pause instant; DES allows a lag in which automation continues | Decide the acceptable lag (DL D6). Then align the PRD or DES |
| IC-08 | DES §4.3 checks "Any rule hit missing or invalid data?" **before** "Split matches: ACTIVE vs SHADOW; drop PAUSED rules". PRD FR-15: "Shadow-mode rules … never change the applied outcome" | Missing data for a shadow or paused rule would force MISSING_DATA → human review, which breaks FR-15 | DES §4.3. Flagged for the design and algorithm pass; it is not resolved here |
| IC-09 | DES §3 and EP §4 allow `Declined → UnderReview` from **any** Declined. DES §5.3 L227: "Check state is Declined **by rule**". PRD FR-05: "auto-declined request". The documents set no limit on repeated escalation or on how late an escalation can happen | A reviewer-declined request could be escalated again, possibly in a loop | DES §3 and EP §4: distinguish auto-declined from reviewer-declined, or add a guard. Escalation window is decision DL-N04 |
| IC-10 | **State names:** PROP L89 "under review, more information needed". EP "Under Review", "More Information Needed". DES `UnderReview`, `MoreInfoNeeded`. PP "pending-review queue". FR-20 "awaiting human review". `Evaluated` appears only in EP and DES. The documents have no Cancelled state (EP Q6 mentions cancellation) | Test cases and UI labels will diverge | PRD: add a canonical state table (display name, code, terminal flag). DES and EP should reference it |
| IC-11 | PP UC-10 "Contest and audit automated decisions": **Should**. PRD FR-05 escalation: **M**. PROP principle "Reversible and contestable" | Escalation could be cut as a "Should" item | PP: split UC-10 into escalation (Must) and sampled review (Should) |
| IC-12 | PRD FR-43 search is **M** in R1. PP places search in Iteration 8 (L205) and has no UC for it | Search is either an R1 blocker or late | Pick one: PRD or PP |
| IC-13 | DES §7 L396: activation needs "a replay against sample **historical** decisions". PP §5C L119: "Collect historical … decisions to replay". PRD NFR-08: "Development, test and demo environments use **synthetic data only**". PROP L104 | Historical decisions are real customer data. Either replay is impossible before the privacy approval, or NFR-08 needs an exception | Decision DL-N03. Then PRD NFR-08 or DES §7 changes |
| IC-14 | PROP L64: customers get "clearer updates". PROP L129: "What status updates should … customers receive?" EP Q7: "are customer notifications in scope?" PRD §3: "A customer-facing portal or customer notifications" is a **non-goal**. D9 default: out of scope | The PRD closed an open question without a recorded answer | Record it in the decision log (D9). Annotate the PROP stakeholder row |
| IC-15 | **Five question registers:** PROP (unnumbered), PP §12 (1–10 plus 4a, 4b), EP §10 (1–10 plus 3a), PRD Q1–Q10, DES D1–D9. Duplicates: PRD Q1 = DES D8 = PP 4 = EP 4; Q4 = D3; Q3 ≈ D4; Q5 ≈ D7 | Answers get recorded in one place and missed in another | Adopt section 4 of this review as the single log. The other documents should reference its IDs |
| IC-24 | DES §4.1: amount is "decimal, **with currency**". DES §6.2 thresholds `TBD_THRESHOLD_A/B` have no currency. Rates are out of scope (PRD §3) | A threshold across currency pairs needs either per-currency thresholds or a conversion rate, and rates are excluded | Workshop question P-07. Then DES §6.2 changes |
| IC-28 | Values the business must supply that are not tagged [TBD-Stakeholder]: FR-33 sign-off criterion (agreement %), FR-42 sample size or rate, the PRD §9 per-rule accuracy threshold, rule categories and "regulated" flags (FR-31), the escalation window | The values will be invented during the build | PRD: add the tags |

### Low

| ID | Finding | Change |
|---|---|---|
| IC-16 | PP UC IDs are out of order (UC-08 to UC-10 sit between UC-02 and UC-03). EP use cases are labelled A0, A, B, C with no UC ID. The PRD does not reference UCs | EP §5: add UC IDs. PRD: add a UC column to the §6 tables |
| IC-17 | Two backlogs: PP S1–S6/T1–T2 and EP E1–E10/E3a/E3b. They overlap and have different estimates (S6 = 5 pts vs E3a = 8 pts for the same engine) | PP §7: reference E-IDs or retire the S-IDs |
| IC-18 | DES status L3: "Implements backlog items E3a **and E3b**". DES §1 L22 puts the criteria out of scope (E3b) | DES header: change to "supports E3b" |
| IC-19 | Outcome terms vary: "human review", "needs-human-review" (PROP L13), "always-human" (PP L156), "always human" rule (PRD §7), "force human" (DES §4.2), "human" (EP §4) | PRD glossary: define "human-review rule" once |
| IC-20 | Channels: PP UC-04 "in-app or push"; EP §6 "push provider"; EP Q7 adds SMS; PRD FR-53 "email, desktop push" | PP UC-04: align after Q8 |
| IC-21 | FR-17 "shadow or human-review rules" mixes mode (shadow) with outcome (human review) | PRD FR-17: write "mode SHADOW, or mode ACTIVE with outcome HUMAN_REVIEW" |
| IC-22 | The conflict tables (PRD §7, DES §4.2) list rows in a different order from evaluation precedence (pause → load error → missing data → match) | PRD §7 and DES §4.2: add a precedence column |
| IC-23 | The DES permission table has no "resume engine" row. The DES rule lifecycle has no pause of a Shadow rule | DES §7 |
| IC-25 | Role sets differ: PRD FR-60 has 7 roles; EP §4 "staff, reviewer, or administrator"; PP S1 staff vs reviewer; persona "policy owner" is not a role | PRD FR-60 (see IC-05) |
| IC-26 | FR-13 requires matched rules and reason text. DES §6.1 DECISION_RECORD has neither field (DES §4.1 Decision does) | DES §6.1 |
| IC-30 | FR-22 makes the reason optional on approve. PP UC-02 L91: "approves, declines, or requests information with a reason" | Resolve through workshop question R-03 |

---

## 3. Policy-elicitation workshop guide (backlog item E3b)

### 3.1 Purpose and outputs

Workshop purpose: fill every [TBD-Stakeholder] / [TBD] marker in the PRD (FR-01, FR-16, FR-22, FR-25, FR-53, FR-62, NFR-01, NFR-03, NFR-10, NFR-13, NFR-15), every `TBD_` value and the context-field list in DES (§4.1, §6.2), and decisions D3–D9.

Outputs:

1. A completed **classification table** (§3.6).
2. A completed **parameter sheet** (§3.7).
3. Signed answers in the decision log (section 4).
4. A list of items still open, each with an owner and a due date.

Answers are recorded verbatim with the speaker's role. The BA does not paraphrase them into rules during the session.

### 3.2 Attendees

| Role | Why they are needed | Sessions |
|---|---|---|
| Business sponsor / product owner | Decides scope questions (Q1/D8, Q8, Q10, D9) and breaks ties | A (opening and close), B |
| Policy owner(s) | Own the classification, thresholds and rule ownership (Q2, Q4/D3, D5) | A |
| Compliance officer | Regulated categories, prohibited automation, sign-off (Q3/D4) | A |
| Privacy officer | Permitted fields and retention (Q5/D7, NFR-10) | A (part 2), B |
| 1–2 head-office reviewers | Real decision criteria, edge cases, reason rules, authority levels | A |
| 1–2 front-line staff (from different branches if possible) | Request types, fields, escalation needs, timing | A (part 1) |
| Operations / branch manager | Routing, volumes, hours, exceptions (Q6, Q7, Q9) | B |
| IT / security representative | Browsers, identity, availability, load (NFR-01, NFR-13) | B |
| BA (facilitator), tech lead (observer, answers feasibility questions only), scribe | Run the session; flag answers that cannot be configured | A, B |

### 3.3 Pre-work, sent five working days before

- One-page summary of the three paths and the fail-safe rule (PRD §1, §7).
- Request for **20–50 anonymized or synthetic past cases**, covering an approved, a declined and a referred case for each request type. Real data is not to be shared until DL-N03 is decided.
- Request for any existing written policy, limits table or compliance memo.
- The blank classification template (§3.6), so attendees can draft entries in advance.

### 3.4 Agenda

Durations are recommendations.

**Session A: decision policy (about 3 hours)**

| Time | Item | Output |
|---|---|---|
| 0:00–0:15 | Purpose; three paths; "anything unclear goes to a human"; ground rules (no rule is active without shadow mode and sign-off) | Shared understanding |
| 0:15–0:45 | Inventory of request types (questions P-01, P-02) | Rows of the classification table |
| 0:45–1:30 | Walk each request type: always-human triggers first, then hard-stop declines, then approvals (P-03 to P-10) | Criteria and thresholds |
| 1:30–1:40 | Break | |
| 1:40–2:10 | Compliance pass over each row (C-01 to C-04) | Compliance flag; prohibited categories |
| 2:10–2:40 | Governance: ownership, approval, activation, pause, accuracy (G-01 to G-09) | Answers to D3, D5, D6 |
| 2:40–3:00 | Data needed to evaluate each rule (F-01 to F-04); read back; list open items | Answer to D7; list of open items |

**Session B: operations and platform (about 90 minutes)**

| Time | Item | Output |
|---|---|---|
| 0:00–0:30 | Review, routing, exceptions (R-01 to R-07) | Answers to FR-22, FR-25, Q7 |
| 0:30–0:50 | Visibility and notifications (V-01, N-01 to N-03) | Answers to FR-62, FR-53, D9 |
| 0:50–1:20 | Volumes, hours, performance, browsers, retention (O-01 to O-06) | Answers to NFR-01, 03, 10, 13, 15 |
| 1:20–1:30 | Scope boundary: transaction execution, rates (S-01, S-02) | Answers to D8 / Q1, Q10 |

### 3.5 Question bank

Each question names the marker it fills. Questions are yes/no or pick-one where possible, and each recommended default is stated.

**P. Request types and classification** (fills FR-16, Q2, `TBD_THRESHOLD_A`, `TBD_THRESHOLD_B`, `TBD_PAIR_LIST`, `TBD_SUPPORTED`)

| # | Question | Fills |
|---|---|---|
| P-01 | List every kind of exchange request a branch sends to head office today. Which kinds never go to head office? | FR-16, Q2 |
| P-02 | For each type: about how many per day, and what share does head office approve, decline, or return? | Q2, NFR-15, baseline |
| P-03 | For each type, is there any situation where it must **always** be seen by a person, whatever the amount? (pick: yes, list triggers / no) | Always-human rules |
| P-04 | For each type, which conditions mean it must be **refused outright**, with no judgment? State the exact condition and the reason text staff will read | Auto-decline rules, reason templates |
| P-05 | For each type, which conditions mean head office would **always** say yes today? State every condition that must hold together | Auto-approve rules |
| P-06 | Which currency pairs are **supported** at all? Which of those are eligible for auto-approval? Is the eligible list a subset of the supported list? (yes/no) | `TBD_SUPPORTED`, `TBD_PAIR_LIST` |
| P-07 | Is the amount limit set **per currency** or **in one base currency**? If base currency, which rate is used for conversion, given that live rates are out of scope? | `TBD_THRESHOLD_A/B`, IC-24 |
| P-08 | What is the auto-approve limit (A) and the always-review limit (B)? Confirm A ≤ B. Amounts between A and B go to a person by default: accept? (yes/no) | `TBD_THRESHOLD_A`, `TBD_THRESHOLD_B` |
| P-09 | Is a value exactly equal to a limit inside or outside it? (pick: inside / outside) | Boundary semantics for `lte`/`gt` |
| P-10 | Do limits vary by branch, customer type, time of day, or cumulative amount per customer or day (velocity)? (yes/no for each) | DES §4.1 Environment fields |

**C. Compliance** (fills Q3, D4)

| # | Question | Fills |
|---|---|---|
| C-01 | Is any request type **prohibited** from automated approval by regulation or internal policy? (list) | D4 |
| C-02 | Is any request type prohibited from automated **decline**? For example, must every refusal be made by a person? (list) | D4 |
| C-03 | Which rule categories are "regulated", so that compliance must co-approve each rule version (FR-31)? | FR-31 category flag |
| C-04 | Does automation change any obligation, such as reporting thresholds or record-keeping, that ExchangeFlow must not interfere with? | PG-17 boundary |

**G. Governance and automation safety** (fills D3, D5, D6, FR-33, FR-42, PRD §9 guardrail)

| # | Question | Fills |
|---|---|---|
| G-01 | If a request matches both an approve rule and a hard-stop decline rule: (a) send it to a person (current default), or (b) decline it? | D3, Q4 |
| G-02 | Who is the named owner of each rule category? | Classification table "Owner" |
| G-03 | Must the approver of a rule version be someone other than its author? (yes, recommended) Must the person who **activates** it be a third person? (yes/no) | D5, IC-05 |
| G-04 | What shadow-mode result is enough to switch a rule on: minimum number of cases, and minimum agreement % with human decisions? | FR-33, IC-28 |
| G-05 | Who may **pause** a rule or the engine? (DES §7 proposes author, approver, compliance, manager.) Who may **resume**? | FR-34, DES §7 |
| G-06 | After someone presses pause, how long may automation continue: immediately (next request), or up to N seconds? | D6, IC-07 |
| G-07 | What accuracy level, measured by overturned auto-declines plus sampled-review errors, triggers an automatic pause of a rule? | PRD §9 guardrail |
| G-08 | What share or number of automated decisions should managers sample, and how often? | FR-42 |
| G-09 | Which rule category should go live first? (lowest risk) | DES §12 rollout |

**F. Data fields** (fills FR-01, D7, Q5, DES §4.1)

| # | Question | Fills |
|---|---|---|
| F-01 | Which fields does a reviewer need to decide each request type? Mark each field as required or optional | FR-01 |
| F-02 | Which of those are customer data? For each, is it permitted to store it in ExchangeFlow? (privacy officer answers) | D7, NFR-07 |
| F-03 | Can rules work with derived values (for example "customer is verified: yes/no") instead of raw identity data? (yes, recommended) | D7, data minimization |
| F-04 | Should admins be able to change the required-field list without a release? (yes/no) | PG-14 gap, DL-N05 |

**R. Review, routing and exceptions** (fills FR-22, FR-25, Q6, Q7)

| # | Question | Fills |
|---|---|---|
| R-01 | Is there one review queue, or several (by branch, request type or amount)? | FR-25, Q6 |
| R-02 | Are there reviewer authority levels, such as amount limits per reviewer? (yes/no; if yes, list them) | FR-25, Q6 |
| R-03 | Is a reason required when a reviewer **approves**? (yes/no) Should reasons be picked from a list, typed as free text, or both? | FR-22, IC-30 |
| R-04 | May a reviewer decide a request they submitted themselves, or one from their own branch? (yes/no) | Separation of duties |
| R-05 | If no reviewer acts within N minutes, what happens: escalate to whom, notify whom? | Q7, PG-16 |
| R-06 | Can a request be marked urgent? Can staff cancel a request, and in which states? | Q7; possible Cancelled state |
| R-07 | When staff resubmit after "more information needed", should the request (a) go back to a reviewer, or (b) be re-evaluated by the rules? | IC-02, DL-N02 |
| R-08 | How long after an auto-decline may staff escalate it? May a reviewer-confirmed decline be escalated again? (yes/no) | IC-09, DL-N04 |

**V / N. Visibility and notifications** (fills FR-62, FR-53, Q8, D9)

| # | Question | Fills |
|---|---|---|
| V-01 | Should staff see only their branch's requests? Which roles need cross-branch visibility? | FR-62 |
| N-01 | Which channels are wanted beyond in-app: email, desktop push, SMS? (pick) | FR-53, Q8 |
| N-02 | Should customers be told automated outcomes by ExchangeFlow? (no, recommended for this release) | D9 |
| N-03 | Which events must notify whom? (submit, decision, more info, escalation, timeout) | FR-50, FR-51 |

**O. Operations and platform** (fills NFR-01, NFR-03, NFR-10, NFR-13, NFR-15)

| # | Question | Fills |
|---|---|---|
| O-01 | How many branches, staff, reviewers, and requests per day are expected (average and peak)? | NFR-15, NFR-01 load |
| O-02 | What is the acceptable wait for an automated answer at the counter? (2 s proposed) | NFR-01 |
| O-03 | What are the operating hours and time zones? What availability is required in those hours? | NFR-03 |
| O-04 | How long must requests, decisions and audit records be kept? Who may access old records? | NFR-10 |
| O-05 | Which browsers and versions do workstations run? Are any locked down? | NFR-13 |
| O-06 | What backup and restore window is acceptable? Who provides support? | SN-07 gap |

**S. Scope boundary** (fills D8/Q1, Q10)

| # | Question | Fills |
|---|---|---|
| S-01 | After an approval, does staff complete the exchange in the existing system (recommended), or must ExchangeFlow trigger it? | D8, Q1 |
| S-02 | Is an indicative rate display needed? If yes, from which permitted source? | Q10, FR-70 |
| S-03 | May real historical decisions be used, under privacy approval, to replay draft rules before activation? Or synthetic or anonymized data only? | IC-13, DL-N03 |

### 3.6 Classification template (for the business to fill in)

Use one row per rule candidate. A request type may have several rows: for example, one always-human row, one auto-decline row and one auto-approve row.

| Row | Request type | Path (Auto-approve / Auto-decline / Always-human) | Criteria (all must hold, plain language) | Thresholds and lists (value, unit or currency, boundary inside/outside) | Data fields needed | Reason text shown to staff | Rule owner (name or role) | Compliance flag (Regulated Y/N; automation prohibited Y/N) | Approver | Go-live priority (1 = first) | Source (person, document, or past-case IDs) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | *e.g. Cash buy, retail* | *Always-human* | *Amount above limit B* | *B = ___ CAD; above = outside* | *amount, currency* | *"Amount requires head-office review."* | | | | | |
| 2 | | | | | | | | | | | |
| 3 | | | | | | | | | | | |

Rules for filling it in:

- Anything not covered by a row goes to a human. Leave a cell blank rather than guessing.
- A request type with any "automation prohibited = Y" cell gets **Always-human** rows only.
- Every Auto-decline row needs reason text that staff can read aloud to a customer.
- Every Auto-approve or Auto-decline row needs a named owner, and an approver who is a different person.

### 3.7 Parameter sheet (single values)

| Parameter | Marker | Value | Owner | Date agreed |
|---|---|---|---|---|
| Auto-approve limit A (currency, boundary) | `TBD_THRESHOLD_A` | | Policy owner | |
| Always-review limit B (currency, boundary) | `TBD_THRESHOLD_B` | | Policy owner | |
| Supported pairs | `TBD_SUPPORTED` | | Policy owner | |
| Auto-approve-eligible pairs | `TBD_PAIR_LIST` | | Policy owner | |
| Approve-vs-decline conflict outcome | D3 | | Policy owner + compliance | |
| Activation sign-off: minimum cases and agreement % | FR-33 | | Policy owner | |
| Auto-pause accuracy threshold | PRD §9 | | Policy owner | |
| Sampled-review rate | FR-42 | | Ops manager | |
| Maximum pause propagation delay | D6 | | Policy owner / tech lead | |
| Escalation window | DL-N04 | | Ops manager | |
| Reviewer timeout and escalation target | Q7 | | Ops manager | |
| Automated-response target (p95) | NFR-01 | | Ops + IT | |
| Operating hours and availability | NFR-03 | | Ops + IT | |
| Retention periods | NFR-10 | | Compliance / privacy | |
| Volumes (branches, users, requests per day, peak) | NFR-15 | | Ops | |
| Supported browsers | NFR-13 | | IT | |

---

## 4. Stakeholder decision log

This log consolidates PRD Q1–Q10, DES D1–D9 and the new items raised by this review (DL-N…). Duplicates are cross-referenced.

"Default if unanswered" is the assumption the build will use if no answer arrives by the end of R0. Each default is recorded as an assumption, not as a requirement.

| ID | Question | Duplicate of | Owner | Why it matters | Default if unanswered | Blocks | Status |
|---|---|---|---|---|---|---|---|
| Q1 | Does auto-approve mean staff proceed in the existing system, or does ExchangeFlow trigger the transaction? | D8, PP 4, EP 4 | Product owner | Execution changes the scope, risk and integrations (PROP L123) | Staff complete it in the existing system; ExchangeFlow only decides and records | FR-07, scope of every release | Open |
| Q2 | Which request types and criteria are auto-approve, auto-decline or always-human? | PP 3, EP 3; DES TBD_ values | Policy owner | No automation without it | Every request goes to human review; placeholder rules stay in SHADOW only | FR-16, R2 exit, D4 | Open |
| Q3 | Are any automated decisions restricted by regulation or internal policy? | D4, PP 4a, EP 3a | Compliance | Automating a restricted type is a compliance breach | All types are treated as restricted (human only) until compliance clears them | Any activation (R3) | Open |
| Q4 | Approve and decline both match: should decline win, or go to a human? | D3 | Policy owner, compliance | Changes the conflict table (FR-11, PRD §7, DES §4.2) | Conflict goes to human review and the policy owner is alerted | FR-11 tests | Open |
| Q5 | What request fields and customer data are required and permitted? | D7, PP 6, EP 8 | Policy owner, privacy | Data model, privacy exposure, rule inputs | Minimal non-sensitive synthetic fields only | FR-01, E3, E4, NFR-07 | Open |
| Q6 | Are there multiple reviewer levels or branch-specific routing? | PP 3, EP 5 | Operations | Queue model and permissions | A single shared queue; any reviewer may decide any request | FR-25, FR-62 | Open |
| Q7 | No reviewer response, urgent request, or cancelled request: what happens? | EP 6 | Operations | Lifecycle completeness. There is currently no Cancelled state and no FR (PG-16) | No timers; aging is shown in the queue; no cancel (requests are left undecided) | Lifecycle sign-off (R0 exit) | Open |
| Q8 | Which notification channels? | PP 7, EP 7 | Product owner | Provider selection, cost | In-app only | FR-53, E8 | Open |
| Q9 | What are the volumes, branches, hours and availability target? | PP 10, EP 9 | Operations, IT | Sizing, NFR targets | Small pilot scale; business hours only; no formal SLA | NFR-01, 03, 15 | Open |
| Q10 | Is an indicative rate display needed, and from which permitted source? | PP 8, EP 10, PROP L132 | Product owner | Legal terms of use; also affects IC-24 (threshold currency) | Not built; FR-70 dormant | FR-70, E10 | Open |
| D1 | Rule format: declarative JSON or a rules library? | — | Architect | Reviewability and auditability of rules | Declarative JSON with a fixed operator set | E3a | Open (technical) |
| D2 | Rule storage: database or config repository? | — | Architect | Immutability and audit of rule versions | Database rows, versioned and immutable | E3a | Open (technical) |
| D3 | Should a hard-stop decline beat an approve rule? | Q4 | Policy owner, compliance | See Q4 | No; conflict goes to human | FR-11 | Open |
| D4 | Are any categories prohibited from automation? | Q3 | Compliance | See Q3 | Human-only until confirmed | R3 activation | Open |
| D5 | Is a two-person approval required for activation? Must the activator differ from the approver? | IC-05 | Policy owner | Separation of duties; team-size feasibility | Author ≠ approver; compliance co-approves regulated categories; the approver may activate | FR-31, FR-33, DES §7 | Open |
| D6 | Engine timeout, and caching interval for pause and policy | IC-07 | Tech lead (business sets the acceptable pause lag) | A cached pause lets automation continue after the kill switch | Pause is read on every evaluation (no cache), which matches FR-34 | NFR-02, FR-34 | Open |
| D7 | Which context fields are necessary and permitted? | Q5 | Policy owner, privacy | Rule inputs vs data minimization | Request type, currency pair, amount, branch, submitter role; no customer identity data | DES §4.1, E3a | Open |
| D8 | Does auto-approve trigger the transaction? | Q1 | Product owner | See Q1 | Staff complete it in the existing process | — | Open |
| D9 | Customer-facing notification of automated outcomes | IC-14; PROP L64, L129; EP Q7 | Product owner | Proposal stakeholders expect customer updates; the PRD excluded them without a recorded answer | Out of scope for this release; staff tell the customer | PRD §3 non-goal confirmation | Open |
| DL-N01 | May placeholder rules auto-approve or auto-decline in the **demo** environment of the first increment? | IC-01 | Product owner | Sets the R1 acceptance tests (EP §7 vs FR-17) | No; FR-17 and DES §6.2 stand, and EP §7 and PP S6 are revised | R1 / first-increment acceptance | **Decided 2026-10-01:** only outside production (ADR-021) |
| DL-N02 | After "more information needed", does a resubmission go back to the reviewer or through the rules again? | IC-02, R-07 | Policy owner, operations | A rule could decide a case that a person is handling | Back to a human reviewer (the more conservative option); the PRD FR-10 wording would then change | FR-06, FR-10, DES §3 | **Decided 2026-10-01:** always human review (ADR-022) |
| DL-N03 | May real historical decisions be used to replay draft rules, and under which approval? | IC-13, S-03 | Privacy, compliance | The DES activation gate requires replay; NFR-08 forbids real data | Replay on synthetic or anonymized cases only | FR-33, R3 activation | **New** |
| DL-N04 | Escalation window and limits: which declines can be escalated, until when, and how many times? | IC-09, R-08 | Operations | Prevents escalation loops; the state guard needs it | Only rule-declined requests; once; no time limit | FR-05, DES §3 | **New** |
| DL-N05 | Should admins be able to configure required request fields without a release? | PG-14, F-04 | Product owner | The proposal scope promises it; no FR exists | No; the field set is fixed per release | FR-01 | **New** |
| DL-N06 | Are threshold amounts per currency or in a base currency? | IC-24, P-07 | Policy owner | Without a rate source, a base-currency limit cannot be evaluated | Per currency | DES §6.2, `TBD_THRESHOLD_A/B` | **New** |
| DL-N07 | Which release do escalation (FR-05), clarification (FR-06) and search (FR-43) belong to? | IC-03, IC-12 | Product owner | The R1 demo scope and tests differ between the PRD and PP | Follow the PRD §10 (R1) | R1 plan | **New** |
| DL-N08 | Confirm or drop the unsourced targets: 2 s p95, under one minute, WCAG 2.1 AA, effective dating | Section 1.4 orphans | Product owner, IT | Values with no stakeholder source | Keep them as provisional targets marked TBD | NFR-01, 11, 12, FR-35 | **New** |
| DL-N09 | 2 |
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
| DL-N09 | Is the credit union provincially or federally regulated, and in which province? | (research DL-N26) | Sponsor, compliance officer | Prudential, privacy, outsourcing and retention rules differ; FINTRAC duties do not | Treat as provincial, province unknown; build a regulatory profile as configuration; no province-specific rule is coded | DL-N10 to DL-N27 Province-specific items; FR-NEW-c; hosting region (ADR-019) | Provisionally answered 2026-10-01: Ontario, provincial (Alterna Savings, per public web search, secondary source); compliance to confirm |
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
| DL-N28 | Do hosts nobody deploys gate every pull request, or run nightly? | — | Tech lead, manager | CI definition, cost | Full layout approved 2026-10-01 (ADR-023): HTTP-path subset on pull request, full suite nightly | P5, R24 | New |
| DL-N29 | Who owns the Functions feasibility spike (P21), and what are the numeric pass and stop criteria (relay lag, p95, double-fire, cold start)? | — | Manager | Option 3 viability | Spike scheduled in REL-1 with an owner named at planning; criteria set by the tech lead | R23 | New |
| DL-N30 | Are `AuditChain` (on the transaction) and `KeySigner` (outside it) confirmed as separate ports? | — | Architect | ADR-023 acceptance | As drawn in `docs/core-engine-plan.md` §4 | ADR-023 | New |
| DL-N31 | Is the teller action after an auto-decline called "Escalate" (as in FR-05, glossary, audit events) or a new UI label such as "Send to head office"; and what do we call the engine routing a new request to a reviewer? | (designer Q3a) | Product owner | A rename creates two vocabularies and, as drawn, one phrase with two meanings (UI-BA-01) | Keep "Escalate" everywhere; engine routing labelled "Sent for review" | FR-05 text, glossary, history labels, French catalogue, escalation tests | New |
| DL-N32 | Does the review queue show an overdue ("Late") marker? If yes, after how many minutes? | Q7, Q9, (designer Q2) | Operations | A threshold is an invented SLA; affects layout, metrics and tests | No marker; show age in minutes, sorted oldest first; no sample value in specs | FR-20 flagging, UI queue spec, FR-40 | New |
| DL-N33 | What are the label, confirmation text and neutral display state for "Refer to compliance", in English and French? | DL-N17 | Compliance, product owner | FR-80 is a REL-1 must-have; ad hoc copy is how restricted terms leak | Generic label "Ask head office to look at this" and neutral state "Under head-office review"; compliance approves before build | FR-80, FR-81, REL-1 demo | New |
| DL-N34 | Who approves the reason set shown to staff and reviewers (cause words and outcome "Why" text, EN and FR), and may a restricted cause appear as anything other than an ordinary referral? | DL-N18, (designer Q3b, Q7) | Compliance, policy owner | FR-81, UI-BA-06 and 08; also settles designer question 7 | Restricted causes show as the ordinary "Rule needs a person"; staff see the approved reason for every outcome (FR-03) | FR-03, FR-21, FR-81, UI copy, E3a reason enum | New |
| DL-N35 | Does a teller see the branch's requests (FR-04) or only their own? | Q6 | Operations | Changes the permission matrix and list design | Branch list with a "Mine" filter | FR-04, permission matrix | New |
| DL-N36 | What is the completion mismatch tolerance, and what exactly is the teller told when completion is blocked? | FR-07 | Compliance | UI-BA-04: design contradicts FR-07 | Block any mismatch; neutral message; no mention of an alert | FR-07, completion dialog | New |
| DL-N37 | Visual extras: dark theme, animated stamp, third font family, brand colour or logo: wanted for REL-1? | (designer Q1, Q5, Q6) | Product owner | Cost and test matrix; none is in the PRD | Light theme only; static stamp; two font families; neutral brand | UI-BA-20, accessibility test matrix | New; **branch desk only (2026-10-12, product owner):** Alterna logo shown by URL reference (ADR-029); Alterna sign-off still needed |
| DL-N38 | Is a full `fr-CA` interface (and decimal-comma input) in REL-1, or only French reason text per FR-81? | DL-N24, DL-N27, FR-83, (designer Q4) | Sponsor, privacy | Catalogue scope and test cost | French for the approved reason set only; English UI; decimal point input | FR-81, FR-83, i18n checklist | New |
| DL-N39 | The product owner decided (2026-10-02) to record the member's name on each request, overriding the references-only default (DL-N11) for the name only. What are the retention period, purge method, who may see it, and is anything beyond the name (address, date of birth, occupation) needed? | DL-N11, BQ-7, NFR-10 | Product owner, compliance, privacy | Member name is personal data in the request store; the design keeps it out of rules, audit rows, notifications, logs and the decision snapshot | Stored in the request revision only; shown to roles that can open the request; retention follows BQ-7 (keep until set); no other personal fields | NFR-07, NFR-10, DL-N11, REL-4 real data | Name stored in the local build; retention open |
| DL-N40 | The product owner named the uexchange.ca public feed (entry id 20, USD) as the rate source for the amount the teller gives. Are its terms of use acceptable; is the quote locked at submit or refreshed at completion; is rounding down to the cent the policy; are buy and sell sides mapped correctly (member sells CAD: sell value; member sells USD: buy value)? | Q10, FR-70 | Product owner, compliance, finance | A third party's rates are not Alterna's rate board; an approval can happen hours after submit; rounding affects what the member receives | Indicative only; quote stored at submit with its age; notice when older than 15 minutes; floor to the cent; mapping as stated; not used by rules | FR-70, any non-local use, REL-4 | Implemented locally; terms unconfirmed |
| DL-N41 | The branch desk is used with real members. Does ADR-021 apply to it? What may a teller do on a result produced by `TRIAL` (unapproved) rules? | DL-N01, ADR-021 | Product owner, compliance | ADR-021 forbids placeholder rules deciding in production. The desk currently tells the teller to complete within-limits exchanges on TRIAL values (DESK-BA-01). | (a) The desk may not be used with members until `APPROVED`. (b) **Recommended:** while TRIAL, every result needs head-office confirmation before completion, and "Within branch limits" is shown only as information. (c) Accept as built, by a new ADR that scopes ADR-021, with a dated owner waiver. Default: (b). | Any use with members; desk copy | **Decided 2026-10-12 (product owner):** act now on the desk under a scoped, dated deviation from ADR-021 (ADR-029). Main app unchanged |
| DL-N42 | Who owns `branch-rules.json`, who may edit it, who approves a change (distinct from the editor?), where does it live, and how are branches told about a change? | D5, DL-N10 | Policy owner, compliance | The values set what tellers may do without head office. Hot reload means silent mid-day changes (DESK-BA-05). | **Recommended:** a named head-office officer edits; a different approver signs; compliance co-approves the values (DL-N10); a change log in the README; branches are notified by email on each version. Default: stays `TRIAL`. | Setting `APPROVED`; DL-N41 option (b) exit | Open (proposed in `reviews/desk-ba.md`, 2026-10-12) |
| DL-N43 | What is "head-office confirmation"? Who staffs the confirmation mailbox, what is the reply format and turnaround, and what does the teller do if no reply arrives? | Q7, BQ-3 | Operations | Without it, "confirmation" in three next-step texts cannot be acted on or tested (DESK-BA-04). | **Recommended:** a reply email quoting the record number and "confirmed" or "not confirmed" counts as confirmation and is filed with the record. Turnaround `[TBD-Stakeholder]`. No reply by branch close means do not complete; re-check the next day. A real mailbox address replaces `example.org`. | Desk next-step copy; use with members | Open (proposed in `reviews/desk-ba.md`, 2026-10-12) |
| DL-N44 | Where do desk PDFs with the member name live (mailbox, branch file, teller workstation, paper)? For how long, who may read them, and how are they destroyed? | DL-N39, BQ-7, DL-N26 | Privacy officer, compliance | Every desk record creates uncontrolled copies of personal data outside any system (DESK-BA-03). | **Recommended:** a restricted shared mailbox; tellers delete the local PDF after sending; paper goes in the existing branch file under its retention; mailbox retention `[TBD-Stakeholder]`, aligned with BQ-7. Privacy officer signs off. | Use with members | Open (proposed in `reviews/desk-ba.md`, 2026-10-12) |
| DL-N45 | Should the desk keep a register of records it produces? If so, what fields (without the member name)? | FR-40-style audit; DL-N11 | Product owner, operations | Without a register there is no bookkeeping, no missing-record check, no detection of re-checks, and no per-member limit is possible (DESK-BA-09, 08). | (a) None, as built. (b) **Recommended:** insert-only register of record number, time, branch, staff ID, result, rules version and hashes, with no member name or member reference. (c) Also include member reference, which enables a daily limit but adds personal data. Default: (b). | Bookkeeping; DL-N49(a) | **Decided 2026-10-12 (product owner):** no register for now; the emailed PDF is the only record (ADR-029). Revisit |
| DL-N46 | Is a typed staff ID with no sign-in acceptable for the interim desk, and may it be served over the branch network? | NFR-05 | Security owner, operations | Anyone with access can produce records under any staff ID (DESK-BA-10). | **Recommended:** loopback only (one per workstation) and a hand signature on the printout as the identity control; network mode only after security review. Default: loopback only. | Deployment of the desk | Open (product owner: "not decided yet", 2026-10-12). Interim: loopback only, enforced in code |
| DL-N47 | Does the desk replace or sit beside the existing exchange procedure? Do the existing system's approvals and identity steps still apply? When is the desk retired, and are its records migrated? | Q1/D8, FR-05, FR-07 | Product owner, operations | It sets the claim "checks all requirements", the once-only escalation, the end date, and the migration scope (DESK-BA-16, 17, 11). | **Recommended:** beside, not instead of; the existing procedure and approvals apply in full; FR-05 once-only applies by procedure; retire when REL-1 is live at the branch; no migration. | Desk fine print; training | Open (proposed in `reviews/desk-ba.md`, 2026-10-12) |
| DL-N48 | Who approves the desk's user-visible texts: the three result labels, the three next-step texts, the TRIAL banner and band, and a desk-specific reason for within-limits that does not say "approved"? | DL-N34, DL-N31 | Compliance, policy owner | New copy shown to staff and filed with member records has no approver. The current texts contradict each other (DESK-BA-02, 18). | **Recommended:** the same approver as DL-N34. "Escalate" is used for the decline path (DL-N31). Default: no "Approved…" text on TRIAL records. | Desk copy sign-off | Open (proposed in `reviews/desk-ba.md`, 2026-10-12) |
| DL-N49 | Which fields should the head-office rules file have? (a) a per-member daily limit; (b) branch hours and holidays; (c) per-branch limits; (d) a minimum amount; (e) effective-from and expiry dates; (f) a contact. Also, what are `headOfficeReviewAbove` and `absoluteBranchMax` for, since today they change no outcome? | DL-N06, Q2 | Policy owner | The officer cannot express the expected policy, and two fields mislead (DESK-BA-06, 08). | **Recommended:** add (b), (e) and (f) now; (c) only if branches differ; (a) only after DL-N45 (c). Keep `branchLimit` as the one deciding value and document the other two as safety nets, until the owner states a distinct use. | Rules-file v2; officer guide | **Partly decided 2026-10-12 (product owner):** interim two-tier limits, USD→CAD up to 2,000.00 USD, CAD→USD up to 1,500.00 CAD; above = cannot be done at the branch; marked TO-BE-CHANGED until head office supplies the rules. Other fields open |

### What blocks implementation

- **Regulatory questions (v0.3):** DL-N09 (province) and DL-N10 (compliance officer, counsel review) gate everything else. DL-N11, N12, N16, N19 and N22 shape the REL-1 field list and the E3a input schema. DL-N13 to DL-N27 and BQ-7 mostly block REL-2 to REL-4. DL-N09 carries a provisional Ontario answer from a public web search (secondary source); compliance must confirm it. UI questions DL-N31 to DL-N38 come from the UI design reviews (`reviews/ui-ba.md`); DL-N33, DL-N34 and DL-N36 block REL-1 UI sign-off, and the implementation applies the stated defaults until they are answered. Decided 2026-10-01 without a log row: ADR-025 (guardrail over all outcomes), ADR-026 (restricted channel in REL-1), ADR-023 (full multi-host layout).

- **R1 cannot be specified for QA until** DL-N01, DL-N02 and DL-N07 are decided. Q5 / D7 must also be answered, or the minimal-field default accepted.
- **R2 (real rules in shadow)** is blocked by Q2 and the classification template, and needs D3/Q4 and DL-N06.
- **R3 (any activation)** is blocked by Q3/D4, D5, DL-N03, and the G-04 and G-07 thresholds.
- **IC-08** (the missing-data check runs before the shadow split) needs the design and algorithm pass before E3a is built.
