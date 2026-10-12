import { Body, Controller, Delete, Get, Headers, HttpCode, Inject, Param, Post, Put, Query, Req as R, Res } from '@nestjs/common';
import type { Response } from 'express';
import type pg from 'pg';
import { AppServices, AppError } from '@ef/app-services';
import { createSession, deleteSession, listDevUsers, listInbox, markInboxRead, resolveSession } from '@ef/adapter-postgres';
import type { RequestStatus } from '@ef/workflow-core';
import { POOL, SERVICES, CONFIG, QUOTE_LIMITER, RateLimiter, actorOf, newCsrf, cookieNames, cookieOptions, type Req, type ApiConfig } from './http';

@Controller()
export class SessionController {
  constructor(@Inject(POOL) private pool: pg.Pool, @Inject(CONFIG) private cfg: ApiConfig) {}

  @Get('health') health() { return { ok: true, environment: this.cfg.environment }; }

  /** Dev-only sign-in picker. Entra ID replaces this later; roles and branch stay in the app database. */
  @Get('dev/users') async devUsers() {
    if (this.cfg.environment === 'prod') throw new AppError('FORBIDDEN', 'Not available');
    return listDevUsers(this.pool);
  }

  @Post('session') @HttpCode(200)
  async login(@Body() body: { userId?: string }, @Res({ passthrough: true }) res: Response) {
    if (this.cfg.environment === 'prod') throw new AppError('FORBIDDEN', 'Not available');
    const users = await listDevUsers(this.pool);
    if (!users.some(u => u.id === body?.userId)) throw new AppError('VALIDATION', 'Unknown user');
    const sid = await createSession(this.pool, body.userId!);
    const names = cookieNames(this.cfg.environment), opts = cookieOptions(this.cfg.environment);
    res.cookie(names.session, sid, { ...opts, httpOnly: true });
    const csrf = newCsrf();
    res.cookie(names.csrf, csrf, { ...opts, httpOnly: false });
    const actor = await resolveSession(this.pool, sid);
    return { actor, csrf };
  }

  @Get('session/me') me(@R() req: Req) { return { actor: actorOf(req) }; }

  @Delete('session') @HttpCode(204)
  async logout(@R() req: Req, @Res({ passthrough: true }) res: Response) {
    const names = cookieNames(this.cfg.environment), opts = cookieOptions(this.cfg.environment);
    const sid = req.cookies?.[names.session]; if (sid) await deleteSession(this.pool, sid);
    res.clearCookie(names.session, opts); res.clearCookie(names.csrf, opts);
  }
}

@Controller('requests')
export class RequestsController {
  constructor(@Inject(SERVICES) private svc: AppServices) {}

  @Get() list(@R() req: Req, @Query('scope') scope?: 'mine' | 'branch', @Query('status') status?: string) {
    return this.svc.list(actorOf(req), { scope, statuses: status ? (status.split(',') as RequestStatus[]) : undefined });
  }
  @Post() create(@R() req: Req, @Body() body: { values: unknown }) { return this.svc.createDraft(actorOf(req), body?.values); }
  @Get(':id') get(@R() req: Req, @Param('id') id: string) { return this.svc.getRequest(actorOf(req), id); }
  @Put(':id') update(@R() req: Req, @Param('id') id: string, @Body() b: { values: unknown; expectedVersion?: number }) {
    return this.svc.updateDraft(actorOf(req), id, b?.values, b?.expectedVersion);
  }
  @Post(':id/submit') @HttpCode(200)
  submit(@R() req: Req, @Param('id') id: string, @Headers('idempotency-key') key: string | undefined, @Body() b: { expectedVersion?: number }) {
    return this.svc.submit(actorOf(req), id, key, b?.expectedVersion);
  }
  @Post(':id/resubmit') @HttpCode(200)
  resubmit(@R() req: Req, @Param('id') id: string, @Body() b: { values: unknown; expectedVersion?: number }) {
    return this.svc.resubmit(actorOf(req), id, b?.values, b?.expectedVersion);
  }
  @Post(':id/escalate') @HttpCode(200)
  escalate(@R() req: Req, @Param('id') id: string, @Body() b: { reason: string; expectedVersion?: number }) {
    return this.svc.escalate(actorOf(req), id, b?.reason, b?.expectedVersion);
  }
  @Post(':id/cancel') @HttpCode(200)
  cancel(@R() req: Req, @Param('id') id: string, @Body() b: { reason: string; expectedVersion?: number }) {
    return this.svc.cancel(actorOf(req), id, b?.reason, b?.expectedVersion);
  }
  @Post(':id/complete') @HttpCode(200)
  complete(@R() req: Req, @Param('id') id: string, @Body() b: { handedOver: unknown; given: unknown; rateApplied: unknown; reference: unknown; expectedVersion?: number }) {
    const { expectedVersion, ...input } = b ?? {};
    return this.svc.complete(actorOf(req), id, input, expectedVersion);
  }
}

@Controller('quote')
export class QuoteController {
  constructor(@Inject(SERVICES) private svc: AppServices, @Inject(QUOTE_LIMITER) private limiter: RateLimiter, @Inject(CONFIG) private cfg: ApiConfig) {}
  /** Live "give the member" estimate for the form. Limited per session; the session cookie value is the key and is never logged. */
  @Get() async quote(@R() req: Req, @Query('sellAmount') amount?: string, @Query('sellCurrency') sell?: string, @Query('buyCurrency') buy?: string) {
    const actor = actorOf(req);
    this.limiter.check(String(req.cookies?.[cookieNames(this.cfg.environment).session] ?? actor.id));
    const r = await this.svc.quote(actor, amount, sell, buy);
    return r.available ? { unavailable: false, quote: r.quote } : { unavailable: true, reason: r.reason };
  }
}

@Controller('review')
export class ReviewController {
  constructor(@Inject(SERVICES) private svc: AppServices) {}
  @Get('queue') queue(@R() req: Req) { return this.svc.reviewQueue(actorOf(req)); }
  @Post(':id/decision') @HttpCode(200)
  decide(@R() req: Req, @Param('id') id: string, @Body() b: { decision: 'APPROVE' | 'DECLINE' | 'REQUEST_INFO'; reason?: string; expectedVersion?: number }) {
    if (!['APPROVE', 'DECLINE', 'REQUEST_INFO'].includes(b?.decision)) throw new AppError('VALIDATION', 'Unknown decision');
    return this.svc.decide(actorOf(req), id, b.decision, b.reason, b.expectedVersion);
  }
}

@Controller('engine')
export class EngineController {
  constructor(@Inject(SERVICES) private svc: AppServices) {}
  @Get() status(@R() req: Req) { return this.svc.engineStatus(actorOf(req)); }
  @Post('pause') @HttpCode(200) pause(@R() req: Req, @Body() b: { reason: string; ruleKey?: string }) { return this.svc.pause(actorOf(req), { ruleKey: b?.ruleKey }, b?.reason); }
  @Post('resume') @HttpCode(200) resume(@R() req: Req, @Body() b: { reason: string; ruleKey?: string }) { return this.svc.resume(actorOf(req), { ruleKey: b?.ruleKey }, b?.reason); }
}

@Controller('inbox')
export class InboxController {
  constructor(@Inject(POOL) private pool: pg.Pool) {}
  @Get() list(@R() req: Req) { return listInbox(this.pool, actorOf(req).id); }
  @Post('read') @HttpCode(204) async read(@R() req: Req) { await markInboxRead(this.pool, actorOf(req).id); }
}
