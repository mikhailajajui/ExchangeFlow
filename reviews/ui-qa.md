# UI design QA review (ui-qa)

Date: 2026-10-01. Reviewer: QA. Scope: `docs/ui-design/ui-design.md`, `tokens.css`, `screens.html`, compared with `exchangeflow/apps/web/src`.

**Method and limits.** I read the HTML/CSS and ran a WCAG 2.1 contrast script (relative luminance, scratchpad `c.py`). I **could not run a browser**, so layout, overlap, focus order, screen-reader output and zoom behaviour below are reasoned from the CSS. Each one is marked **(unverified)** and needs a manual check. The web app has no tests: `vitest.config.ts` includes only `packages/**`, and `apps/web/package.json` has no axe or Playwright.

Ladder rung: **R2 (spec coverage) for the design.** No UI code implements it yet, so R3 and R4 do not apply. Contrast was recomputed (R3 for the numbers).

## 1. Contrast recomputation

I recomputed every pair in `ui-design.md` section 8 and added pairs that `screens.html` actually uses. **All 13 claimed rows match the doc to two decimals, in both themes. No claimed pair fails AA.**

Pairs the doc did not list, checked because the CSS uses them:

| Pair | Light | Dark | Verdict |
|---|---|---|---|
| `--good` / `--bad` / `--warn` on `--paper` | 5.95 / 5.95 / 6.30 | 9.31 / 7.99 / 9.56 | pass |
| `--ink-muted` on `--review-tint` / `--good-tint` / `--bad-tint` / `--warn-tint` | 5.44 / 5.72 / 5.47 / 5.63 | 6.79 / 6.47 / 7.09 / 6.13 | pass |
| `--ink` on all four tints | 12.0 to 12.7 | 11.2 to 13.0 | pass |
| `--good` on `--review-tint` | 5.32 | 7.87 | pass |
| `--edge` on `--bad-tint` / `--review-tint` (control border, 3:1) | 3.62 / 3.60 | 4.45 / 4.26 | pass, thin margin in light |
| `--paper` text on `--ink` (selected filter) | 13.44 | 14.71 | pass |
| `--ink-muted` on `--rule` (disabled button text) | **4.23** | 5.13 | below 4.5 in light, exempt as disabled |
| `--rule` on `--slip` / `--paper` (decorative) | 1.58 / 1.44 | 1.41 / 1.57 | decorative only, as stated |

Notes:
- The thin margins are `--edge` on `--paper` (4.03) and `--edge` on the tints (3.60). Any palette change must be re-run.
- The doc states "disabled is exempt." True under WCAG 1.4.3. But the disabled Decline and Ask buttons carry the reason text, which is correct, and the muted-on-rule disabled text is only 4.23 in light mode.
- Non-text contrast (1.4.11) holds for the status marks, row bars and meter border. The meter **fill** (`--ink-muted` on `--slip`) is fine.
- **The current implementation fails.** `styles.css` line 39 draws the focus ring as `--brand` at 55% alpha. That is about 2.6:1 on white, under the 3:1 requirement. The new `--focus` solid ring fixes it.

## 2. Findings

Severity: High means a likely wrong or inaccessible result on a core flow. Medium means a defect with a workaround. Low means polish or docs.

### High

**UI-QA-01 [High] Dialog spec contradicts itself, and the current `Modal` has no focus management.**
- Evidence: 4.8 says "Cancel as the first focusable control." 5.4 says "first focus on the reason field." The current `Modal` in `ui.tsx` has no focus trap and no focus return. It closes on backdrop `mousedown`, which discards a half-typed reason. It listens for Escape on `window`, and the background is not `inert`. It also uses `aria-label` rather than `aria-labelledby`.
- Also inconsistent: 5.4 lists the dialogs as pause/resume, cancel and record completion. But "Send to head office" needs a reason, and 6 calls it a dialog.
- Fix:
  - Use native `<dialog>` with `showModal()`, or a tested library, so you get inert background and Esc for free.
  - Pick one initial-focus rule. Recommend: the reason field for reason dialogs, and Cancel for pause/resume only if there is no reason field, which should not happen.
  - Return focus to the trigger. If the trigger unmounts, focus goes to the page `h1`.
  - Backdrop click should not dismiss a dialog that has input.
  - Add "Send to head office" to the dialog list.

