# UI design: business analysis review (UI-BA)

Date: 2026-10-01. Reviewer: ba agent. Point-in-time snapshot; do not treat as current truth after the PRD changes below are applied.

**Reviewed:** `docs/ui-design/ui-design.md` (v1 proposal), `tokens.css`, `screens.html`.
**Against:** `PRD.md` (FR-01 to 08, 20 to 28, 43, 50 to 52, 80 to 83; NFR-11, 12, 13, 16; §7.2 state names; glossary), `policy-engine-design.md` §3 and §6.3 (also §4.3 for `fallbackCause`), `reviews/ba-review.md` §4 and its ready-to-paste table (DL-N01 to DL-N30).
**Not edited:** PRD, design docs, ba-review. Proposed PRD and traceability changes are listed in sections 4 and 5 for the main session.

## 1. Summary

| Result | Count |
|---|---|
| Findings | 24 (High 7, Medium 13, Low 4) |
| Requirements in scope (36) with a screen that meets them | FR-01 to 04, 06 (partly), 08, 20, 22 (see UI-BA-09), 23, 24, 26 (UI exists, rules TBD), 28, 50, 51, 52, NFR-16 |
| In scope with no screen | FR-43 (search), FR-80 (refer to compliance), FR-27 (Expired state), FR-82, FR-83 (back-end; no UI expected, but language profile is affected) |
| Conflicts with a requirement | FR-07 (completion mismatch), FR-21 (shadow results), FR-05 (renamed action), FR-81 and design §6.3 (restricted-cause label), FR-04 (own vs branch list) |
| Design content with no source (scope creep) | Late threshold and relative meter, dark theme, three-font stack and stamp motion, `fr-CA` as a UI deliverable, Round divider term, 3-character reason minimum, approve without reason, collapsed audit "Details" for managers |

The design is strong on accessibility, status encoding and error copy. The main problems are: one missing REL-1 must-have screen (FR-80), two direct conflicts with the PRD (FR-07, FR-21), a restricted-topic "tell" in the cause mapping, a rename that collides with an existing meaning, and an invented SLA.

## 2. Screen and action traceability

| Screen or action (design §) | Requirement or use case | Status | Note |
|---|---|---|---|
| Sign-in, test user list (4.1) | NFR-05, Auth ADRs; test environment | Met | Production variant is Entra via BFF; the user picker must be absent from production builds (ADR-021 spirit). See UI-BA-20 |
| Teller request list (4.2) | FR-04, UC-03 | Conflict | "My requests" vs "branch's requests" (UI-BA-12) |
| New request, Submit, Save draft (4.3) | FR-01, FR-02, FR-03, FR-08, UC-01 | Met | Field list is `[TBD-Stakeholder]` (FR-01); fields shown are candidates only (UI-BA-13) |
| Idempotency, busy state | FR-08 | Met (no visible behaviour needed) | Add: double-click must not create a second request |
| Outcome docket (4.4) | FR-03 | Met | Copy open (UI-BA-14, UI-BA-17) |
| Send to head office (escalate) | FR-05, UC-01 | Conflict (wording) | UI-BA-01 |
| Request detail and history (4.5) | FR-04, FR-21, FR-43 | Partly | No revisions view (FR-06, FR-21); audit behind "Details" (UI-BA-11) |
| Update and resubmit | FR-06 | Met | Same-reviewer routing not visible; revisions not shown |
| Cancel request | FR-26 | Met with open rule | Who and from which states is BQ-4; button shown on one state only in the sample |
| Record completion (5.4 dialog, 7) | FR-07 | Conflict | UI-BA-04 |
| Reviewer queue (4.6) | FR-20, FR-51, UC-02 | Met plus creep | Late threshold, UI-BA-03 |
| Decision panel (4.7) | FR-22, FR-23, FR-24, FR-28 | Partly | Approve reason open (R-03), UI-BA-09 |
| How the engine decided (4.7, 7) | FR-21 | Conflict | Shadow timing, UI-BA-05 |
| Decision engine panel, pause and resume (4.8) | FR-34, FR-36 (REL-2) | Out of REL-1 | Not in the review scope; note it is REL-2 and sits in the nav (UI-BA-18) |
| Notifications popover (5.4) | FR-50 (S, REL-2), FR-51 (S, REL-2), FR-52 (M, REL-1) | Met; release mismatch | UI-BA-16 |
| Refer to compliance | FR-80 (M, REL-1) | **Gap** | UI-BA-02 |
| Search and audit view | FR-43 (M, REL-1) | **Gap** | UI-BA-10 |
| Expired state | FR-27 (S, REL-3), PRD §7.2 | Gap | Status mark table 5.3 has no Expired |
| Language, French catalogue | FR-81 (EN and FR reason text), FR-83 (language requirements) | Partly | UI-BA-15 |
| Accessibility targets | NFR-12 | Met plus assumption | WCAG 2.1 AA still unsourced (DL-N08); UI-BA-19 |
| Usability, one-minute submit | NFR-11 | Not evidenced | Design has no task-time measure; UI-BA-21 |
| Browsers | NFR-13 | Silent | UI-BA-22 |
| Output encoding, CSP | NFR-16 | At risk | External font link, UI-BA-19 |

