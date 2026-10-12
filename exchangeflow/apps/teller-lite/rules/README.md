# Branch rules file (head office)

`branch-rules.json` holds the preset rules the branch desk checks every request against. Head office owns this file; branches never edit it. The server reads it on every check and recompiles it when its content changes. A file that fails the checks stops all checks: the page says the rules are unavailable rather than guessing.

**The current values are interim**, set by the product owner on 2026-10-12 and marked `TO-BE-CHANGED` until head office supplies its rules (ADR-029, DL-N49). They are not regulatory thresholds. Compliance must review the real values (DL-N10) before `status` is set to `APPROVED`. Who may edit and approve this file is open (DL-N42).

Keys starting with `#` are notes for people (JSON has no comments); the server ignores them.

| Field | Meaning |
|---|---|
| `ruleSetId`, `version` | Printed on every record. Change `version` on every edit, for example `2026-10-12.3`. Keep a copy of every published file: a printed record can only be re-checked against the file that produced it |
| `status` | `TRIAL` or `APPROVED`. Printed on the record as data ("status trial"); the page shows no warning banner (product-owner direction, 2026-10-12). Under ADR-029, tellers may act on TRIAL results |
| `approvedBy`, `approvedOn` | Who approved the values and when (YYYY-MM-DD). Required when `status` is `APPROVED` |
| `confirmationEmail` | Where tellers email the PDF record. One plain address |
| `branches` | Branches that may use the desk: id, name, IANA time zone written exactly (for example `America/Toronto`) |
| `currencies` | Currencies offered on the form, each listed once |
| `supportedPairs` | Pairs the branch may do, as `SELL/BUY`, at least one |
| `paymentMethods` | Offered payment methods: `CASH`, `ACCOUNT`, `OTHER`. Others cannot be chosen |
| `branchLimit` | One value per currency in `currencies`, in the currency **the member gives**. At or below: "Within branch limits". Above: "Cannot be done at the branch" (the teller may escalate by email) |
| `businessHoursOnly` | When `true`, a request outside Monday to Friday 09:00 to 17:00 branch time, or on a date in `holidays`, needs head-office review |
| `holidays` | Branch-local dates (YYYY-MM-DD). Used only when `businessHoursOnly` is `true` |

Amounts are decimal strings (`"1500.00"`), never bare numbers.

## How a request is decided

The engine applies these in order: the first that applies wins.

1. Outside hours or on a holiday (when `businessHoursOnly`): **Head-office review needed**.
2. A pair not in `supportedPairs`, or an amount above `branchLimit`: **Cannot be done at the branch**.
3. Otherwise: **Within branch limits**.

Interim values: a member selling USD for CAD up to 2,000.00 USD; a member selling CAD for USD up to 1,500.00 CAD.

The server compiles this file into an engine policy (`src/server/rules.ts`) and evaluates it with the same engine as the main ExchangeFlow build.