**UI-QA-02 [High] No focus or announcement rule when content swaps in place.**
- Evidence: `Outcome` in `RequestForm.tsx` replaces the form through state. There is no route change, so the submit button unmounts and focus drops to `body`. The spec's "focus the heading, tabIndex=-1" is right but is not in the reference HTML. The reference outcome `h3` has no `tabindex`, and the doc also adds a polite live region on the same heading.
- Also unspecified: where focus goes after Approve, Decline or Ask (the panel unmounts), after a route change, after a queue item vanishes under focus, and after the "Draft, not saved" status changes.
- Fix:
  - Focus the heading only. Drop the live region for it, because focus plus live region announces twice.
  - Set `document.title` per route and per outcome.
  - After a reviewer decision, focus the page `h1` or a `status` banner ("Approved.").
  - If the focused queue row is removed, focus the next row or the list heading.

**UI-QA-03 [High] The restricted-cause label is itself a tell.**
- Evidence: 7.9 maps GUARDRAIL to "Head-office check required" and claims the cause is "not distinguishable." Every other cause has a specific wording. So this label identifies the restricted path to anyone who sees it, and the "same shape" claim covers layout only.
- Related: the outcome "Why" line shows the engine reason text, and decision 7 is still open. `ROLE_LABEL` has `COMPLIANCE: 'Compliance'`. If an actor name or role is shown to tellers, "Compliance" is shown too.
- Fix: the product owner and security-reviewer decide whether one generic label ("Sent to a person for review") covers several causes, or the tell is accepted. Add `compliance`, `guardrail`, `flag`, `AML`, `KYC`, `watchlist` and `restricted` to the lint list (section 4).

**UI-QA-04 [High] `data-theme="light"` does not force the light theme under a dark OS (tokens.css).**
- Evidence: `:root[data-theme="light"]` sets only `color-scheme: light`. The `@media (prefers-color-scheme: dark) :root` block still sets every variable. A tester with a dark OS who sets `data-theme="light"` gets dark colours with light native controls.
- The comment says it is a "manual override for QA." `screens.html` has no override at all, because it copies the tokens inline and has drifted from `tokens.css`. The `data-theme="dark"` block also omits `--shadow-lift`.
- Fix:
  - Define the light variables in `:root, :root[data-theme="light"]`.
  - Wrap the dark media block in `:root:not([data-theme="light"])`.
  - Have `screens.html` link `tokens.css`.
  - Playwright should use `colorScheme` emulation as well as the attribute.

**UI-QA-05 [High] A 15-second auto-refresh with no way to pause (WCAG 2.2.2 Pause, Stop, Hide, AA).**
- Evidence: 4.6 and 8 describe the queue refresh and the inbox poll. There is no pause control. The design keeps focus stable but does not give the user control. The sign-in-expiry message has no warning before timeout (2.2.1), and 6 does not say whether unsaved slip entries survive a sign-out.
- Fix: add "Pause updates" and "Refresh now" buttons, and show "Updated 09:44:10". Add a 2-minute timeout warning with "Stay signed in." Persist a form draft locally across sign-in expiry, with no personal data (note the PII hints).

**UI-QA-06 [High] Approve is one click with no confirmation and no undo, next to Decline (4.7).**
- Evidence: WCAG 3.3.4 (AA) requires financial and data-changing submissions to be reversible, checked or confirmed. The doc says "no undo, because decisions are recorded." The button also lacks the request ref or amount, and a mis-click lands next to Decline.
- Fix: the product owner must pick one of these.
  - A confirm step.
  - A 10-second "Undo" toast.
  - An accepted risk, recorded in the decision log.
  - At minimum, keep Approve visually separated from Decline, and have the aria-label include the ref ("Approve request P9R4WA").

