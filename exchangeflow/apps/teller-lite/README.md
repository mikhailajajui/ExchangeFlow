# Branch desk (interim)

A one-page tool for branch tellers. The teller fills in a currency exchange request and presses **Check request**. The server validates every field with the main app's request schema and checks the request against the head-office rules file (`rules/branch-rules.json`, see `rules/README.md`). It returns a record that the teller prints or saves as a PDF and emails to head office. Decided in ADR-029.

It **does not move money and keeps nothing**: no database, no copy of the record, no sign-in. The printed or saved PDF is the only record.

## Run

```bash
pnpm install                                  # from exchangeflow/
pnpm --filter @ef/teller-lite dev             # server 127.0.0.1:3101 + page http://localhost:5174
pnpm --filter @ef/teller-lite build && pnpm --filter @ef/teller-lite start   # one process on http://127.0.0.1:3101
npx vitest run apps/teller-lite               # tests
```

Settings: `EFL_RULES_FILE` (path to the rules file), `EFL_PORT` (default 3101), `EFL_HOST` (loopback only: `127.0.0.1`, `localhost` or `::1`), `EF_RATE_URL` (must be on uexchange.ca).

## Limits of this tool (read before use)

- **Same computer only.** There is no sign-in and no encryption, so the server refuses any network address and only answers requests addressed to a loopback host name. Serving a branch network is undecided (DL-N46).
- **Staff ID is typed, not verified.** The record shows whatever ID was entered; the signature line is the identity control.
- **No register.** Head office cannot tell whether a PDF was edited or how many times a request was checked (DESK-SEC-01, DL-N45).
- **Member names leave the system** in the PDF and the email. Send only to the head-office address, over the approved mail system, and delete the downloaded PDF afterwards. Retention is open (DL-N44, DL-N39).
- **Alterna logo by URL.** The page loads Alterna's logo from alterna.ca (the only third-party request; no referrer is sent). Brand use needs Alterna's sign-off (DL-N37). Offline, the text wordmark shows instead.
- **Rates are indicative** (uexchange.ca feed, DL-N40) and never affect the result.
- **Interim rules.** The values are the product owner's interim limits, marked TO-BE-CHANGED (ADR-029). By product-owner direction (2026-10-12), this warning lives in this README, the rules file notes and ADR-029, not on the page. The record shows the rule-set version and status as data only.