## 3. Findings

### High

**UI-BA-01 (High) "Send to head office" replaces "Escalate" and now means two different things.**
- Evidence: `ui-design.md` §6 table ("replaces 'Escalate'"), §9 item 10, §10 (rename in `ACTION_LABEL`), §4.5 history sample ("Sent to head office / Rule engine. A reviewer needs to decide."), outcome variant 3 stamp "With head office", §7.9 ("Escalated auto-decline: Teller disagreed with a rule decline"). Source: PRD FR-05 ("escalate ... once"), glossary ("Escalation: Staff asking a reviewer, once, to reconsider an auto-decline"), `policy-engine-design.md` §3 and §5.3, permission matrix row "Escalate an auto-decline", audit event `request.escalated`.
- Problem: the same phrase labels (a) the teller action after an auto-decline and (b) the engine routing a new request to human review (history sample). A user cannot tell a teller escalation from a first-time referral in the history. Also the PRD, state diagram, audit names and metrics ("overturned escalations") all say escalation; a rename in the UI only creates a second vocabulary. Also, "head office" is a place, not a role; PRD says reviewer.
- Consequence if kept: glossary, FR-05, UC text, test names, audit labels, French catalogue and training diverge.
- Fix: keep the term **Escalate** as the canonical name in all documents and audit event names. If the owner prefers plainer wording, define it as a display label only, add it to the PRD glossary ("UI label for Escalate"), and use it only for the teller action and its history line. Use a different phrase for engine routing (suggest "Sent for review"). Decision DL-N31.

**UI-BA-02 (High) No screen or action for "Refer to compliance" (FR-80, M, REL-1) and no neutral display state.**
- Evidence: FR-80; `policy-engine-design.md` §6.3 ("Available on every decided, declined or cancelled request ... generic confirmation ... neutral display state"). `ui-design.md` has no such action, confirmation, state or role placement; §5.3 status table has no neutral referral state; §4.5 lists only Update and resubmit, Cancel.
- Consequence: the REL-1 exit demo cannot show a must-have; unreviewed ad hoc copy will be written by the developer, which is how restricted terms leak.
- Fix: designer to add the action (label proposal "Ask head office to look at this", wording to be approved, no restricted topic words), the generic confirmation, and the neutral display state (the same mark and word for every referred request, no timing or layout difference, visible to all general roles). Owner for wording: compliance with product owner. Decision DL-N33.

