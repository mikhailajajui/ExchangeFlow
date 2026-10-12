# ExchangeFlow — QA Review of Requirements and Design for Testability

| | |
|---|---|
| **Reviewed** | `PRD.md` (Draft v0.1), `policy-engine-design.md` (Draft v0.1), `application-elaboration-plan.md` |
| **Reviewer** | QA consultancy |
| **Date** | 2026-10-01 |
| **Verification rung reached** | None (no code). This is a static review. The decision table in section 3 is meant to become the language-neutral reference vector set for the engine. |

Severity labels: **High** = the requirement can't be verified as written, or it contradicts another document in a way that would give a wrong or unsafe result. **Medium** = it can be verified only after a missing definition, number or owner is added. **Low** = wording or completeness.

---

## 0. Headline findings (most severe first)

| # | Sev | Finding | Where |
|---|---|---|---|
| H1 | High | **Pausing a rule can make the engine more permissive.** The algorithm drops PAUSED rules before resolving the outcome. If you pause a matching `AUTO_DECLINE` rule in an approve+decline conflict, the result becomes `AUTO_APPROVE`. If you pause a matching `HUMAN_REVIEW` rule next to an approve rule, the result also becomes `AUTO_APPROVE`. The PRD glossary says a kill switch sends "affected requests to human review". The design does the opposite for these cases. | design §4.3 node I; PRD §14 "Kill switch"; FR-34 |
| H2 | High | **Shadow and paused rules can change the applied outcome.** The missing-data check (node G) runs on *every* rule before the split into active, shadow and paused. A shadow rule that hits a missing field turns an `AUTO_APPROVE` into `HUMAN_REVIEW/MISSING_DATA`. The same is true when a shadow rule throws (the guard turns it into `ENGINE_ERROR`). This breaks FR-15 and design §9 ("never change the outcome"). | design §4.3 nodes E–I, §4.3 guard; FR-15 |
| H3 | High | **FR-14 and NFR-09 determinism and reproducibility can't be tested as modelled.** (a) The pause state (global and per rule) isn't part of the policy version, so the same request and the same version can give different outcomes. (b) `EvaluationContext` includes timestamp, a business-hours flag and a velocity count, so "same request" isn't the same input. (c) `DECISION_RECORD` stores neither the context snapshot, `matchedRules`, `reasonText`, nor the deciding *rule version*, so a past decision can't be replayed. | FR-13, FR-14, NFR-09; design §4.1, §6.1 |
| H4 | High | **R1 scope contradicts itself.** FR-17 and the R1 exit criteria say placeholders can only be shadow or human-review rules, and "every request goes to human review". The elaboration increment (§7) requires placeholders that show all three paths, plus an acceptance check that staff can escalate an auto-decline. FR-05 (escalation) is in R1 scope, but no auto-decline can exist in R1. R1 says "placeholder rules in shadow only", but FR-15 (shadow) is scheduled for R2. | PRD §10, FR-05, FR-15, FR-17; elaboration §7 |
| H5 | High | **The resubmission path is defined two ways.** PRD journey 5.1 (G→B), design §3 (MoreInfoNeeded→Submitted→Evaluated) and FR-10 say a resubmitted request is **re-evaluated** against the version active *at resubmission*. Elaboration UC-C step 4 says it **returns to the review queue**. If it's re-evaluated, a request a reviewer asked about can be auto-approved without that reviewer ever seeing the answer. | FR-06, FR-10; elaboration UC-C |
| H6 | High | **The permission matrix is incomplete, so FR-61 can't be tested exhaustively.** These actions have no row: view own or branch requests (FR-04), resubmit (FR-06), mark Completed (FR-07), search and audit (FR-43), simulate (FR-32), shadow report (FR-37), resume *engine* (FR-34), sign off activation (FR-33), and dashboards (FR-40/41). Compliance has no audit-view permission, although §4 says compliance can "audit any decision". | design §7; FR-43, FR-61 |
| H7 | High | **FR-37's agreement metric has no definition.** It doesn't say how to count a shadow `HUMAN_REVIEW` result, a human "more info" decision, requests decided automatically (no human outcome), escalations, or several shadow rules disagreeing with each other. Activation (FR-33) depends on this report. | FR-33, FR-37 |
| H8 | High | **Blocking TBDs make Must requirements untestable:** FR-01 field list, NFR-01 load, NFR-02 timeout value (D6), NFR-03, NFR-15 and the pause-cache interval (D6). | PRD §6, §8 |

---

## 1. Testability audit — functional requirements

Format: **ID — verdict — issue — proposed measurable rewrite.**

### 6.1 Request submission and tracking

