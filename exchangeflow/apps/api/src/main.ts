import 'reflect-metadata';
import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import cookieParser from 'cookie-parser';
import { randomUUID } from 'node:crypto';
import { AppServices } from '@ef/app-services';
import { createRateProvider } from '@ef/adapter-rates';
import { PgUnitOfWork, createPool, migrate, seed, waitForDatabase, runOutboxRelay, outboxLagSeconds } from '@ef/adapter-postgres';
import { POOL, SERVICES, CONFIG, QUOTE_LIMITER, RateLimiter, resolveEnvironment, SessionMiddleware, CsrfMiddleware, ProblemFilter, securityHeaders, type ApiConfig } from './http';
import { SessionController, RequestsController, ReviewController, EngineController, InboxController, QuoteController } from './controllers';

const environment = resolveEnvironment(process.env.EF_ENV);
const databaseUrl = process.env.DATABASE_URL ?? `postgres://ef:ef@localhost:${process.env.EF_DB_PORT ?? 54320}/exchangeflow`;
const port = Number(process.env.PORT ?? 3001);

// INV-PLACEHOLDER-1 start-up refusal: a production process never boots with the dev seed or dev login.
if (environment === 'prod' && process.env.EF_ALLOW_NON_PRODUCTION_RULES) throw new Error('refusing to start: non-production rules are enabled in prod');

const pool = createPool(databaseUrl);
await waitForDatabase(pool);
console.log('[api] migrations applied:', (await migrate(pool)).join(', ') || 'none (up to date)');
if (environment !== 'prod' && (await seed(pool))) console.log('[api] seeded DEV demo data (synthetic, nonProduction rules)');

// Indicative rates for the teller's "give the member" figure only. A bad EF_RATE_URL (not https, or a host off the allow-list) refuses to start.
const rates = createRateProvider({ url: process.env.EF_RATE_URL, onError: reason => console.warn(`[api] rate feed unavailable: ${reason}`) });
const services = new AppServices(new PgUnitOfWork(pool), { now: () => new Date().toISOString() }, { uuid: () => randomUUID() }, { environment }, rates);

@Module({
  controllers: [SessionController, RequestsController, ReviewController, EngineController, InboxController, QuoteController],
  providers: [{ provide: QUOTE_LIMITER, useValue: new RateLimiter(30, 60_000) }, { provide: POOL, useValue: pool }, { provide: SERVICES, useValue: services }, { provide: CONFIG, useValue: { environment } satisfies ApiConfig }, SessionMiddleware, CsrfMiddleware],
})
class AppModule implements NestModule {
  configure(c: MiddlewareConsumer) { c.apply(SessionMiddleware, CsrfMiddleware).forRoutes('{*path}'); }
}

const app = await NestFactory.create<NestExpressApplication>(AppModule, { logger: ['error', 'warn'] });
app.setGlobalPrefix('api');
app.use(securityHeaders);
app.use(cookieParser());
// Serve the built SPA when it exists (same origin, so the CSP above applies to it). In dev, Vite serves the SPA instead.
const webDist = fileURLToPath(new URL('../../web/dist', import.meta.url));
if (existsSync(webDist)) {
  app.useStaticAssets(webDist, { index: false });
  app.use((req: { method: string; path: string }, res: { sendFile(p: string): void }, next: () => void) =>
    req.method === 'GET' && !req.path.startsWith('/api') ? res.sendFile(`${webDist}/index.html`) : next());
}
app.useGlobalFilters(new ProblemFilter());
app.getHttpAdapter().getInstance().disable('x-powered-by');
await app.listen(port);
console.log(`[api] ExchangeFlow API on http://localhost:${port}/api (environment: ${environment})`);

// Outbox relay (at-least-once, SKIP LOCKED). In a real host this is the worker; here it is a local timer.
setInterval(async () => {
  try { await runOutboxRelay(pool); const lag = await outboxLagSeconds(pool); if (lag > 10) console.warn(`[api] outbox lag ${lag.toFixed(1)}s exceeds the 10 s target`); }
  catch (e) { console.error('[api] relay error', e); }
}, 2000);
