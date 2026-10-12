// Local PostgreSQL 16 for development (real server binaries from npm; no Docker, no cloud).
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const port = Number(process.env.EF_DB_PORT ?? 54320);
const dir = resolve(process.cwd(), '.data/pg');
const server = new EmbeddedPostgres({ databaseDir: dir, user: 'ef', password: 'ef', port, persistent: true, onLog: () => {}, onError: m => console.error(String(m)) });

if (!existsSync(resolve(dir, 'PG_VERSION'))) await server.initialise();
await server.start();
const admin = new pg.Client({ host: 'localhost', port, user: 'ef', password: 'ef', database: 'postgres' });
await admin.connect();
const exists = await admin.query(`select 1 from pg_database where datname = 'exchangeflow'`);
if (!exists.rowCount) await admin.query('create database exchangeflow');
await admin.end();
console.log(`[db] PostgreSQL ready on postgres://ef:ef@localhost:${port}/exchangeflow (data in .data/pg)`);

const stop = async () => { await server.stop(); process.exit(0); };
process.on('SIGINT', stop); process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
