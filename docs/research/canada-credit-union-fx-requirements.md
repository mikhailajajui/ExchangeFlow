# Canadian requirements for a credit union offering foreign exchange — research for ExchangeFlow

> **Not legal advice; confirm with compliance.** This is a product-planning input. It has not been reviewed by counsel or by the credit union's compliance officer. It does not change the PRD or the design.

| | |
|---|---|
| **Status** | Draft v0.1, research only |
| **Access date** | 2026-10-01 for every source cited |
| **Method** | Five parallel research passes (FINTRAC program and KYC; FINTRAC reports and sanctions; federal vs provincial; privacy and residency; automation and tipping-off). Most government pages were read through a **summarising fetch tool**, not raw text, and several regulator sites returned 403 or 404. |
| **Organization assumption (added 2026-10-01)** | A public web search identifies Alterna Savings as an Ontario credit union that is a member of FSRA, which makes it provincially regulated (secondary source; compliance to confirm). Ontario-specific research (the Credit Unions and Caisses Populaires Act, 2020 text, FSRA guidance on outsourcing and operational risk, FSRA deposit insurance) has **not** been done yet and is listed as a gap. Quebec items stay conditional on DL-N24. Alterna Savings is named here only as a working assumption, not as a recorded fact in the product documents. |
| **Reviews** | `reviews/regulatory-architect.md`, `-qa.md`, `-security.md`, `-manager.md`, `-ba.md` |
| **Related** | `PRD.md` (NFR-10, NFR-07, NFR-08), `policy-engine-design.md` §4.3 (guardrail row 9), §6.1, `reviews/ba-review.md` §4 |

### Status after review (2026-10-01)

- This document is a **research snapshot**. The decision-log questions it proposed as DL-N09 to DL-N27 were rewritten by the ba review as atomic, owned, defaulted questions with different numbers. **The final questions are in `reviews/ba-review.md` §4.** Mapping, research numbering to final numbering:

| Research ID (in the table below) | Final ID | | Research ID | Final ID |
|---|---|---|---|---|
| DL-N26 (province) | DL-N09 | | DL-N15 (refer, STR) | DL-N17 |
| DL-N19 (officer, program) | DL-N10 | | DL-N27 (restricted field access) | DL-N18 |
| DL-N10 (ticket record) | DL-N11 | | DL-N16 (screening) | DL-N19 |
| DL-N09 (3,000 trigger, aggregation) | DL-N13 | | DL-N12 (PEP approver) | DL-N20 |
| DL-N14 (who files) | DL-N15 | | DL-N11 (third party) | DL-N21 |
| DL-N13 (entity) | DL-N22 | | DL-N17 (directives) | DL-N23 |
| DL-N20, DL-N21 (retention) | BQ-7 (amended) | | DL-N22 (Quebec, region, outside Canada) | DL-N24, DL-N25 |
| DL-N23 (privacy officer, breach) | DL-N26 | | DL-N24 (automated decision) | DL-N27 |

  Research DL-N18 (member risk rating) folds into final DL-N12; research DL-N19 (program documentation), the fixed vs rolling 24-hour window, the stricter tipping-off rule and the outsourcing notification were dropped as stakeholder questions (covered by DL-N10 and DL-N18, or left to counsel and the research gaps).
  Not in the table above, new in the log: DL-N12 (guardrail may read compliance facts), DL-N14 (non-CAD conversion), DL-N16 (payment method as a request field), DL-N28 to DL-N30 (core engine).
- The **three-tier certainty rule** from the ba review applies: Tier 1 is text counsel or compliance has re-checked against the primary source; Tier 2 is text read on a government page through the summarising tool; Tier 3 is anything from a secondary source, the agent's background knowledge, or "Not found". Everything marked **Confirmed (primary)** in this document is at most Tier 2 until counsel marks it. No requirement cites a claim below Tier 2.
- **Basis column, to be read into the impact table:** rows 1 to 3, 6, 7 and 13 rest on published FINTRAC duties (Tier 2); rows 4, 5, 8 to 12 and 14 to 20 mix duties with **design choices** (human review defaults, restricted channel, reason-text rules), which are recommended defaults labelled as such, not legal requirements.
- Corrections from the reviews: row 7 says "above" where the source says "or more" (read the EFT threshold as 10,000 or more); headline 4 should read "every decline must be *able* to route to a suspicion check", not "must route".
- **Compatible with ADR-025 and ADR-026:** guardrail over all outcomes, restricted channel in REL-1.

### How to read the certainty flags

| Flag | Meaning |
|---|---|
| **Confirmed (primary)** | Stated on a FINTRAC, Justice Laws, OPC or regulator page that was fetched (through the summarising tool). Still re-check exact wording before it enters a spec. |
| **Verify** | From a law-firm, vendor or other secondary source, from the research agent's background knowledge, or a section number the tool produced that was not checked against the consolidated text. |
| **Province-specific** | Depends on where the credit union is incorporated. |
| **Not found** | The research did not locate a source. Treated as a question, never as "no rule". |

No thresholds below are invented. Values are those FINTRAC or the statute publishes, as read on 2026-10-01.

### Headline findings