**UI-BA-03 (High) "Late" threshold, relative meter and "Late" word are an invented SLA.**
- Evidence: `ui-design.md` §4.6 ("relative to the late threshold, `[TBD-Stakeholder]`"; word "Late"; thicker amber bar), §3 `--warn` role ("late"), §11 item 2 ("Sample uses 45"), `screens.html` `.late` class, row "52 min Late", footnote "sample uses 45 min". Sources: FR-20 requires queue sortable by age, flagged causes; Q7 default "No timers; aging is shown in the queue"; Q9 default "no formal SLA"; FR-40 (age views, S, REL-3). No requirement has a Late state.
- Problem: a threshold is also a compliance and conduct signal (a request called "Late" implies an obligation). CLAUDE.md: no invented thresholds. The sample 45 will be copied into screenshots and tests.
- Fix: REL-1 shows age in minutes and sorts oldest first, with no "Late" word, no relative meter and no sample number. Keep the meter only if its scale is a fixed visual scale unrelated to a deadline (for example capped at 60 min), and say so. Re-open when operations answer Q7/Q9. Decision DL-N32.

**UI-BA-04 (High) Completion mismatch copy contradicts FR-07 and design §3.2.**
- Evidence: `ui-design.md` §7 "Request-detail rules": "Completed. The executed values differ from the approved values, so head office has been told." PRD FR-07 and `policy-engine-design.md` §3.2: a mismatch **beyond tolerance blocks completion and alerts compliance**; tolerance is `[TBD-Stakeholder]`.
- Problem: the design shows a successful Completed state with a mismatch. Under the PRD the request stays Approved, completion is refused, and compliance (not "head office") is alerted. Telling a teller that an alert was raised is also a possible tipping-off line.
- Fix: for a mismatch beyond tolerance: block, show a neutral message ("These values do not match the approval. Check them against the existing system.") with no mention of an alert; within tolerance: complete without a banner. Designer to confirm with the tolerance owner. Add the tolerance question to the log (DL-N36). Also the completion dialog needs the field list (amount, currency pair, transaction reference) from FR-07.

**UI-BA-05 (High) Reviewers see shadow results in "How the engine decided", contrary to FR-21.**
- Evidence: `ui-design.md` §7 "Request-detail rules" ("reviewers see them inside 'How the engine decided'"), §4.7. PRD FR-21: "Shadow results are shown only after the reviewer has decided." Sample in `screens.html` shows "Result, Reason, Rule, Policy" only, so the sample is compliant and the prose is not.
- Why it matters: shadow results exist to measure human-vs-rule agreement (FR-37); showing them before the decision biases the human outcome and corrupts the metric.
- Fix: amend the design text to "after the reviewer has decided"; show the shadow block only in the read-only post-decision view. No PRD change.

**UI-BA-06 (High) "Head-office check required" and the GUARDRAIL row are a tell and conflict with §6.3.**
- Evidence: `ui-design.md` §2 principle 6, §7.9 (row `GUARDRAIL (and any restricted detail)` to "Head-office check required"; the next paragraph claims it is "never ... distinguishable"), queue sample row "G1F7QS ... Head-office check required", §9 item 10 (the old "Compliance has been flagged" was removed as a tell). `policy-engine-design.md` §6.3: "restricted causes appear as generic `HUMAN_REVIEW`"; "The staff-visible `fallbackCause` list excludes restricted detail." FR-81: restricted causes invisible to every general role.
- Problem: (1) the label is unique to one cause, so any teller or reviewer who sees it learns "a guardrail fired", which is the same tell the design already removed. Distinguishable by text, even if the layout matches. (2) The UI table maps a code, `GUARDRAIL`, so the client would be sent the code; §6.3 says the projected decision must not carry it. (3) `policy-engine-design.md` §4.1 lists `GUARDRAIL` among general `fallbackCause` values with only the sub-cause `COMPLIANCE_GUARDRAIL` restricted. That is an unresolved ambiguity in the engine doc: is `GUARDRAIL` itself staff-visible?
- Consequence: if guardrail triggers only on restricted facts (FR-82), showing GUARDRAIL tells a general user the member has a compliance fact set.
- Fix: the server projects every restricted cause to the same cause and the same text as an ordinary referral (suggest `RULE_REQUIRES_HUMAN`, "Rule needs a person", or a deliberately generic "Needs a person"). Delete the GUARDRAIL row from the client mapping and from §7.9. Raise a clarification against `policy-engine-design.md` §4.1/§6.3 (architect). Add a canary test that the response for a guardrail-triggered request is byte-identical in shape to an ordinary one. Decision DL-N34 (approved reason set, EN and FR).

