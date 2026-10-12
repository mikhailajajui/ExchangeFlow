import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPool, migrate, seed, PgUnitOfWork } from '@ef/adapter-postgres';
import { AppServices } from '../src';
import type { Actor, Clock, IdGenerator, RateProvider } from '@ef/ports';

let n = 0;
export const ids: IdGenerator = { uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
export class FakeClock implements Clock {
  constructor(public t = '2026-10-01T15:00:00.000Z') {}
  now() { return this.t; }
}

export interface Env { svc: AppServices; pool: pg.Pool; clock: FakeClock; stop: () => Promise<void>; actor: (id: string) => Promise<Actor> }

export async function startEnv(environment: 'dev' | 'prod' = 'dev', rates: RateProvider | null = null): Promise<Env> {
  const dir = mkdtempSync(join(tmpdir(), 'ef-pg-'));
  const port = 55000 + Math.floor(Math.random() * 3000);
  const server = new EmbeddedPostgres({ databaseDir: dir, user: 'ef', password: 'ef', port, persistent: false, onLog: () => {}, onError: () => {} });
  await server.initialise(); await server.start(); await server.createDatabase('t');
  const pool = createPool(`postgres://ef:ef@localhost:${port}/t`, 20);
  await migrate(pool); await seed(pool);
  const clock = new FakeClock();
  const svc = new AppServices(new PgUnitOfWork(pool), clock, ids, { environment }, rates);
  const actor = async (id: string) => {
    const r = (await pool.query('select * from users where id=$1', [id])).rows[0];
    return { id: r.id, displayName: r.display_name, roles: r.roles, branchId: r.branch_id, kind: 'user' } as Actor;
  };
  return { svc, pool, clock, actor, stop: async () => { await pool.end(); await server.stop(); rmSync(dir, { recursive: true, force: true }); } };
}

export const values = (amount: string, o: Record<string, unknown> = {}) => ({
  requestType: 'EXCHANGE', sell: { amount, currency: 'CAD' }, buyCurrency: 'USD', paymentMethod: 'ACCOUNT', memberName: 'Test Member', memberRef: 'M-1001', ...o,
});
