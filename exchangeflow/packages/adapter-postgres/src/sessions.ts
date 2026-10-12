import type pg from 'pg';
import { randomBytes } from 'node:crypto';
import type { Actor } from '@ef/ports';

export async function createSession(pool: pg.Pool, userId: string, ttlHours = 8): Promise<string> {
  const id = randomBytes(32).toString('hex');
  await pool.query(`insert into sessions(id,user_id,expires_at) values($1,$2, now() + ($3 || ' hours')::interval)`, [id, userId, String(ttlHours)]);
  return id;
}
/** Roles and branch are read from the app database on every request (ADR-014/015). Entra will only authenticate later. */
export async function resolveSession(pool: pg.Pool, sessionId: string): Promise<Actor | null> {
  const r = await pool.query(`select u.* from sessions s join users u on u.id = s.user_id where s.id = $1 and s.expires_at > now() and u.active`, [sessionId]);
  const x = r.rows[0];
  return x ? { id: x.id, displayName: x.display_name, roles: x.roles, branchId: x.branch_id, kind: 'user' } : null;
}
export async function deleteSession(pool: pg.Pool, sessionId: string): Promise<void> {
  await pool.query('delete from sessions where id = $1', [sessionId]);
}
export async function listDevUsers(pool: pg.Pool) {
  const r = await pool.query(`select u.id, u.display_name, u.roles, u.branch_id, b.name as branch_name from users u left join branches b on b.branch_id = u.branch_id where u.active order by u.id`);
  return r.rows.map(x => ({ id: x.id, displayName: x.display_name, roles: x.roles as string[], branchId: x.branch_id as string | null, branchName: x.branch_name as string | null }));
}
