# Exchange Operations Application Proposal

## Proposal Summary

This proposal introduces an application that decides, routes and records exchange requests according to business-defined policy. Some requests are routine and can proceed immediately; others must be approved or declined by head office. Today, a front-line worker may have to pause while waiting for a response, manually check for it, and record the outcome. The proposed application would evaluate each request against policy and send it down one of three paths: automatic approval, automatic decline, or human review. It would give workers and reviewers a shared view of each request and retain a complete record of every decision, whether made by a rule or by a person.

The decision policies are owned by the business, not by the application. Which requests qualify for each path, and under what thresholds, will be collected from stakeholders during discovery and maintained as versioned, auditable configuration. Any request the rules do not clearly cover goes to a human. The application does not replace required financial, compliance or identity-verification controls.

## Project Expression of Interest

Currency exchange staff can be left waiting while head office reviews a request, even when the request is routine. During that wait, the worker may need to follow up manually, the customer may not know the status, and the request history may be spread across conversations or systems. The proposed application would manage the workflow from request submission through decision and recording. It would decide routine requests automatically under approved policy, queue the rest for human review, notify the relevant people, and route exceptions to an authorized stakeholder.

The initial proposal assumes that front-line staff submit requests, that policy classifies each request as auto-approve, auto-decline or needs-human-review, and that head-office staff decide the human-review cases. The exact request types, decision rules, existing systems, and exception process still need to be confirmed with the people who perform this work.

## Project Overview

### Project Title

**ExchangeFlow — Exchange Request and Approval Management**

### Project Domain

Currency exchange operations, including request intake, internal review, decision tracking, and transaction recordkeeping.

### Problem (What)

Exchange requests are not all equal: some are routine and could proceed at once, some need head-office judgment, and some should be refused outright. When every request depends on manual communication and follow-up, routine work is delayed, service is interrupted, and it is harder to see which requests are waiting, who is responsible, or what decision was made. The frequency and impact of these delays, and the adequacy of current tools, should be established with the intended users.

### Motivation (Why)

A shared workflow could reduce the administrative effort spent checking on requests and help staff give customers clearer status updates. A consistent decision history could also help managers understand how requests are handled. The proposal is motivated by the opportunity to make an existing operational process more visible and coordinated while keeping decision authority with the appropriate people.

### Proposed Solution (How)

ExchangeFlow would provide a desktop web application backed by a shared service for submitting and deciding exchange requests. Staff could create a request, see its current status, and receive updates in a desktop browser. A policy engine would evaluate each request and assign one of three decision paths:

| Path | Meaning | Who decides |
|---|---|---|
| **Auto-approve** | The request meets every criterion of an approved policy and may proceed immediately. | The policy (rule and version recorded) |
| **Auto-decline** | The request matches a hard-stop rule and cannot proceed. The reason is recorded and shown to staff. | The policy (rule and version recorded) |
| **Human review** | The request falls outside the automated criteria, is ambiguous, is high-risk, or no rule applies. | A head-office reviewer, who approves, declines, or requests more information |

Whatever path is taken, the system records status changes, decision reasons, timestamps, and the responsible actor (a named user or a named rule version).

Design principles for automated decisions:

- **Business-owned policy.** Criteria, thresholds and request types come from stakeholders and are held as versioned configuration, not hard-coded. They are collected during discovery.
- **Fail safe to a human.** If no rule matches, rules conflict, or evaluation fails, the request goes to human review rather than being automatically decided.
- **Explainable.** Every automated decision records which rule fired and why.
- **Reversible and contestable.** Staff can escalate an auto-decline to a human reviewer. Authorized users can pause automation, for example with a kill switch per rule or globally.
- **Earn trust gradually.** Rules first run in shadow mode, evaluating requests while humans still decide, so the business can compare outcomes before any rule is switched on.
- **Audited after the fact.** A sample of automated decisions is routed to managers for periodic review.