**UI-BA-07 (High) Restricted-topic hint in the decision panel sample.**
- Evidence: `screens.html` decision panel: "Some checks are shown only to head-office roles that need them." Sources: FR-81, NFR-07.
- Problem: the sentence tells every reviewer that hidden checks exist. FR-21 says restricted compliance information is never shown; saying that it exists is a lesser leak, but it is one the design already rules out ("never rendered, hinted at").
- Fix: remove the sentence. Same rule for any "some details are hidden" copy. Add to the lint list.

### Medium

**UI-BA-08 (Medium) Reason strings are designer-authored; FR-81 requires an approved enum set (EN and FR).**
- Evidence: `ui-design.md` §4.4 and §6 outcome copy ("Within the automatic limit for this currency pair", "This currency pair is not offered yet", "A head-office reviewer needs to decide this one"), §7.9 labels. `policy-engine-design.md` §6.3: "Reason text is an approved enum (English and French)."
- Problem: the UI mapping (§7.9) duplicates the server enum with different words; two sources of truth. "Why: engine reason text" in §4.4 contradicts the sample where text is invented. Also the sample decline reason names a policy ("currency pair not offered") that may not be a configured rule.
- Fix: the server returns the approved reason code and text in the active language; the UI only renders it. The §7.9 table becomes the proposed approved set to be submitted for compliance approval, not UI logic. Link to DL-N34.

**UI-BA-09 (Medium) Approve without a reason pre-empts open item R-03; 3-character minimum is invented.**
- Evidence: `ui-design.md` §4.7 ("Approve takes one click with no reason"; "3 or more characters"). PRD FR-22: reason required for decline and more information; approval **[TBD-Stakeholder: R-03]**; IC-30 notes the PRD and the plan disagree.
- Fix: say "Approve: reason requirement per R-03; default shown optional" and design the field so the reason box can be required for approve without a layout change. The minimum length is a validation rule, not a requirement: log it or drop it ("a non-empty reason"). Also confirm reasons are free text vs list (R-03 second half).

**UI-BA-10 (Medium) No search or audit-history screen (FR-43, M, REL-1).**
- Evidence: FR-43; `ui-design.md` §4 says "at most four destinations", nav is Requests, New request, Review queue, Decision engine. No search field, no audit view for managers or compliance. §4.5 moves audit sequence and hash behind "Details disclosure for managers".
- Fix: add a minimal search screen (by reference, status, date, branch) for authorised roles and a read-only audit view, or record FR-43 as designed in a later pass and mark REL-1 scope accordingly. Exports exclude restricted information (FR-43, FR-81).

**UI-BA-11 (Medium) Tellers see "actor, action and time" only; FR-04 says full history.**
- Evidence: §4.5 last paragraph; FR-04 ("open any one to see its full history"); FR-21 (reviewers see revisions, history, rule results).
- Problem: ambiguity on what "full" means for a teller. The design hides sequence and hash, which is reasonable, but also does not show revisions (FR-06: "earlier values are preserved as revisions"; FR-21).
- Fix: add revision comparison (previous value vs current) to the request detail for reviewers and tellers. Define "full history" in the PRD as every general-chain event with actor, action, time and reason (restricted excluded).

**UI-BA-12 (Medium) Teller list is "My requests"; FR-04 says the branch's requests.**
- Evidence: §4.2 title and filters; `screens.html` "My requests, 5 requests today". FR-04: "Staff can list their branch's requests".
- Fix: owner decides: own requests (needs the PRD changed) or branch requests (needs a "Mine" filter). Recommend the PRD wording stands and the list defaults to branch with a "Mine" filter. Also check against the branch-scope rule in the permission matrix. Decision DL-N35 (bundled with approve reason? no, separate).

