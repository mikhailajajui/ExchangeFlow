import {
  evaluate, applyResubmissionFloor, hashOf, ENGINE_VERSION, isAutomated, isDecimal, scaleOf,
  type Decision, type Control,
} from '@ef/policy-core';
import {
  RequestValuesSchema, CompletionInputSchema, sameDecimal, BASE_CURRENCY, buildContext, transition, TRANSITIONS, DomainError, computeQuote, quoteCurrencyFor, minorUnitsOf,
  type RequestValues, type Command, type RequestStatus, type Role, type Quote, type QuoteResult, type RateSnapshot,
} from '@ef/workflow-core';
import {
  StaleRequestError,
  type Actor, type CompletionRecord, type Clock, type IdGenerator, type UnitOfWork, type RateProvider, type Tx, type ExchangeRequest, type DecisionRecord,
} from '@ef/ports';
import { AppError } from './errors';

export interface AppConfig { environment: 'dev' | 'test' | 'prod' }

const has = (a: Actor, ...roles: Role[]) => roles.some(r => a.roles.includes(r));
const short = (id: string) => id.slice(0, 8);

export interface RequestView {
  id: string; shortId: string; status: RequestStatus; version: number; cycle: number; branchId: string; submitterId: string; submittedBy: string;
  values: RequestValues; createdAt: string; updatedAt: string; escalated: boolean;
  latest: { appliedOutcome: string; reasonText: string; cause?: string } | null;
  allowedActions: Command[];
  /** What the member gets: the completed figure when there is one, else the stored quote, else null. Set on list, queue and detail. */
  give: GiveView | null;
}
export interface GiveView { amount: string; currency: string; rate: string; source: 'COMPLETED' | 'QUOTED' }
export interface CompletionView {
  handedOver: { amount: string; currency: string }; given: { amount: string; currency: string }; rateApplied: string; rateSide: string; reference: string;
  completedBy: string; completedAt: string; quotedGive: { amount: string; currency: string } | null; differsFromQuote: boolean;
}

export class AppServices {
  constructor(private uow: UnitOfWork, private clock: Clock, private ids: IdGenerator, private cfg: AppConfig, private rates: RateProvider | null = null) {}

  /** Network I/O: always called before a unit of work opens, never while the control row is locked. Any failure means no rate. */
  private async snapshotFor(sellCurrency: string, buyCurrency: string): Promise<RateSnapshot | null> {
    const currency = quoteCurrencyFor(sellCurrency, buyCurrency);
    if (!currency || !this.rates) return null;
    try { return await this.rates.get(currency); } catch { return null; }
  }
  /** The decision never reads this. Returns null when no quote can be made; the audit gets a hash and a rate id only. */
  private quoteFrom(values: RequestValues, snapshot: RateSnapshot | null): Quote | null {
    const q = computeQuote(values.sell, values.buyCurrency, snapshot);
    return q.available ? q.quote : null;
  }
  private async storeQuote(tx: Tx, requestId: string, revision: number, quote: Quote | null) {
    if (quote) await tx.quotes.put(requestId, revision, quote);
  }

  /** Live estimate for the form. Advisory only: the stored quote is computed at submit. */
  async quote(actor: Actor, sellAmount: unknown, sellCurrency: unknown, buyCurrency: unknown): Promise<QuoteResult> {
    if (!has(actor, 'STAFF')) throw new AppError('FORBIDDEN', 'Only branch staff can get a quote');
    const issues: { path: string; message: string }[] = [];
    const cur = (v: unknown) => typeof v === 'string' && minorUnitsOf(v) !== undefined;
    if (!cur(sellCurrency)) issues.push({ path: 'sellCurrency', message: 'unsupported currency' });
    if (!cur(buyCurrency)) issues.push({ path: 'buyCurrency', message: 'unsupported currency' });
    if (cur(sellCurrency) && sellCurrency === buyCurrency) issues.push({ path: 'buyCurrency', message: 'buy and sell currencies must differ' });
    if (!isDecimal(sellAmount) || sellAmount.startsWith('-') || /^0+(\.0*)?$/.test(sellAmount)) issues.push({ path: 'sellAmount', message: 'amount must be a positive decimal string' });
    else if (cur(sellCurrency) && scaleOf(sellAmount) > minorUnitsOf(sellCurrency as string)!) issues.push({ path: 'sellAmount', message: 'too many decimal places' });
    if (issues.length) throw new AppError('VALIDATION', 'The quote request has invalid fields', { issues });
    const sell = { amount: sellAmount as string, currency: sellCurrency as string };
    const snapshot = await this.snapshotFor(sell.currency, buyCurrency as string);
    return computeQuote(sell, buyCurrency as string, snapshot);
  }