An exchange-rate view may be included as supporting information. The project notes reference [UExchange's currency-rate page](https://uexchange.ca/get-currency-rate), but its availability, data terms, and programmatic access have not been verified. The application should use a verified source or clearly labelled demonstration data. Rate information would be indicative and would not itself authorize or execute a transaction.

## Intended Users and Stakeholders

| Stakeholder | Interest in the application |
|---|---|
| Front-line exchange staff | Submit requests, check progress, and know when a decision or further information is needed. |
| Policy owners (business and compliance) | Define which requests are auto-approved, auto-declined or sent to a human; approve rule changes; own the risk of automated decisions. |
| Head-office reviewers | See requests awaiting review, make and record decisions, and return requests for clarification. |
| Branch and operations managers | Monitor workload, pending requests, turnaround, and consistency with internal procedures. |
| Customers | Receive a more predictable service and, where appropriate, clearer updates about a pending request. |
| Business leadership | Improve operational visibility and assess whether the workflow meets business objectives. |
| IT and security staff | Ensure the application fits the organization's systems, access policies, security, and support practices. |
| Compliance and privacy stakeholders | Confirm what information may be collected, accessed, retained, and audited. |
| Data provider, if used | Supply exchange-rate information under confirmed availability and usage terms. |

## Initial Workflow

1. A staff member creates an exchange request and supplies the information required by the business.
2. The application validates the request and routes it according to configured policy.
3. The policy engine evaluates the request and assigns a decision path.
4. **Auto-approve:** the request is approved immediately, the rule and version are recorded, and the staff member can proceed. **Auto-decline:** the request is declined with a recorded reason, and the staff member may escalate it to a reviewer. **Human review:** the request appears in the appropriate review queue, and relevant users receive a status notification.
5. For human review, an authorized reviewer approves, declines, or requests additional information, with a reason where required.
6. The staff member sees the outcome and can continue according to the organization's existing transaction process.
7. The application retains a record of the request and its status and decision history, including the decision path and the rule version or reviewer responsible.

This workflow is a starting point for discussion. The actual steps, user roles, approvals, and required information must be confirmed with the business.

## Proposed Scope

### Initial Application

- Staff and reviewer accounts with role-based access.
- Request creation and submission.
- A shared queue for pending requests.
- Request statuses such as draft, submitted, under review, more information needed, approved, declined, and completed.
- A policy engine that classifies each request as auto-approve, auto-decline or human review, using business-defined, versioned rules.
- Shadow mode for new or changed rules, per-rule and global pause controls, and escalation of auto-declines to a reviewer.
- Approval, decline, and clarification actions with recorded reasons where appropriate.
- Decision records that identify the decision path and the responsible user or rule version.
- Notifications for submission, status changes, and requests requiring attention.
- Searchable request history and basic operational summaries.
- An administrative way to configure routing and request requirements, subject to business rules.

### Outside the Initial Scope

- Executing payments or exchanging funds.
- Replacing the organization's point-of-sale, accounting, identity-verification, or compliance systems.
- Automated decisions based on machine-learning or unexplained scoring. Initial automation is limited to transparent, business-approved rules.
- Activating any automated rule in production before the business has approved it and run it in shadow mode.
- Using real customer or transaction data in a demonstration before security, privacy, and business approvals are in place.
- Integrating live rates until the source and its terms and technical access are verified.

## Expected Value

The application is intended to reduce manual status checking and follow-up, make pending work visible, and keep decisions in one traceable workflow. It may help staff communicate request status more consistently and help managers identify bottlenecks. The expected results should be measured against the current process—for example, time spent on follow-up, request turnaround time, number of requests awaiting review, and completeness of decision records. These are proposed measures; a baseline has not yet been collected.

## Feasibility and Considerations

The workflow can be implemented as a desktop web application backed by a cloud service and database. The service would synchronize requests between branches and reviewers, enforce access permissions, store decision history, and deliver notifications. A prototype can demonstrate the process using test users and sample data.

Before operational use, the business would need to confirm its workflow and decision policies, access roles, privacy and retention requirements, security expectations, integration needs, and support responsibilities. Adoption would depend on fitting the application into staff routines and connecting it appropriately with existing systems. Desktop availability at staff workstations and reviewer coverage may affect turnaround time.

## Open Questions for Discovery

- Which requests may be auto-approved, which must be auto-declined, and which always need a human? What are the criteria and thresholds, and who owns them?
- Are any automated approvals or declines restricted by regulation or internal compliance policy?
- What happens when an auto-decision is wrong, and who may override or pause the rules?
- How should automated decisions be sampled and reviewed after the fact?
- Does "execute immediately" mean the staff member proceeds in the existing system, or must ExchangeFlow trigger the transaction?
- What are the current steps from customer request to final decision?
- What tools are used today, and where are the main delays or handoff problems?
- Which information must staff submit for a reviewer to decide?
- Who may approve, decline, or request clarification? Are there different authority levels?
- What exceptions occur, and how should each be escalated?
- What status updates should staff and customers receive?
- What records must be kept, by whom, and for how long?
- Which existing systems would the application need to work with?
- Is live exchange-rate information required, and which source is approved for that use?
- What would count as a successful improvement, and how would it be measured?

## Assumptions and Validation Needed

- The primary workflow involves front-line staff, a policy engine and a head-office reviewer.
- The application decides (by rule or by human) and records decisions; existing business systems remain responsible for executing transactions unless future discovery changes the scope.
- Business stakeholders will define the auto-approve, auto-decline and human-review policies, and these will be collected during discovery.
- A rate page reference does not establish permission, API availability, or suitability for application integration.
- The problem statement and expected value are preliminary until validated through discussion with exchange staff, reviewers, and business owners.