**UI-BA-13 (Medium) The form shows candidate fields as if settled.**
- Evidence: §4.3 (Request type Exchange or Wire, Payment method "From account", Member reference, Note for the reviewer). FR-01: field list `[TBD-Stakeholder]`; payment method pending DL-N16; member reference pending DL-N11; third-party, entity, country flags DL-N21 to N23 not shown. The free-text note and the "Teller note" sample ("Member planning a trip abroad") invite personal and purpose-of-transaction data (Q5/D7 default: minimal, non-sensitive fields; NFR-07).
- Fix: label the form "candidate fields" in the spec; define the note as non-sensitive and length-limited; the reviewer's "What is the member buying the currency for?" example question (4.5) asks for a purpose. Confirm purpose collection is allowed under DL-N11 and Q5, or replace the sample.

**UI-BA-14 (Medium) Declined copy ignores the escalation window and reviewer declines.**
- Evidence: §6: "you can send it to head office once, with a reason." FR-05: within the window (BQ-5, DL-N04); reviewer declines cannot be escalated; Quebec route (DL-N27).
- Fix: copy variants: (a) Declined by rule, within window: current copy plus the window if one is set; (b) window lapsed or reviewer decline: no escalation sentence and no button. The state is `DECLINED` for both lapse and reviewer (policy §3), so the UI must read an `escalatable` flag from the server, not infer it from the label.

**UI-BA-15 (Medium) French treated as an open product question when the PRD already needs French reason text.**
- Evidence: §11 item 4; FR-81 ("approved set (English and French)"); FR-83 (language requirements in the regulatory profile); DL-N24, DL-N27; REG-BA-14.
- Fix: split the question: (a) French reason text for the approved set: required by FR-81, so the catalogue structure is in REL-1 scope; (b) a full `fr-CA` UI and decimal-comma input: owner decision, tied to DL-N24 (Quebec members) and FR-83. The API stays decimal point (CLAUDE.md money rule). Checklist item "i18n: extract strings" is REL-1 scope only for (a).

**UI-BA-16 (Medium) Copy depends on REL-2 notifications.**
- Evidence: outcome variant 3 "You will see the answer in your notifications"; FR-50 and FR-51 are S, REL-2; `PRD.md` REL-1 list includes FR-52 only; D9 and Q8 say in-app only.
- Fix: for REL-1, copy points to the request list and status ("You will see the answer on this request"). The notification popover is optional until REL-2. FR-51 is met in the queue by the 15-second refresh (inside the 30-second limit; keep the 15 and 30 numbers in step).

**UI-BA-17 (Medium) Term and state-name drift from approved vocabulary.**
- Evidence: "In head-office review" (§5.3, lists) vs PRD §7.2 display name "Under review"; "Sent again by teller" vs "resubmission" (FR-06, ADR-022, glossary); "Round" vs "Cycle" (FR-24, glossary); "Teller" vs "staff"; "Declined by rule" matches. "Wire request" appears as a cause in the queue (`screens.html`) but is not in §7.9 or in `fallbackCause`.
- Fix: add a UI vocabulary table to the PRD glossary listing each canonical term and its UI label (state names stay as in §7.2 unless the owner approves a change). Suggested: keep "Under review" in the PRD and add "In head-office review" as a display alias only with approval; "Round" shown to users, "cycle" in documents; "Resubmitted by teller". Remove "Wire request" from the cause column or map it to a real reason.

**UI-BA-18 (Medium) Scope beyond REL-1 in the shell.**
- Evidence: the nav includes "Decision engine" and the design details pause and resume (§4.8); `PRD.md` REL-1 list (FR-01 to 08, 10 to 15, 17, 20 to 24, 26, 28, 43, 44, 52, 60 to 63, 80 to 83) excludes FR-34 (REL-2).
- Fix: tag each screen with its release (4.8 is REL-2). Without this, the hand-off checklist (§10) builds REL-2 screens in REL-1.

