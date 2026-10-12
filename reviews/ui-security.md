# Security review: ExchangeFlow UI design v1

**Reviewer:** security-reviewer agent. **Saved by:** main session (the agent has no write tool). **Date:** 2026-10-01.
**Scope:** `docs/ui-design/ui-design.md`, `tokens.css`, `screens.html`, checked against `exchangeflow/apps/web/src` and `exchangeflow/apps/api/src`, plus `packages/app-services/src/services.ts` (`getRequest`, `complete`). Static reading only; nothing was run and no browser measurements were taken.
**Overall:** the design intent is sound (it bans restricted words and raw codes, and says to self-host fonts in production), but it does not close several leaks, and the current code ships them. UI-SEC-01 and UI-SEC-02 are server-side, so a UI-only fix will not close them.

*Point-in-time snapshot: do not edit after consolidation.*

## Findings

### UI-SEC-01 (High): compliance-related routing cause is returned by the API and rendered raw
- **Evidence:** `RequestDetail.tsx:88` renders `Routing cause: <code>{x.cause}</code>`; `ReviewQueue.tsx:9` maps `GUARDRAIL` to "Guardrail"; `services.ts:getRequest` returns `cause: generic(d.fallbackCause)` to every reviewer, manager, approver and compliance user.
- **Gap:** design §7.9 maps `GUARDRAIL` to "Head-office check required", but only in the UI. The JSON still carries the cause and is visible in the browser network tab. §7.9 says "shown to teller and reviewer", yet the code gives tellers no cause at all.
- **Fix:** map on the server so the API emits only a neutral enum (`HEAD_OFFICE_CHECK`); state that tellers see no cause; add an API contract test that no response contains `GUARDRAIL`, `COMPLIANCE_*`, `sanction`, `PEP`, `FINTRAC` or `screening`.

### UI-SEC-02 (High): the "How the engine decided" disclosure risks showing shadow results before the reviewer decides
- **Evidence:** design §7 puts shadow results and the cause inside that disclosure for reviewers; `services.ts` hides shadow results until the reviewer has decided that cycle (FR-21, SEC-09), but `RequestDetail.tsx:89` renders whatever the API supplies.
- **Fix:** state that the disclosure shows shadow results only after the decision and is absent from the DOM before then (not collapsed or greyed, which leaks that shadow data exists, UI-SEC-04). The API gate stays the only authority.

### UI-SEC-03 (High): the completion mismatch message is a tipping-off tell
- **Evidence:** `RequestDetail.tsx:125` says "Compliance has been flagged"; the design rewrite says "so head office has been told". `services.ts` currently only records the mismatch in the audit detail, so the claim is also inaccurate.
- **Fix:** neutral message: "Completed. Executed values were recorded." Do not claim any downstream action. Show a plain "values differ" notice only if the product owner decides tellers must see it.

### UI-SEC-04 (Medium): hidden actions, different states and timing can tip off
- **Gaps:** the design does not say restricted-cause items must be indistinguishable in queue position, age meter and notification wording; a different `allowedActions` set, a different message by role, or a facet or count on "Head-office check required" would be visible differences.
- **Fix:** restricted items use the same status, wording, notification text and allowed actions as ordinary human-review items; no filter or count on the neutral label; no separate cause column in the teller view; any latency padding is a server decision.

### UI-SEC-05 (Medium): audit hashes and sequence numbers shown to every user
- **Evidence:** `RequestDetail.tsx:102` shows `audit #{seq}` and a 12-character hash; `EnginePanel.tsx:24` shows the policy hash. The sequence number reveals how many audit events exist, including hidden ones.
- **Fix:** show hash and seq only to compliance and manager roles and drop them from the API response for others; renumber per request in the UI; filter restricted events from `audit.forTarget` for non-compliance actors.

### UI-SEC-06 (High): Google Fonts is a live third-party request
- **Evidence:** `screens.html:10` and `tokens.css:3` have an active `@import` of `fonts.googleapis.com`; the checklist offers "add the font link (or self-host)".
- **Risk:** every page load tells Google the user's IP, user agent and the internal URL as referrer; it needs CSP exceptions and fails on locked-down branch networks.
- **Fix:** remove the import; self-host woff2 under `public/fonts` with `@font-face` and `font-display: swap` (all three families are OFL); CSP `font-src 'self'; style-src 'self'; default-src 'self'`; keep system fallbacks; treat the reference page as dev-only or give it local font files.

