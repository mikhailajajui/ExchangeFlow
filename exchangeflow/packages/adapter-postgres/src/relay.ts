import type pg from 'pg';

/** Outbox relay: at-least-once, FOR UPDATE SKIP LOCKED, consumers dedupe by outbox id (INV-OUT-1). */
export async function runOutboxRelay(pool: pg.Pool, batch = 50): Promise<number> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    const rows = (await c.query(`select * from outbox where delivered_at is null order by id limit $1 for update skip locked`, [batch])).rows;
    for (const m of rows) {
      const p = m.payload as { userId?: string; requestId?: string; kind?: string; message?: string };
      if (m.type === 'inbox.notify' && p.userId) {
        await c.query(`insert into inbox(user_id, request_id, kind, message) values($1,$2,$3,$4)`, [p.userId, p.requestId ?? null, p.kind ?? 'INFO', p.message ?? '']);
      }
      await c.query('update outbox set delivered_at = now(), attempts = attempts + 1 where id = $1', [m.id]);
    }
    await c.query('COMMIT');
    return rows.length;
  } catch (e) { await c.query('ROLLBACK').catch(() => {}); throw e; } finally { c.release(); }
}

export async function outboxLagSeconds(pool: pg.Pool): Promise<number> {
  const r = await pool.query(`select coalesce(extract(epoch from now() - min(created_at)), 0)::float as lag from outbox where delivered_at is null`);
  return r.rows[0].lag;
}