**UI-BA-19 (Medium) NFR-12 and NFR-16 interplay and unverified contrast numbers.**
- Evidence: §8 claims WCAG 2.1 AA "(NFR-12)"; NFR-12 says AA is **[TBD: confirm]** (DL-N08, orphan in ba-review §1.4). §10 checklist: add a Google Fonts link "or self-host"; §3 says "Self-host in production". NFR-16: strict CSP; DL-N25 (data outside Canada). §8 says the ratios are "calculated values, not browser measurements".
- Fix: (a) treat AA as a provisional target until DL-N08 closes. (b) A third-party font request exposes user IPs and violates a strict CSP: require self-hosted fonts in every environment, not only production. (c) Contrast values need an independent verification pass (formula check, flag for the qa agent); the manual keyboard and screen-reader check (NFR-12) is not in the §10 test list.

**UI-BA-20 (Medium) Dark theme, brand and stamp are scope not asked for.**
- Evidence: §3 dark palette, `tokens.css`, §11 items 1, 5, 6. No PRD requirement mentions dark mode, branding or motion; NFR-13 and NFR-12 do not require them.
- Problem: dark mode doubles the visual and contrast test matrix; the stamp and third font are decorative cost. They are cheap to drop but cannot be implicit.
- Fix: put dark mode, stamp animation and third font under one owner decision (DL-N37): default is light theme only, stamp static (no animation), Public Sans and IBM Plex Mono only. Mark them "optional, not tested for acceptance" until accepted.

### Low

**UI-BA-21 (Low) NFR-11 is not evidenced.** The design offers no target or task path to measure under-one-minute submit. Add: a timed script "form open to docket" with brief training for the usability session; target remains `[TBD-Stakeholder]`.

**UI-BA-22 (Low) NFR-13 not mentioned.** The design uses `prefers-color-scheme`, `:focus-visible`, `forced-colors`. State "supported on current Chrome, Edge, Firefox desktop" and confirm workstation browsers.

**UI-BA-23 (Low) Test-only elements must not reach production.** The test-user picker, "Test scenarios" panel and "Test environment" strip are environment features. State in the spec that they are built only when the environment flag is non-production (ADR-021 rationale; NFR-08).

**UI-BA-24 (Low) Banned-term list is narrower than FR-81.** §6 lists suspicion, sanctions, PEP, FINTRAC, screening. FR-81 and NFR-07 also cover suspicion **reports**, "listed-person" matches, "politically exposed", and the regulator. Also add "STR", "compliance flag", "hold". The test in §10 ("no user-facing string contains the banned words") must read the list from one shared file with the PRD terms. Minor: "Amount: at most 2 decimal places for CAD" should be per currency minor-unit scale (JPY 0), FR-02; stale-request copy matches FR-23 (Met); the mismatch "You cannot decide a request you submitted" should add "or edited" (FR-28).

## 4. The designer's 7 questions: are they well-formed?

None has an ID, owner, default or "blocks". Review of each:

| # | Designer question | Problem | Disposition |
|---|---|---|---|
| 1 | Approve stamp, or plainer variant | Presentation, not a requirement; no owner or default | Merge into DL-N37 (visual options) |
| 2 | Late threshold, sample 45 | Not a requirement; owner should be operations, not product owner; sample is an invented number; overlaps Q7, Q9 | Replace with DL-N32 |
| 3 | "Send to head office" instead of "Escalate"; "Head-office check required" | Two questions in one; second must go to compliance and is a tell (UI-BA-06) | Split into DL-N31 and DL-N34 |
| 4 | `fr-CA` for REL-1; decimal comma | Two questions; overlaps DL-N24, DL-N27, FR-81, FR-83 | Split; see UI-BA-15; DL-N38 |
| 5 | Brand colour or logo | Fine, no owner, default (neutral) or blocks | Keep, rewrite as DL-N37 sub-item |
| 6 | Third font for stamp | Visual option, not a decision-log item | Merge into DL-N37 |
| 7 | Do tellers see engine plain reason for every outcome | Already answered by FR-03 ("generic reason in the response", every outcome); the real open issue is who approves the text | Close as answered by FR-03; replace with DL-N34 |

