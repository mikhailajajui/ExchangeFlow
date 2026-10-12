import pg from 'pg';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

pg.types.setTypeParser(1184, (v: string) => new Date(v).toISOString()); // timestamptz -> ISO string
pg.types.setTypeParser(20, (v: string) => Number(v));                    // int8 -> number (counters are small)

export function createPool(connectionString: string, max = 10): pg.Pool {
  return new pg.Pool({ connectionString, max });
}

export async function waitForDatabase(pool: pg.Pool, tries = 60): Promise<void> {
  for (let i = 0; i < tries; i++) {
    try { await pool.query('select 1'); return; } catch { await new Promise(r => setTimeout(r, 500)); }
  }
  throw new Error('database not reachable; run `pnpm db` first');
}

export async function migrate(pool: pg.Pool): Promise<string[]> {
  await pool.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())');
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
  const applied = new Set((await pool.query('select name from schema_migrations')).rows.map(r => r.name as string));
  const ran: string[] = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.sql')).sort()) {
    if (applied.has(f)) continue;
    const c = await pool.connect();
    try {
      await c.query('BEGIN'); await c.query(readFileSync(join(dir, f), 'utf8'));
      await c.query('INSERT INTO schema_migrations(name) VALUES ($1)', [f]); await c.query('COMMIT'); ran.push(f);
    } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
  }
  return ran;
}