### Medium

**UI-QA-07 [Medium] Stamp can overlap content, especially in French (unverified).**
- Evidence: `.stamp` is `position:absolute` at 36px uppercase. `.docket h3` reserves only `padding-right:11rem` (176px) and `min-height:3.5rem` (56px). My estimate: "WITH HEAD OFFICE" at 36px condensed is about 260 to 290px wide and about 68px tall, plus a -4deg rotation. That already spills past the reservation. The stamp has an opaque `--slip` background, so it would hide text below it. "Avec le siège social" is longer and will wrap, growing taller.
- Fix: in-flow layout (flex row with stamp `flex:none`) instead of absolute. Test at 3 languages and 200% zoom.

**UI-QA-08 [Medium] Tables overflow on narrow widths, and the spec's scroll wrapper is not in the reference.**
- Evidence: 8 requires a `role=region`, `tabindex=0`, labelled wrapper. `screens.html` has none. `.ledger` is `width:100%` with `nowrap` marks and money. The reviewer queue has six columns in a `minmax(min(100%,34rem),1fr)` track, so I expect it to overflow even in the desktop gallery (unverified).
- When you add the wrapper, `overflow:auto` clips the 3px focus outline of links in the first and last rows. Add inner padding.
- Fix: add the wrapper class to the reference. Add padding of at least 5px inside it.

**UI-QA-09 [Medium] 320px reflow (WCAG 1.4.10) will fail in several places (unverified).**
- `.sale` stays three columns (`1fr auto auto`) at all widths with a 24px mono amount, so the amount field is cramped and clipped.
- `.docket .big` (32px, `nowrap`) plus its label overflows at 320px.
- `.bar` has no `flex-wrap`, so brand, nav, who, notifications and sign-out do not fit.
- The sticky top bar would be 2 to 3 lines tall at 200 to 400% zoom and covers most of the viewport. There is no `scroll-padding-top`, so focused elements hide under it (2.4.11 Focus Not Obscured, WCAG 2.2).
- The sticky decision panel (`top:4rem`) can be taller than a short viewport, so its buttons are unreachable.
- Fix: stack `.sale` under 48rem. Allow the money line to wrap in the label. Set `.bar{flex-wrap:wrap}`. Unstick the bar and the panel below 48rem or under `max-height:40rem`. Set `html{scroll-padding-top:4rem}`.

**UI-QA-10 [Medium] Status marks and urgency lose parts in forced-colors mode.**
- Evidence: meter fill, row bars (`box-shadow`) and tinted `.next` notes are backgrounds or shadows, which forced-colors removes. Words and shapes survive, so status is not lost, but the meter looks empty. Section 8 says "set `forced-color-adjust: auto`," which is already the default, so it is not an action. No `@media (forced-colors: active)` rules exist.
- Also unverified: `box-shadow` on `<tr>` with `border-collapse: collapse` is unreliable in some browsers, so the left bar may not paint (and the late bar, 8px vs 4px, may not show).
- Fix: add forced-colors rules, for example meter fill `background:Highlight` and a `border-left` on the first cell for the bar. Use `border-left` on the first `td` instead of a `tr` shadow.

**UI-QA-11 [Medium] Table semantics gaps.**
- 11 `<th>` and none has `scope`, although 8 requires it.
- The queue has an empty header cell for the "Open" column (axe `empty-table-header`).
- Each queue row has two links to the same target (ref and "Open"), and "Open" is not descriptive (2.4.4).
- The ref is not marked as the row header.
- The caption is hidden with an inline `left:-9999px` style rather than a shared `sr-only` class.
- Fix: `scope="col"` and `scope="row"` on the ref cell. Use a visually hidden "Action" header. Name the link "Open P9R4WA" or remove it. The row click convenience stays.