| ID | Sev | Issue | Proposed rewrite |
|---|---|---|---|
| FR-01 | High | The field list is TBD. Validity can't be asserted, and test data can't be built. | "Staff can create and submit a request containing exactly the fields in Appendix F (name, type, format, required/optional, allowed range). A request with all required fields valid is accepted (HTTP 201) and assigned a unique request ID." Treat Appendix F as an R0 exit artefact. |
| FR-02 | Medium | "Explains any errors" and "without losing entered data" aren't measurable. It also doesn't say whether client-side validation is allowed to be the only check. | "On invalid input the server returns 422 with one error object per invalid field (field name, rule violated, human-readable message). No request is persisted. The form re-displays every value the user entered, with each error shown next to its field and announced to assistive technology. A request with client validation bypassed is still rejected by the server." |
| FR-03 | Medium | "The reason" isn't defined for `HUMAN_REVIEW`: is it the fallback cause, plain text, or nothing? NFR-01 is the latency target but isn't linked. | "The submit response contains requestId, status (`Approved`, `Declined` or `UnderReview`), reasonCode and reasonText. For HUMAN_REVIEW, reasonText is the staff-facing message mapped from the fallbackCause (Appendix R). The response is returned within the NFR-01 budget." |
| FR-04 | Low | "Full history" isn't enumerated. List ordering and paging aren't specified. | "...the list shows requestId, created time, status, last change, and is sorted newest first by default. Detail shows every state transition, decision record and escalation with actor, timestamp and reason, in chronological order." |
| FR-05 | Medium | Doesn't say whether only **rule** declines can be escalated (design §5.3 says "Declined by rule") or reviewer declines too (design §3 allows any `Declined`). It doesn't limit repeat escalation or set a time window. The reason has no minimum length. | "Staff in the request's branch can escalate a request whose current decision path is AUTO_DECLINE, once per automated decision, giving a non-empty reason (1–500 characters). The request moves to UnderReview, flagged `ESCALATED`. Escalating a reviewer-declined request, or escalating a second time, is rejected with 409." |
| FR-06 | High | Conflicts with UC-C (see H5). "Earlier values preserved" doesn't say how they're preserved. It's unclear whether resubmitting with no change is allowed. | "Staff can edit and resubmit a request in MoreInfoNeeded. Each submission creates an immutable request revision. The detail view shows all revisions and a field-level diff. On resubmit the request is [re-evaluated against the policy version active at resubmission time / returned to the reviewer queue — **pick one**]." |
| FR-07 | Low | Who may complete it (submitter only, or anyone in the branch?) isn't stated. Completed isn't in the permission matrix. | "Staff in the request's branch can move an Approved request to Completed. The action is audited. Any other source state returns 409." |
| FR-08 | Medium | The idempotency key, its scope, its time window and what a duplicate returns aren't defined. | "Submit accepts a client-generated Idempotency-Key. Repeating the key within 24 h, by the same user, returns the original response (same requestId, same outcome) and creates no new request, decision or audit event. N concurrent identical submits produce exactly one request." |

### 6.2 Automated decisioning

| ID | Sev | Issue | Proposed rewrite |
|---|---|---|---|
| FR-10 | Medium | "Active policy version" doesn't specify at what instant: submit time or evaluation start. On resubmission, see H5. | "Each evaluation pins the policy version active at evaluation start and records its ID. A resubmission is a new evaluation with its own pinned version, and the earlier decision record is retained." |
| FR-11 | Low | Verifiable by a property test. | Add: "For any permutation of the rule set, the Decision is identical (excluding evaluatedAt)." |
| FR-12 | Medium | Per-rule pause isn't covered (see H1). It doesn't say which fallback cause a timeout gets (the design maps it to `ENGINE_ERROR`). There's no precedence when several conditions hold at once. | List the causes with their precedence: `ENGINE_PAUSED` > `ENGINE_ERROR` (incl. timeout, load failure, malformed rule) > `MISSING_DATA` > `RULE_REQUIRES_HUMAN` > `CONFLICT` > `NO_MATCH`. (Note: the current algorithm puts NO_MATCH before RULE_REQUIRES_HUMAN, but they are mutually exclusive, so either order is fine.) Add the paused-rule semantics decided under H1. |
| FR-13 | Medium | The data model in design §6.1 lacks matchedRules, reasonText, rule *version* and the context snapshot. "Deciding rule ID" doesn't say whether it means the rule or the rule version. For `RULE_REQUIRES_HUMAN` it isn't clear whether decidingRuleId is set. With several approve rules matching, it isn't clear which one is "deciding". | "Each decision record stores: outcome, decidingRuleVersionId (null for fallback causes other than RULE_REQUIRES_HUMAN; when several same-outcome rules match, the lowest ruleId — deterministic), matchedRuleVersionIds (sorted), policyVersionId, pause snapshot, reasonCode, reasonText, fallbackCause, context snapshot hash + payload, shadowResults, evaluatedAt (UTC)." |
| FR-14 | High | See H3. | "Given the same EvaluationContext (including its timestamp and environment fields), the same policy version and the same pause snapshot, evaluate() returns an identical Decision excluding evaluatedAt. Replaying any stored decision from its stored context reproduces its outcome, deciding rule and fallback cause." |
| FR-15 | High | Contradicted by the algorithm (see H2). | "Shadow rules, including rules that error or hit missing data, never change outcome, fallbackCause, decidingRuleId or matchedRules. Their results (including error states) are recorded in shadowResults." |
| FR-16 | Medium | "Not code" is verifiable only as a negative. | "Changing any threshold, criterion or request-type mapping requires only a new approved rule version. No code change or deployment is needed. Verified by changing a threshold in a running test environment and observing the new outcome on the next evaluation." |
| FR-17 | High | Contradicts elaboration §7 (H4). "Labelled" isn't defined. | "Until criteria are approved, every rule has `placeholder=true` and an ID prefixed `PLACEHOLDER-`. The rule store rejects (on save and on load) any placeholder rule with mode ACTIVE whose outcome is AUTO_APPROVE or AUTO_DECLINE, in every environment except one flagged `demo`." |

### 6.3 Human review

| ID | Sev | Issue | Proposed rewrite |
|---|---|---|---|
| FR-20 | Low | The default sort and the visible flag set aren't stated. | "...default sort oldest first. Each item shows age, an `ESCALATED` badge if applicable, and its fallbackCause label." |
| FR-21 | Low | Shadow results are an R2 feature but the requirement is in R1. Fine if the panel is empty in R1, but say so. | Add: "If there are no shadow results, show 'none'." |
| FR-22 | Medium | Reason rules are TBD. "Optional for approve" conflicts with PRD §1 ("every decision ... recorded with its reason") and with the completeness metric in §9. | "Decline and More-info require a reason of 1–1000 characters. Approve [requires / allows] a reason. The completeness metric counts [rule: reason code; human: reason text or the approve default code `HUMAN_APPROVED`]." |
| FR-23 | Low | "Changed" needs definition (version increment). The response code isn't stated. | "Each decision command carries the request version the reviewer loaded. If the stored version differs, the server returns 409 with message M-STALE and saves nothing." |
| FR-24 | Medium | "Review cycle" isn't defined. | "A review cycle is one continuous stay in UnderReview. Exactly one of {approve, decline, more-info} is recorded per cycle. Under N concurrent decision commands, exactly one succeeds and the rest get 409." |
| FR-25 | Low | TBD, and Should priority. Fine to defer. | — |

