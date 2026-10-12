# ExchangeFlow UI design: the slip and the ledger

Status: design proposal v2 (2026-10-01). Designer output, not yet an ADR. v2 adopts an Alterna-aligned palette and Inter (section 3.1), on top of the review fixes (`reviews/ui-qa.md`, `ui-ba.md`, `ui-security.md`). The Alterna assumption is provisional (DL-N09) and brand use needs Alterna's sign-off (DL-N37). Companion files: `tokens.css`, `screens.html` (open from disk; it makes no external requests). Contrast ratios were computed with the WCAG 2.1 relative-luminance formula by script (section 8); they are calculated values, not browser measurements, and still need axe and manual checks.

## 1. Point of view

A teller desk runs on two pieces of paper. The member-facing **slip** is a short form, filled once, handed over and stamped. The back-office **ledger** is a ruled book where every line has a date, an amount and a state. ExchangeFlow is both: the teller fills a slip and gets it stamped by the engine, and the reviewer works a ledger of slips waiting for a decision.

So the interface has two surfaces and nothing else:

- **Ledger surface** (lists, queues, history): ruled rows, no cards, no shadows, amounts in a monospaced column on the right, a status bar on the left edge of each row.
- **Slip surface** (form, outcome receipt, request detail): a white sheet with a heavy ink outline, a ruled header strip, and for the outcome a torn edge.

**Boldness is spent in one place: the outcome docket.** After submit, the teller gets a receipt with the amount in large monospaced figures and a rubber-stamp mark (Approved, Declined, With head office) that lands once. Everything else is deliberately quiet: flat, square-cornered, one ink colour.