**UI-QA-12 [Medium] Form errors in the reference.**
- The From select has `.f.err` styling (red border and tint) but no message and no `aria-invalid`. A colour-only error.
- The `!` icon is `::before` generated content, which some screen readers read as "exclamation mark." The doc lists no "Error:" prefix.
- The summary has `role="alert"` but no `tabindex="-1"`, so it cannot take focus as 5.2 says. Using both focus and `role=alert` double-announces. The summary links are `href="#amt"`, which will not move focus reliably in a router app.
- The current `Field` wraps the control in a `<label>` that also contains the hint and the `role="alert"` error, so the accessible name becomes "label + hint + error". It has no `aria-invalid` or `aria-describedby`. Several field errors with `role=alert` fire at once.
- Fix: label via `htmlFor`. Errors in an element referenced by `aria-describedby` (no per-field `role=alert`). On failed submit, focus the summary only and drop `role=alert`. Handle summary links in JS (`element.focus()`). Hide the "!" with `aria-hidden` and put "Error:" text in a visually hidden span.

**UI-QA-13 [Medium] Status glyphs are read out.**
- Evidence: `<i>✓</i>`, `<i>✕</i>` and `<b>?</b>` inside `.mark` are not `aria-hidden`, so a screen reader says "check mark Approved" or "multiplication X Declined by rule."
- Fix: `aria-hidden="true"` on the glyph. Keep the word. The stamp has `role="img"` with `aria-label="Declined"`, which drops the child text "by rule" and "waiting for a reviewer", and sits before the heading in DOM order. Make the stamp `aria-hidden` and keep the heading text the same as the label.

**UI-QA-14 [Medium] Heading structure in the reference.**
- Page titles are `h2` and the outcome heading is `h3`, with no `h1` inside the frames. 8 says "one `h1` per page." An implementer who copies the HTML ships the wrong levels. The decision panel is an `<aside>` (a complementary landmark) for a primary task.
- Fix: annotate the reference ("in the app, h2 becomes h1"). Make the outcome heading an `h1`. Use `<section>` for the decision panel. Add a skip link and `<main>` to the reference. The skip link target needs `tabindex="-1"`.

**UI-QA-15 [Medium] `display: contents` timeline and list-style removal (unverified).**
- `.timeline` is an `ol` with `list-style:none` and `li{display:contents}`. In Safari/VoiceOver, both choices are known to drop list semantics. The "Round n" divider is a `grid-column` item with no valid `li` in the sample, so an implementer may place a `div` inside the `ol`.
- Fix: add `role="list"` and `role="listitem"`, or avoid `display:contents` (use a grid per `li`). Make the round divider an `li`. Mark times with `<time datetime>`. Show the zone, because the convention is UTC instants with a branch IANA zone and head-office users see branch times. The current `fmtTime` uses `en-CA`, which prints "9:42 a.m." (12-hour) while the design shows 24-hour "09:42".

**UI-QA-16 [Medium] Disabled Decline and Ask buttons are not discoverable by keyboard.**
- `disabled` removes them from the tab order. The reason is in a nearby `<p>` but is not connected with `aria-describedby`. A keyboard or screen-reader user can miss the buttons.
- Fix: use `aria-disabled="true"` with `aria-describedby` pointing at the reason, and block the click in JS. Or keep `disabled` but link the reason from the Reason field's hint.

**UI-QA-17 [Medium] "Send to head office" in the decline outcome is an `<a>` styled as the primary button.**
- It opens a reason dialog, so it should be a `<button>`. The Sign out `<a href="#">` is also an action. The design says one primary per screen, and the detail screen's "Cancel request" is drawn as a secondary where 5.1 says destructive.

### Low

