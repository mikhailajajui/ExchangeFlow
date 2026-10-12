import type pg from 'pg';
import { canonicalJson, hashOf, type Control, type PolicyVersion } from '@ef/policy-core';
import type {
  Tx, UnitOfWork, ExchangeRequest, RequestRevision, DecisionRecord, ReviewDecision, Actor, Branch,
  AuditEventInput, AuditEventView, OutboxMessage, CompletionRecord, Quote,
} from '@ef/ports';
import { StaleRequestError } from '@ef/ports';

type Q = pg.PoolClient;
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : (v as string));

function mapRequest(r: any): ExchangeRequest {
  return {
    id: r.id, status: r.status, version: r.version, cycle: r.cycle, submitterId: r.submitter_id, branchId: r.branch_id,
    escalated: r.escalated, currentRevision: r.current_revision, createdAt: iso(r.created_at), updatedAt: iso(r.updated_at),
    submitterName: r.submitter_name,
  };
}

function makeTx(c: Q): Tx {
  return {
    requests: {
      async get(id, forUpdate) {
        const r = await c.query(`select r.*, u.display_name as submitter_name from exchange_request r join users u on u.id = r.submitter_id
          where r.id = $1 ${forUpdate ? 'for update of r' : ''}`, [id]);
        return r.rows[0] ? mapRequest(r.rows[0]) : null;
      },
      async insert(req, rev) {
        await c.query(`insert into exchange_request(id,status,version,cycle,submitter_id,branch_id,escalated,current_revision,created_at,updated_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`, [req.id, req.status, req.version, req.cycle, req.submitterId, req.branchId, req.escalated, req.currentRevision, req.createdAt, req.updatedAt]);
        await this.addRevision(rev);
      },
      async update(req, expectedVersion) {
        const r = await c.query(`update exchange_request set status=$1, version=version+1, cycle=$2, escalated=$3, current_revision=$4, updated_at=$5
          where id=$6 and version=$7 returning *`, [req.status, req.cycle, req.escalated, req.currentRevision, req.updatedAt, req.id, expectedVersion]);
        if (!r.rows[0]) throw new StaleRequestError(await this.get(req.id));
        return { ...mapRequest(r.rows[0]), submitterName: req.submitterName };
      },
      async addRevision(rev) {
        await c.query(`insert into request_revision(request_id,revision,"values",values_hash,created_at) values($1,$2,$3,$4,$5)`,
          [rev.requestId, rev.revision, JSON.stringify(rev.values), rev.valuesHash, rev.createdAt]);
      },
      async getRevision(requestId, revision) {
        const r = await c.query(`select * from request_revision where request_id=$1 and revision=$2`, [requestId, revision]);
        const x = r.rows[0];
        return x ? { requestId: x.request_id, revision: x.revision, values: x.values, valuesHash: x.values_hash, createdAt: iso(x.created_at) } : null;
      },
      async list(f) {
        const where: string[] = []; const args: unknown[] = [];
        if (f.branchId) { args.push(f.branchId); where.push(`r.branch_id = $${args.length}`); }
        if (f.submitterId) { args.push(f.submitterId); where.push(`r.submitter_id = $${args.length}`); }
        if (f.statuses?.length) { args.push(f.statuses); where.push(`r.status = any($${args.length})`); }
        const r = await c.query(`select r.*, u.display_name as submitter_name, v."values" from exchange_request r join request_revision v on v.request_id=r.id and v.revision=r.current_revision
          join users u on u.id = r.submitter_id
          ${where.length ? 'where ' + where.join(' and ') : ''} order by r.updated_at desc limit 200`, args);
        return r.rows.map(x => ({ ...mapRequest(x), values: x.values }));
      },
    },
    control: {
      async lockShared() { return readControl(c, 'for share'); },
      async lockExclusive() { return readControl(c, 'for update'); },
      async read() { return readControl(c, ''); },
      async write(next, actorId, action, reason) {
        await c.query(`update policy_control set control_revision=$1, global_paused=$2, paused_rule_ids=$3 where id=1`,
          [next.controlRevision, next.globalPaused, JSON.stringify(next.pausedRuleIds)]);
        await c.query(`insert into control_event(control_revision,action,actor,reason) values($1,$2,$3,$4)`, [next.controlRevision, action, actorId, reason]);
      },
    },
    policy: {
      async getById(id) {
        const r = await c.query('select * from policy_version where id=$1', [id]);
        const x = r.rows[0];
        return x ? ({ ...(x.manifest as object), policyVersionId: x.id, number: x.number, policyHash: x.policy_hash } as PolicyVersion) : null;
      },
    },
    decisions: {
      async insert(d: DecisionRecord) {
        await c.query(`insert into decision_record(id,request_id,cycle,request_revision,policy_version_id,policy_hash,control_revision,context_snapshot,context_hash,as_of,engine_version,
          outcome,applied_outcome,fallback_cause,deciding_rule_key,matched_rules,shadow_results,alerts,reason_code,reason_text,restricted,created_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22)`,
          [d.id, d.requestId, d.cycle, d.requestRevision, d.policyVersionId, d.policyHash, d.controlRevision, JSON.stringify(d.contextSnapshot), d.contextHash, d.asOf, d.engineVersion,
           d.outcome, d.appliedOutcome, d.fallbackCause, d.decidingRuleKey, JSON.stringify(d.matchedRules), JSON.stringify(d.shadowResults), JSON.stringify(d.alerts), d.reasonCode, d.reasonText, JSON.stringify(d.restricted), d.createdAt]);
      },
      async insertReview(r: ReviewDecision) {
        await c.query(`insert into review_decision(id,request_id,cycle,decision_record_id,decision_type,reviewer_id,reason,at) values($1,$2,$3,$4,$5,$6,$7,$8)`,
          [r.id, r.requestId, r.cycle, r.decisionRecordId, r.decisionType, r.reviewerId, r.reason, r.at]);
      },
      async forRequest(requestId) {
        // General projection: the restricted column is deliberately not selected here (ADR-026).
        const r = await c.query(`select id,seq,request_id,cycle,request_revision,policy_version_id,policy_hash,control_revision,context_snapshot,context_hash,as_of,engine_version,
          outcome,applied_outcome,fallback_cause,deciding_rule_key,matched_rules,shadow_results,alerts,reason_code,reason_text,created_at from decision_record where request_id=$1 order by cycle`, [requestId]);
        return r.rows.map(x => ({
          id: x.id, requestId: x.request_id, cycle: x.cycle, seq: x.seq, requestRevision: x.request_revision, policyVersionId: x.policy_version_id, policyHash: x.policy_hash,
          controlRevision: x.control_revision, contextSnapshot: x.context_snapshot, contextHash: x.context_hash, asOf: iso(x.as_of), engineVersion: x.engine_version,
          outcome: x.outcome, appliedOutcome: x.applied_outcome, fallbackCause: x.fallback_cause, decidingRuleKey: x.deciding_rule_key, matchedRules: x.matched_rules,
          shadowResults: x.shadow_results, alerts: x.alerts, reasonCode: x.reason_code, reasonText: x.reason_text,
          restricted: { compliance: {}, restrictedDetail: null }, createdAt: iso(x.created_at),
        }));
      },
      async reviewsFor(requestId) {
        const r = await c.query('select * from review_decision where request_id=$1 order by cycle', [requestId]);
        return r.rows.map(x => ({ id: x.id, requestId: x.request_id, cycle: x.cycle, decisionRecordId: x.decision_record_id, decisionType: x.decision_type, reviewerId: x.reviewer_id, reason: x.reason, at: iso(x.at) }));
      },
    },
    idempotency: {
      async begin(submitterId, key, payloadHash) {
        const ins = await c.query(`insert into idempotency(submitter_id,key,payload_hash) values($1,$2,$3) on conflict do nothing returning 1`, [submitterId, key, payloadHash]);
        if (ins.rowCount) return { kind: 'new' };
        const r = await c.query('select payload_hash, response from idempotency where submitter_id=$1 and key=$2', [submitterId, key]);
        const x = r.rows[0];
        if (x.payload_hash !== payloadHash) return { kind: 'mismatch' };
        return { kind: 'replay', response: x.response };
      },
      async complete(submitterId, key, response) {
        await c.query('update idempotency set response=$3 where submitter_id=$1 and key=$2', [submitterId, key, JSON.stringify(response)]);
      },
    },
    quotes: {
      async put(requestId, revision, quote) {
        await c.query('insert into request_quote(request_id, revision, quote) values($1,$2,$3)', [requestId, revision, JSON.stringify(quote)]);
      },
      async get(requestId, revision) {
        const r = await c.query('select quote, created_at from request_quote where request_id=$1 and revision=$2', [requestId, revision]);
        return r.rows[0] ? { quote: r.rows[0].quote, createdAt: iso(r.rows[0].created_at) } : null;
      },
      async forRequests(items) {
        const out = new Map<string, Quote>();
        if (!items.length) return out;
        const r = await c.query(`select q.request_id, q.quote from request_quote q join unnest($1::uuid[], $2::int[]) as w(request_id, revision) on w.request_id = q.request_id and w.revision = q.revision`,
          [items.map(i => i.requestId), items.map(i => i.revision)]);
        for (const x of r.rows) out.set(x.request_id, x.quote);
        return out;
      },
    },
    completions: {
      async put(x) {
        await c.query(`insert into request_completion(request_id,revision,handed_over,given,rate_applied,rate_side,reference,quoted_give,completed_by,completed_at)
          values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [x.requestId, x.revision, JSON.stringify(x.handedOver), JSON.stringify(x.given), x.rateApplied, x.rateSide, x.reference, x.quotedGive ? JSON.stringify(x.quotedGive) : null, x.completedBy, x.completedAt]);
      },
      async get(requestId) { return (await this.forRequests([requestId])).get(requestId) ?? null; },
      async forRequests(requestIds) {
        const out = new Map<string, CompletionRecord>();
        if (!requestIds.length) return out;
        const r = await c.query(`select k.*, u.display_name from request_completion k join users u on u.id = k.completed_by where k.request_id = any($1)`, [requestIds]);
        for (const x of r.rows) out.set(x.request_id, {
          requestId: x.request_id, revision: x.revision, handedOver: x.handed_over, given: x.given, rateApplied: x.rate_applied, rateSide: x.rate_side, reference: x.reference,
          quotedGive: x.quoted_give, completedBy: x.completed_by, completedAt: iso(x.completed_at), completedByName: x.display_name,
        });
        return out;
      },
    },
    users: {
      async get(id) {
        const r = await c.query('select * from users where id=$1 and active', [id]);
        const x = r.rows[0];
        return x ? ({ id: x.id, displayName: x.display_name, roles: x.roles, branchId: x.branch_id, kind: 'user' } as Actor) : null;
      },
      async branch(id) {
        const r = await c.query('select * from branches where branch_id=$1', [id]);
        const x = r.rows[0];
        return x ? ({ branchId: x.branch_id, name: x.name, timezone: x.timezone } as Branch) : null;
      },
    },
    outbox: {
      async enqueue(m: OutboxMessage) {
        await c.query(`insert into outbox(type,payload,dedupe_key) values($1,$2,$3) on conflict (dedupe_key) do nothing`, [m.type, JSON.stringify(m.payload), m.dedupeKey]);
      },
    },
    audit: {
      async append(e: AuditEventInput) {
        const r = await c.query('select * from audit_append($1,$2,$3,$4,$5,$6,$7,now())',
          [e.actorId, JSON.stringify(e.actorRoles), e.action, e.targetType, e.targetId, e.correlationId, JSON.stringify(e.detail ?? {})]);
        return { seq: r.rows[0].seq, hash: r.rows[0].hash };
      },
      async forTarget(targetId) {
        const r = await c.query(`select a.seq, a.at, a.actor_id, coalesce(u.display_name, a.actor_id) as actor_name, a.action, a.hash, a.detail
          from audit_event a left join users u on u.id = a.actor_id where a.target_id=$1 order by a.seq`, [targetId]);
        return r.rows.map(x => ({ seq: x.seq, at: iso(x.at), actorId: x.actor_id, actorName: x.actor_name, action: x.action, hash: x.hash, detail: x.detail } as AuditEventView));
      },
    },
  };
}

async function readControl(c: Q, lock: string): Promise<Control & { currentPolicyVersionId: string | null }> {
  const r = await c.query(`select * from policy_control where id=1 ${lock}`);
  const x = r.rows[0];
  return { controlRevision: x.control_revision, globalPaused: x.global_paused, pausedRuleIds: x.paused_rule_ids, currentPolicyVersionId: x.current_policy_version_id };
}

export class PgUnitOfWork implements UnitOfWork {
  constructor(private pool: pg.Pool) {}
  /** READ COMMITTED; retried only on serialization or deadlock errors, restarting from the control lock. */
  async run<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      const c = await this.pool.connect();
      try {
        await c.query('BEGIN ISOLATION LEVEL READ COMMITTED');
        const out = await fn(makeTx(c));
        await c.query('COMMIT');
        return out;
      } catch (e: any) {
        await c.query('ROLLBACK').catch(() => {});
        if ((e?.code === '40001' || e?.code === '40P01') && attempt < 2) continue;
        throw e;
      } finally { c.release(); }
    }
  }
}

export { canonicalJson, hashOf };
