import type pg from 'pg';
import { hashOf, type PolicyVersion, type RuleVersion, type Condition } from '@ef/policy-core';

/**
 * DEV-ONLY demo data (ADR-021). Every rule is flagged nonProduction and every number below is a synthetic
 * placeholder chosen to show all three paths. None of them is a regulatory or business threshold.
 */
const SUPPORTED = ['CAD/USD', 'USD/CAD', 'CAD/EUR', 'EUR/CAD', 'CAD/GBP', 'GBP/CAD'];
const pair: Condition = { field: 'currencyPair', op: 'in', value: SUPPORTED };

function rule(key: string, outcome: RuleVersion['outcome'], conditions: Condition, reasonCode: string): RuleVersion {
  const base = { ruleKey: key, nonProduction: true, appliesTo: { requestType: ['EXCHANGE'] }, outcome, conditions, reasonCode };
  return { ruleVersionId: `rv-${key}-1`, contentHash: hashOf(base), ...base };
}

export function demoPolicy(): PolicyVersion {
  const entries: PolicyVersion['entries'] = [
    { mode: 'ACTIVE', rule: rule('PLACEHOLDER-001', 'AUTO_APPROVE',
      { all: [{ field: 'sell.amount', op: 'lte', value: { CAD: '1000', USD: '750', EUR: '700', GBP: '600' } }, pair] }, 'WITHIN_APPROVED_LIMIT') },
    { mode: 'ACTIVE', rule: rule('PLACEHOLDER-002', 'AUTO_DECLINE', { not: pair }, 'CURRENCY_NOT_SUPPORTED') },
    { mode: 'ACTIVE', rule: rule('PLACEHOLDER-003', 'HUMAN_REVIEW',
      { field: 'sell.amount', op: 'gt', value: { CAD: '10000', USD: '7500', EUR: '7000', GBP: '6000' } }, 'REQUIRES_HEAD_OFFICE_REVIEW') },
    { mode: 'SHADOW', rule: rule('PLACEHOLDER-004', 'AUTO_APPROVE',
      { all: [{ field: 'sell.amount', op: 'lte', value: { CAD: '2500', USD: '1900', EUR: '1700', GBP: '1500' } }, pair] }, 'WITHIN_APPROVED_LIMIT') },
  ];
  const guardrail = {
    guardrailVersionId: 'gr-1', maxAutoApprove: { CAD: '1500', USD: '1100', EUR: '1000', GBP: '900' },
    prohibitedCurrencies: [], prohibitedRequestTypes: ['WIRE'], requireFacts: [], holdFacts: ['complianceHold'],
  };
  const body = { entries, guardrail };
  return { policyVersionId: 'pv-1', number: 1, policyHash: hashOf(body), ...body };
}

export async function seed(pool: pg.Pool): Promise<boolean> {
  const has = await pool.query(`select 1 from policy_version limit 1`);
  if (has.rowCount) return false;
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`insert into branches values ('BR-TOR','Toronto Main','America/Toronto'),('BR-OTT','Ottawa Centre','America/Toronto')`);
    await c.query(`insert into users(id,display_name,roles,branch_id) values
      ('u-teller-tor','Teller (Toronto)','{STAFF}','BR-TOR'),
      ('u-teller-ott','Teller (Ottawa)','{STAFF}','BR-OTT'),
      ('u-reviewer','Head-office reviewer','{REVIEWER}',null),
      ('u-approver','Policy approver','{POLICY_APPROVER}',null),
      ('u-manager-tor','Manager (Toronto)','{MANAGER}','BR-TOR'),
      ('u-compliance','Compliance officer','{COMPLIANCE}',null)`);
    const p = demoPolicy();
    await c.query('insert into policy_version(id,number,policy_hash,manifest) values($1,$2,$3,$4)',
      [p.policyVersionId, p.number, p.policyHash, JSON.stringify({ entries: p.entries, guardrail: p.guardrail })]);
    await c.query(`insert into policy_control(id,control_revision,global_paused,paused_rule_ids,current_policy_version_id) values (1,1,false,'[]',$1)`, [p.policyVersionId]);
    await c.query('COMMIT');
    return true;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