Questions the designer missed that the UI depends on: refer-to-compliance wording (DL-N33), teller list scope (DL-N35), completion tolerance (DL-N36), approve reason (R-03, existing), escalation window (BQ-5, existing), who may cancel (BQ-4, existing), WCAG mandate (DL-N08, existing).

## 5. Traceability rows and PRD wording that follow (do not apply here)

New or changed trace rows (add to `ba-review.md` §1.3; IDs for the UI doc: UI-01 to UI-09 are proposed as design references):

| Requirement | Design reference | Status |
|---|---|---|
| FR-01 | ui-design §4.3 | Met (fields TBD) |
| FR-02 | ui-design §5.2, §6 | Met |
| FR-03 | ui-design §4.4 | Met |
| FR-04 | ui-design §4.2, §4.5 | Conflict (UI-BA-12) |
| FR-05 | ui-design §6 | Conflict (UI-BA-01) |
| FR-06 | ui-design §4.5 | Partly (revisions, UI-BA-11) |
| FR-07 | ui-design §7 | Conflict (UI-BA-04) |
| FR-08 | ui-design §5.1 busy state | Met |
| FR-20 | ui-design §4.6 | Met, creep (UI-BA-03) |
| FR-21 | ui-design §4.7, §7 | Conflict (UI-BA-05) |
| FR-22 | ui-design §4.7 | Open (R-03) |
| FR-23 | ui-design §6 Stale | Met |
| FR-24, FR-28 | ui-design §4.7 | Met |
| FR-26 | ui-design §4.5 | Met, rules open (BQ-4) |
| FR-27 | none | Gap |
| FR-43 | none | Gap (UI-BA-10) |
| FR-50, FR-51, FR-52 | ui-design §4.6, §5.4 | Met; REL-2 for FR-50, 51 |
| FR-80 | none | Gap (UI-BA-02) |
| FR-81 | ui-design §2, §6, §7.9 | Conflict (UI-BA-06, 07, 08) |
| FR-82, FR-83 | none | Out of UI; language effect only |
| NFR-11 | none | Open |
| NFR-12 | ui-design §8 | Met plus unsourced target |
| NFR-13 | none | Open |
| NFR-16 | ui-design §3, §10 | At risk (UI-BA-19) |

Proposed PRD wording changes (main session to apply after the decisions):
1. Glossary: add "UI label" column for Escalation, Cycle ("Round"), Resubmission, and for state names (UI-BA-01, 17).
2. FR-04: keep as written; add "with an 'own requests' filter" if DL-N35 agrees.
3. FR-20: add "age is shown in minutes; no overdue state in REL-1 `[TBD-Stakeholder: Q7, Q9]`".
4. FR-21: add "revisions are shown as before and after".
5. FR-80: add "the action label, confirmation and neutral state are from the approved reason set (EN and FR)".
6. FR-81: add "and a general-role response for a restricted cause is identical in shape to an ordinary referral".
7. FR-07: no change; add an acceptance line "mismatch within tolerance: no banner; beyond tolerance: blocked, neutral message".
8. NFR-12: keep `[TBD]` until DL-N08; note the manual screen-reader check applies to REL-1 screens.
9. NFR-16: add "no third-party font or script requests; fonts are self-hosted".
10. Release plan: add the UI screen to release map (FR-34 screens in REL-2).
11. `policy-engine-design.md` §4.1/§6.3: clarify whether `GUARDRAIL` is staff-visible (architect, UI-BA-06).

## 6. Decisions the product owner must make (decision-log form)

Proposed IDs continue after DL-N30; plan owner to confirm numbering. Defaults are conservative and follow CLAUDE.md (no invented thresholds).