  // ---------- helpers ----------
  private parse(values: unknown): RequestValues {
    const r = RequestValuesSchema.safeParse(values);
    if (!r.success) throw new AppError('VALIDATION', 'The request has invalid fields', { issues: r.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
    return r.data;
  }
  private domain<T>(fn: () => T): T {
    try { return fn(); } catch (e) {
      if (e instanceof DomainError) {
        const map = { INVALID_TRANSITION: 'INVALID_TRANSITION', FORBIDDEN: 'FORBIDDEN', REASON_REQUIRED: 'REASON_REQUIRED', ALREADY_ESCALATED: 'ALREADY_ESCALATED', VALIDATION: 'VALIDATION' } as const;
        throw new AppError(map[e.code], e.message);
      }
      throw e;
    }
  }
  private async load(tx: Tx, actor: Actor, id: string, forUpdate = false): Promise<ExchangeRequest> {
    const r = await tx.requests.get(id, forUpdate);
    if (!r) throw new AppError('NOT_FOUND', 'Request not found');
    // Branch scope enforced in the data path; out-of-scope objects return 404 (SEC-12).
    if (has(actor, 'STAFF', 'MANAGER') && !has(actor, 'REVIEWER', 'COMPLIANCE') && actor.branchId !== r.branchId) throw new AppError('NOT_FOUND', 'Request not found');
    if (!has(actor, 'STAFF', 'MANAGER', 'REVIEWER', 'COMPLIANCE')) throw new AppError('NOT_FOUND', 'Request not found');
    return r;
  }
  private expect(r: ExchangeRequest, expectedVersion: number | undefined) {
    if (expectedVersion !== undefined && r.version !== expectedVersion) throw new AppError('STALE_REQUEST', 'The request changed since you opened it', { current: { status: r.status, version: r.version } });
  }
  private async save(tx: Tx, next: ExchangeRequest, expectedVersion: number): Promise<ExchangeRequest> {
    try { return await tx.requests.update(next, expectedVersion); } catch (e) {
      if (e instanceof StaleRequestError) throw new AppError('STALE_REQUEST', 'The request changed since you opened it', { current: e.current ? { status: e.current.status, version: e.current.version } : null });
      throw e;
    }
  }
  private view(r: ExchangeRequest, values: RequestValues, latest: DecisionRecord | undefined, actor: Actor): RequestView {
    const allowed = TRANSITIONS.filter(t => t.from === r.status && t.allowedRoles.some(x => actor.roles.includes(x))
      && !(t.guard === 'NOT_ESCALATED_BEFORE' && r.escalated)).map(t => t.command);
    return {
      id: r.id, shortId: short(r.id), status: r.status, version: r.version, cycle: r.cycle, branchId: r.branchId, submitterId: r.submitterId, submittedBy: r.submitterName ?? '',
      values, createdAt: r.createdAt, updatedAt: r.updatedAt, escalated: r.escalated,
      latest: latest ? { appliedOutcome: latest.appliedOutcome, reasonText: latest.reasonText, cause: causeFor(actor, latest.fallbackCause) } : null,
      allowedActions: allowed, give: null,
    };
  }
  private giveOf(quote: Quote | undefined | null, completion: CompletionRecord | undefined | null): GiveView | null {
    if (completion) return { ...completion.given, rate: completion.rateApplied, source: 'COMPLETED' };
    if (quote) return { ...quote.give, rate: quote.rate, source: 'QUOTED' };
    return null;
  }
  private completionView(c: CompletionRecord, quote: Quote | null): CompletionView {
    const differs = !!c.quotedGive && (!sameDecimal(c.given.amount, c.quotedGive.amount) || (quote !== null && !sameDecimal(c.rateApplied, quote.rate)));
    return {
      handedOver: c.handedOver, given: c.given, rateApplied: c.rateApplied, rateSide: c.rateSide, reference: c.reference,
      completedBy: c.completedByName ?? '', completedAt: c.completedAt, quotedGive: c.quotedGive, differsFromQuote: differs,
    };
  }
  private async withGive(tx: Tx, rows: { view: RequestView; revision: number }[]): Promise<RequestView[]> {
    const quotes = await tx.quotes.forRequests(rows.map(x => ({ requestId: x.view.id, revision: x.revision })));
    const completions = await tx.completions.forRequests(rows.map(x => x.view.id));
    return rows.map(x => ({ ...x.view, give: this.giveOf(quotes.get(x.view.id), completions.get(x.view.id)) }));
  }

  // ---------- drafts ----------
  async createDraft(actor: Actor, values: unknown): Promise<RequestView> {
    if (!has(actor, 'STAFF') || !actor.branchId) throw new AppError('FORBIDDEN', 'Only branch staff can create requests');
    const v = this.parse(values);
    return this.uow.run(async tx => {
      const now = this.clock.now(); const id = this.ids.uuid();
      const req: ExchangeRequest = { id, status: 'DRAFT', version: 1, cycle: 0, submitterId: actor.id, branchId: actor.branchId!, escalated: false, currentRevision: 1, createdAt: now, updatedAt: now, submitterName: actor.displayName };
      await tx.requests.insert(req, { requestId: id, revision: 1, values: v, valuesHash: hashOf(v), createdAt: now });
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: 'request.drafted', targetType: 'request', targetId: id, correlationId: id });
      return this.view(req, v, undefined, actor);
    });
  }