**UI-QA-18 [Low] Target size claim.** Section 8 says at least 40px. Filter buttons are about 34px (padding .35rem, no `min-height`), `.btn.sm` is 32px (acknowledged). Both pass 2.5.8 (24px) but not the doc's claim. Correct the doc or add `min-height`.

**UI-QA-19 [Low] Hover in dark mode.** `.btn:hover{filter:brightness(1.15)}` on `--btn` `#E6ECE8` barely changes the colour (it clips towards white), so hover feedback is nearly invisible in dark.

**UI-QA-20 [Low] Font weight 650.** Headings use 650 but the font request loads 400/500/600/700. Unless the file is the variable font, 650 renders as 700. The Google Fonts `@import` is also live in the reference, which is a third-party request. The tokens file says to self-host.

**UI-QA-21 [Low] Notification button name.** The bell becomes the word "Notifications" with a count badge. Keep the visible text in the accessible name by using hidden text (", 3 unread"), not `aria-label`. The current popover is `role="menu"` with no menuitems or arrow-key handling. Use a disclosure (`aria-expanded`, Escape, focus return) as 10 says.

**UI-QA-22 [Low] Current tabs.** `Requests.tsx` uses `role="tablist"` and `role="tab"` with no tabpanel, no roving tabindex and no arrow keys. The new `aria-pressed` buttons are the right fix. Specify that the filter group is single-select and reports the result count in a live region.

**UI-QA-23 [Low] Misc.** Slip and docket are centred (`margin:0 auto`) while 3 says left-aligned. `.perf` is unused CSS. `inputmode="decimal"` on iOS or Android in a French locale shows a comma key while the API wants a point (ties to decision 4). Reference has no print rules (the receipt may be printed). The env strip must be absent in production, which needs a test (ADR-021).

## 3. What can be automated and what cannot

| Rule | How | Notes |
|---|---|---|
| Contrast of all token pairs, both themes | Unit test over `tokens.css` (parse vars, assert ratios and thresholds). Failing pair list is the oracle; I can add `c.py` as a fixture | Catches palette edits. Computed values, not rendered. |
| Contrast as rendered | axe-core `color-contrast` in Playwright, light and dark (`colorScheme` emulation) | axe skips text over gradients/images and pseudo-elements; stamp and tear edge need manual check. |
| Names, roles, labels, `aria-*`, table headers, landmarks, heading order, duplicate ids, `aria-valid-attr` | axe-core (`@axe-core/playwright`) per screen | Covers UI-QA-11, 12, 14 partly. |
| Copy lint | Unit test over the message catalogue plus a rendered-text scan: banned words (`suspicion`, `sanction`, `PEP`, `FINTRAC`, `screening`, plus UI-QA-03 additions) and raw codes (`GUARDRAIL`, `COMPLIANCE_GUARDRAIL`, `ENGINE_ERROR`, any `[A-Z_]{4,}` token) | Run it for tellers and reviewers on every screen state. Allow the words in code and docs only. Also assert the 7.9 table is the only source. |
| Restricted-cause row same shape | Playwright: render GUARDRAIL vs RULE_REQUIRES_HUMAN rows, compare DOM structure (tags, classes, text node count), bounding box height | Timing sameness needs API-level tests. |
| Keyboard flows | Playwright: tab order from load, skip link, form to outcome (focus lands on the heading), dialog open/trap/Esc/return, filters, reviewer decision, inbox disclosure | Assert `document.activeElement` at each step. |
| Error summary and field errors | Playwright: submit invalid, assert summary focused, each link focuses its field, `aria-invalid`, `aria-describedby` target text, accessible name excludes error | |
| Reduced motion | Playwright `reducedMotion:'reduce'`: `getComputedStyle(stamp).animationName === 'none'`. Without it, assert it runs once | Also a lint that no other `animation` or `transition` exists. |
| Status never colour only | Test: every status/urgency element has text plus a shape element. Screenshot with `forced-colors` and greyscale filter | Greyscale distinguishability is a manual look. |
| Narrow window | Playwright at 320, 768, 1024 and 200% zoom (deviceScaleFactor or viewport 640px): assert `scrollWidth <= clientWidth` on `document` and no overflow outside scroll regions | Visual overlap (stamp) needs screenshots plus human check. |
| Live regions | Playwright: assert live-region node text changes ("1 new request", "Approved.") | What a screen reader says is manual. |
| Sticky bar not hiding focus | Playwright: tab to each element at 200% and check `getBoundingClientRect().top >= barHeight` | |
| No float for money | Existing unit tests plus a lint on `parseFloat` / `Number(` in web | |