| ID | Question | Duplicate of | Owner | Why it matters | Default if unanswered | Blocks | Status |
|---|---|---|---|---|---|---|---|
| DL-N31 | Is the teller action after an auto-decline called "Escalate" (as in FR-05, glossary, audit events) or a new UI label such as "Send to head office"; and what do we call the engine routing a new request to a reviewer? | (designer Q3a) | Product owner | A rename creates two vocabularies and, as drawn, one phrase with two meanings (UI-BA-01) | Keep "Escalate" everywhere; engine routing labelled "Sent for review" | FR-05 text, glossary, history labels, French catalogue, escalation tests | New |
| DL-N32 | Does the review queue show an overdue ("Late") marker? If yes, after how many minutes? | Q7, Q9, (designer Q2) | Operations | A threshold is an invented SLA; affects layout, metrics and tests | No marker; show age in minutes, sorted oldest first; no sample value in specs | FR-20 flagging, UI queue spec, FR-40 | New |
| DL-N33 | What are the label, confirmation text and neutral display state for "Refer to compliance", in English and French? | DL-N17 | Compliance, product owner | FR-80 is a REL-1 must-have; ad hoc copy is how restricted terms leak | Generic label "Ask head office to look at this" and neutral state "Under head-office review"; compliance approves before build | FR-80, FR-81, REL-1 demo | New |
| DL-N34 | Who approves the reason set shown to staff and reviewers (cause words and outcome "Why" text, EN and FR), and may a restricted cause appear as anything other than an ordinary referral? | DL-N18, (designer Q3b, Q7) | Compliance, policy owner | FR-81, UI-BA-06 and 08; also settles designer question 7 | Restricted causes show as the ordinary "Rule needs a person"; staff see the approved reason for every outcome (FR-03) | FR-03, FR-21, FR-81, UI copy, E3a reason enum | New |
| DL-N35 | Does a teller see the branch's requests (FR-04) or only their own? | Q6 | Operations | Changes the permission matrix and list design | Branch list with a "Mine" filter | FR-04, permission matrix | New |
| DL-N36 | What is the completion mismatch tolerance, and what exactly is the teller told when completion is blocked? | FR-07 | Compliance | UI-BA-04: design contradicts FR-07 | Block any mismatch; neutral message; no mention of an alert | FR-07, completion dialog | New |
| DL-N37 | Visual extras: dark theme, animated stamp, third font family, brand colour or logo: wanted for REL-1? | (designer Q1, Q5, Q6) | Product owner | Cost and test matrix; none is in the PRD | Light theme only; static stamp; two font families; neutral brand | UI-BA-20, accessibility test matrix | New |
| DL-N38 | Is a full `fr-CA` interface (and decimal-comma input) in REL-1, or only French reason text per FR-81? | DL-N24, DL-N27, FR-83, (designer Q4) | Sponsor, privacy | Catalogue scope and test cost | French for the approved reason set only; English UI; decimal point input | FR-81, FR-83, i18n checklist | New |
| R-03 (existing) | Is a reason required on approve? | IC-30 | Policy owner | Design pre-empts it (UI-BA-09) | Optional on approve; layout supports required | FR-22 | Open |
| BQ-4, BQ-5 (existing) | Who may cancel, from which states; escalation window | Q7, DL-N04 | Operations | Copy for Declined and Cancel button (UI-BA-14) | Reviewer or submitter, non-terminal; once, no time limit | FR-05, FR-26 | Open |
| DL-N08 (existing) | Is WCAG 2.1 AA mandated? | NFR-12 orphan | Product owner, IT | Design uses AA as target | Provisional target | NFR-12 | New |

## 7. What blocks implementation of the UI

- Cannot build without first deciding: DL-N33 and DL-N34 (REL-1 must-have action and restricted-topic labelling), DL-N36 (completion rule).
- Can start now, with the defaults: the teller list, form, outcome docket, request detail, queue (without Late), decision panel, accessibility tokens; but remove the GUARDRAIL row, the shadow-result wording, the "Some checks" sentence and the Late marker first.
- Release scope: engine panel (4.8) is REL-2; notifications (FR-50, 51) are REL-2; FR-43 search and FR-80 referral screens are missing from the design.