1. **The credit union's province, and whether it is federal, is the first unknown.** Most credit unions are provincial. PCMLTFA/FINTRAC duties apply to them as "financial entities" regardless; prudential, conduct, outsourcing and privacy rules differ by province. The regulator profile should be configuration, not a constant.
2. **FX at or above a published threshold triggers identity verification and a richer transaction ticket.** A ticket is needed for *every* FX transaction.
3. **Reports have different triggers and deadlines.** Large cash, EFT, suspicious-transaction and listed-person reports each need an integration or a staff procedure. ExchangeFlow does not move money, so some triggers fire in the downstream system, not here. Which system owns each report is an open question.
4. **Declines are reportable events in their own right.** FINTRAC's STR guidance includes *attempted* transactions. Every decline, including an auto-decline, needs a route to a suspicion check by a person.
5. **Some outcomes must stay with a human.** STR judgement, listed-person matches, and senior-management approval of PEP/HIO relationships cannot be automated away.
6. **No statutory data-localization rule was found** for private-sector financial data, but Quebec requires a privacy impact assessment before data leaves Quebec, and Alberta requires notice when a provider outside Canada is used (both **verify**).
7. **Tipping-off.** The offence is narrower than "never mention anything" (it concerns disclosing an STR with intent to prejudice an investigation), but the design should still keep STR existence out of every reason text and out of the staff UI where practical.
8. **Recent and pending change.** Amendments reported as in force from 2026-03-26 raise penalties and add a "very serious violation" for an ineffective program (law-firm sources, **verify**). A federal privacy bill (Bill C-36) was tabled 2026-06-15 and is not law.

---

## 1. PCMLTFA / FINTRAC obligations

Credit unions are reporting entities under PCMLTFA s.5(b) and are "financial entities" in the Regulations. No FINTRAC page found treats credit unions differently from banks apart from the "affiliate or member" identification method.

### 1.1 Compliance program

