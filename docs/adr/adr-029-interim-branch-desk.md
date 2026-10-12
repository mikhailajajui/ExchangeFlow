# ADR-029: Interim branch desk, with a scoped deviation from ADR-021

- **Status:** Accepted
- **Date:** 2026-10-12
- **Sources:** product-owner direction 2026-10-12; `reviews/desk-security.md`, `desk-qa.md`, `desk-ba.md`, `desk-architect.md` (DESK-ARCH-14 drafted this record), `desk-ui.md`

## Context

While the full product is built, branches need a way to check a currency exchange against head-office rules and file a record. The product owner asked (2026-10-12) for a one-page teller form that checks a request against preset head-office rules, validates every entry, and produces a printable record the teller emails to head office for confirmation and bookkeeping.

The team review found that the desk lets rules marked `TRIAL` tell a teller to complete an exchange. ADR-021 allows placeholder (`nonProduction`) rules to automate only outside production (DESK-BA-01, DESK-QA-01, DESK-ARCH-03, DESK-UI-06).

## Decision

1. **Shape.** `exchangeflow/apps/teller-lite` is a stateless app in the workspace. It reuses `policy-core` (`evaluate`) and `workflow-core` (`RequestValuesSchema`, `buildContext`, `computeQuote`) and the uexchange rate adapter. It has no database and no sign-in. Head office edits rules in `rules/branch-rules.json`, which is compiled into a `PolicyVersion`. The output is a browser print or "Save as PDF". The teller attaches the PDF to an email to head office. The record prints the member name.
2. **Scoped deviation from ADR-021 (product owner, 2026-10-12).** On the branch desk only, a `Within branch limits` result from a `TRIAL` rules file may be acted on immediately. Every record is emailed to head office. The warning that the rules are interim lives in the rules file notes, the desk READMEs and this record, not in the user interface; the printed record carries the rule-set version and status as data only (product-owner direction, 2026-10-12). The deviation does **not** change ADR-021 for the main application, which keeps its production guard. It ends when head office supplies approved values and the file is set to `APPROVED`, or when the desk is retired, whichever comes first.
3. **Interim limits (product owner, 2026-10-12, marked TO-BE-CHANGED).** The limits are two-tier, measured in the currency the member gives:
   - a member selling USD for CAD: up to 2,000.00 USD;
   - a member selling CAD for USD: up to 1,500.00 CAD.

   At or below the limit, the result is "Within branch limits". Above it, the result is "Cannot be done at the branch", and the teller may escalate to head office by email. Head office will replace these values.
4. **No register for now (product owner, 2026-10-12).** The desk keeps no copy of records. The emailed PDF is the only record, so head office cannot detect an edited printout or repeated checks (DESK-SEC-01). This choice is revisited under DL-N45.
5. **Same computer only until DL-N46 is decided.** The server binds to loopback only and refuses any other address.
6. **Alterna logo by URL reference (product owner, 2026-10-12).** The desk shows Alterna's logo from `https://www.alterna.ca/media/t0onoi0m/alterna-savings.svg` in the header and on the record. It is not copied into the repo. This is the desk's one exception to "no third-party requests": the CSP allows `img-src` from `https://www.alterna.ca` only, with no referrer sent. If the image cannot load, the text wordmark stands alone. Brand use still needs Alterna's sign-off (DL-N37).

## Consequences

- Real exchanges may be decided by interim values. Head-office confirmation by email is the control (DL-N43 defines what confirmation means).
- Member names leave the system in PDFs and email. Retention and handling are open (DL-N44, DL-N39).
- A printed record carries `policyHash` and `contextHash`. Without an archive of rule files, a record can be replayed only while the matching rules file is kept (DESK-ARCH-02). Head office should keep every published rules file.
- Convergence with the main app is deferred. The recommended path is to move `compilePolicy` into a pure package and import any future register as a read-only table (DESK-ARCH-05, 15).