### UI-SEC-07 (Medium): CSP compatibility is unspecified and the reference page breaks a strict policy
- **Evidence:** the API sets no security headers (no helmet); `screens.html` uses an inline `<style>` and `style=` attributes; Vite dev injects inline scripts. The production Vite build is CSP-friendly.
- **Fix:** `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`, plus `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, HSTS, `Permissions-Policy`. No inline `style=` in components (stamp rotation and meter widths via classes or CSSOM). Serve `screens.html` only from disk, never from the API origin. Add a CSP-violation check to the end-to-end run.

### UI-SEC-08 (Medium): clickjacking protection absent
- **Fix:** send `frame-ancestors 'none'` and `X-Frame-Options: DENY` from the server (a meta CSP cannot set `frame-ancestors`). The pause, cancel and complete dialogs are one-click state changes.

### UI-SEC-09 (Medium): rendering of notes, reasons and member references (XSS)
- **Evidence:** React escapes all user text; no `dangerouslySetInnerHTML` or `innerHTML` found. Risks come from the design: ICU catalogue interpolation (French readiness), rich text or markdown for notes, `title` attributes.
- **Fix:** user text is rendered as text only, never through catalogue HTML tags; ESLint rule banning `dangerouslySetInnerHTML`; server-side length and character limits on note and reason (the 200-character limit is client-only); render with `white-space: pre-wrap`.

### UI-SEC-10 (Medium): CSRF and session handling in the SPA
- **Evidence:** double-submit token and origin check exist, but the origin check allows any `localhost:port` origin and a missing Origin, in every environment; the CSRF cookie is JS-readable, not session-bound and has no `__Host-` prefix; no `Secure` flag; fixed 8-hour `maxAge` with no idle timeout although the design shows a "signed out for inactivity" message; no session rotation on login.
- **Fix (production):** `Secure`, `__Host-` names, `SameSite=Strict` for the session, CSRF bound to the session, no localhost allowance, require Origin or Sec-Fetch-Site on state changes, server-side idle timeout, clear the CSRF cookie on 401.

### UI-SEC-11 (Medium): dev sign-in picker in production builds
- **Evidence:** `Login.tsx` always ships the picker and "Local development sign-in" text; the API refuses `/dev/users` in prod, but `EF_ENV` defaults to `dev`.
- **Fix:** default `EF_ENV` to `prod` (fail closed) and refuse unknown values; gate the picker and the "Try a scenario" panel with `import.meta.env.DEV` so they tree-shake out; CI check that the production bundle contains neither `dev/users` nor the picker copy; production login redirects to the identity provider.

### UI-SEC-12 (Low): browser storage and autocomplete for member references
- **Evidence:** `autoComplete="off"` is set on the amount and reference but not the note; no `localStorage` use (good). The design adds "Your entries are still here" draft persistence.
- **Fix:** keep drafts server-side only (the DRAFT status exists); `autocomplete="off"`, `autocapitalize="off"`, `spellcheck="false"` on reference and note; `Cache-Control: no-store` on `/api/*`; no request ID or member reference in URL queries or page titles.

### UI-SEC-13 (Low): copy about what not to enter can leak, and can mislead
- **Evidence:** "No names, ID numbers or account numbers" and "Do not include personal details" are only enforced for the reference; the free-text note is the most likely place for a teller to write a suspicion, visible to the submitter and branch.
- **Fix:** server-side pattern check on the note (card-like and SIN-like sequences) and a line such as "Do not record concerns about the member here. Use your normal escalation route." Wording needs legal review; `[TBD-Stakeholder]`.

## Decisions the product owner must make

1. Confirm the server returns only a neutral routing label for restricted causes (no raw enum) and tellers see no cause at all (UI-SEC-01).
2. Confirm reviewers see shadow results only after deciding, and the disclosure is omitted before then (UI-SEC-02).
3. Decide who may see audit hashes and sequence numbers (recommended: compliance and manager only) and whether restricted audit events are filtered for other roles (UI-SEC-05).
4. Decide the completion-mismatch wording and whether tellers are told about a mismatch at all (UI-SEC-03). Recommended: a neutral message with no claim of flagging.
5. Decide whether restricted items need uniform response timing and uniform allowed actions, accepting a performance cost (UI-SEC-04).
6. Approve the free-text note policy: keep, restrict or drop, with legal wording (UI-SEC-13).
7. Approve self-hosted fonts only (no Google Fonts anywhere, including the reference page) and the strict CSP and header set (UI-SEC-06, -07, -08).
8. Approve fail-closed `EF_ENV`, build-time removal of the dev picker, and production cookie hardening with an idle timeout (UI-SEC-10, -11). Idle-timeout duration is `[TBD-Stakeholder]`.
9. Decide whether the static reference page may appear in any deployed artifact (recommended: no).
