# Branch desk: QA review

| Date 2026-10-12 | Scope | Sources read |
|---|---|---|
| 2026-10-12 | `exchangeflow/apps/teller-lite/` (branch desk): rules compilation, decision outcomes, quote, validation, page error mapping, test coverage | `apps/teller-lite/src/server/{rules,desk,app,main}.ts`, `src/shared.ts`, `src/web/{App,api,format}.tsx/ts`, `rules/branch-rules.json`, `rules/README.md`, `test/desk.test.ts`; `packages/policy-core/src/{evaluate,decimal,reasons}.ts`; `packages/workflow-core/src/{request,quote}.ts`; `packages/adapter-rates/src/uexchange.ts` (error path only); `packages/app-services/src/services.ts` (placeholder guard only) |

**Verification reached:** rung 3 (matches the reference) for the engine outcomes and the quote. `npx vitest run apps/teller-lite`: 1 file, 35 tests passed. `npx tsc --noEmit -p apps/teller-lite`: clean. A throwaway probe (`/private/tmp/claude-501/deskqa/probe.mts`, not committed) ran 46 decision-table rows through `checkRequest`: every row matched the expected outcome computed by hand from `policy-engine-design.md` §4.3 precedence (appendix A). Quote figures were checked separately with Python `decimal` (appendix B). Rung 4 does not apply: there is only one implementation, and it calls the same `evaluate()` as the main build.

## Headline findings

- **DESK-QA-01 (blocker for branch use, needs a decision):** with the shipped `status: "TRIAL"` file, which holds placeholder values, the desk still prints "Within branch limits. You may complete the exchange in the banking system." The compiled rules are flagged `nonProduction`, but nothing in the desk reads that flag. Accepted ADR-021 allows placeholder rules to auto-decide only outside production, and the main build enforces this (`services.ts:169`, `PLACEHOLDER_IN_PRODUCTION`). The trial banner ("must be confirmed by head office") contradicts the "you may complete" instruction.
- **DESK-QA-02 (high, needs a decision):** `headOfficeReviewAbove` and `absoluteBranchMax` change nothing for a supported pair. Every amount above `branchLimit` already gets "Head-office review needed" (no rule matches, so it falls to human review). The file check also forbids `branchLimit > absoluteBranchMax`, so the guardrail can never fire. Head office will believe it is setting three tiers when only one limit does anything.
- **DESK-QA-03 (medium):** the business-hours check ignores statutory holidays: 25 December at 11:00 counts as within limits. `rules/README.md` misdescribes two behaviours (see 02 and 05).
- **DESK-QA-04 (medium):** the rules-file checks accept an empty `supportedPairs` (every request becomes "Cannot be done at the branch"), duplicate currencies, payment methods and pairs, limit keys for unlisted currencies, an impossible `approvedOn` (`2026-13-45`) and lowercase time zones.
- **DESK-QA-05 (medium):** the tests cover 7 of the 46 table rows. Untested: the 09:00 and 17:00 boundaries, Sunday, standard time after the daylight-saving change, a non-Toronto time zone, the UTC day rollover, an unsupported pair above the review line or outside hours, the guardrail, and a USD to CAD quote.

## Findings