  async updateDraft(actor: Actor, id: string, values: unknown, expectedVersion?: number): Promise<RequestView> {
    const v = this.parse(values);
    return this.uow.run(async tx => {
      const r = await this.load(tx, actor, id, true);
      if (!has(actor, 'STAFF')) throw new AppError('FORBIDDEN', 'Only branch staff can edit');
      if (r.status !== 'DRAFT') throw new AppError('INVALID_TRANSITION', 'Only a draft can be edited; use resubmit after a request for information');
      this.expect(r, expectedVersion);
      const rev = r.currentRevision + 1; const now = this.clock.now();
      await tx.requests.addRevision({ requestId: id, revision: rev, values: v, valuesHash: hashOf(v), createdAt: now });
      const next = await this.save(tx, { ...r, currentRevision: rev, updatedAt: now }, r.version);
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: 'request.draft_updated', targetType: 'request', targetId: id, correlationId: id, detail: { revision: rev } });
      return this.view(next, v, undefined, actor);
    });
  }

  // ---------- evaluation (shared by submit and resubmit) ----------
  private async evaluateIn(tx: Tx, req: ExchangeRequest, values: RequestValues, control: Control & { currentPolicyVersionId: string | null }, floor: boolean) {
    const asOf = this.clock.now();
    const branch = await tx.users.branch(req.branchId);
    if (!branch) throw new AppError('NOT_FOUND', 'Branch not found');
    const policy = control.currentPolicyVersionId ? await tx.policy.getById(control.currentPolicyVersionId) : null;
    const context = buildContext(values, { branchId: branch.branchId, timezone: branch.timezone }, asOf);
    const { currentPolicyVersionId: _ignored, ...ctl } = control;
    // Compliance facts come only from a compliance-owned source (ADR-025). None is connected locally, so the map is empty.
    const compliance: Record<string, 'TRUE' | 'FALSE' | 'UNKNOWN'> = {};
    const raw: Decision = evaluate({ context, policy, control: ctl, asOf, engineVersion: ENGINE_VERSION, compliance });
    const applied = floor ? applyResubmissionFloor(raw).applied : raw;
    // INV-PLACEHOLDER-1 last line: never apply an automated outcome decided by a nonProduction rule in production.
    if (this.cfg.environment === 'prod' && isAutomated(applied.outcome) && policy?.entries.find(e => e.rule.ruleKey === applied.decidingRuleKey)?.rule.nonProduction) {
      throw new AppError('PLACEHOLDER_IN_PRODUCTION', 'A placeholder rule cannot decide in production');
    }
    return { raw, applied, context, asOf, compliance };
  }

  private record(req: ExchangeRequest, cycle: number, rev: number, e: Awaited<ReturnType<AppServices['evaluateIn']>>): DecisionRecord {
    const { raw, applied } = e;
    return {
      id: this.ids.uuid(), requestId: req.id, cycle, requestRevision: rev, policyVersionId: raw.policyVersionId, policyHash: raw.policyHash,
      controlRevision: raw.controlRevision, contextSnapshot: e.context, contextHash: raw.contextHash, asOf: e.asOf, engineVersion: raw.engineVersion,
      outcome: raw.outcome, appliedOutcome: applied.outcome, fallbackCause: applied.fallbackCause ?? null, decidingRuleKey: raw.decidingRuleKey ?? null,
      matchedRules: raw.matchedRules, shadowResults: raw.shadowResults, alerts: raw.alerts, reasonCode: applied.reasonCode, reasonText: applied.reasonText,
      restricted: { compliance: e.compliance, restrictedDetail: raw.restrictedDetail ?? null }, createdAt: e.asOf,
    };
  }

  // ---------- submit ----------
  async submit(actor: Actor, id: string, idempotencyKey: string | undefined, expectedVersion?: number) {
    if (!idempotencyKey || idempotencyKey.length < 8) throw new AppError('IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header');
    // The rate is fetched before the transaction so no lock is held during network I/O. A non-locking peek finds the pair.
    const peek = await this.uow.run(async tx => {
      const r = await tx.requests.get(id);
      return r ? tx.requests.getRevision(id, r.currentRevision) : null;
    }).catch(() => null);
    const snapshot = peek ? await this.snapshotFor(peek.values.sell.currency, peek.values.buyCurrency) : null;
    return this.uow.run(async tx => {
      // Lock order (INV-LOCK-ORDER): control row, request row, audit head. Control is locked FIRST (INV-CTRL-1, ADR-027).
      const control = await tx.control.lockShared();
      const r = await this.load(tx, actor, id, true);
      if (!has(actor, 'STAFF')) throw new AppError('FORBIDDEN', 'Only branch staff can submit');
      const idem = await tx.idempotency.begin(actor.id, idempotencyKey, hashOf({ id, rev: r.currentRevision }));
      if (idem.kind === 'mismatch') throw new AppError('IDEMPOTENCY_MISMATCH', 'This Idempotency-Key was used with a different request');
      if (idem.kind === 'replay') return idem.response as SubmitResponse;
      this.expect(r, expectedVersion);
      const rev = await tx.requests.getRevision(id, r.currentRevision);
      const stored = RequestValuesSchema.safeParse(rev!.values);
      if (!stored.success) throw new AppError('VALIDATION', 'The request has invalid fields', { issues: stored.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
      const ev = await this.evaluateIn(tx, r, rev!.values, control, false);
      const quote = this.quoteFrom(rev!.values, snapshot);
      const status = this.domain(() => transition({ from: r.status, command: 'SUBMIT', roles: actor.roles, engineOutcome: ev.applied.outcome }));
      const cycle = r.cycle + 1;
      const next = await this.save(tx, { ...r, status, cycle, updatedAt: ev.asOf }, r.version);
      await tx.decisions.insert(this.record(r, cycle, r.currentRevision, ev));
      await this.storeQuote(tx, id, r.currentRevision, quote);
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: 'request.submitted', targetType: 'request', targetId: id, correlationId: id,
        detail: { outcome: ev.applied.outcome, cause: ev.applied.fallbackCause ?? undefined, policy: ev.raw.policyVersionId, controlRevision: ev.raw.controlRevision, contextHash: ev.raw.contextHash, ...quoteAudit(quote) } });
      const response: SubmitResponse = { id, status: next.status, version: next.version, outcome: ev.applied.outcome, reason: ev.applied.reasonText, quote };
      await tx.idempotency.complete(actor.id, idempotencyKey, response);
      return response;
    });
  }

  // ---------- resubmit (always human review, ADR-022) ----------
  async resubmit(actor: Actor, id: string, values: unknown, expectedVersion?: number) {
    const v = this.parse(values);
    const snapshot = await this.snapshotFor(v.sell.currency, v.buyCurrency);
    return this.uow.run(async tx => {
      const control = await tx.control.lockShared();
      const r = await this.load(tx, actor, id, true);
      this.expect(r, expectedVersion);
      const rev = r.currentRevision + 1; const now = this.clock.now();
      const status = this.domain(() => transition({ from: r.status, command: 'RESUBMIT', roles: actor.roles }));
      await tx.requests.addRevision({ requestId: id, revision: rev, values: v, valuesHash: hashOf(v), createdAt: now });
      const ev = await this.evaluateIn(tx, { ...r, currentRevision: rev }, v, control, true);
      const cycle = r.cycle + 1;
      const next = await this.save(tx, { ...r, status, cycle, currentRevision: rev, updatedAt: ev.asOf }, r.version);
      await tx.decisions.insert(this.record(r, cycle, rev, ev));
      const quote = this.quoteFrom(v, snapshot);
      await this.storeQuote(tx, id, rev, quote);
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: 'request.resubmitted', targetType: 'request', targetId: id, correlationId: id,
        detail: { revision: rev, engineOutcome: ev.raw.outcome, applied: 'HUMAN_REVIEW', cause: 'RESUBMISSION_FLOOR', ...quoteAudit(quote) } });
      return { id, status: next.status, version: next.version, outcome: ev.applied.outcome, reason: ev.applied.reasonText, quote } as SubmitResponse;
    });
  }

  // ---------- escalate an auto-decline (no re-evaluation) ----------
  async escalate(actor: Actor, id: string, reason: string, expectedVersion?: number) {
    return this.uow.run(async tx => {
      const r = await this.load(tx, actor, id, true);
      this.expect(r, expectedVersion);
      const status = this.domain(() => transition({ from: r.status, command: 'ESCALATE', roles: actor.roles, reason, escalatedBefore: r.escalated }));
      const next = await this.save(tx, { ...r, status, escalated: true, cycle: r.cycle + 1, updatedAt: this.clock.now() }, r.version);
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: 'request.escalated', targetType: 'request', targetId: id, correlationId: id, detail: { cycle: next.cycle } });
      return { id, status: next.status, version: next.version };
    });
  }

  // ---------- reviewer decision ----------
  async decide(actor: Actor, id: string, decision: 'APPROVE' | 'DECLINE' | 'REQUEST_INFO', reason: string | undefined, expectedVersion?: number) {
    return this.uow.run(async tx => {
      const r = await this.load(tx, actor, id, true);
      if (!has(actor, 'REVIEWER')) throw new AppError('FORBIDDEN', 'Only reviewers can decide');
      if (r.submitterId === actor.id) throw new AppError('SOD_VIOLATION', 'You cannot decide a request you submitted');
      this.expect(r, expectedVersion);
      const command = ({ APPROVE: 'REVIEW_APPROVE', DECLINE: 'REVIEW_DECLINE', REQUEST_INFO: 'REVIEW_REQUEST_INFO' } as const)[decision];
      const status = this.domain(() => transition({ from: r.status, command, roles: actor.roles, reason }));
      const now = this.clock.now();
      const records = await tx.decisions.forRequest(id);
      const last = records[records.length - 1];
      const next = await this.save(tx, { ...r, status, updatedAt: now }, r.version);
      // UNIQUE(request_id, cycle) on review_decision is the backstop (INV-CONC-1, FR-24).
      await tx.decisions.insertReview({ id: this.ids.uuid(), requestId: id, cycle: r.cycle, decisionRecordId: last?.id ?? null, decisionType: decision, reviewerId: actor.id, reason: reason?.trim() || null, at: now });
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: `review.${decision.toLowerCase()}`, targetType: 'request', targetId: id, correlationId: id, detail: { cycle: r.cycle } });
      const text = { APPROVE: 'was approved', DECLINE: 'was declined', REQUEST_INFO: 'needs more information' }[decision];
      await tx.outbox.enqueue({ type: 'inbox.notify', dedupeKey: `${id}:${r.cycle}:${status}`, payload: { userId: r.submitterId, requestId: id, kind: status, message: `Request ${short(id)} ${text}.` } });
      return { id, status: next.status, version: next.version };
    });
  }

  async cancel(actor: Actor, id: string, reason: string, expectedVersion?: number) {
    return this.uow.run(async tx => {
      const r = await this.load(tx, actor, id, true);
      this.expect(r, expectedVersion);
      const status = this.domain(() => transition({ from: r.status, command: 'CANCEL', roles: actor.roles, reason }));
      const next = await this.save(tx, { ...r, status, updatedAt: this.clock.now() }, r.version);
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: 'request.cancelled', targetType: 'request', targetId: id, correlationId: id });
      return { id, status: next.status, version: next.version };
    });
  }

  /** FR-07. Records what the teller actually gave and at what rate, in the same transaction as the transition. Differences from the quote are audit booleans only; they are never returned as a flag. */
  async complete(actor: Actor, id: string, input: unknown, expectedVersion?: number) {
    const parsed = CompletionInputSchema.safeParse(input);
    if (!parsed.success) throw new AppError('VALIDATION', 'The completion has invalid fields', { issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
    const c = parsed.data;
    return this.uow.run(async tx => {
      const r = await this.load(tx, actor, id, true);
      this.expect(r, expectedVersion);
      const status = this.domain(() => transition({ from: r.status, command: 'COMPLETE', roles: actor.roles }));
      const rev = await tx.requests.getRevision(id, r.currentRevision);
      const issues: { path: string; message: string }[] = [];
      if (c.handedOver.currency !== rev!.values.sell.currency) issues.push({ path: 'handedOver.currency', message: 'must be the currency the member sells' });
      if (c.given.currency !== rev!.values.buyCurrency) issues.push({ path: 'given.currency', message: 'must be the currency the member buys' });
      if (issues.length) throw new AppError('VALIDATION', 'The completion has invalid fields', { issues });
      const stored = await tx.quotes.get(id, r.currentRevision);
      const quote = stored?.quote ?? null;
      const sell = rev!.values.sell.currency, buy = rev!.values.buyCurrency;
      const rateSide = sell === BASE_CURRENCY ? 'SELL_RATE' : buy === BASE_CURRENCY ? 'BUY_RATE' : 'OTHER';
      const now = this.clock.now();
      const next = await this.save(tx, { ...r, status, updatedAt: now }, r.version);
      await tx.completions.put({ requestId: id, revision: r.currentRevision, handedOver: c.handedOver, given: c.given, rateApplied: c.rateApplied, rateSide, reference: c.reference,
        quotedGive: quote ? quote.give : null, completedBy: actor.id, completedAt: now });
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: 'request.completed', targetType: 'request', targetId: id, correlationId: id, detail: {
        reference: c.reference,
        handedOverDiffers: !sameDecimal(c.handedOver.amount, rev!.values.sell.amount),
        givenDiffersFromQuote: quote ? !sameDecimal(c.given.amount, quote.give.amount) : false,
        rateDiffersFromQuote: quote ? !sameDecimal(c.rateApplied, quote.rate) : false,
      } });
      return { id, status: next.status, version: next.version };
    });
  }

  // ---------- engine control (pause is always safe) ----------
  async pause(actor: Actor, scope: { ruleKey?: string }, reason: string) {
    if (!has(actor, 'POLICY_APPROVER', 'MANAGER', 'COMPLIANCE')) throw new AppError('FORBIDDEN', 'You cannot pause the engine');
    if (!reason || reason.trim().length < 3) throw new AppError('REASON_REQUIRED', 'A reason is required');
    return this.uow.run(async tx => {
      const c = await tx.control.lockExclusive();   // waits for in-flight submits; later submits see the pause (INV-PAUSE-1)
      const next: Control = scope.ruleKey
        ? { controlRevision: c.controlRevision + 1, globalPaused: c.globalPaused, pausedRuleIds: [...new Set([...c.pausedRuleIds, scope.ruleKey])] }
        : { controlRevision: c.controlRevision + 1, globalPaused: true, pausedRuleIds: c.pausedRuleIds };
      await tx.control.write(next, actor.id, scope.ruleKey ? `pause:${scope.ruleKey}` : 'pause:engine', reason);
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: scope.ruleKey ? 'engine.rule_paused' : 'engine.paused', targetType: 'engine', targetId: 'engine', correlationId: this.ids.uuid(), detail: { controlRevision: next.controlRevision, ruleKey: scope.ruleKey ?? null } });
      return next;
    });
  }
  async resume(actor: Actor, scope: { ruleKey?: string }, reason: string) {
    if (!has(actor, 'POLICY_APPROVER')) throw new AppError('FORBIDDEN', 'Only a policy approver can resume');
    if (!reason || reason.trim().length < 3) throw new AppError('REASON_REQUIRED', 'A reason is required');
    return this.uow.run(async tx => {
      const c = await tx.control.lockExclusive();
      const next: Control = scope.ruleKey
        ? { controlRevision: c.controlRevision + 1, globalPaused: c.globalPaused, pausedRuleIds: c.pausedRuleIds.filter(k => k !== scope.ruleKey) }
        : { controlRevision: c.controlRevision + 1, globalPaused: false, pausedRuleIds: c.pausedRuleIds };
      await tx.control.write(next, actor.id, scope.ruleKey ? `resume:${scope.ruleKey}` : 'resume:engine', reason);
      await tx.audit.append({ actorId: actor.id, actorRoles: actor.roles, action: scope.ruleKey ? 'engine.rule_resumed' : 'engine.resumed', targetType: 'engine', targetId: 'engine', correlationId: this.ids.uuid(), detail: { controlRevision: next.controlRevision } });
      return next;
    });
  }

  // ---------- queries ----------
  async getRequest(actor: Actor, id: string) {
    return this.uow.run(async tx => {
      const r = await this.load(tx, actor, id);
      const rev = await tx.requests.getRevision(id, r.currentRevision);
      const decisions = await tx.decisions.forRequest(id);
      const reviews = await tx.decisions.reviewsFor(id);
      const audit = await tx.audit.forTarget(id);
      const latest = decisions[decisions.length - 1];
      const storedQuote = await tx.quotes.get(id, r.currentRevision);
      const completion = await tx.completions.get(id);
      const shadowVisible = has(actor, 'POLICY_APPROVER', 'MANAGER', 'COMPLIANCE');
      return {
        request: { ...this.view(r, rev!.values, latest, actor), give: this.giveOf(storedQuote?.quote, completion) },
        quote: storedQuote?.quote ?? null,
        completion: completion ? this.completionView(completion, storedQuote?.quote ?? null) : null,
        decisions: decisions.map(d => ({
          cycle: d.cycle, asOf: d.asOf, appliedOutcome: d.appliedOutcome, reasonText: d.reasonText,
          policyVersionId: shadowVisible ? d.policyVersionId : undefined,
          cause: causeFor(actor, d.fallbackCause),
          // Shadow results stay hidden from reviewers until they have decided that cycle (FR-21, SEC-09).
          shadow: shadowVisible || (has(actor, 'REVIEWER') && reviews.some(x => x.cycle >= d.cycle)) ? d.shadowResults : undefined,
          alerts: has(actor, 'MANAGER', 'POLICY_APPROVER', 'COMPLIANCE') ? d.alerts.filter(a => !a.startsWith('WOULD_BE')) : undefined,
        })),
        reviews: reviews.map(x => ({ cycle: x.cycle, decisionType: x.decisionType, reason: x.reason, at: x.at, reviewerId: x.reviewerId })),
        // Audit sequence and hash only for COMPLIANCE and MANAGER (UI-SEC-05); everyone else gets a per-request entry number.
        history: audit.map((a, i) => ({ n: i + 1, at: a.at, actor: a.actorName, action: a.action, ...(has(actor, 'COMPLIANCE', 'MANAGER') ? { seq: a.seq, hash: a.hash.slice(0, 12) } : {}) })),
      };
    });
  }

  async list(actor: Actor, filter: { scope?: 'mine' | 'branch'; statuses?: RequestStatus[] } = {}): Promise<RequestView[]> {
    return this.uow.run(async tx => {
      if (has(actor, 'STAFF', 'MANAGER') && !has(actor, 'REVIEWER', 'COMPLIANCE')) {
        const rows = await tx.requests.list({ branchId: actor.branchId!, statuses: filter.statuses, submitterId: filter.scope === 'mine' ? actor.id : undefined });
        return this.withGive(tx, rows.map(x => ({ view: this.view(x, x.values, undefined, actor), revision: x.currentRevision })));
      }
      const rows = await tx.requests.list({ statuses: filter.statuses });
      return this.withGive(tx, rows.map(x => ({ view: this.view(x, x.values, undefined, actor), revision: x.currentRevision })));
    });
  }

  async reviewQueue(actor: Actor): Promise<(RequestView & { cause: string | undefined; escalatedItem: boolean })[]> {
    if (!has(actor, 'REVIEWER')) throw new AppError('FORBIDDEN', 'Reviewers only');
    return this.uow.run(async tx => {
      const rows = await tx.requests.list({ statuses: ['UNDER_REVIEW'] });
      const quotes = await tx.quotes.forRequests(rows.map(x => ({ requestId: x.id, revision: x.currentRevision })));
      const completions = await tx.completions.forRequests(rows.map(x => x.id));
      const out = [];
      for (const x of rows) {
        const d = await tx.decisions.forRequest(x.id);
        const last = d[d.length - 1];
        out.push({ ...this.view(x, x.values, last, actor), give: this.giveOf(quotes.get(x.id), completions.get(x.id)), cause: causeFor(actor, last?.fallbackCause), escalatedItem: x.escalated });
      }
      return out.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    });
  }

  async engineStatus(actor: Actor) {
    return this.uow.run(async tx => {
      const c = await tx.control.read();
      const p = c.currentPolicyVersionId ? await tx.policy.getById(c.currentPolicyVersionId) : null;
      return {
        controlRevision: c.controlRevision, globalPaused: c.globalPaused, pausedRuleIds: c.pausedRuleIds, environment: this.cfg.environment,
        policy: p && { id: p.policyVersionId, number: p.number, hash: has(actor, 'POLICY_APPROVER', 'MANAGER', 'COMPLIANCE') ? p.policyHash.slice(0, 12) : undefined, rules: p.entries.map(e => ({ ruleKey: e.rule.ruleKey, outcome: e.rule.outcome, mode: e.mode, nonProduction: e.rule.nonProduction })) },
        canPause: has(actor, 'POLICY_APPROVER', 'MANAGER', 'COMPLIANCE'), canResume: has(actor, 'POLICY_APPROVER'),
      };
    });
  }
}