**Manual only:** screen-reader output (NVDA, JAWS or VoiceOver, plus TalkBack/Narrator spot check), real zoom and text-spacing override (1.4.12), Windows High Contrast, whether the stamp and tear edge look right, hover and focus legibility, French copy fit and tone, cognitive load of the two surfaces.

## 4. Acceptance criteria per screen

Each is pass/fail and testable. "AT" means a manual check with a screen reader.

**Sign-in (4.1)**
- Users are listed as full-width rows, each a button, with name and role in the accessible name.
- Tab reaches each row; Enter and Space activate; focus ring visible.
- Env strip present in test, absent in production build.
- Production shows one primary button with the credit-union copy.

**Teller request list (4.2)**
- Skip link first in tab order; one `h1` "My requests"; table has caption, `th scope`.
- Each row's status shows shape, word and bar; greyscale screenshot still distinguishes five statuses.
- Needs-action rows sort first. Filter buttons use `aria-pressed`; the count change is announced.
- Empty state shows copy and the primary button. Money is right-aligned, tabular, built from the decimal string.
- No horizontal page scroll at 320px; the table scrolls in a focusable labelled region.

**New request form (4.3)**
- Labels via `for`; optional fields say "(optional)"; no instructions in placeholders.
- Invalid submit: summary gets focus and lists each error as a working link; each field has `aria-invalid` and `aria-describedby`; no field is styled red without a message.
- Each error message matches section 6 verbatim, including "at most 2 decimal places for CAD".
- Validation on submit and on blur of a touched field. Submit shows "Submitting..." with the button width unchanged; double click does not create two requests.
- Test scenarios panel is a collapsed `details`, shown in test environments only.

**Outcome (4.4)**
- After submit, focus is on the `h1`; title updates; no double announcement.
- Heading text, stamp label and next-step copy match section 6 for approve, decline and head office.
- Stamp animation runs once, not at all under reduced motion; it is hidden from AT and never covers the amount, heading or "Why" at 320, 768, 1280px and in French.
- "Send to head office" is a button opening a dialog; "Open request" works by keyboard.
- Amount is the submitted decimal string, no rounding.

**Request detail and history (4.5)**
- Status, round and branch shown; version and audit hashes only in the Details disclosure, and only for managers.
- Timeline is a real list (verify in Safari/VO); each entry has a time with zone, an actor in text, and a square or round marker.
- Round dividers are valid list items. Back link and actions reachable by keyboard.
- Reviewer's message shown with the "The reviewer asked" prefix; Update and resubmit goes to a form that states the resubmission always goes to review (ADR-022).

**Reviewer queue (4.6)**
- Oldest first; meter, minutes and "Late" word all present; late rows have the thicker amber bar.
- A 15-second refresh does not move or blur the focused row; "1 new request" is announced; Pause updates works.
- A removed row under focus hands focus to a defined place.
- "Why it is here" uses only 7.9 wording; no raw code appears.
- Late threshold is configurable and displayed once decided (`[TBD-Stakeholder]`).