### 6.4 Policy administration

| ID | Sev | Issue | Proposed rewrite |
|---|---|---|---|
| FR-30 | Low | Verifiable. | Add: "Any update to an approved rule version returns 409. Edits create version n+1." |
| FR-31 | Medium | The source of the "regulated" flag isn't given. Design §7 adds "approver ≠ activator where team size allows", which can't be tested. Matrix: only the Policy approver can both approve and activate. | Make the activation separation either mandatory or explicitly out of scope. Add "category.regulated is set by Compliance." |
| FR-32 | Low | "No side effects" needs a precise meaning. | "Simulation writes no request, decision, shadow, notification or rule-state record. It writes only an audit event 'simulation run'." |
| FR-33 | Medium | Who signs off isn't named. The design also requires a replay and (in §12) compliance sign-off; the PRD doesn't. | "Shadow→Active requires a sign-off record (signer with the activate permission ≠ author, note, linked agreement report ID and replay run ID). Regulated categories also need a compliance sign-off." |
| FR-34 | High | "Next evaluation" contradicts design §9 ("cached up to a short interval"). The permission to resume the *engine* isn't in the matrix. Paused-rule semantics are unsafe (H1). It doesn't say whether a Shadow rule can be paused (it isn't in the lifecycle). | "A pause takes effect for every evaluation starting more than T_pause (D6, ≤ 5 s) after the pause is committed. Resuming a rule or the engine requires the policy-approver permission. While a rule is paused, any request it would have matched gets HUMAN_REVIEW with `RULE_PAUSED`." (recommended) |
| FR-35 | Low | Effective-date checks against evaluatedAt add a time input (see FR-14). Time zone isn't stated. | "Effective dates are evaluated in [business TZ], inclusive from, exclusive to." |
| FR-36 | Low | Verifiable. | — |
| FR-37 | High | See H7. | "Agreement for rule R = (# requests where R's would-be outcome equals the final human decision) / (# requests where R matched in shadow and a final human approve/decline exists). Exclusions: more-info, still pending, would-be HUMAN_REVIEW (reported separately). Reported per rule version over a selectable date range, with the counts shown." |

### 6.5 Monitoring and audit

| ID | Sev | Issue | Proposed rewrite |
|---|---|---|---|
| FR-40 | Medium | Turnaround start and stop points aren't defined. Aging buckets aren't defined. | "Turnaround = final decision time − first submit time, per path. Escalations are measured from the escalation time. Shown as median and p90 per day." |
| FR-41 | Low | Time window not stated. | Add a date-range filter. |
| FR-42 | Medium | "Random sample" size and method aren't defined, and neither is the flag lifecycle. | "Sample size N (configurable, default 20/week), drawn uniformly from automated decisions in the period, with the seed recorded. Each flag records reviewer, reason and rule version." |
| FR-43 | Medium | "Authorized users" isn't in the matrix (H6). Search fields aren't specified. | List the roles and the search keys (requestId, branch, status, date range, rule ID). |
| FR-44 | Low | "Through the application" leaves DB-level tampering open. | Add: "The application DB role has INSERT/SELECT only on audit tables." This is verifiable by a privilege test. |

### 6.6 Notifications, 6.7 Access, 6.8 Optional

| ID | Sev | Issue | Proposed rewrite |
|---|---|---|---|
| FR-50/51 | Low | No delivery latency. | "...visible within 30 s of the decision being committed." |
| FR-52 | Low | Verifiable by fault injection. | — |
| FR-53 | Low | TBD; Could priority. | — |
| FR-60 | Low | "Policy owner" (used throughout the docs) isn't a role. | Map the persona to roles explicitly. |
| FR-61 | High | The matrix is incomplete (H6). | Complete the matrix, one row per API operation, so a generated test runs every role × every endpoint. |
| FR-62 | Low | TBD; "wider access" mechanism not stated. | — |
| FR-63 | Medium | Doesn't say whether role changes affect live sessions, or whether admins can change their own roles. | "Role changes apply to the next request (no stale-token grace beyond T). An admin cannot grant roles to themselves. A deactivated user's sessions are rejected." |
| FR-70 | Low | Conditional; fine. | — |

## 2. Testability audit — NFRs

| ID | Sev | Issue | Proposed rewrite |
|---|---|---|---|
| NFR-01 | High | The load is TBD, and where the time is measured isn't stated. | "Server-side time from receipt of the submit request to response is ≤ 2.0 s at p95 and ≤ 4 s at p99, at X req/s sustained for 15 min, with a policy of Y rules and Z stored requests." |
| NFR-02 | High | No value. It must fit inside the NFR-01 budget. | "evaluate() times out at T_eval (e.g. 500 ms). On timeout: HUMAN_REVIEW/ENGINE_ERROR with sub-cause TIMEOUT, logged and alerted." |
| NFR-03 | High | Hours and target are TBD. | "≥ 99.5 % monthly availability during HH:MM–HH:MM [TZ] Mon–Sat, measured by a synthetic check every 1 min." |
| NFR-04 | Medium | "Partial failure" isn't enumerated. | "If any of these fail: DB commit, audit insert, process crash between the evaluate and commit steps, or notification send, then either all of state + decision + audit are persisted or none are. Verified by fault injection at each step." |
| NFR-05 | Low | TLS version isn't given. | "TLS ≥ 1.2, HSTS. Every route except /health returns 401 when unauthenticated. Verified from the route inventory." |
| NFR-06 | Low | Verifiable. | "Secret scanning (e.g. gitleaks) in CI fails the build on any finding." |
| NFR-07 | High | "Sensitive" isn't defined. | "Fields classified Sensitive in Appendix F never appear in logs. Verified by submitting canary values and grepping all log sinks." |
| NFR-08 | Medium | Not verifiable without a marker. | "All seed and fixture records carry `synthetic=true`. A non-prod startup check refuses data without it." |
| NFR-09 | High | See H3: the data model can't support it. | Same as the FR-14 rewrite plus storing the context snapshot. |
| NFR-10 | Medium | TBD. | Defer, but add an R0 exit item. |
| NFR-11 | Medium | "Brief training", "routine" and "typical" aren't defined. | "After a ≤ 15 min training, ≥ 80 % of ≥ 5 staff participants submit a routine request (scenario script S1) in < 60 s. Reviewers decide scenario S2 with zero page navigations." |
| NFR-12 | Low | The verification method isn't stated. | "Zero axe-core serious/critical violations on all pages, plus a manual audit (keyboard only, NVDA + Chrome) of the submit, queue and decide flows before each release." |
| NFR-13 | Low | "Current" is vague. | "Latest stable and previous major of Chrome, Edge and Firefox, at 1366×768 and above." |
| NFR-14 | Medium | Alert channel, latency and thresholds aren't defined. | "Each listed event emits a structured log with code. An alert reaches the on-call channel within 5 min. The engine-error alert fires above E % of evaluations in 5 min." |
| NFR-15 | High | TBD. | "Sustains 2× expected peak (from Q9) for 1 h with NFR-01 still met." |

---

## 3. Ambiguities and contradictions between documents

| # | Sev | Topic | PRD says | Design / elaboration says | Needs decision from |
|---|---|---|---|---|---|
| A1 | High | Paused-rule semantics | Glossary: a kill switch sends affected requests to human review | §4.3: paused rules are dropped silently, and can flip outcomes to AUTO_APPROVE (H1) | Policy owner, architect |
| A2 | High | Missing data or errors in shadow rules | FR-15: shadow never changes the outcome | §4.3: the MISSING_DATA check and the exception guard apply to all rules, before the shadow split (H2) | Architect |
| A3 | High | Resubmitted request: re-evaluation and policy version | FR-10 + journey 5.1: re-evaluated against the active version | Elaboration UC-C: returned to the review queue. If re-evaluated, the version may differ from the first evaluation, and the earlier decision record's status is unclear (superseded?) | Product owner |
| A4 | High | R1 placeholder behaviour | FR-17 / R1 exit: shadow or human-review only, every request goes to human | Elaboration §7: all three paths demonstrated, escalation of an auto-decline tested | Product owner |
| A5 | High | Which states allow escalation | FR-05: auto-declined only | Design §3: `Declined → UnderReview` from **any** Declined (including reviewer declines), and `Declined → [*]` is also terminal. Design §5.3: "Declined by rule". Elaboration: only from the auto-decline branch. Repeat escalation (escalate → reviewer declines → escalate again?) is not addressed | Product owner |
| A6 | Medium | State names | "Declined by reviewer", "more information needed", "Completed" | Design: `Declined` (one state for both paths), `UnderReview`, `MoreInfoNeeded`, `Evaluated`. Elaboration: "Under Review", "More Information Needed". Unclear whether `Evaluated` and `Draft` are persisted states or transient ones. Decision path must be stored separately because the state is shared | Architect: publish one canonical state enum + transition table |
| A7 | Medium | Reason requirements | FR-22: optional for approve. §1: every decision has a reason. §9: completeness metric | Elaboration §7: "reason capture" for all three actions. Design REVIEW_DECISION.reason nullability not stated | Policy owner / compliance |
| A8 | Medium | Timeout as a fallback cause | FR-12 lists timeout separately | Design maps it to `ENGINE_ERROR`; there is no `TIMEOUT` cause | Architect (recommend sub-cause) |
| A9 | Medium | Fallback cause list | Glossary: no match, conflict, missing data, error, paused; "when no rule decided it" | Design adds `RULE_REQUIRES_HUMAN`, which *is* rule-driven | Architect |
| A10 | Medium | Pause latency | FR-34: "from the next evaluation" | Design §9: cached up to a "short, documented interval" (D6) | Tech lead |
| A11 | Medium | Separation of duties at activation | FR-31: approval by a non-author only | Design §7: approver ≠ activator "where team size allows". Matrix gives approve and activate to the same role | Policy owner |
| A12 | Medium | Rule lifecycle vs. immutability | FR-30: approved versions are immutable | Design §7: `Shadow → Draft : revise` moves an approved version back to Draft. Should be "create version n+1". `Shadow → Paused` is missing | Architect |
| A13 | Medium | Activation gate | FR-33: recorded sign-off | Design §7: agreement report **and** replay. §12: plus compliance sign-off | Policy owner, compliance |
| A14 | Medium | Policy version contents | Glossary: snapshot of *active* rules | Shadow rules are also evaluated; if they're not in the version, shadow results can't be reproduced. The pause state isn't in the version | Architect |
| A15 | Medium | Global pause and shadow data | FR-15 / FR-37 | §4.3 short-circuits on global pause, so no shadow results are recorded during a pause, and agreement data is lost | Architect |
| A16 | Medium | Conflict masked by a human rule | §7: conflict alerts the policy owner | §4.3: a HUMAN_REVIEW rule is checked before the conflict, so an approve+decline conflict alongside a human rule is never alerted | Policy owner |
| A17 | Low | "Candidate rule" for MISSING_DATA | — | It isn't defined whether a missing field in an untaken `any`/`all` branch (short-circuit) counts | Architect |
| A18 | Low | Placeholder values | — | `"TBD_THRESHOLD_A"` is a string compared with `lte` against a decimal. Load-time validation should reject it; otherwise the result is MISSING_DATA or ENGINE_ERROR depending on the implementation | Architect |
| A19 | Low | Shadow results in R1 | FR-21 (R1) displays shadow results | FR-15 is R2 | Product owner |
| A20 | Low | Amount currency in thresholds | — | Amount is "decimal, with currency"; thresholds don't specify a currency. It's unclear how a threshold compares across currencies | Policy owner |
| A21 | Low | No exit from MoreInfoNeeded / UnderReview | Q7 open | No cancel/withdraw/expire transitions | Operations |

---

## 4. Decision-table test suite — policy engine resolution

**Notation.** Rules: `A` = AUTO_APPROVE, `D` = AUTO_DECLINE, `H` = HUMAN_REVIEW. Suffix `ₐ` = mode ACTIVE (default), `ₛ` = SHADOW, `ₚ` = PAUSED. "✓" = matches. **Expected** follows design §4.3 *as written*. Where that conflicts with the PRD, the row is marked **GAP** and shows the PRD-consistent expectation that QA recommends. These rows must not be implemented until the decision is made.

Every row also asserts these invariants:
- **I1** If outcome is AUTO_*, fallbackCause = null and decidingRuleId ≠ null.
- **I2** If outcome is HUMAN_REVIEW, fallbackCause ≠ null.
- **I3** matchedRules contains ACTIVE matches only, sorted.
- **I4** shadowResults contains one entry per matching SHADOW rule and never influences I1–I3.
- **I5** policyVersion is set (except where load failed: null or "unloaded" — **GAP**: specify).
- **I6** The result is identical under every permutation of rule order.
- **I7** evaluate() performs no writes.

| ID | Global pause | Load | Data | Active matches | Paused matches | Shadow matches | Exception / timeout | Expected outcome | fallbackCause | decidingRuleId | Alert | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| DT-01 | off | ok | ok | — | — | — | — | HUMAN_REVIEW | NO_MATCH | null | no | |
| DT-02 | off | ok | ok | A1 | — | — | — | AUTO_APPROVE | null | A1 | no | |
| DT-03 | off | ok | ok | A1, A2 | — | — | — | AUTO_APPROVE | null | **GAP** (A1? lowest ID?) | no | Define a deterministic choice |
| DT-04 | off | ok | ok | D1 | — | — | — | AUTO_DECLINE | null | D1 | no | |
| DT-05 | off | ok | ok | D1, D2 | — | — | — | AUTO_DECLINE | null | **GAP** | no | As DT-03 |
| DT-06 | off | ok | ok | H1 | — | — | — | HUMAN_REVIEW | RULE_REQUIRES_HUMAN | **GAP** (H1 or null) | no | |
| DT-07 | off | ok | ok | A1, D1 | — | — | — | HUMAN_REVIEW | CONFLICT | null | **yes** (policy owner) | D3 may change to AUTO_DECLINE |
| DT-08 | off | ok | ok | A1, H1 | — | — | — | HUMAN_REVIEW | RULE_REQUIRES_HUMAN | per DT-06 | no | |
| DT-09 | off | ok | ok | D1, H1 | — | — | — | HUMAN_REVIEW | RULE_REQUIRES_HUMAN | per DT-06 | no | |
| DT-10 | off | ok | ok | A1, D1, H1 | — | — | — | HUMAN_REVIEW | RULE_REQUIRES_HUMAN | per DT-06 | **GAP** (conflict masked, A16) | |
| DT-11 | off | ok | field missing for an active rule | (A1 would match) | — | — | — | HUMAN_REVIEW | MISSING_DATA | null | no | |
| DT-12 | off | ok | missing for active rule | — | — | — | — | HUMAN_REVIEW | MISSING_DATA | null | no | MISSING_DATA beats NO_MATCH |
| DT-13 | off | ok | missing for active rule | H1 | — | — | — | HUMAN_REVIEW | MISSING_DATA | null | no | MISSING_DATA beats RULE_REQUIRES_HUMAN, per algorithm |
| DT-14 | off | ok | invalid (wrong type, negative amount, bad currency code) | A1 | — | — | — | HUMAN_REVIEW | MISSING_DATA | null | no | "invalid" counts as missing |
| DT-15 | off | ok | missing **only** for a shadow rule | A1 | — | (S1 errors) | — | As written: HUMAN_REVIEW/MISSING_DATA. **GAP → expected AUTO_APPROVE**, shadowResults S1 = error | | A1 | no | **H2 / FR-15** |
| DT-16 | off | ok | missing **only** for a paused rule | A1 | (P1 errors) | — | — | As written: HUMAN_REVIEW/MISSING_DATA. **GAP** | | | no | Paused rules shouldn't be evaluated at all |
| DT-17 | off | ok | missing in an untaken short-circuit branch | A1 | — | — | — | **GAP** (A17) | | | | |
| DT-18 | off | ok | ok | A1 | — | — | exception in a rule | HUMAN_REVIEW | ENGINE_ERROR | null | **yes** | Never an automated outcome |
| DT-19 | off | ok | ok | A1 | — | — | timeout | HUMAN_REVIEW | ENGINE_ERROR (sub-cause TIMEOUT recommended) | null | **yes** | FR-12 lists timeout separately |
| DT-20 | off | **fail** (store unreachable) | ok | n/a | n/a | n/a | — | HUMAN_REVIEW | ENGINE_ERROR | null | **yes** | |
| DT-21 | off | ok but **malformed rule** (unknown op, `TBD_` value) | ok | — | — | — | — | HUMAN_REVIEW | ENGINE_ERROR (**GAP**: or MISSING_DATA, A18) | null | yes | Should also be rejected at approval time |
| DT-22 | off | **no active policy version exists** | ok | — | — | — | — | HUMAN_REVIEW | **GAP** (ENGINE_ERROR vs NO_MATCH) | null | ? | Fresh install |
| DT-23 | **on** | ok | ok | A1 | — | A2ₛ | — | HUMAN_REVIEW | ENGINE_PAUSED | null | no (pause alert raised at pause time) | matchedRules empty; shadowResults empty (**GAP** A15) |
| DT-24 | **on** | fail | ok | — | — | — | — | HUMAN_REVIEW | ENGINE_PAUSED | null | | Pause is checked before load |
| DT-25 | **on** | ok | missing | — | — | — | exception | HUMAN_REVIEW | ENGINE_PAUSED | null | | Pause is checked first |
| DT-26 | off | ok | ok | — | A1ₚ | — | — | HUMAN_REVIEW | NO_MATCH as written. **GAP → RULE_PAUSED** recommended | null | | Glossary: affected requests go to human |
| DT-27 | off | ok | ok | A2 | A1ₚ | — | — | AUTO_APPROVE | null | A2 | | Other active rule still decides |
| DT-28 | off | ok | ok | A1 | D1ₚ | — | — | AUTO_APPROVE as written. **GAP → HUMAN_REVIEW/RULE_PAUSED** | | | | **H1: pausing a decline makes the result more permissive** |
| DT-29 | off | ok | ok | A1 | H1ₚ | — | — | AUTO_APPROVE as written. **GAP → HUMAN_REVIEW** | | | | **H1** |
| DT-30 | off | ok | ok | D1 | A1ₚ | — | — | AUTO_DECLINE | null | D1 | | Conflict removed by pause; acceptable? confirm |
| DT-31 | off | ok | ok | — | — | A1ₛ | — | HUMAN_REVIEW | NO_MATCH | null | | shadowResults = [A1: AUTO_APPROVE] (the R1 / placeholder case) |
| DT-32 | off | ok | ok | — | — | A1ₛ, D1ₛ | — | HUMAN_REVIEW | NO_MATCH | null | **GAP**: alert on a shadow conflict? | Both recorded |
| DT-33 | off | ok | ok | A1 | — | D1ₛ | — | AUTO_APPROVE | null | A1 | | Shadow D recorded only |
| DT-34 | off | ok | ok | A1 | — | H1ₛ | — | AUTO_APPROVE | null | A1 | | |
| DT-35 | off | ok | ok | D1 | — | A1ₛ | — | AUTO_DECLINE | null | D1 | | |
| DT-36 | off | ok | ok | H1 | — | A1ₛ | — | HUMAN_REVIEW | RULE_REQUIRES_HUMAN | per DT-06 | | Placeholder set (PLACEHOLDER-001ₛ + 003ₐ) |
| DT-37 | off | ok | ok | A1 | — | — | shadow rule throws | As written: ENGINE_ERROR. **GAP → AUTO_APPROVE**, shadow result = error | | | yes | **H2** |
| DT-38 | off | ok | ok | — (only Draft / InReview / Approved / Retired rules whose conditions are true) | — | — | — | HUMAN_REVIEW | NO_MATCH | null | no | Non-active lifecycle states are never evaluated |
| DT-39 | off | ok | ok | A1 outside effective window (FR-35) | — | — | — | HUMAN_REVIEW | NO_MATCH | | | Boundaries: from (inclusive), to (exclusive), TZ |
| DT-40 | toggled on during an in-flight evaluation | ok | ok | A1 | — | — | — | **GAP** (pinned at start?) | | | | D6 caching interval |
| DT-41 | off | rule version activated during evaluation | ok | | | | | Uses the version pinned at start | | | | design §9 "pinned" |

**Operator and boundary sub-suite** (one vector each, per operator `eq neq lt lte gt gte in between all any not`):
- the value equal to the threshold, ±0.01 and ± the smallest currency unit;
- decimal equivalence (`"100.1"` vs `"100.10"`), and scale beyond the currency's minor unit (`100.001`);
- `between` at both ends;
- `in` with an empty list;
- `not` of a missing field (should give MISSING_DATA, not `true`);
- the largest allowed amount;
- zero and negative amounts;
- a currency mismatch between the amount and the threshold (A20).

**Property suite:**
- **P1** order independence (I6).
- **P2** determinism: evaluate twice → equal.
- **P3** monotonic safety: adding an H rule or a SHADOW rule never turns HUMAN_REVIEW into AUTO_*.
- **P4** fail-safe: any injected exception → never AUTO_*.
- **P5** pausing any rule never turns HUMAN_REVIEW into AUTO_* and never turns AUTO_DECLINE into AUTO_APPROVE. This currently **fails** by design (DT-28/29).
- **P6** global pause → always ENGINE_PAUSED.

**Fixture format.** Store each row as JSON: `{id, policy:{rules:[...]}, pause:{global, rules:[]}, context:{...}, inject:{loadFail, throwIn, timeout}, expected:{outcome, fallbackCause, decidingRuleId, matchedRules, shadowResults, alert}}`. Every implementation (backend, simulator, replay tool) can then load the same file. GAP rows carry `"status":"pending-decision"` and are skipped until decided.

---

## 5. Acceptance criteria — R1 Workflow MVP

R1 scope: FR-01–06, 08, 10–14, 17, 20–24, 43, 44, 52, 60, 61, 63. These are written against the R1 configuration (only placeholder rules: shadow, or ACTIVE human-review). Scenarios that need AUTO_* outcomes use a **test-only policy fixture**, pending A4.

**FR-01 Create and submit**
- *Given* a signed-in staff user at branch B, *when* they submit a request with all required fields valid (Appendix F), *then* the response is 201 with a new unique requestId, the request is stored with status UnderReview (R1), and its history shows "Submitted" by that user with a timestamp.
- *Given* a reviewer-only user, *when* they call submit, *then* 403 and nothing is stored.

**FR-02 Validation**
- *Given* a form with a required field empty and another field out of range, *when* submitted, *then* the server returns 422 listing both fields, nothing is persisted, the form keeps all entered values, and each error is shown next to its field.
- *Given* client validation is bypassed (direct API call with an invalid payload), *then* 422.

**FR-03 Immediate outcome**
- *Given* the R1 policy, *when* staff submit a valid request, *then* the same response contains requestId, status `UnderReview`, fallbackCause-derived reasonText, and returns within the NFR-01 budget.
- *Given* the test fixture with active rule A1 matching, *then* the response shows `Approved`, reasonText from A1's template and rule ID A1.

**FR-04 List and history**
- *Given* requests from branches B and C, *when* staff at B open their list, *then* they see only B's requests, each with status. Opening one shows every transition with actor, timestamp and reason in chronological order.
- *When* a staff user at B requests C's request by ID, *then* 403/404.

**FR-05 Escalate auto-decline** (test fixture)
- *Given* a request auto-declined by rule D1, *when* the branch staff escalate it with reason "customer has documentation", *then* the status becomes UnderReview, the queue item is flagged ESCALATED and linked to D1's decision, and an audit event records the actor and reason.
- *Given* the same request, *when* they escalate with an empty reason, *then* 422 and the status is unchanged.
- *Given* a request declined by a reviewer, *when* staff try to escalate, *then* 409 (pending A5).
- *Given* an UnderReview request, *when* staff escalate, *then* 409.

**FR-06 Resubmit after more info**
- *Given* a request in MoreInfoNeeded with reviewer note N, *when* staff change field X and resubmit, *then* a new revision is stored, revision 1 still shows the old X, history shows the more-info request (with N) and the resubmission, and the request follows [re-evaluation with a new decision record pinned to the current policy version | the review queue] per A3.
- *Given* a request not in MoreInfoNeeded, *when* resubmit is called, *then* 409.

**FR-08 Idempotent submit**
- *Given* a submit with Idempotency-Key K, *when* it is repeated 5 times (including 3 in parallel), *then* exactly one request, one decision and one submit audit event exist, and every response carries the same requestId.
- *Given* the same payload with a different key, *then* a second request is created (a legitimate duplicate).

**FR-10 / FR-11 / FR-12 Evaluation**
- *Given* the R1 policy version V1, *when* any valid request is submitted, *then* exactly one decision record exists, with policyVersion = V1 and outcome HUMAN_REVIEW.
- *Given* each row DT-01…DT-41 (decided rows), *when* evaluated, *then* the outcome and fallbackCause match the vector.
- *Given* the rules in any order, *then* the result is identical.
- *Given* the global pause is on, *when* a request is submitted, *then* HUMAN_REVIEW / ENGINE_PAUSED.
- *Given* the rule store is unavailable, *then* HUMAN_REVIEW / ENGINE_ERROR, an alert is emitted, and the request is still saved.

**FR-13 Decision record**
- *Given* any evaluated request, *then* its decision record has non-null outcome, policyVersion, reasonCode, reasonText and evaluatedAt (UTC); fallbackCause is non-null if and only if the outcome is HUMAN_REVIEW; and it lists matchedRules (possibly empty).

**FR-14 Determinism**
- *Given* a stored decision, *when* its stored context is replayed against its stored policy version and pause snapshot, *then* the outcome, deciding rule and fallbackCause are identical.

**FR-17 Placeholder restriction**
- *Given* a placeholder rule with mode ACTIVE and outcome AUTO_APPROVE, *when* it is loaded or saved in a non-demo environment, *then* it is rejected with a validation error and the engine keeps the previous version.
- *Given* the shipped R1 rule set, *then* every rule ID starts with `PLACEHOLDER-` and every rule is SHADOW or HUMAN_REVIEW.

**FR-20 Queue**
- *Given* 3 UnderReview requests aged 1 h, 5 h and 2 d (one escalated, one with MISSING_DATA), *when* a reviewer opens the queue, *then* they are listed oldest first, the escalated one shows an ESCALATED flag, and each shows its fallback-cause label.
- *When* staff open the queue URL, *then* 403.

**FR-21 Detail**
- *Given* a request with shadow result S1 = AUTO_APPROVE, *when* the reviewer opens it, *then* they see the fields, full history, matched active rules and S1 labelled "shadow (not applied)".

**FR-22 Decide**
- *Given* an UnderReview request at version v, *when* the reviewer approves (reason optional), *then* the status is Approved, the decision path is HUMAN, the actor is the reviewer, and the audit event is present.
- *When* they decline or request more info without a reason, *then* 422 and nothing changes.

**FR-23 Stale update**
- *Given* reviewer R1 loaded version v, and the request has since moved to v+1, *when* R1 submits a decision with v, *then* 409 with the stale message, and no decision or audit event is written.

**FR-24 One decision per cycle**
- *Given* two reviewers submit approve and decline simultaneously on version v, *then* exactly one succeeds, the other gets 409, and the request has exactly one review decision for this cycle.
- *Given* an Approved request, *when* any reviewer decides again, *then* 409.

**FR-43 Search and audit**
- *Given* a user with audit permission, *when* they search by requestId, branch, status or date, *then* matching requests are returned, and the audit view has no edit controls and its API has no mutating verbs.
- *Given* a staff user, *when* they search outside their branch, *then* those results are excluded.

**FR-44 Immutable audit**
- *Given* any audit event, *when* a PUT, PATCH or DELETE is attempted on any audit endpoint, *then* 404/405.
- *Given* the application DB role, *when* it attempts UPDATE or DELETE on an audit table, *then* permission is denied.

**FR-52 Notification failure**
- *Given* the notification provider fails or times out, *when* a request is submitted or decided, *then* the commit succeeds, the status and queue show the new state, the failure is logged with a retryable record, and an alert is raised.

**FR-60 Roles**
- *Given* a user holding staff and reviewer roles, *then* they can submit and decide. *Given* they submitted request X, *then* [can or cannot decide own request — **GAP**, not specified].

**FR-61 Server-side authorization**
- *For each* (role, endpoint) pair in the completed matrix, *when* called with a token for that role only, *then* allowed pairs succeed and every other pair returns 403. The test is generated from the matrix and fails if any endpoint is missing from it.

**FR-63 User admin**
- *Given* an admin, *when* they deactivate user U, *then* U's next API call returns 401/403 and an audit event records the admin, the target and the change.
- *When* an admin edits their own roles, *then* 403 (pending decision).
- *When* a non-admin calls user management, *then* 403.

**R1 exit (end-to-end):** with synthetic data, staff submit → HUMAN_REVIEW (shadow result recorded for PLACEHOLDER-001) → reviewer requests more info → staff resubmit → reviewer approves → staff see Approved with full history after logout and login.

---

## 6. Recommended test strategy and tooling

The stack isn't chosen yet (elaboration §6). Tools are given as a TypeScript/Node default with Python or JVM equivalents.

| Level | Scope | Tooling | Gate |
|---|---|---|---|
| **Unit** | Operators, decimal comparisons, resolution table (one test per DT row), state-transition table (every from × to pair, valid and invalid), reason validation, idempotency-key handling | Vitest/Jest (pytest, JUnit 5); `decimal.js` / `Decimal` / `BigDecimal`. Never use floats | Every DT row and every transition covered, ≥ 90 % branch coverage on the engine and workflow domain |
| **Property-based** | P1–P6; random rule sets and contexts; generated sequences of workflow commands checked against a model state machine (no illegal state reachable, exactly one decision per cycle) | fast-check (Hypothesis, jqwik) | 1,000+ cases per property in CI; failing seeds saved as fixtures |
| **Golden / reference vectors** | The JSON decision table from section 4, shared by the engine, simulator (FR-32) and replay | JSON fixtures in a shared directory | Every implementation agrees field by field |
| **Integration** | Atomic commit of state + decision + audit (fault injection at each step), notification failure (FR-52), optimistic locking (FR-23/24), concurrent idempotent submit (FR-08), audit table privileges (FR-44), pause propagation latency (D6) | Testcontainers with the real DB engine; a fake notification adapter with failure modes; a controllable clock | Run on every PR |
| **Contract / API** | Error shapes (422/409/403), authorization matrix generated from config | OpenAPI schema validation; matrix-driven test generator | Fail on any endpoint missing from the matrix |
| **End-to-end** | R1 journey, escalation, more-info loop, stale screen with two browser contexts, session persistence | Playwright (Chrome, Edge, Firefox per NFR-13) | Nightly + pre-release |
| **Accessibility** | WCAG 2.1 AA: automated scan + manual keyboard and screen-reader pass on the submit, queue, detail and decide pages | axe-core via @axe-core/playwright; manual NVDA/JAWS checklist | Zero serious/critical violations |
| **Performance** | NFR-01 p95 submit latency; engine timeout behaviour under a slow rule store; queue query on large volumes | k6 or Gatling; a synthetic data generator scaled to Q9 volumes | Once load numbers are set (H8) |
| **Security** | AuthN on every route, IDOR across branches, secret scan, log scan for canary PII, TLS config | OWASP ZAP baseline, gitleaks, log-grep canary test, testssl.sh | Per release |
| **Governance** | Author ≠ approver, immutability, activation gate, resume permission | Integration tests against the admin API | R2 |
| **Shadow / replay** | Shadow never alters the applied result; agreement report counts against a hand-computed fixture | Golden dataset with known human outcomes | R2 |

### Test data and synthetic fixtures needed

1. **Field catalogue (Appendix F)** with types, ranges and sensitivity classes. Needed before any fixture can be built (blocks FR-01, NFR-07).
2. **Synthetic request generator** (seeded): valid requests per request type, boundary amounts, every currency pair (supported and unsupported), invalid and missing variants for each field. Every record tagged `synthetic=true`.
3. **Policy fixture sets (JSON):** `r1-placeholder` (the shipped set), `three-paths-test` (A, D and H active, test-only), `conflict`, `paused-variants`, `shadow-variants`, `malformed`, `empty`, and a large set (~500 rules) for performance.
4. **Decision-table vectors** (section 4) plus operator/boundary vectors, each with expected output.
5. **Users and roles fixture:** one user per role, multi-role users, users at two branches, a deactivated user, an admin.
6. **Workflow scenario fixtures:** requests seeded in every lifecycle state (including escalated and resubmitted with two revisions) for queue and history tests.
7. **Shadow agreement golden set:** N requests with known shadow results and human decisions, plus the hand-computed expected agreement per rule (needs the H7 definition first).
8. **Fault-injection doubles:** rule store (down, slow, malformed), notification adapter (fail, timeout), clock (fixed, advancing), DB (fail at commit).
9. **PII canary values** to scan logs for (NFR-07).
10. **Usability scenario scripts** S1 (routine submit) and S2 (typical review) for NFR-11.

### Decisions QA needs before writing executable tests

H1/A1 (paused-rule semantics), H2/A2 (shadow isolation), A3 (resubmission path), A4 (R1 placeholder behaviour), A5 (escalation states), A6 (canonical state enum), H6 (complete permission matrix), H7 (agreement definition), D6 (timeout and pause interval), and the FR-01 field list.
