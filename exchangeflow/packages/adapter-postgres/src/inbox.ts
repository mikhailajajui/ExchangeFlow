import type pg from 'pg';
export async function listInbox(pool: pg.Pool, userId: string) {
  const r = await pool.query(`select id, request_id, kind, message, created_at, read_at from inbox where user_id=$1 order by id desc limit 50`, [userId]);
  return r.rows.map(x => ({ id: x.id as number, requestId: x.request_id as string | null, kind: x.kind as string, message: x.message as string, createdAt: x.created_at as string, read: !!x.read_at }));
}
export async function markInboxRead(pool: pg.Pool, userId: string): Promise<void> {
  await pool.query('update inbox set read_at = now() where user_id=$1 and read_at is null', [userId]);
}