**Decision panel (4.7)**
- Approve is the only green filled button; Decline and Ask are not activatable until the reason has 3 or more characters; the reason text is associated with them.
- Self-decision attempt shows the message and blocks.
- After each decision, focus and a "Decision recorded" status are defined; no double submission (idempotency).
- "How the engine decided" lists only general-part fields; a reviewer-only check hides shadow results for tellers.

**Engine panel (4.8)**
- Paused band has shape, word and role `status`. Pause and Resume dialogs require a reason; the primary action is named "Pause the whole engine".
- Focus is trapped; Esc closes; focus returns to the trigger.
- "test rule" tag replaces "non-production" wording.

**Inbox**
- Word "Notifications" plus square count badge; disclosure with `aria-expanded`; Esc closes and returns focus; count and unread state not colour only.

## 5. Browser, zoom and mode matrix

| Dimension | Cases |
|---|---|
| Browsers | Chrome and Edge (current), Firefox (current), Safari 17+ on macOS. Safari matters for `tr` shadows, `display:contents` lists, and focus rings. Add iPad Safari for touch-size spot check. |
| Zoom and size | 100%, 200% at 1024px window (about 512 CSS px), 400% at 1280px (320 CSS px), browser minimum font size 24px, text-spacing bookmarklet (1.4.12), 768px boundary (48rem). |
| Colour scheme | Light, dark, and switching mid-session. Theme forced by OS and by `data-theme` (see UI-QA-04). |
| High contrast | Windows High Contrast (Contrast themes) with Edge and Firefox; macOS "Increase contrast" and "Reduce transparency". Check marks, meter, stamp border, focus ring. |
| Motion | `prefers-reduced-motion: reduce` on and off. |
| Input | Keyboard only; mouse; touch on a tablet; voice control ("click Submit request" must match visible labels). |
| Assistive tech | NVDA + Firefox/Chrome, JAWS + Chrome, VoiceOver + Safari. Scripts: submit a request, read the outcome, resolve a queue item, pause the engine. |
| Locale | en-CA and fr-CA: stamp and button fit, date and number format, comma input. |
| Printing | Outcome docket print preview (if printing is allowed). |

## 6. Spec coverage gaps (rung 2)

| Spec statement | Test mapped | Status |
|---|---|---|
| Section 10 "axe in light and dark" | none exists | gap (no web test tooling at all) |
| Keyboard path form to docket | none | gap |
| Copy lint | none | gap |
| Reduced-motion check | none | gap |
| Zoom 200%/1024 and below 768 behaviour | none | gap, add Playwright viewport tests |
| Dialog focus, return | none | gap |
| Stale, network, sign-in-expired messages (section 6) | none | gap; messages listed but no trigger paths specified |

All of these map to the new web test set; I did not add files because the web package has no test runner configured, and adding one is a product-code change for sr-dev.

## 7. Decisions the product owner must make

1. **Approve confirmation (UI-QA-06):** confirm step, undo window, or accepted risk.
2. **Restricted-cause wording (UI-QA-03):** one generic label for several causes, or accept that "Head-office check required" is a tell. Also decide the open question 7 on showing engine reason text to tellers.
3. **Auto-refresh control (UI-QA-05):** add Pause and Refresh now, and a session-expiry warning with draft preservation.
4. **Dialog rule (UI-QA-01):** initial focus (reason field vs Cancel) and whether "Send to head office" is a dialog.
5. **Stamp and French (UI-QA-07):** keep the rotated stamp if it cannot fit French, or use an in-flow stamp or drop the rotation.
6. **fr-CA for REL-1 and decimal comma** (decision 4 in the design), including mobile keypad behaviour.
7. **Time display:** 12 or 24 hour, and which zone (branch or viewer) with the zone shown.
8. **Late threshold** (still `[TBD-Stakeholder]`).
9. **Supported browsers and AT** for the matrix, including whether Safari and Windows High Contrast are in scope for REL-1.
10. **Test tooling approval:** add Playwright and axe to `apps/web` and a CI gate (sr-dev work, not mine).