What this is not: no cream paper with terracotta as the page identity (the orange is a thin accent from the client's brand, not a surface), no near-black with an acid accent, no hairline broadsheet, no row of identical rounded shadowed cards, no gradient or icon-in-circle decoration.

## 2. Principles

1. **Structure encodes information.** The left bar on a row is status. The width of the meter is waiting time. A round-trip through "more information" is an indigo rule in the history. Nothing is there only to look good.
2. **Status is never colour alone.** Every status is a shape, a word and a colour (section 5.3).
3. **Money is a figure, not prose.** Monospaced, tabular, slashed zero, right-aligned, built from the decimal string (`fmtAmount` in `ui.tsx` already does this; it never parses to float).
4. **One next step per screen.** Each screen has one filled primary button. Secondary actions are outlined, tertiary are underlined links.
5. **Say what happened and what to do.** Errors name the field and the fix. Empty states offer the action.
6. **Never reveal what the teller must not know.** Reasons shown to tellers and reviewers come from the projected, general decision only (policy-engine-design.md section 6.3). A restricted cause is shown with the same neutral words as an ordinary "needs a person" cause, so it cannot be told apart (section 7.9).

## 3. Tokens (v2)

Full list in `tokens.css`. Named palette (hex values; `--accent` is gone, split into `--brand`, `--link` and `--review`):

| Token | Light | Dark | Role |
|---|---|---|---|
| `--paper` | `#F3F1F0` | `#1C1C28` | page background (Alterna warm grey; navy-dark in dark) |
| `--slip` | `#FFFFFF` | `#262638` | the sheet: forms, receipts, tables, top bar |
| `--ink` | `#2A2A3E` | `#ECEBF2` | text, headings, slip outline, table top rule (Alterna navy) |
| `--ink-muted` | `#55536A` | `#B0AFC4` | secondary text, hints |
| `--btn` / `--on-btn` | `#2A2A3E` / `#FFFFFF` | `#ECEBF2` / `#1C1C28` | primary button fill and text |
| `--brand` | `#BD5A00` | `#F7931E` | accent only: wordmark "Flow", active-nav underline. Never a status |
| `--brand-tint` | `#F2DECC` | `#3A2A1C` | nav hover only, decorative |
| `--on-brand` | `#FFFFFF` | `#1C1C28` | text on a `--brand` fill (decorative button variant only) |
| `--link` | `#2F3A8C` | `#AEB8FF` | links, quiet buttons |
| `--review` / `--review-tint` | `#2F3A8C` / `#E6E8F4` | `#AEB8FF` / `#2A2D55` | "in head-office review" mark, row bar, decision panel edge, history markers |
| `--good` / `--good-tint` | `#1B6B3D` / `#E3F1E7` | `#6FD08F` / `#17301F` | approved, completed |
| `--bad` / `--bad-tint` | `#B3261E` / `#F9E4E1` | `#FF8F85` / `#3A1B19` | declined, errors, destructive |
| `--warn` / `--warn-tint` | `#6F4A00` / `#F7EBCF` | `#E8B84A` / `#3A2D0E` | needs action (more information), test-environment strip |
| `--edge` | `#7A7470` | `#8A8AA3` | control borders, meter outline |
| `--rule` | `#D8D3CF` | `#3A3A52` | decorative hairlines only |
| `--focus` | `#2A2A3E` | `#ECEBF2` | focus ring (navy; light ink in dark) |

Design choices behind the palette:
- The primary button is **navy ink**, not orange. That frees every hue for meaning: green approved, red declined, indigo "a person at head office has it", gold-brown "someone must act". Orange is brand, so it is kept out of the status vocabulary entirely. The brand orange and the warning gold are only 1.52:1 apart (old gold `#7A5200`), so `--warn` was darkened to `#6F4A00` (1.74:1, still similar in luminance), and the two never rely on colour: warn always has the diamond shape and the words "More information needed". Rule: orange never appears next to or inside a status mark, row bar or banner.
- Indigo `#2F3A8C` replaces the old stamp violet. It is a navy-derived blue, readable beside the ink, and distinct from green and red. It doubles as the link colour; links are always underlined.
- The focus ring is solid navy 3px with a 2px offset: 11 to 14:1 on every surface in light, and light ink in dark (11 to 14:1). An extra orange outer ring was considered and rejected: `#BD5A00` is only 4.03:1 on paper, it adds nothing that navy does not already give, and it would put brand colour on an interactive-state signal.
- Dark theme (my own design, not extracted from alterna.ca, which has none): paper `#1C1C28`, slip a step lighter `#262638`, brand `#F7931E` (7.34:1 on paper, 6.46:1 on slip).

### 3.1 Type

All free, SIL OFL, self-hosted with `@fontsource` (no Google Fonts or any third-party request, in every environment; CSP `font-src 'self'`). Latin and latin-ext subsets cover French.

| Role | Family | Fallbacks | Use |
|---|---|---|---|
| UI and prose | Inter 400/500/600/700 (`@fontsource/inter`) | Segoe UI, system-ui, Arial | everything |
| Figures | IBM Plex Mono 400/500/600 (`@fontsource/ibm-plex-mono`) | ui-monospace, SF Mono, Menlo, Consolas | amounts, refs, times, codes |
| Stamp | Barlow Condensed 700 (`@fontsource/barlow-condensed`) | Arial Narrow, Helvetica Neue, Arial | outcome stamp only |

Why the stamp stays Barlow Condensed: Inter has no condensed width (Inter Tight only tightens spacing, it is not narrow), and Inter 700 in capitals at 36px does not fit "Avec le siège social" in the stamp box. Public Sans was not an alternative for this: it is not condensed either. If DL-N37 declines a third family, set the stamp in Inter 700 at 28px with the same double border and shorter words ("Head office" / "Siège social"). Heading weight is 600 (static Inter has no 650; the earlier 650 was a finding, UI-QA-20). Inter features: keep default; figures stay in Plex Mono, so Inter's tabular figures are not needed in tables. Inter is slightly wider than Public Sans: expect about 3 to 4% longer labels, so keep labels unfixed in width and re-check the top bar at 1024px.

Scale: 13 (meta, column headers) / 14 / **15 body** / 18 section / 24 page title / 32 slip amount / 36 stamp. Line height 1.5 body, 1.2 headings. Prose capped at 68 characters. Headings sentence case, weight 600, no tracking, no all-caps except the stamp.

### 3.2 Brand alignment

Follows Alterna (observed on alterna.ca, public site, not a brand guide): navy `#2A2A3E` as heading ink (Alterna's own body and label text is neutral `#3f3f3f`, 10.53:1; we use the navy for both, 14.01:1, see `alterna-ui-extraction.md` section 4); warm grey `#F3F1F0` as the page ground; burnt orange `#BD5A00` as the single accent (text wordmark second part, active-nav underline); the light orange `#F7931E` as the dark-theme accent; an Inter-style sans; flat, white surfaces.

Deliberately does not follow: (1) orange is not the primary button colour and never carries status meaning, because an operations tool needs a status vocabulary that the brand cannot collide with; (2) `#F2A930` and `#EFBD4D` (amber) are not used: amber on white is 2.00:1 and would clash with the needs-action gold; (3) `#BD5A00` is never used for text on `--paper` (4.03:1, fails) or on `--brand-tint` (3.48:1); (4) Alterna's logo is not recreated: the top bar uses a plain text wordmark "ExchangeFlow" with "Flow" in orange, which is ExchangeFlow's own mark and a placeholder until branding is decided; (5) the peach `#F2DECC` is used only as a nav hover tint; (6) the sharp 2px corners, slip/ledger structure, stamp and mono figures are ExchangeFlow's own and not from Alterna.

Caveat: the client assumption is provisional (DL-N09); the values come from the public website, not an official guide; using Alterna's colours, name or any mark in a product needs Alterna's written sign-off (DL-N37). Until then `tokens.css` is the only place the brand values live, so swapping them is a one-file change (`--brand`, `--brand-tint`, `--ink`, `--paper`).

**Spacing:** 4px base (4, 8, 12, 16, 24, 32, 48). Row height 44px.
**Radius and elevation:** 2px on controls and chips, 4px on dialogs, nothing else rounded except status marks (a circle means declined). No shadows on content. Separation is by rules: 1px `--rule` between rows, 2px `--ink` (navy) on the slip outline and the table top edge. Only dialogs get a lift shadow.
**Layout:** page max 78rem, left-aligned, not centred on wide screens for lists. Slip width 36rem. Desktop first; two-column detail collapses under 768px.

## 4. Layout concept and wireframes

App shell: a 3rem top bar on `--slip` with a 2px navy bottom edge. Left: text wordmark "Exchange" in `--ink` plus "Flow" in `--brand` (weight 700; orange text only on this white bar, 4.54:1), then nav (current page has a 3px `--brand` underline, weight 600 and `aria-current`; hover is a `--brand-tint` fill). The underline is a non-text indicator (4.03:1 or more), the weight and `aria-current` carry the meaning too. Right: notifications, name and role, sign out. Sticky: yes, top bar only. The test-environment strip sits above it and is not sticky. No sidebar; there are at most four destinations.

### 4.1 Sign-in

```
+---------------------------------------------------------+
| Test environment. Sample data only.                     |
+---------------------------------------------------------+
|                                                         |
|   ExchangeFlow                                          |
|   +---------------------------------------------+       |
|   | Sign in                                     |       |
|   | Choose a test user. In production you sign  |       |
|   | in with your credit union account.          |       |
|   |                                             |       |
|   | Amira Tran        Teller, Branch 014        |       |
|   | Jon Pelletier     Reviewer, head office     |       |
|   | ...  (ruled rows, whole row is a button)    |       |
|   +---------------------------------------------+       |
+---------------------------------------------------------+
```
Single slip, left-aligned under the name, no hero. Each user is a full-width ruled row (name left, role right) with visible focus. Production variant: one primary button "Sign in with your credit union account".

### 4.2 Teller request list (ledger)

```
[bar] ExchangeFlow  Requests  New request          Amira Tran / Teller, Branch 014  Sign out
My requests                                                           [ New request ]
5 requests today. 1 needs your attention.
[All] [Needs my action (1)] [In review (2)] [Closed]
=========================================================================================
 Status                       Ref      Member sells   Buys   Updated
|? More information needed    K7M2Q9    3,200.00 CAD   USD    9 min ago
|v Approved                   H3X8TD      500.00 CAD   USD   22 min ago
|o In head-office review      P9R4WA   20,000.00 CAD   USD    1 h ago
|x Declined by rule           B2N6LC      100.00 CAD   JPY    2 h ago
 - Draft                      D5T1ZE      250.00 EUR   CAD    3 h ago
```
Rows that need the teller sort first. Left bar and mark encode status. Whole row is a link target (the ref is the real anchor; the row also responds to click). Empty state: "No requests yet today. Start with a new request." with the primary button.

### 4.3 New-request form (slip)

```
New exchange request
Branch and time are set for you.
+==============================================================+
| Exchange slip                                  Draft, not saved |
+==============================================================+
| [error summary, only after a failed submit, links to fields]   |
| +----------------------------------------------------------+ |
| | Member sells           From        To                    | |
| |        [   500.00 ]    [CAD v]     [USD v]               | |
| +----------------------------------------------------------+ |
| Request type            [Exchange v]                          |
| Payment method          [From account v]                      |
| Member reference (optional)  [          ]  hint               |
| Note for the reviewer (optional) [      ]  hint               |
| [ Submit request ]  [ Save draft ]   Cancel                   |
+==============================================================+
```
The amount, from and to currencies sit in one tinted band at the top, because that is the transaction; everything else is secondary. Labels are above fields (French-ready, no fixed width). The dev "Try a scenario" panel moves to a collapsed `details` below the slip labelled "Test scenarios (test environment only)"; the "What happens next" list becomes one sentence under the buttons.

### 4.4 Outcome screen (the bold moment)

```
+==============================================================+
|  Request H3X8TD is approved           +--------------------+  |
|                                       |     APPROVED       |  |  <- stamp, rotated -4deg,
|                                       |      by rule       |  |     double border, lands once
|                                       +--------------------+  |
|  Member sells ........................   500.00 CAD  (32px)    |
|  Member buys .........................   USD                   |
|  Why ...  Within the automatic limit for this currency pair.   |
|  | Next step. Complete the exchange in the existing system,    |
|  | then record what you executed.                              |
|  [ Open request ]  [ New request ]                             |
 \/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/\/   <- torn edge
```
Three variants differ by stamp colour and word, the left rule of the next-step note, and the copy (section 6). The stamp animation is the one deliberate motion in the product: 280ms, scale 1.5 to 1 with fade, once, triggered by the user's own submit; removed under `prefers-reduced-motion`. The stamp has `role="img"` with an aria-label, and the heading carries the same meaning in text, so the stamp is redundant for screen readers. Focus moves to the heading on load (`tabIndex=-1`) and the heading is announced by a polite live region.

### 4.5 Request detail with history

```
< Back to my requests
Request K7M2Q9                      [ Update and resubmit ] [ Cancel request ]
? More information needed   Round 1, branch 014
| The reviewer asked: What is the member buying the currency for? ...
+-----------------------------------+  +------------------------+
| Request                           |  | History                |
| Member sells   3,200.00 CAD       |  | Oct 1, 09:42 | Submitted|
| Member buys    USD                |  |              | Amira T. |
| ...                               |  | Oct 1, 09:42 O Sent for  |
+-----------------------------------+  |              | review   |
                                       +------------------------+
```
History is a ledger-style timeline: time in mono at left, a vertical rule, a square marker for a teller action and an indigo (`--review`) round marker for a head-office or engine action (the actor is always also written out). Each cycle (round) starts with a text divider "Round 2". Audit sequence numbers and hashes move behind a "Details" disclosure for managers; tellers see actor, action and time.

### 4.6 Reviewer queue (ledger with urgency)

```
Review queue
4 waiting. Longest wait 52 min. Oldest first.
==========================================================================
 Waiting            Ref     Branch  Member sells    Why it is here
|[======] 52 min      P9R4WA  014    20,000.00 CAD  Rule needs a person   [Open]
|[===   ] 29 min      W4E8ZN  022       300.00 CAD  Wire request          [Open]
|[==    ] 15 min      Y8C2VH  014       100.00 CAD  Sent again by teller  [Open]
|[=     ]  4 min      G1F7QS  031     1,800.00 EUR  Rule needs a person   [Open]
```
Age is shown as the number of minutes and a meter on a fixed visual scale capped at 60 minutes. The meter is not a deadline and there is no "Late" marker or threshold (DL-N32; reopen when operations answer Q7/Q9). Sorted oldest first and the order never reshuffles while the reviewer is on the page (the 15 second refresh keeps the focused row in place and announces "1 new request" in a polite live region rather than moving rows). Empty state: "Nothing is waiting. New requests appear here by themselves."

### 4.7 Decision panel (reviewer, on the detail page)

```
+-------------------------------+  +-----------------------------+
| Request (amount 24px mono)    |  |#Your decision (indigo edge)|
+-------------------------------+  | You cannot decide your own..|
| > How the engine decided      |  | Reason [               ]    |
+-------------------------------+  | [Approve] [Decline] [Ask..] |
                                   +-----------------------------+
```
The panel sits in the right column and sticks under the top bar on tall pages (`position: sticky; top: 4rem`) so the decision is always reachable while reading history. Approve is the only filled green button. Decline and Ask for information stay disabled until a reason of 3 or more characters exists, with the reason stated under the buttons (not a silent disable). Replaces the three-button modal flow: the reason box is inline, so there are no dialogs for the main task. Approve takes one click with no reason. There is no undo, because decisions are recorded; the button label states the result.

### 4.8 Decision-engine panel (manager and policy approver)

```
Decision engine
Policy v3, hash a41f09, control revision 12, test environment
[Engine is live]                                  [ Pause the whole engine ]
==========================================================================
 Rule              Result         Mode      State          
|large-amount [test rule]  Needs a person  Live    v Live        [Pause]
|pair-unsupported          Declines        Live    x Paused      [Resume]
```
When paused, a full-width amber band (shape `?` diamond plus text) states "Engine paused. Every new request goes to head-office review." Pause and Resume open a dialog that requires a reason, with Cancel as the first focusable control and the destructive-style action named exactly ("Pause the whole engine", not "Confirm"). The per-request "How the engine decided" disclosure (4.7) shows result, reason, rule, policy version and time. It lists only general-part fields.

## 5. Components

### 5.1 Buttons
| Variant | Fill, text, border | Use |
|---|---|---|
| Primary | `--btn` fill, `--on-btn` text, 2px `--btn` | one per screen (Submit request, Open request) |
| Secondary | transparent, `--ink` text, 2px `--ink` | Save draft, New request |
| Quiet | transparent, `--link` text, underlined | Cancel, Sign out, Back |
| Brand (decorative, optional) | `--brand` fill, `--on-brand` text (white on `#BD5A00` 4.54:1; `#1C1C28` on `#F7931E` 7.34:1) | marketing-like moments only (for example sign-in). Never the main action and never a status |
| Approve | `--good` fill, slip-coloured text | reviewer Approve only |
| Destructive | `--bad-tint` fill, `--bad` text and border | Decline, Cancel request |
| Disabled | `--rule` fill, `--ink-muted` text, not-allowed cursor | exempt from contrast; reason always printed nearby |

Height 40px (32px small in tables), radius 2px, weight 600, sentence case, padding 0 16px. Hover: brightness +15% (secondary: `--rule` fill). Active: 1px down. Focus: 3px `--focus` (navy) outline, 2px offset, never removed. Busy: label changes to the verb in progress ("Submitting...") and the button keeps its width.

### 5.2 Forms
Labels above, 14px weight 600. Inputs `--control-height` (40px), 1px `--edge` border (3:1 or better against the slip), 2px radius, 15px text. The amount field is `--control-height-amount` (52px), 24px mono, right-aligned. Hint under the label in `--ink-muted` 13px. Error: 2px `--bad` border, `--bad-tint` fill, a round "!" mark plus the message below the field (14px, weight 500, `--bad`), linked by `aria-describedby`, `aria-invalid=true`. Validate on submit and on blur of a touched field. After a failed submit, an error summary at the top of the slip lists each error as a link to its field and takes focus. Required is the default; optional fields say "(optional)" in the label, so no `*` and no legend. No placeholder text carries instructions. Do not add `role="alert"` to each field message (one summary announces; the field message is read through `aria-describedby`).

Other controls (Pass 4, from the alterna.ca form study):
- **Radio and checkbox:** `appearance:none`, `--radio-size` (24px) box, 2px `--edge` border; radio is round with an **ink** dot when selected, checkbox is square with a check mark. Selection is shown by the dot or check shape, not by colour, and never by orange. Label to the right, 8px gap, whole row clickable. A group is a `fieldset` with a `legend` (same type as a label); options stack vertically for up to 4 choices.
- **Select:** native element, `appearance:none`, same height and border as inputs, a chevron drawn in CSS with `currentColor` (ink), no image request, 32px right padding for the chevron. The first option is a real prompt ("Choose a currency"), not blank.
- **Textarea:** minimum `--textarea-min` (96px), `resize:vertical` only, same border and text as inputs.
- **Conditional field:** a field that depends on an answer appears directly after its trigger (`display:none` when hidden, never off-screen), the trigger sets `aria-controls`, and a hidden field is not validated or submitted.
- **Autofill and input purpose:** name, email and phone fields carry `autocomplete` and the right `type`/`inputmode` (WCAG 1.3.5). Amounts use `inputmode="decimal"` and stay `type="text"` so decimal strings are never coerced.
- **Focus:** `--focus-width` (3px) `--focus` outline with `--focus-offset` (2px) on every control, including the submit button.

### 5.3 Status marks
| Status | Mark | Word (EN) | Row bar |
|---|---|---|---|
| Approved, Completed | filled square with check | Approved, Completed | `--good` |
| Declined by rule, Declined | filled circle with cross | Declined by rule, Declined | `--bad` |
| Under review | half-circle outline (an open decision) | In head-office review | `--review` (indigo) |
| More information needed | diamond outline with "?" | More information needed | `--warn` |
| Draft, Cancelled | dashed square | Draft, Cancelled | none |

Shapes differ in outline (square, circle, half-circle, diamond, dashed) so they are distinguishable in greyscale.

### 5.4 Other
- **Tag:** 1px `--edge` border, 13px text, transparent fill; for facts like "test rule", "Sent again by teller". No colour meaning.
- **Banner:** 4px left bar in the status colour plus tinted fill plus a leading word ("Heads up", "Problem", "Done"); role `status` for info, `alert` for errors.
- **Dialog:** `--slip`, 2px ink border, 4px radius, lift shadow, scrim 50% `--paper`/black; focus trapped, Escape closes, first focus on the reason field, returns focus to the trigger. Used only for pause/resume, cancel, and recording completion.
- **Table:** section 4.2. Header 13px muted with a 1px `--edge` rule beneath, 2px ink rule on top. Numeric columns right-aligned. Sortable columns, when added, use `aria-sort` and a visible arrow shape plus the word in a tooltip.
- **Nav link:** 3px bottom border `--brand` and weight 600 when current, plus `aria-current="page"`. Orange here is the one place the brand colour appears on a control, and it carries no status.
- **Language toggle (Pass 4):** in the top bar, a quiet button showing the *other* language as a full word ("Français" / "English"), always visible (no hover-only reveal), with `lang="fr"` (or `en`) on the word and an accessible name that contains the visible text. It sets the user's language; the page stays on one URL.
- **Footer (Pass 4):** one line on `--paper` under a 1px `--rule`: "Accessibility", "Privacy" (targets `[TBD-Stakeholder]`) and the app version, 13px `--ink-muted`, links underlined. No social links, no orange titles, no grey panel.
- **Notifications:** replace the bell emoji with the word "Notifications" and a count in a square badge (text and border, not colour only).

## 6. Copy (sentence case, active verbs, French-ready)

One verb per action across the whole flow:

| Action | Label | Notes |
|---|---|---|
| Create | New request | nav and button |
| Save | Save draft | |
| Send to engine | Submit request | same on form and busy state "Submitting..." |
| After info request | Update and resubmit | |
| Teller disputes auto-decline | Escalate | canonical term from FR-05, glossary and audit events (DL-N31). Engine routing to a reviewer is labelled "Sent for review" |
| Reviewer | Approve, Decline, Ask for information | |
| After approval | Record completion | |
| Stop | Cancel request | |

Outcome copy:
- Approved: heading "Request H3X8TD is approved". Why: engine reason text. Next: "Complete the exchange in the existing system, then record what you executed."
- Declined: "Request B2N6LC is declined." Next: "Tell the member. If you think this is wrong, you can escalate it once, with a reason."
- Head office: "Request P9R4WA is with head office." Next: "Nothing to do now. You will see the answer in your notifications and on this request."

Errors (what happened, how to fix):
- Amount: "Enter digits only, for example 500.00." / "The amount must be more than zero." / "Use at most 2 decimal places for CAD." / "The two currencies must be different. Change one of them."
- Stale: "Someone else changed this request while you were looking. We have loaded the latest version. Check it and try again."
- Network: "We could not reach the server. Your entries are still here. Try again in a moment."
- Sign-in expired: "You were signed out for inactivity. Sign in again to carry on."

Empty states: teller list "No requests yet today. Start with a new request."; reviewer queue "Nothing is waiting. New requests appear here by themselves."; notifications "No notifications yet. Updates on your requests will appear here."

Rules: never say suspicion, sanctions, PEP, FINTRAC or screening in the UI. Never show internal codes (`GUARDRAIL`, `COMPLIANCE_GUARDRAIL`, `ENGINE_ERROR`) to tellers or reviewers. Use the mapping in 7.9. French-readiness: all strings in a message catalogue (react-i18next or similar, `fr-CA`), no concatenated sentences with embedded numbers except via ICU placeholders, labels never fixed-width, dates and number grouping from `Intl` with the active locale (French groups with a space and uses a decimal comma only in display; the input still accepts and the API still carries the decimal point, which is a decision, see section 10).

## 7. Screen notes

### 7.9 Mapping of routing causes to words (reviewer queue, detail)
| Engine cause | Shown to teller and reviewer |
|---|---|
| RULE_REQUIRES_HUMAN | Rule needs a person |
| NO_MATCH | No rule covered this |
| MISSING_DATA | Some details are missing |
| CONFLICT | Rules disagree |
| RULE_PAUSED, ENGINE_PAUSED | Automatic decisions are paused |
| ENGINE_ERROR | The engine could not decide |
| GUARDRAIL (and any restricted detail) | Rule needs a person (identical to RULE_REQUIRES_HUMAN, so the cause is not distinguishable) |
| RESUBMISSION_FLOOR | Sent again by teller |
| Escalated auto-decline | Teller disagreed with a rule decline |

The restricted detail is never rendered, hinted at, or distinguishable by timing or layout: a restricted row shows the same neutral words and has the same shape as every other row.

### Request-detail rules
Show Round (cycle) in the status line, not "cycle 1, version 4". Version appears only in a "Details" disclosure. "Shadow results" and "Routing cause code" are removed from the teller view; reviewers see them inside "How the engine decided". The mismatch message after completion becomes "Completed. The executed values differ from the approved values, so head office has been told."

## 8. Accessibility

Targets: WCAG 2.1 AA, provisional until DL-N08 closes. Ratios below come from `contrast.py` in this folder (WCAG 2.1 relative luminance, sRGB; it reads the hex values from `tokens.css` and fails if a pair is under its threshold). They are calculated values, not browser measurements; the same pairs must be re-checked with axe-core in light and dark (UI-QA test plan).

Rules that keep failing pairs out of use:
- `--brand` (`#BD5A00`) as **text** is allowed only on `--slip` (white) in light (4.54:1). It fails on `--paper` (4.03:1) and on `--brand-tint` (3.48:1). In practice orange text appears in exactly one place: the wordmark on the white top bar. Elsewhere orange is a non-text line (nav underline, 4.03 to 4.54:1, needs 3:1).
- Brand amber `#F2A930` / `#EFBD4D` is not in the palette (2.00:1 on white).
- Orange never carries status, so its closeness to the old gold (1.52:1) and to the new `--warn` (1.74:1) cannot cause a wrong reading; `--warn` always has the diamond shape and words.
- `--rule` is decorative (1.32:1 light, 1.53:1 dark) and is never the only boundary of an interactive control; controls use `--edge`.
- Muted text `--ink-muted` is the lowest-contrast text and is allowed on `--paper`, `--slip` and the tints (6.08 and above).
- Disabled buttons are exempt (WCAG 1.4.3) and always have a printed reason.

**Text (need 4.5)**

| Foreground | Background | Light | Dark | Verdict |
|---|---|---|---|---|
| `--ink` #2A2A3E / #ECEBF2 | `--paper` #F3F1F0 / #1C1C28 | 12.44 | 14.23 | pass |
| `--ink` #2A2A3E / #ECEBF2 | `--slip` #FFFFFF / #262638 | 14.01 | 12.52 | pass |
| `--ink-muted` #55536A / #B0AFC4 | `--paper` #F3F1F0 / #1C1C28 | 6.59 | 7.84 | pass |
| `--ink-muted` #55536A / #B0AFC4 | `--slip` #FFFFFF / #262638 | 7.42 | 6.90 | pass |
| `--ink-muted` #55536A / #B0AFC4 | `--bad-tint` #F9E4E1 / #3A1B19 | 6.08 | 7.24 | pass |
| `--ink-muted` #55536A / #B0AFC4 | `--warn-tint` #F7EBCF / #3A2D0E | 6.26 | 6.26 | pass |
| `--ink` #2A2A3E / #ECEBF2 | `--review-tint` #E6E8F4 / #2A2D55 | 11.48 | 11.05 | pass |
| `--ink` #2A2A3E / #ECEBF2 | `--brand-tint` #F2DECC / #3A2A1C | 10.74 | 11.61 | pass |
| `--on-btn` #FFFFFF / #1C1C28 | `--btn` #2A2A3E / #ECEBF2 | 14.01 | 14.23 | pass |
| `--on-brand` #FFFFFF / #1C1C28 | `--brand` #BD5A00 / #F7931E | 4.54 | 7.34 | pass |
| `--link` #2F3A8C / #AEB8FF | `--paper` #F3F1F0 / #1C1C28 | 8.86 | 8.91 | pass |
| `--link` #2F3A8C / #AEB8FF | `--slip` #FFFFFF / #262638 | 9.98 | 7.83 | pass |
| `--review` #2F3A8C / #AEB8FF | `--slip` #FFFFFF / #262638 | 9.98 | 7.83 | pass |
| `--review` #2F3A8C / #AEB8FF | `--review-tint` #E6E8F4 / #2A2D55 | 8.18 | 6.92 | pass |
| `--good` #1B6B3D / #6FD08F | `--paper` #F3F1F0 / #1C1C28 | 5.80 | 8.90 | pass |
| `--good` #1B6B3D / #6FD08F | `--slip` #FFFFFF / #262638 | 6.53 | 7.83 | pass |
| `--good` #1B6B3D / #6FD08F | `--good-tint` #E3F1E7 / #17301F | 5.60 | 7.50 | pass |
| `--bad` #B3261E / #FF8F85 | `--paper` #F3F1F0 / #1C1C28 | 5.81 | 7.64 | pass |
| `--bad` #B3261E / #FF8F85 | `--slip` #FFFFFF / #262638 | 6.54 | 6.72 | pass |
| `--bad` #B3261E / #FF8F85 | `--bad-tint` #F9E4E1 / #3A1B19 | 5.36 | 7.05 | pass |
| `--warn` #6F4A00 / #E8B84A | `--paper` #F3F1F0 / #1C1C28 | 7.02 | 9.14 | pass |
| `--warn` #6F4A00 / #E8B84A | `--slip` #FFFFFF / #262638 | 7.91 | 8.04 | pass |
| `--warn` #6F4A00 / #E8B84A | `--warn-tint` #F7EBCF / #3A2D0E | 6.68 | 7.29 | pass |
| `--slip` #FFFFFF / #262638 | `--good` #1B6B3D / #6FD08F | 6.53 | 7.83 | pass |
| `--slip` #FFFFFF / #262638 | `--bad` #B3261E / #FF8F85 | 6.54 | 6.72 | pass |
| `--slip` #FFFFFF / #262638 | `--review` #2F3A8C / #AEB8FF | 9.98 | 7.83 | pass |
| `--brand` #BD5A00 / #F7931E | `--slip` #FFFFFF / #262638 | 4.54 | 6.46 | pass |
| `--brand` #BD5A00 / #F7931E | `--paper` #F3F1F0 / #1C1C28 | 4.03 | 7.34 | light FAILS |
| `--brand` #BD5A00 / #F7931E | `--brand-tint` #F2DECC / #3A2A1C | 3.48 | 5.99 | light FAILS |

**Non-text (need 3.0)**

| Foreground | Background | Light | Dark | Verdict |
|---|---|---|---|---|
| `--edge` #7A7470 / #8A8AA3 | `--paper` #F3F1F0 / #1C1C28 | 4.09 | 5.01 | pass |
| `--edge` #7A7470 / #8A8AA3 | `--slip` #FFFFFF / #262638 | 4.61 | 4.41 | pass |
| `--edge` #7A7470 / #8A8AA3 | `--bad-tint` #F9E4E1 / #3A1B19 | 3.77 | 4.62 | pass |
| `--focus` #2A2A3E / #ECEBF2 | `--paper` #F3F1F0 / #1C1C28 | 12.44 | 14.23 | pass |
| `--focus` #2A2A3E / #ECEBF2 | `--slip` #FFFFFF / #262638 | 14.01 | 12.52 | pass |
| `--focus` #2A2A3E / #ECEBF2 | `--good-tint` #E3F1E7 / #17301F | 12.01 | 11.99 | pass |
| `--focus` #2A2A3E / #ECEBF2 | `--bad-tint` #F9E4E1 / #3A1B19 | 11.48 | 13.13 | pass |
| `--focus` #2A2A3E / #ECEBF2 | `--warn-tint` #F7EBCF / #3A2D0E | 11.83 | 11.36 | pass |
| `--focus` #2A2A3E / #ECEBF2 | `--review-tint` #E6E8F4 / #2A2D55 | 11.48 | 11.05 | pass |
| `--focus` #2A2A3E / #ECEBF2 | `--brand-tint` #F2DECC / #3A2A1C | 10.74 | 11.61 | pass |
| `--brand` #BD5A00 / #F7931E | `--paper` #F3F1F0 / #1C1C28 | 4.03 | 7.34 | pass |
| `--brand` #BD5A00 / #F7931E | `--slip` #FFFFFF / #262638 | 4.54 | 6.46 | pass |
| `--good` #1B6B3D / #6FD08F | `--paper` #F3F1F0 / #1C1C28 | 5.80 | 8.90 | pass |
| `--bad` #B3261E / #FF8F85 | `--paper` #F3F1F0 / #1C1C28 | 5.81 | 7.64 | pass |
| `--review` #2F3A8C / #AEB8FF | `--paper` #F3F1F0 / #1C1C28 | 8.86 | 8.91 | pass |
| `--warn` #6F4A00 / #E8B84A | `--paper` #F3F1F0 / #1C1C28 | 7.02 | 9.14 | pass |

**Result: no pair is below its threshold except the two flagged `--brand` text rows in light (orange on paper, orange on peach), which are banned by the rules above.** The pair `--brand` on `--paper` passes the 3:1 non-text threshold (4.03) and is used only for the nav underline. Alterna observed values for reference: white on `#BD5A00` 4.54; `#2A2A3E` on `#F3F1F0` 12.44; `#2A2A3E` on white 14.01; `#F7931E` on `#1C1C28` 7.34. All match the table.

Not computed: `--rule`-based borders (decorative); the stamp double border (decorative, the words carry the meaning); gradient edge of the torn receipt. Hover states (`filter: brightness(1.15)` on the navy button) darken or lighten the fill by about 15% and still exceed 12:1 against white text in light; re-check the dark hover (`#ECEBF2` brightened) with axe.

Keyboard and screen readers:
- Visible 3px focus ring on every interactive element, `:focus-visible`, never `outline: none`.
- Skip link "Skip to main content" first in tab order; one `h1` per page; `main`, `nav aria-label="Main"`.
- Tables use `th scope`, `caption` (visually hidden). Clickable rows contain a real link; the row click is a convenience, not the only route.
- Errors: summary takes focus and is announced; field errors via `aria-describedby`. Live regions: outcome heading on load, queue changes ("1 new request"), toast results ("Approved.").
- Target size at least 40px high (44px table rows).
- Status never by colour alone (5.3); age never by colour alone (meter plus minutes).
- Reduced motion: stamp animation off; no other motion exists. No auto-scrolling, no auto-refresh that moves focus.
- Zoom to 200% and a 1024px window work; below 768px the two-column layouts stack, the ledger tables scroll horizontally inside their own region with a visible focusable wrapper (`tabindex=0`, `role=region`, label), and the slip goes full width. Tellers use desktop, so no phone-specific layout.
- Forced colours: borders and marks use real borders and text, so status shapes survive; set `forced-color-adjust: auto` and do not rely on background tints.

## 9. Pass 2: critique and revisions

I wrote a first pass, then tested it against the brief. What read as a generic default and what I changed:

1. **First draft: green primary button, red and amber chips, rounded cards.** That is the stock SaaS dashboard, and the green collided with the "approved" green. Changed: ink-coloured primary, status hues reserved for meaning, squared 2px corners, rules instead of card shadows. Cards no longer exist; there are slips (white sheet, 2px outline) and ledgers (ruled tables).
2. **First draft: outcome as a coloured banner with a check icon in a circle.** Generic. Changed: the receipt docket with torn edge, large mono amount, rubber-stamp mark. This is the single bold place; everything else stayed plain.
3. **First draft: cream paper with a serif display face and a rust accent** (the obvious "paper form" answer). Rejected as the cliche the brief names. Changed to a plain ledger paper and a plain grotesque (Public Sans in v1, Inter in v2); the character comes from the mono figures and the stamp, not from a serif.
4. **First draft: uppercase tracked labels over every section ("REQUEST", "HISTORY").** Removed. Hierarchy comes from size and weight. The only uppercase is the stamp, which is what a stamp is.
5. **First draft: numbered steps in a "What happens next" list.** That is not a real sequence the teller walks through. Replaced with one sentence under the buttons. The only number left in the UI is the round count, which is a real cycle.
6. **First draft: timeline of identical dots.** Dots told nothing. Changed: square markers for teller actions, round indigo markers for head-office and engine actions, a "Round n" divider at each cycle; actor is also written.
7. **First draft: urgency as a red badge.** Colour only. Changed: proportional meter plus minutes plus a "Late" word plus a heavier left bar. (v2: the "Late" word, threshold and heavier bar were removed under DL-N32; age in minutes and a capped fixed-scale meter remain.)
8. **First draft: Approve, Decline, Ask for information in a dialog.** Extra clicks for the most repeated reviewer task. Changed: inline reason field, buttons enabled by the reason, one dialog less.
9. **First draft: motion on row hover and page transitions.** Removed; only the stamp moves.
10. **Copy:** "Escalate" and "Escalated to head office" varied by screen. v1 unified to "Send to head office"; v2 reverts to the canonical **Escalate** (UI-BA-01, DL-N31) and labels engine routing "Sent for review". Removed internal cause codes and "Guardrail" from user view; "Compliance has been flagged" (a tell) reworded.

Remaining risks: the stamp may feel playful for a bank (mitigation: it is restrained in size, one colour, and the words are plain; the product owner can disable it by removing one class). Mono amounts in lists are less common in finance UIs; they are chosen because tabular alignment is the job. Condensed stamp font is the third family; if the owner wants two families, set the stamp in Inter 700 uppercase at 28px with the same border (section 3.1).

### Pass 3: Alterna-aligned palette and Inter (v2)

Decided by the product owner; I applied it and tested it against contrast, not taste.
1. **Ink and paper.** Navy `#2A2A3E` and warm grey `#F3F1F0` replace the green-grey ink and paper. Contrast went up (ink on paper 12.44 vs 13.44 before, still far above 4.5).
2. **Violet removed.** The stamp violet `#4A3AA0` is gone. "In head-office review", links, history markers and the decision panel use indigo `#2F3A8C`; focus uses navy.
3. **Orange as accent only.** The measured pairs forced three rules: no orange text on paper (4.03), no amber (2.00), no orange beside status (1.52 to the old gold). I darkened `--warn` to `#6F4A00` anyway so the gap grows to 1.74, and kept the diamond and the words.
4. **Focus.** I tested a navy plus orange double ring. Orange adds no contrast over navy, so it was not used.
5. **Fonts.** Public Sans to Inter, self-hosted. Barlow Condensed stays for the stamp (Inter has no condensed width), with a documented fallback.
6. **Review fixes applied in v2 text:** no "Late" marker (DL-N32), Escalate as the term (DL-N31), restricted cause shown with neutral words, no Google Fonts anywhere, `data-theme` override fixed (light block in `:root, :root[data-theme="light"]`, dark media block under `:root:not([data-theme="light"])`, forced-dark block complete with `--shadow-lift`), heading weight 600. Items not touched in this pass remain as listed in `reviews/ui-qa.md`.
7. **Remaining risk.** Navy-on-warm-grey with a small orange accent is close to Alterna's own site; if Alterna does not sign off, change `--brand`, `--brand-tint` and optionally `--ink` and `--paper` in `tokens.css`. No component references a hex value.

### Pass 4: alterna.ca contact-form study (v2.1, 2026-10-02)

Evidence: `alterna-ui-extraction.md` (live HTML and CSS of `/en/about-us/contact-us/email-us`, nothing verified visually). Nothing in the palette changed; contrast.py still reports 0 unexpected failures.
1. **Body ink wording (3.2).** Alterna's labels and body are `#3f3f3f` and only headings are `#2a2a3e` (`form label.umbraco-forms-label`, `.widget-title`). Our single navy ink is an adaptation (14.01:1 vs 10.53:1), not a copy. Text corrected.
2. **Form controls (5.2, tokens).** The spec said nothing about radio, checkbox, select, textarea or conditional fields. Alterna gives a 25px radio, a 50px select with a CSS-drawn chevron, a 168px textarea and radio-driven show/hide. Adapted: 24px radio with an ink dot, ink chevron via `currentColor`, 96px textarea, `fieldset`/`legend` groups, conditional reveal rules. New tokens `--control-height`, `--control-height-amount`, `--radio-size`, `--textarea-min`, `--focus-width`, `--focus-offset` (sizes only).
3. **Focus kept, and why.** Alterna's focus is inconsistent: a 3px black outline on `.btn-*`, nothing on inputs, and on the form submit Bootstrap's `rgba(0,123,255,.25)` glow (1.39:1, fails WCAG 1.4.11). Ours (3px navy, 2px offset, everywhere) stays. The 3px width matches theirs.
4. **Errors kept, tightened.** Alterna's error is 16px `#d64033` text only (4.53 on white, 3.71 on a tint), no icon, no border change, `role="alert"` on every field, no `aria-describedby`, no summary. Our "!" mark, border, tint, `aria-describedby` and summary stay; per-field `role="alert"` is now explicitly forbidden.
5. **Required markers.** Alterna stars required fields (the star is unstyled, not hidden from screen readers, and has no key). Ours stays "(optional)" on the exceptions.
6. **Rejected on purpose.** Orange pill primary button (orange is accent-only; 4.54:1 is a 0.04 margin), 5px radius, 50px controls, 900px-wide fields, 30px label padding, reCAPTCHA and honeypot (third party / not needed behind sign-in), card shadows, page spinner and smooth scroll, 62.5% root, generic "Submit".
7. **Language toggle and footer (5.4).** Alterna's toggle shows "FR" and reveals "Français" only on hover, with an English `aria-label` that omits the visible text. Ours: always-visible word, `lang` on it, name contains text. Footer: only the legal strip is taken, without orange.
8. **Open.** French form wording and spacing were not studied (FR page out of scope); whether Alterna's controls render in Inter is inferred only.

## 10. Hand-off checklist (sr-dev), mapped to `exchangeflow/apps/web/src`

Do not change behaviour or API calls; this is presentation and copy. All colour, font and radius values come from `tokens.css`; no hex values in components.

**Tokens and fonts (this revision)**
- [ ] `package.json` (apps/web): add `@fontsource/inter`, `@fontsource/ibm-plex-mono`, `@fontsource/barlow-condensed` (all OFL). Remove any Google Fonts `<link>` or `@import`.
- [ ] `main.tsx`: import the font weights listed at the top of `tokens.css` (Inter 400/500/600/700, Plex Mono 400/500/600, Barlow Condensed 700), then `./tokens.css`, then `./styles.css`.
- [ ] `src/tokens.css`: copy of `docs/ui-design/tokens.css`. Renamed or new tokens: `--accent` removed; new `--brand`, `--brand-tint`, `--on-brand`, `--link`, `--review` (was the violet use); `--paper`, `--slip`, `--rule`, `--edge`, `--ink`, `--ink-muted`, `--btn`, `--on-btn`, `--good`, `--bad`, `--warn`, tints and `--focus` have new values. `--font-ui` is now Inter.
- [ ] `index.html`: no font link; `<html lang="en">`, a `lang` update hook for French; `<meta name="color-scheme" content="light dark">`; the CSP from `reviews/ui-security.md` (`font-src 'self'`, `style-src 'self'`).
- [ ] `styles.css`: replace every hard-coded colour, radius and shadow with tokens (`--brand` and `--accent` old references map as: links and quiet buttons to `--link`; stamp violet, "in review" row bar and mark, decision panel edge, history markers to `--review`; nav current underline to `--brand`; focus outline to `--focus`, 3px, 2px offset). Heading weight 600, not 650. The `.late` bar and any "Late" styling are removed. Add the `.btn.brand` decorative variant only if wanted.
- [ ] `App.tsx`: wordmark `Exchange<span class="wordmark-flow">Flow</span>` (orange only on the white top bar, never on `--paper`); drop the emoji brand glyph; skip link; sticky bar with `scroll-padding-top`; nav hover `--brand-tint`.
- [ ] `ui.tsx`: `TONE` gains `review` (indigo); `StatusMark` colours from `--good`, `--bad`, `--warn`, `--review` only; no component may use `--brand` for a status. `ACTION_LABEL`: the teller action stays **Escalate**; engine routing label "Sent for review".
- [ ] `pages/ReviewQueue.tsx`: age in minutes with the fixed-scale meter capped at 60 min; no "Late" word, bar or threshold; `CAUSE` map per 7.9 with GUARDRAIL shown as "Rule needs a person".
- [ ] Tests: unit test over `tokens.css` asserting every pair in section 8 (thresholds 4.5 and 3.0, light and dark) with the two banned orange pairs asserted as absent from component CSS; axe-core in light and dark via `colorScheme` emulation; a CSP-violation check that no font request leaves the origin.

**Form controls and shell (Pass 4, v2.1; sizes only, no colour change)**. Another change may be editing `apps/web` at the same time, so each item says what to look for; do not assume the file state.
- [ ] `src/tokens.css`: re-copy `docs/ui-design/tokens.css` (v2.1). Only additions: `--control-height`, `--control-height-amount`, `--radio-size`, `--textarea-min`, `--focus-width`, `--focus-offset`. No existing token changed value; no component CSS needs rework for the palette.
- [ ] `src/styles.css`: replace the hard-coded control height, amount height and focus width/offset with the new tokens; add `input[type=radio], input[type=checkbox]` custom boxes (`--radio-size`, `--edge` border, ink dot or check mark, `:focus-visible` ring), the `select` chevron (CSS gradient with `currentColor`, `appearance:none`), `textarea{min-height:var(--textarea-min);resize:vertical}`, and `.field-error` (no `role="alert"`).
- [ ] `src/ui.tsx`: `Field` renders `fieldset` + `legend` for radio/checkbox groups; error text linked with `aria-describedby`; no `role="alert"` on individual field messages (only the `ErrorSummary`). Name, email, phone fields get `autocomplete` and `type`/`inputmode` (amount: `inputmode="decimal"`, `type="text"`). Optional `ConditionalField` (hidden = `hidden` attribute, trigger has `aria-controls`).
- [ ] `src/App.tsx`: language toggle in the top bar (a button showing the other language as a word, `lang` on it, accessible name contains the visible text); a one-line footer (Accessibility, Privacy, version; link targets `[TBD-Stakeholder]`). Skip link visible on `:focus` at all widths.
- [ ] `src/pages/RequestForm.tsx`: use the new `Field` variants; keep "Submit request" as the verb; no captcha, no honeypot.
- [ ] Tests: `contrast.py` unchanged; add axe checks for radio group labelling and `aria-describedby` on error; check that the language toggle's accessible name includes its visible text.

**Carried over from v1 (unchanged)**
- [ ] `ui.tsx`: `Money` component (`<span className="money">`, `fmtAmount`, decimal strings only). `Field` gets `htmlFor`, `aria-describedby`, `aria-invalid`. `Banner` gets the leading word and `alert` role for errors. `Modal` gets focus trap and focus return. Add `ErrorSummary`.
- [ ] `pages/Login.tsx`: ruled-row user list (4.1); production button copy.
- [ ] `pages/Requests.tsx`: ledger table with `StatusMark`, filters as `aria-pressed` buttons, empty state copy, needs-action rows first.
- [ ] `pages/RequestForm.tsx`: amount/from/to band, error summary, inline messages per section 6, `Outcome` becomes the docket (stamp, large amount, next-step note; focus the heading; animation class only on first render). Move `SCENARIOS` into a test-only `details`; replace the numbered list with one sentence. Declined copy: "escalate it once, with a reason" only when the server says the request is escalatable (UI-BA-14).
- [ ] `pages/RequestDetail.tsx`: slip layout, timeline per 4.5, `audit #`, hash and version in a "Details" disclosure, inline decision panel (4.7), apply 7.9 mapping, hide routing cause code and shadow results for non-reviewer roles, reword the mismatch message.
- [ ] `pages/EnginePanel.tsx`: result and state with marks, paused band, dialog button names, "test rule" tag wording.
- [ ] `pages/Inbox.tsx`: text plus square count badge; keyboard-operable disclosure.
- [ ] i18n: strings to a catalogue; `Intl` for dates and numbers.
- [ ] Tests: keyboard path for submit, banned-words test, reduced-motion check.

## 11. Decisions needed from the product owner

1. Approve the stamp as the single bold element, or ask for the plainer variant.
2. Late threshold for the queue: not shown in v2 (DL-N32). Reopen when operations answer Q7/Q9.
3. Wording: v2 keeps "Escalate" (DL-N31) and shows restricted causes with neutral words (DL-N34).
4. French: is `fr-CA` required for REL-1, and should decimal input accept a comma (the API stays decimal point)?
5. Brand: v2 uses Alterna-observed colours as a provisional palette. Needs Alterna sign-off (DL-N37) and confirmation that the client is Alterna (DL-N09). Status hues stay whatever the brand is. Open: is a text wordmark acceptable, or will an official logo be supplied?
6. Third font family for the stamp (Barlow Condensed), or Inter only with a shorter stamp (section 3.1).
7. Whether tellers may see the engine's plain reason text (as in the outcome screen) for every outcome, or only for declines.
8. Footer and language toggle (Pass 4): which pages do "Accessibility" and "Privacy" link to, and is the language chosen per user or per session? Both are `[TBD-Stakeholder]`.