| ID | Severity | Location | Finding | Recommendation | Needs a decision? |
|---|---|---|---|---|---|
| DESK-QA-01 | blocker (for use at a branch) | `src/server/desk.ts` `checkRequest`; `src/server/rules.ts` `compilePolicy` (`nonProduction: trial`); `src/web/App.tsx` L152, L290 | With `status: TRIAL`, 500.00 CAD on a weekday returns `WITHIN_LIMITS` with reason "Approved automatically under current policy." and next step "You may complete the exchange…". The `nonProduction` flag is set on every compiled rule, but `evaluate()` does not read it. The desk has no counterpart to the main build's placeholder guard (`EF_ENV` plus `PLACEHOLDER_IN_PRODUCTION`). The shipped values are placeholders (`rules/README.md`). The record prints "approved automatically" and "trial, not approved" side by side | Choose one: (a) while TRIAL, change every automated result to `HEAD_OFFICE_REVIEW`, the same idea as the resubmission floor, and add a test; or (b) refuse to start in TRIAL unless an explicit `EFL_ALLOW_TRIAL` flag is set; or (c) the product owner accepts trial auto-approval at branches and records an exception to ADR-021. Under any option, change the TRIAL next-step text so it does not say "You may complete" | Yes: product owner (ADR-021 applies; is the desk "production"?) |
| DESK-QA-02 | high | `rules.ts` `compilePolicy`, `superRefine`; `rules/README.md` table | (i) A supported pair between `branchLimit` and `headOfficeReviewAbove` matches no rule, so the engine falls to `NO_MATCH`, which is human review. Above `headOfficeReviewAbove`, the `HO-REVIEW-ABOVE` rule also gives human review. Both bands produce the same label and reason text. The only effect of `headOfficeReviewAbove` is that an *unsupported* pair above it is reviewed instead of declined. (ii) `absoluteBranchMax` feeds `guardrail.maxAutoApprove`. Approval needs amount ≤ `branchLimit`, and the file check requires `branchLimit ≤ absoluteBranchMax`, so `OVER_MAX_AUTO_APPROVE` is unreachable. No test proves the guardrail downgrade in the desk. (iii) The README line "nothing above it is ever Within branch limits, whatever branchLimit says" is true only because the file check makes it vacuous | Decide what the tiers mean. If above `headOfficeReviewAbove` should differ (for example "Cannot be done at the branch", or a different next step), compile it that way. Otherwise drop the field or document it as "applies to unsupported pairs only". Keep `absoluteBranchMax` as defence in depth, say so in the README, and add a test that calls `compilePolicy` on a hand-built file with `branchLimit > absoluteBranchMax` and expects review | Yes: head office / BA |
| DESK-QA-03 | medium | `workflow-core/src/request.ts` `businessHoursAt`; `rules/README.md` | Hours are Monday to Friday, 09:00 inclusive to 17:00 exclusive, branch time, checked by the hour. This matches the README. Statutory and branch holidays are not considered (2026-12-25 at 11:00 gives `WITHIN_LIMITS`). Branch-specific hours are not supported either | Add a `holidays` list (dates per province or branch) or record that holidays are out of scope. Hours are `[TBD-Stakeholder]` | Yes: head office |
| DESK-QA-04 | medium | `rules.ts` `RulesFileSchema` | Accepted when they arguably should not be: `supportedPairs: []` (every request becomes NOT_AT_BRANCH or review); duplicate `currencies` (React duplicate keys, duplicate options); duplicate `paymentMethods` and `supportedPairs`; limit keys for currencies not in `currencies` (silently ignored, so head office may think EUR has a limit); `approvedOn: "2026-13-45"` and future dates; `approvedBy: "   "` while TRIAL; `"america/toronto"` (Intl accepts it, and the record prints the lowercase name); `version` unchanged after an edit (the hash changes, the label does not); zero limits. Equal limits (`branchLimit == headOfficeReviewAbove == absoluteBranchMax`) are accepted and behave correctly; that is fine | Add `.min(1)` on `supportedPairs` (or an explicit opt-in), uniqueness checks, a check that every limit key is in `currencies`, a real calendar-date check, and canonicalisation of time zones (`resolvedOptions().timeZone`). Optionally warn when `absoluteBranchMax < headOfficeReviewAbove` | Partly (whether an empty pair list is allowed) |
| DESK-QA-05 | medium | `test/desk.test.ts` | Spec rules with no test: see appendix A, column "Test?". The missing vectors are the 08:59:59, 09:00, 16:59:59 and 17:00 boundaries; Sunday; standard time (2026-11-02); a non-Toronto zone; Friday 20:00 local = Saturday UTC; CAD 1500.01 and 10000.00 (the "above" line is strict); USD 7500.00 and 7500.01; unsupported pair above the review line and on a Saturday (review beats decline); empty `supportedPairs`; guardrail; `"1000"` without decimals; OTHER payment method with the shipped file; a USD to CAD quote; a 0.01 CAD quote; HTTP 415, body over 8 KB, rate provider throwing on `/api/check`, `/api/quote` 429, static path traversal; invalid `approvedOn`. The test named "a payment method head office removed needs review" actually asserts a validation error | Add the rows in appendix A as an `it.each` table, with the expected values from the appendix; rename the misnamed test | No |
| DESK-QA-06 | medium | `rules/README.md` | "Any other pair is 'Cannot be done at the branch'" is wrong when the amount is above `headOfficeReviewAbove` or the time is outside hours: both give "Head-office review needed" because review beats decline. "Between branchLimit and headOfficeReviewAbove, a request needs head-office review" is correct but hides that above the line looks identical (02). `main.ts` refers to "README" for the no-sign-in warning, but there is no `apps/teller-lite/README.md` | Correct the pair row; add the app README, or point the comment at an existing document | No |
| DESK-QA-07 | low | `rules.ts` `HO-PAYMENT-METHOD`; `desk.ts` `validateDesk` | The compiled rule "payment method not listed gives review" is unreachable: `validateDesk` rejects an unlisted method with 422 first | Remove the rule, or let validation pass and let the rule route to review. Pick one behaviour and test it | No |
| DESK-QA-08 | low | `App.tsx` `PATH_FIELD`, L121 to L125 | Server issue paths not mapped to a field: `requestType`, `sell` (whole object), `''` (unknown key in `values`), `values`. They cannot be reached from the page (the page always sends EXCHANGE and a well-formed object). When unmapped issues come with mapped ones, they are dropped silently; when only unmapped issues come, a generic message shows. Also, when `tellerId` fails the outer schema, the server returns only that issue and the `values` issues come on a second attempt (the client regex matches the server's, so this is unlikely in practice) | Show unmapped issues in the summary box as plain text rather than dropping them | No |
| DESK-QA-09 | low | `App.tsx` `localErrors` versus server messages | The client checks fewer things than the server (amount scale and zero, name characters, `memberRef` pattern, note card or SIN check are server-only). Every server issue comes back mapped to its field. Copy differs in tone: the client says "Enter an amount in figures, for example 250.00…" while the server says "Amount must be greater than zero." and "At most 2 decimal places for CAD." (capitalised by `sentence()`); `memberRef` gives "Letters, digits, - and _ only." The summary uses names that differ from the visible labels ("Amount the member gives" versus "Member gives"; "Currency the member gives" versus "Currency") | Mirror the scale and zero checks on the client with the same wording; align `FIELD_NAME` with the visible labels; make the summary items links to the fields | No |
| DESK-QA-10 | low | `workflow-core` `computeQuote`; `app.ts` `/api/quote` | Arithmetic is correct (appendix B). Edge cases: 0.01 CAD quotes "0.00 USD" (floor), shown as a figure; `/api/quote` does not check the amount's scale (1000.005 CAD gets a quote, while `/api/check` rejects it) | Show "no estimate" when `give` is 0; check the scale in `/api/quote` | No |
| DESK-QA-11 | low | `App.tsx` L323 `fmtTime` | "Checked" is formatted in the browser's time zone, while "Date and time" uses the branch zone. If the PC clock zone differs, the PDF shows two different local times | Format "Checked" in UTC with a "UTC" suffix, or in the branch zone | No |
| DESK-QA-12 | low | `reviews/ba-review.md` §4, `docs/adr/` | The 2026-10-12 decisions (lite app, JSON rules file, name printed, PDF emailed, no database or sign-in) do not appear in the decision log or in any ADR (a grep for "desk" and "teller-lite" found nothing) | BA records them with the date | No (recording only) |

## Not checked

- No browser: print preview, light and dark themes, a narrow window, keyboard order, screen reader, and the `mailto:` link in a real mail client were not viewed. The `vite build` production bundle was not built or inspected (the tests run from source). No automated accessibility checks were run.
- The live rate feed was not called. The feed's terms of use remain unconfirmed (DL-N40).
- The security of the HTTP surface (no sign-in, `EFL_HOST` exposure, an outbound fetch triggered by any POST) was not reviewed; see `reviews/desk-security.md`.
- Regulatory suitability of any threshold: every value is `[TBD-Stakeholder]`.

### Manual browser checks needed (no automated UI tests exist)

1. Print preview in Chrome, Edge and Firefox: `.no-print` hidden; the record fits on one page; the trial band, stamp, signature lines and fingerprint are printed; the saved PDF file name is "Exchange record EFD-…" and never contains the member name.
2. Each result kind (within limits, review, cannot be done): status is shown by glyph or shape plus word, not by colour alone, including in a greyscale print. The review stamp has an empty glyph; confirm it is still distinguishable.
3. Light and dark (`prefers-color-scheme`), and forced colours or high contrast: contrast of the stamp, trial band and error text.
4. Narrow window (about 360 px) and 200 % zoom: the form and record reflow without horizontal scrolling.
5. Keyboard only: skip link; tab order; error summary receives focus and lists every field; `aria-invalid` and `aria-describedby` are announced; the radio group is reachable with the arrow keys; focus moves to the record heading after a check; "New request" moves focus to the Member section; visible 3 px focus ring.
6. The estimate updates after 400 ms, shows the stale-rate message, and shows "no estimate" for an unquotable pair; `aria-live` is not too noisy.
7. "Email head office" opens the mail client with the subject and body (no member name) and the correct address; behaviour when no mail client is configured.
8. Rules file changed while the page is open (currency removed): the server message appears next to the field. Rules file broken: the page shows the "not available" banner.
9. Branch and staff ID are remembered in `localStorage`, and the page still works when storage is blocked.

## Appendix A: decision table (shipped rules unless noted; Toronto branch; Tuesday 2026-10-13 11:00 EDT unless noted)

Expected values were derived by hand from the compiled rules and the §4.3 precedence (human-review rule, then no-match review; decline only when no review rule is true; approve needs amount ≤ `branchLimit[sell currency]` and a supported pair). Actual values come from `checkRequest`. All 46 rows matched. W = Within branch limits, R = Head-office review needed, N = Cannot be done at the branch, V = 422 validation.

| # | Input | Expected | Why | Actual | Test? |
|---|---|---|---|---|---|
| 1 | 0.01 CAD to USD | W | ≤ 1000.00 | W | no |
| 2 | 999.99 CAD | W | | W | no |
| 3 | 1000.00 CAD | W | `lte`, inclusive | W | yes |
| 4 | "1000" CAD (no decimals) | W | decimal compare | W | no |
| 5 | "0001000.00" CAD | W | leading zeros accepted | W | no |
| 6 | 1000.01 CAD | R | no rule matches (NO_MATCH) | R | yes |
| 7 | 1500.00 CAD (= absoluteBranchMax) | R | NO_MATCH; guardrail not reached | R | no |
| 8 | 1500.01 CAD | R | NO_MATCH | R | no |
| 9 | 10000.00 CAD (= review line) | R | `gt` is strict, so NO_MATCH | R | no |
| 10 | 10000.01 CAD | R | HO-REVIEW-ABOVE | R | yes |
| 11 | 749.99 USD to CAD | W | USD limit 750.00 | W | no |
| 12 | 750.00 USD | W | inclusive | W | yes |
| 13 | 750.01 USD | R | NO_MATCH | R | yes |
| 14 | 1100.01 USD | R | | R | no |
| 15 | 7500.01 USD | R | HO-REVIEW-ABOVE | R | no |
| 16 | 999.00 CAD to USD | W | limit taken from the *sell* currency (CAD 1000), not USD 750 | W | no |
| 17 | ACCOUNT payment method | W | | W | no |
| 18 | OTHER payment method (not listed) | V `paymentMethod` | validation before the engine; HO-PAYMENT-METHOD unreachable | V | partly (with a modified file) |
| 19 | Tuesday 08:59:59 EDT (12:59:59Z) | R | hour 8 | R | no |
| 20 | Tuesday 09:00:00 EDT | W | hour ≥ 9 | W | no |
| 21 | Tuesday 16:59:59 EDT | W | hour 16 | W | no |
| 22 | Tuesday 17:00:00 EDT | R | hour < 17 fails | R | no |
| 23 | Friday 16:30 EDT | W | | W | no |
| 24 | Friday 20:00 EDT = Saturday 00:00Z | R | branch day Friday, hour 20 | R | no |
| 25 | Saturday 11:00 | R | weekend | R | yes |
| 26 | Sunday 11:00 | R | weekend | R | no |
| 27 | Monday 10:00 EDT | W | | W | no |
| 28 | Monday 2026-11-02 08:59 EST (13:59Z) | R | after DST ends, UTC−5 | R | no |
| 29 | Monday 2026-11-02 09:00 EST (14:00Z) | W | | W | no |
| 30 | Monday 2026-11-02 16:59 EST | W | | W | no |
| 31 | Monday 2026-11-02 17:00 EST (22:00Z) | R | | R | no |
| 32 | Vancouver branch, 08:30 PDT (11:30 in Toronto) | R | branch zone used | R | no |
| 33 | Vancouver branch, 16:30 PDT (19:30 in Toronto) | W | branch zone used | W | no |
| 34 | Friday 2026-12-25 11:00 EST | W (see DESK-QA-03) | no holiday calendar | W | no |
| 35 | businessHoursOnly false, Saturday, 500.00 CAD | W | | W | yes |
| 36 | businessHoursOnly false, Saturday, 1000.01 CAD | R | | R | no |
| 37 | EUR file: CAD to EUR 500.00 | N | pair not listed | N | yes |
| 38 | EUR file: CAD to EUR 5000.00 | N | between the limits, decline | N | no |
| 39 | EUR file: CAD to EUR 10000.01 | R | review rule beats decline | R | no |
| 40 | EUR file: EUR to CAD 500.00 | N | | N | no |
| 41 | EUR file: EUR to USD 7000.01 | R | EUR review line 7000.00 | R | no |
| 42 | EUR file: CAD to EUR 500.00 on Saturday | R | outside-hours rule beats decline | R | no |
| 43 | `supportedPairs: []`, 500.00 CAD | N | file accepted (DESK-QA-04) | N | no |
| 44 | 1000.005 CAD | V `sell.amount` | scale 2 | V | yes (10.001) |
| 45 | "1e3" CAD | V `sell.amount` | not a decimal string | V | no |
| 46 | 12345678901234567890.00 CAD | R | no upper bound on size; exact BigInt | R | no |
| — | Guardrail: `branchLimit > absoluteBranchMax` | R (OVER_MAX_AUTO_APPROVE) | cannot be built through `parseRulesFile` | not reachable | no |

## Appendix B: quote arithmetic (independent check with Python `decimal`, ROUND_FLOOR to 0.01)

| Input | Rate used | Exact | Expected | `computeQuote` |
|---|---|---|---|---|
| 500.00 CAD to USD | sell 1.4499 (÷) | 344.85136905… | 344.85 USD | 344.85 (unrounded 344.851369) |
| 250.00 USD to CAD | buy 1.3512 (×) | 337.800000 | 337.80 CAD | 337.80 |
| 100.01 USD to CAD | buy 1.3657 (×) | 136.583657 | 136.58 CAD | 136.58 |
| 1.00 CAD to USD | sell 1.4499 | 0.68970… | 0.68 USD | 0.68 |
| 0.01 CAD to USD | sell 1.4499 | 0.00689… | 0.00 USD | 0.00 (DESK-QA-10) |

The side is correct: when the member sells CAD, the amount is divided by the sell value; when the member sells USD, it is multiplied by the buy value. Rounding is down to the cent, as decided on 2026-10-02.