export interface SubmitResponse { id: string; status: RequestStatus; version: number; outcome: string; reason: string; quote: Quote | null }

/** Audit keeps a hash of the quote and the rate id only. */
function quoteAudit(q: Quote | null): Record<string, unknown> {
  return q ? { quoteHash: hashOf(q), rateId: `uexchange.ca:${q.snapshot.feedId}:${q.snapshot.feedUpdatedAt}` } : {};
}

/**
 * Cause shown per role (ADR-026, UI-SEC-01). Tellers get none. Reviewers get one of three specific values or the single
 * neutral NEEDS_REVIEW. Managers and policy approvers also see the specific non-restricted causes. Only COMPLIANCE sees GUARDRAIL.
 */
function causeFor(actor: Actor, cause: string | null | undefined): string | undefined {
  if (!cause) return undefined;
  if (has(actor, 'COMPLIANCE')) return cause;
  if (has(actor, 'MANAGER', 'POLICY_APPROVER')) return cause === 'GUARDRAIL' ? 'NEEDS_REVIEW' : cause;
  if (has(actor, 'REVIEWER')) return ['RESUBMISSION_FLOOR', 'ENGINE_PAUSED', 'ENGINE_ERROR'].includes(cause) ? cause : 'NEEDS_REVIEW';
  return undefined;
}