| Item | Requirement | Source | Flag |
|---|---|---|---|
| Elements | Compliance officer; written policies and procedures, approved by a senior officer; documented risk assessment; written ongoing training program and plan; documented plan for an effectiveness review | [FINTRAC compliance program](https://fintrac-canafe.canada.ca/guidance-directives/compliance-conformite/Guide4/4-eng) (modified 2024-10-11) | Confirmed (primary) |
| Effectiveness review | At least every two years, by an internal or external auditor (or the entity if it has none); findings to a senior officer within 30 days | same | Confirmed (primary); 30-day detail **verify** |
| Penalties and standard | Program must be "reasonably designed, risk-based and effective"; failing is reported as a "very serious violation"; maximum penalties raised; compliance agreements mandatory; reported in force 2026-03-26 | [DLA Piper 2026-04](https://www.dlapiper.com/en-us/insights/publications/2026/04/canada-implements-amendments-to-the-pcmltfa), [Blakes](https://www.blakes.com/insights/strong-borders-act-a-landmark-shift-in-canada-s-aml-penalties/) | **Verify** (secondary) |
| Enrolment with FINTRAC | In-force date reported as "to be fixed by order"; not confirmed | DLA Piper, same | **Verify** |

### 1.2 Identification, know-your-client and the FX ticket

| Item | Requirement | Source | Flag |
|---|---|---|---|
| FX identification trigger | Verify the identity of every person who requests a foreign currency exchange of **CAD 3,000 or more** when the transaction takes place | [FINTRAC: when to verify identity, financial entities](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/client/fin-eng) | Confirmed (primary); regulation section (s.86(1)(b)) **verify** |
| FX transaction ticket | One for every FX transaction, any amount. At 3,000 or more it also holds requester name, address, date of birth and occupation. Always holds currencies and amounts, payment method, exchange rate and its source, accounts and reference numbers | [FINTRAC record keeping, financial entities](https://fintrac-canafe.canada.ca/guidance-directives/recordkeeping-document/record/fin-eng) | Confirmed (primary); section (s.12(l)) **verify** |
| Other ID triggers | Account opening; large cash and large virtual currency 10,000 or more (24-hour rule); international EFT 1,000 or more; suspicious transactions at any amount | same, FINTRAC client guidance | Confirmed (primary) |
| ID methods | Government photo ID, credit file, dual-process, affiliate/member (credit-union specific), reliance | [Methods to verify identity](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/Guide11/11-eng) | Confirmed (primary) |
| Business relationship | Starts at account opening, or at a second ID-triggering transaction within 5 years (so two non-account FX transactions of 3,000 or more in 5 years) | [Business relationship requirements](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/brr-eng) | Confirmed (primary) |
| Ongoing monitoring | Frequency risk-based, not prescribed; monitoring records kept 5 years | FINTRAC guidance (BRR) | Confirmed (primary) |
| Not found | Whether several FX requests are aggregated toward the 3,000 threshold; how non-CAD amounts convert for the threshold; content and retention of identity-verification records; entity identification triggers for one-off FX | | Not found |

### 1.3 Third party, PEP/HIO and beneficial ownership

| Item | Requirement | Source | Flag |
|---|---|---|---|
| Third-party determination | At account opening and for large cash and virtual currency at 10,000 or more. FX alone does not appear in the trigger list (the tool's reading, not a quoted sentence) | [TPDR](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/tpdr-eng) | **Verify** |
| PEP/HIO | Determinations for account relationships, EFTs of 100,000 or more, and periodic review. A member of senior management with decision authority must review and approve. Source of funds and source of wealth measures required. Foreign PEPs always high-risk; domestic PEPs and HIOs per risk assessment; status lasts 5 years after leaving office | [FINTRAC PEP/HIO](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/pep/pep-eng) | Confirmed (primary, via summary); exact timing **verify** |
| Beneficial ownership | Threshold 25 percent or more; discrepancies with Corporations Canada reported within 30 days | [Beneficial ownership](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/bor-eng) | Confirmed (primary) |
| Not found | PEP record retention; PEP determination timeline | | Not found |

### 1.4 Record keeping

| Item | Requirement | Source | Flag |
|---|---|---|---|
| Retention | At least **5 years**, counted from record creation or account closure depending on the record | [FINTRAC record keeping](https://fintrac-canafe.canada.ca/guidance-directives/recordkeeping-document/record/fin-eng) | Confirmed (primary); s.144(1) **verify** |
| Production | Records producible to FINTRAC within 30 days | same | Confirmed (primary); s.152 **verify** |
| Provincial record rules | Retention periods in provincial credit union acts | | Not found; **Province-specific** |

### 1.5 Reports, triggers and deadlines

| Report | Trigger (as published) | Deadline | Applies to credit union FX? | Source | Flag |
|---|---|---|---|---|---|
| **Large Cash Transaction Report (LCTR)** | Receipt of CAD 10,000 or more in cash. Foreign banknotes count, converted at the Bank of Canada rate at transaction time. **24-hour rule:** transactions by or for the same person, third party or beneficiary aggregate | 15 calendar days | Yes, when FX is paid in cash | [LCTR guidance](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/lctr-doie/lctr-doie-eng) | Confirmed (primary); fixed vs rolling 24-hour window **verify** |
| **Electronic Funds Transfer Report (EFTR, international)** | CAD 10,000 or more initiated or finally received, 24-hour aggregation. Excludes direct deposits, pre-authorized debits, cheque imaging, beneficiary cash withdrawals, inter-institutional settlement | 5 working days | Yes, if the FX completes as an international EFT | [EFT guidance](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/eft-dt/eft-dt-eng) | Confirmed (primary) |
| **Suspicious Transaction Report (STR)** | No dollar threshold. Reasonable grounds to suspect, including **attempted** transactions | "As soon as practicable" | Yes, including declined requests | [STR guidance](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/str-dod/str-dod-eng) | Confirmed (primary) |
| **Large Virtual Currency Transaction Report** | CAD 10,000 or more in virtual currency | 5 working days | Likely out of scope for a fiat FX product | [LVCTR guidance](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/lvctr/lvctr-eng) | Confirmed (primary); scope is an inference |
| **Listed Person or Entity Property Report (LPEPR)**, formerly Terrorist Property Report | Property of a listed person or entity. Criminal Code trigger is "know"; UN Act, SEMA and JVCFOA triggers are "reason to believe". Control test reaches direct or indirect ownership or control, including 50 percent or more. Renamed 2025-03-02; SEMA and JVCFOA listings from 2025-10-01. Since 2025-10-01 an LPEPR trigger plus reasonable grounds to suspect means both an LPEPR and an STR | "Immediately" to FINTRAC, plus disclosure without delay to the RCMP Commissioner or CSIS Director (Criminal Code s.83.1) | Yes | [Listed person guidance](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/Guide5/5-eng), [Criminal Code s.83.1](https://laws-lois.justice.gc.ca/eng/C-46/section-83.1.html), [McCarthy](https://www.mccarthy.ca/en/insights/blogs/terms-trade/canadas-new-sanctioned-property-reporting-regime-now-force) | Confirmed (primary) for Criminal Code and FINTRAC pages; SEMA disclosure duty **verify** (secondary) |
| **Ministerial directives (PCMLTFA s.11.42)** | DPRK (2017) and Iran (2020): high-risk treatment, identity verification, due diligence on source of funds, records. Russia: sources conflict on whether a formal directive exists | n/a | Yes, as a risk rule for country-linked transactions | [FINTRAC notice 2025-03-21](https://fintrac-canafe.canada.ca/notices-avis/avs/2025-03-21-eng) | **Verify** country list and measures; the directives page returned 404 |
| Submission channels | FINTRAC Web Reporting System (low volume); API (system to system). Paper and fax are fallbacks | n/a | n/a | [Methods to report](https://fintrac-canafe.canada.ca/reporting-declaration/electron-eng) | Confirmed (primary); LPEPR electronic filing **verify** |

### 1.6 Sanctions screening

| Item | Finding | Flag |
|---|---|---|
| Legal sources | Special Economic Measures Act (SEMA), Justice for Victims of Corrupt Foreign Officials Act (JVCFOA), Criminal Code listed entities (s.83.08, s.83.1), United Nations Act regulations | Statutes named; **primary texts for SEMA, JVCFOA, UN regulations and s.83.08 were not fetched** |
| What the entity must do | Not freeze or deal with listed property; report to FINTRAC and disclose to RCMP or CSIS (see LPEPR above) | Confirmed for the report (primary); freezing and disclosure duties **verify** |
| Screening frequency and list sources | Not found. Which lists to screen against and how often is a compliance decision | Not found |
| Evasion indicators | FINTRAC publishes a sanctions-evasion reporting page | [FINTRAC sanctions page](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/sanctions/sanctions-eng); not read in full |

### 1.7 Tipping-off (reports)

[PCMLTFA s.8](https://laws-lois.justice.gc.ca/eng/acts/p-24.501/section-8.html) (current to 2026-09-21, last amended 2026-03-26): the offence is disclosing that an STR was or will be made, or its contents, **with intent to prejudice a criminal investigation**. Penalty sections were not retrieved. Whether s.8 also covers LPEPR disclosures was not established. FINTRAC's STR guidance tells entities not to request unusual information that would tip off the client, and has no wording on declining or exiting a client.

---

## 2. Federal vs provincial

| Topic | Finding | Source | Flag |
|---|---|---|---|
| Who regulates the credit union | Provincial credit unions sit under provincial acts. The Bank Act applies only to "federal credit unions" (cooperative banks) | [Bank Act](https://laws-lois.justice.gc.ca/eng/acts/B-1.01/FullText.html); [FCAC regulated entities](https://www.canada.ca/en/financial-consumer-agency/services/industry/regulated-entities.html) | Confirmed (primary) |
| Provincial regimes | Ontario: Credit Unions and Caisses Populaires Act, 2020, FSRA. BC: Credit Union Incorporation Act and Financial Institutions Act, BCFSA. Saskatchewan: Credit Union Act, 1998, FCAA. Alberta: Credit Union Act, CUDGC. Quebec: Act respecting financial services cooperatives, AMF. Nova Scotia and PEI: own Credit Union Acts. Manitoba, New Brunswick, Newfoundland and Labrador: act names not verified | [BCFSA](https://www.bcfsa.ca/about-us/legislation), [FCAA](https://fcaa.gov.sk.ca/regulated-businesses-persons/businesses/credit-unions-saskcentral), [CUDGC](https://cudgc.ab.ca/our-role/), [PEI Act](https://www.princeedwardisland.ca/sites/default/files/legislation/C-29-1-Credit%20Unions%20Act.pdf), [NS Act](https://nslegislature.ca/sites/default/files/legc/statutes/credit%20union.pdf) | **Province-specific**; act text for ON and BC not read |
| FX as an activity | No provincial rule found that restricts FX, and no explicit grant either. Federal credit unions may offer "any financial service" (Bank Act s.409). Ontario allows other business with FSRA CEO approval (law-firm summary) | [FSRA guidance](https://www.fsrao.ca/industry/credit-unions-and-caisses-populaires/regulatory-framework/guidance-credit-unions-and-caisses-populaires/approval-or-authorization-business-and-investment-activities-under-credit-unions-and-caisses-populaires-act-2020) (not read, 403) | **Verify**: check the act text before the PRD states FX powers |
| MSB registration | Nothing found saying a credit union must also register as a money services business | | Inference only; confirm with counsel |
| Deposit insurers | By province (e.g., CUDGC Alberta, provincial corporations elsewhere); Manitoba insurer name conflicted between sources; Alberta guarantees 100 percent of deposits. Federal credit unions: CDIC to 100,000 | [CCUA](https://ccua.com/about-credit-unions/provincial-deposit-insurance/), [FCAC deposit insurance](https://www.canada.ca/en/financial-consumer-agency/services/banking/deposit-insurance.html) | **Province-specific**; limits not captured for most provinces |
| Outsourcing and cloud guidance | Guidance, not statute. Ontario: FSRA operational-risk and resilience guidance (reported effective 2024-03-01, secondary). BC: 2021 Outsourcing and Information Security Guidelines; initial report of material incidents within 72 hours; no data-location rule. Quebec: AMF third-party risk guideline replacing the 2009 outsourcing guideline (October 2025 draft; March 2026 PDF unreadable, final status unconfirmed); draft calls for a register of third-party arrangements including service locations. Alberta: no outsourcing text found | [BLG on BCFSA](https://www.blg.com/en/insights/2022/01/bcfsa-finalizes-information-security-and-outsourcing-guidelines), [AMF PDF](https://lautorite.qc.ca/fileadmin/lautorite/reglementation/lignes-directrices-toutes-institutions/Third-party-Risk-Management-Guideline.pdf), [Norton Rose](https://www.nortonrosefulbright.com/en/knowledge/publications/4df18e23/amf-publishes-draft-third-party-risk-management-guideline-for-consultation) | **Verify**; **Province-specific**; nothing found for SK, MB, Atlantic |
| Consumer overlay | FCAC supervises banks and federal credit unions only. Provincial credit union members complain to the provincial regulator; OBSI covers federal banks and some credit unions voluntarily. Quebec's complaints body was not researched | [FCAC notice](https://www.canada.ca/en/financial-consumer-agency/news/2023/10/designation-dun-organisme-externe-de-traitement-des-plaintes-unique-pour-le-secteur-bancaire-au-canada.html) | **Province-specific**; partly Not found |
| Payments | Provincial credit unions became eligible for Payments Canada membership (royal assent 2024-06-20). The Retail Payment Activities Act excludes provincial credit unions. ExchangeFlow does not move money, so these matter only indirectly | [Payments Canada](https://www.payments.ca/credit-unions-and-changes-canadian-payments-act), [DLA Piper](https://www.dlapiper.com/en-us/insights/publications/2025/01/breaking-down-exceptions-and-exclusions-in-the-retail-payment-activities-act) | Secondary; **verify** |
| If federally regulated | OSFI regime replaces the provincial one: FCAC consumer rules, CDIC cover, OSFI Guideline B-10 (third-party risk, effective 2024-05-01), OSFI E-21, and E-23 model risk from 2027-05-01. **FINTRAC obligations are the same either way** | [OSFI E-23](https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/guideline-e-23-model-risk-management-2027), [Blakes on B-10](https://www.blakes.com/insights/osfi-s-new-guideline-b-10-third-party-risk-managem/) | Confirmed (OSFI page, via summary); B-10 date secondary |

**Consequence for ExchangeFlow:** keep a `regulatoryProfile` (province, federal/provincial, regulator, deposit insurer, privacy regime) as configuration data. Do not hard-code Ontario or Quebec assumptions.

---

## 3. Privacy and data residency

| Topic | Finding | Source | Flag |
|---|---|---|---|
| Which law applies | Credit unions are provincially regulated, not federal works. In Quebec, Alberta and BC the provincial private-sector law covers in-province member data, and PIPEDA still reaches interprovincial and international flows. Regime for credit unions in other provinces not confirmed (probably PIPEDA) | [OPC, provincial laws that may apply instead of PIPEDA](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/prov-pipeda/) | Confirmed (primary) for AB, BC, QC; **verify** others |
| Residency or localization | No statutory data-localization rule found for private-sector financial data in PIPEDA, Alberta PIPA, BC PIPA or the Quebec Act. Controls are accountability, contract and transparency | OPC, [Alberta PIPA](https://qp.alberta.ca/1266.cfm?display=html&leg_type=Acts&page=P06P5.cfm) | **Verify** (primary text partly unreadable) |
| Alberta | Notice to individuals when a service provider outside Canada is used (PIPA s.13.1) | [OIPC AB](https://oipc.ab.ca/pipa-amendments-2/) | **Province-specific**, **verify** |
| Quebec | Privacy impact assessment and a written agreement before communicating personal information outside Quebec (s.17). Hosting in Canada Central (Toronto area) would be "outside Quebec" for Quebec members; Canada East (Quebec City) would not. This is an inference | [LegisQuébec P-39.1](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1) (403, not read); [Watchdog Security](https://watchdogsecurity.io/law25/cross-border-transfers) | **Province-specific**, **verify** (secondary) |
| Breach reporting | PIPEDA: report on real risk of significant harm; keep breach records 24 months. Alberta: report to the Commissioner without delay. Quebec: incident register and reporting (details unverified). BC: no mandatory private-sector breach notification found | [OPC breach guidance](https://www.priv.gc.ca/en/privacy-topics/privacy-breaches/respond-to-a-privacy-breach-at-your-business/gd_pb_201810/) | Confirmed (primary) for PIPEDA; others **verify** |
| Retention and anonymization | Quebec s.23: destroy or anonymize once the purpose is achieved; anonymized means irreversible; de-identified data is still personal information. For test data this favours fully synthetic data over masked copies (matches NFR-08) | [Osler](https://www.osler.com/en/insights/updates/quebec-anonymization-requirements-lessons-lingering-questions/), [Dentons](https://www.dentonsdata.com/quebec-privacy-regulator-appears-to-prohibit-anonymization/) | **Verify** (secondary) |
| Pending federal law | Bill C-36 (Protecting Privacy and Consumer Data Act) tabled 2026-06-15 would replace PIPEDA Part 1; not law as of the research date | [Parliament](https://www.parl.ca/DocumentViewer/en/45-1/bill/C-36/first-reading), [OPC statement](https://www.priv.gc.ca/en/opc-news/speeches-and-statements/2026/s-d_260615/) | Confirmed bill exists; status secondary |
| Microsoft data location | No OPC, CAI or OIPC guidance specific to Azure found; Microsoft's Canada data-location terms not checked | | **Verify** |

---

## 4. Rules that restrict automation

| Topic | Finding | Source | Flag |
|---|---|---|---|
| STR assessment | Reasonable grounds to suspect, and the entity must be able to articulate the reasoning. This is a human judgement; the rules engine can raise indicators but not conclude | [STR guidance](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/str-dod/str-dod-eng) | Confirmed (primary) for the test; "human only" is a design inference |
| Listed-person match | A match must be reported and disclosed; no automated outcome should dispose of a potential match | Criminal Code s.83.1, FINTRAC LPEPR page | Design inference; disposition rules **Not found** |
| PEP/HIO | Senior management with decision authority reviews and approves | [FINTRAC PEP/HIO](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/pep/pep-eng) | Confirmed (primary, via summary) |
| Ministerial directive countries | High-risk treatment, identity verification, due diligence | FINTRAC notices | **Verify** |
| Quebec automated decisions | Section 12.1: notify when a decision is based exclusively on automated processing; on request give the personal information used and principal factors, and a chance to submit observations to a person able to review. No AML carve-out found | secondary only ([Augure](https://augureai.ca/blog/law-25-ai-compliance-guide-quebec)); LegisQuébec 403, CAI 404 | **Province-specific**, **verify** |
| PIPEDA, AB, BC | No automated-decision provision found | | **Verify** |
| Federal AI law | AIDA died with Bill C-27 (January 2025). Bill C-36 would add explanation and human-review rights for decisions with "legal or similarly significant effect"; not law | [Gowling](https://gowlingwlg.com/en/insights-resources/articles/2026/understanding-bill-c36), [Canadian Privacy Law Blog](https://blog.privacylawyer.ca/2026/06/canadas-proposed-new-privacy-law-bill-c.html) | Secondary |
| Model-risk guidance | OSFI E-23 (effective 2027-05-01) covers federally regulated institutions only; includes AI/ML; stresses explainability and governance. Not applicable to provincial credit unions per the fetched summary. Provincial regulator expectations on model or AI risk not found | [OSFI E-23](https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/guideline-e-23-model-risk-management-2027) | Confirmed (primary, via summary); provincial **Not found** |
| De-risking and consumer-law reasons for refusal | Not researched with primary sources | | Not found |

ExchangeFlow's own design already helps: automated outcomes are limited to rule-matched, compliance-guardrailed cases, and everything else goes to a person. The open question is whether an auto-decline counts as "exclusively automated" for Quebec s.12.1, and what the member must be told.

---

## 5. Tipping-off and decline reasons

- **Law.** PCMLTFA s.8 targets disclosure of an STR (or its contents) with intent to prejudice a criminal investigation (Confirmed, primary). FINTRAC says not to ask unusual questions that would tip off the client (Confirmed, primary).
- **Decline reasons.** No source found requiring or forbidding specific reason wording for FX declines. The following are **design recommendations**, not legal requirements:
  1. Reason text shown to staff and members stays generic and drawn from the approved set (already required by SEC-16 and design §4.1).
  2. Never mention an STR, a suspicion, a FINTRAC report, a sanctions or listed-person match, or a PEP determination in `reasonText`, in the staff UI, in notifications or in telemetry.
  3. Keep a **restricted internal** reason field, visible only to compliance, for AML-driven routing.
  4. Do not display numeric limits (already in design) and do not reveal which risk indicator fired.
  5. Every decline, including an auto-decline, must be able to route to a compliance suspicion check, because attempted transactions are reportable. Escalation by staff to a reviewer (the existing flow) must not be the only route.

---

## 6. Impact on ExchangeFlow

Legend: **F** request fields; **G** guardrail or human-review rule; **R** reporting trigger and integration; **RET** NFR-10 retention; **A** audit; **T** reason-text limits; **Q** new `[TBD-Stakeholder]` question. Proposed question IDs continue the log in `reviews/ba-review.md` §4 after DL-N08.

| # | Requirement | F | G | R | RET | A | T | Q |
|---|---|---|---|---|---|---|---|---|
| 1 | FX identity verification at CAD 3,000 or more | Identity-verified flag, method, verifier, date; reference to the ID record held in the core system, not copies | Guardrail: no auto-approve unless identity verification is recorded for requests at or above the threshold; threshold is a compliance parameter, not a rule literal | None directly | ≥ 5 years for the ticket (see 2) | Record who verified and when | n/a | DL-N09: Where is ID verification performed and recorded (core system or ExchangeFlow)? Is the 3,000 threshold applied per request or aggregated? |
| 2 | FX transaction ticket for every FX transaction | Currencies and amounts, payment method, rate and rate source, accounts, reference numbers, requester name, address, DOB, occupation (at or above threshold). Confirm which of these ExchangeFlow stores versus the core system | None | None | ≥ 5 years; clock start differs per record type | Completion record links to the ticket reference (existing `Completed` reconciliation, design §3.2) | n/a | DL-N10: Which system is the system of record for the FX ticket? Does ExchangeFlow hold only a reference? |
| 3 | Third-party determination | Third-party flag (and details if yes) for cash at or above 10,000 | Human review if third party indicated and not documented | None directly | ≥ 5 years | Record determination | n/a | DL-N11: Is third-party determination collected for FX requests, and by whom? |
| 4 | PEP/HIO determination and senior-management approval | PEP/HIO flag, status, source of funds/wealth reference | **Always human review** for PEP/HIO; approval by a named senior-management role (not the submitter, per SoD) | None directly | PEP record retention **not found** → counsel | Record approver, date, basis | Never state PEP status in reason text | DL-N12: Who is the senior-management approver role? How does ExchangeFlow learn PEP status (core system, screening vendor)? |
| 5 | Beneficial ownership (entities) | Entity flag; reference to the BO record | Human review for entity requests until BO is recorded | None | ≥ 5 years | Record | n/a | DL-N13: Are entity (non-individual) FX requests in scope for REL-1 to REL-3? |
| 6 | Large Cash Transaction Report (10,000 or more cash, 24-hour rule) | Payment method (cash or not), currency of cash, member/third-party/beneficiary identifiers for aggregation | Guardrail: cash at or above a compliance-set trigger goes to human review; ExchangeFlow velocity facts (FR-19, E15) could support 24-hour aggregation but need a pseudonymous key from the same person | Report filed by the system or process that receives the cash (likely core system); due in 15 calendar days. ExchangeFlow needs only a flag and reference unless it becomes the filing system | ≥ 5 years for report copies and records | Record that an LCTR was triggered, by reference | n/a | DL-N14: Who files LCTRs and EFTRs today? Does ExchangeFlow need to compute 24-hour aggregation or only flag? Fixed or rolling 24-hour window? |
| 7 | International EFT report (10,000 or more) | Whether the FX completes via international EFT; originator and beneficiary details as needed by the filing system | Guardrail: international EFT above threshold needs human review of completeness | EFTR via FINTRAC Web Reporting or API, 5 working days; integration owned by the filing system | ≥ 5 years | Reference only | n/a | See DL-N14 |
| 8 | Suspicious Transaction Report, including attempted (declined) | Free-text indicators entered only by staff in a restricted compliance field; no STR flag in general queues | Every decline path, auto or reviewer, offers a "refer to compliance" action. Auto-approve guardrail: no automated outcome when a compliance hold is set. STR judgement never automated | STR filed by compliance through FINTRAC channels, "as soon as practicable"; an ExchangeFlow integration is optional (decision) | ≥ 5 years; STR copies per compliance | Restricted audit visibility for referral events; audit rows hold IDs and hashes, no suspicion text | Reason text never mentions STR or suspicion | DL-N15: How are suspicions raised and who files? Should ExchangeFlow offer a "refer to compliance" action visible only to the submitter and compliance? |
| 9 | Listed person or entity (sanctions) screening and LPEPR | Counterparty and member name fields sufficient for screening, supplied to the screening process | **Always human review (or hard hold)** on any potential match; auto-approve guardrail requires a "screening clear" fact from the screening source | LPEPR to FINTRAC "immediately"; disclosure to RCMP/CSIS without delay; owned by compliance. Screening integration (vendor or list service) is a decision | ≥ 5 years; confirm | Record screening result reference and time, not match details in general audit | Never say "sanctions" or "listed" in reason text | DL-N16: Which lists are screened, by which system, and at what points? Does ExchangeFlow call the screening service or receive its result? |
| 10 | Ministerial directive countries (DPRK, Iran, others) | Country of origin and destination of funds | Human review (or decline per directive) for transactions linked to directive countries; list maintained by compliance as a parameter, not hard-coded | None unless the directive requires a report type (unclear for Iran) | ≥ 5 years | Record which directive caused the routing in a restricted field | Generic text only | DL-N17: Which directives apply today, and how is the country list maintained? |
| 11 | Ongoing monitoring and business relationship | Link to member and relationship ID (pseudonymous key) | Risk rating from the core system as a guardrail input | None | Monitoring records ≥ 5 years | Record risk rating used | n/a | DL-N18: Does ExchangeFlow receive member risk rating? |
| 12 | Compliance program and "effective" standard | None | Governance already in design (two-person activation, shadow mode, replay). Add compliance sign-off on guardrail changes and an annual effectiveness review that includes the engine | None | Review reports retained ≥ 5 years (confirm) | Existing audit | n/a | DL-N19: Does the credit union's compliance program documentation need to describe the engine, and who approves it? |
| 13 | Record production to FINTRAC within 30 days | Searchable by member, date, reference | None | Export for compliance (existing FR-43/44 audit export) | Retrieval within 30 days is a design target | Audit export is itself audited (existing) | n/a | DL-N20: Retention clock start per record type (creation or closure). Provincial retention periods in the credit union act? |
| 14 | Audit retention vs PII purge | Keep PII out of audit rows (existing) | None | None | Existing NFR-10 design already separates PII from the chain; confirm period ≥ 5 years for AML records and any longer provincial or internal rule | Chain unaffected by purge | n/a | DL-N21 (extends BQ-7): Retention period for decision records, context snapshots and audit; legal hold process |
| 15 | Privacy: residency and cross-border | Province of member (if Quebec members exist) | None | None | Destruction or anonymization at end of purpose (Quebec s.23); NFR-08 synthetic-only already aligned | Log breach incidents (see 16) | n/a | DL-N22: Province of incorporation and member provinces? Any Quebec members? Does Canada Central hosting need a Quebec PIA, or should Canada East be primary? Any processing outside Canada (support access, telemetry, vendors)? |
| 16 | Privacy: breach reporting and records | None | None | Incident process, regulator notification per province | PIPEDA breach records 24 months; Quebec register period unverified | Security incident events in the security workspace | n/a | DL-N23: Who is the privacy officer, and what is the breach notification procedure? |
| 17 | Automated decision transparency (Quebec s.12.1, pending federal) | A way to tell the member that a decision used automated processing and to offer human review | Auto-decline already escalatable once; extend: human review on request without waiting for a window | None | Keep decision basis for the retention period (full input already stored) | Existing replay supports "principal factors" | Member-facing explanation must be generic and must not tip off | DL-N24: Is an auto-decline "based exclusively on automated processing" for Quebec purposes? What does the member see, and who explains it? |
| 18 | Outsourcing and cloud guidance (provincial) | None | None | Notify regulator of material outsourcing where required (varies) | Third-party register entries retained | Existing deployment and access logs | n/a | DL-N25: Which provincial regulator guidance applies, and is regulator notification of the Azure arrangement required? |
| 19 | Federal vs provincial status | Configuration profile | Regulator-specific rules as parameters | Same FINTRAC duties either way | Same | Same | n/a | DL-N26: Provincially or federally regulated, and which province? (Blocks everything marked Province-specific) |
| 20 | Tipping-off | Restricted compliance field separate from generic reason | Reason-text allow-list; lint that forbids STR, sanction, PEP, FINTRAC and suspicion terms | None | Restricted fields follow the compliance retention | Restricted audit visibility | **Hard rule:** none of the restricted topics in `reasonText`, staff screens, notifications or telemetry | DL-N27: Who may see the restricted field? Does the credit union want a stricter rule than the law's intent test? |

### Cross-cutting design implications (for the review, not applied yet)

1. **New guardrail inputs.** The guardrail policy (design §4.3 row 9) needs compliance-owned facts it can read: identity-verified, PEP/HIO flag, screening result, directive-country flag, cash flag, entity flag, compliance hold. The engine must treat a missing fact as UNKNOWN, so a missing screening result routes to a human (already how three-valued logic works).
2. **Reporting is mostly outside the engine.** ExchangeFlow decides routing and records evidence; filing LCTR, EFTR, STR and LPEPR belongs to compliance and the core system unless the sponsor decides otherwise. The product should expose the facts compliance needs (references, flags, timestamps) and an export, not file reports in REL-1.
3. **Retention.** NFR-10 can take "at least 5 years" as a published floor for AML records. Provincial and internal periods may be longer. The period for request, decision and audit data is still `[TBD-Stakeholder]`.
4. **A restricted compliance channel.** Referral, screening and directive-driven routing need a store and audit view separate from the general queue.
5. **Province as configuration.** Regulator profile, privacy regime and hosting region depend on the answer to DL-N26.

---

## 7. Open questions and gaps summary

### New stakeholder questions (proposed for `reviews/ba-review.md` §4)

DL-N09 to DL-N27 in the table above. The first to answer is **DL-N26** (province and federal or provincial status), followed by **DL-N22** (Quebec members, hosting region) and **DL-N14** (who files LCTR and EFTR).

### Research gaps to close with counsel or primary-source review

| Gap | Why it matters |
|---|---|
| Primary text for SEMA, JVCFOA, UN Act regulations, Criminal Code s.83.08 | Sanctions screening and freezing duties |
| Ontario and BC credit union act text on FX powers and record keeping | PRD must not assert FX powers unverified |
| Quebec s.12.1, s.17, s.23 primary text (LegisQuébec 403) | Automation transparency and residency |
| FINTRAC ministerial directives page (404); Russia directive status; Iran report type | Country risk rules |
| Aggregation of multiple FX requests toward the 3,000 threshold; non-CAD conversion | Request fields and velocity facts |
| Fixed vs rolling 24-hour window | Aggregation logic |
| Provincial retention periods; PEP record retention; ID-verification record contents | NFR-10 |
| Whether FINTRAC enrolment is in force; whether the 2026-03-26 penalty amendments are in force as reported | Compliance program and penalties |
| Provincial AI or model-risk expectations (FSRA, AMF, BCFSA, others) | Governance of the engine |
| Consumer-law rules on reasons for refusal; de-risking positions | Reason text |
| Outsourcing guidance for SK, MB and Atlantic provinces; Quebec AMF guideline final status | Cloud arrangement |
| Microsoft Canada data-location terms; any regulator view on Azure regions | Residency |

---

## 8. Source list (primary and regulator pages used)

All accessed 2026-10-01 through a summarising fetch tool unless noted.

- FINTRAC: [compliance program](https://fintrac-canafe.canada.ca/guidance-directives/compliance-conformite/Guide4/4-eng), [when to verify identity](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/client/fin-eng), [methods to verify identity](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/Guide11/11-eng), [business relationship](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/brr-eng), [third party](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/tpdr-eng), [PEP/HIO](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/pep/pep-eng), [beneficial ownership](https://fintrac-canafe.canada.ca/guidance-directives/client-clientele/bor-eng), [record keeping](https://fintrac-canafe.canada.ca/guidance-directives/recordkeeping-document/record/fin-eng), [LCTR](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/lctr-doie/lctr-doie-eng), [EFT](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/eft-dt/eft-dt-eng), [STR](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/str-dod/str-dod-eng), [LVCTR](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/lvctr/lvctr-eng), [listed person property](https://fintrac-canafe.canada.ca/guidance-directives/transaction-operation/Guide5/5-eng), [methods to report](https://fintrac-canafe.canada.ca/reporting-declaration/electron-eng), [notice 2025-03-21](https://fintrac-canafe.canada.ca/notices-avis/avs/2025-03-21-eng)
- Justice Laws: [PCMLTFA](https://laws-lois.justice.gc.ca/eng/acts/P-24.501/FullText.html) (incl. [s.8](https://laws-lois.justice.gc.ca/eng/acts/p-24.501/section-8.html)), [Regulations SOR/2002-184](https://laws-lois.justice.gc.ca/eng/regulations/SOR-2002-184/FullText.html), [Criminal Code s.83.1](https://laws-lois.justice.gc.ca/eng/C-46/section-83.1.html), [Bank Act](https://laws-lois.justice.gc.ca/eng/acts/B-1.01/FullText.html), [PIPEDA](https://laws-lois.justice.gc.ca/eng/acts/p-8.6/page-1.html)
- Regulators and insurers: [FCAC](https://www.canada.ca/en/financial-consumer-agency/services/industry/regulated-entities.html), [OSFI E-23](https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/guideline-e-23-model-risk-management-2027), [BCFSA](https://www.bcfsa.ca/about-us/legislation), [FCAA Saskatchewan](https://fcaa.gov.sk.ca/regulated-businesses-persons/businesses/credit-unions-saskcentral), [CUDGC Alberta](https://cudgc.ab.ca/our-role/), [AMF guideline PDF](https://lautorite.qc.ca/fileadmin/lautorite/reglementation/lignes-directrices-toutes-institutions/Third-party-Risk-Management-Guideline.pdf) (not readable), [CCUA](https://ccua.com/about-credit-unions/provincial-deposit-insurance/)
- Privacy: [OPC provincial laws](https://www.priv.gc.ca/en/privacy-topics/privacy-laws-in-canada/the-personal-information-protection-and-electronic-documents-act-pipeda/r_o_p/prov-pipeda/), [OPC breach guidance](https://www.priv.gc.ca/en/privacy-topics/privacy-breaches/respond-to-a-privacy-breach-at-your-business/gd_pb_201810/), [Alberta PIPA](https://qp.alberta.ca/1266.cfm?display=html&leg_type=Acts&page=P06P5.cfm), [OIPC Alberta](https://oipc.ab.ca/pipa-amendments-2/), [LegisQuébec P-39.1](https://www.legisquebec.gouv.qc.ca/en/document/cs/P-39.1) (403)
- Secondary sources are cited inline and flagged **verify**: law-firm bulletins (DLA Piper, Blakes, McCarthy Tétrault, Osler, Dentons, Gowling WLG, Norton Rose Fulbright, BLG, Torys) and vendor guides.

Raw per-topic research notes were written to a temporary session folder outside the repository and are not preserved. Re-run the research if the full claim-by-claim notes are needed.
