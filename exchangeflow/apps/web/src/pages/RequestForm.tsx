import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError, type Detail, type Values, type Issue, type Quote, type QuoteReply } from '../api';
import { Banner, ErrorSummary, Field, Money, errorMessage } from '../ui';
import { GiveFigure, QuoteNote, rateLine } from '../quote';

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'CHF', 'AUD', 'MXN'];
const MINOR: Record<string, number> = { JPY: 0 };
const EMPTY: Values = { requestType: 'EXCHANGE', sell: { amount: '', currency: 'CAD' }, buyCurrency: 'USD', paymentMethod: 'ACCOUNT', memberName: '', memberRef: '', note: '' };
/** Order of fields on the slip; the error summary lists errors in this order. */
const FIELD_ORDER = ['memberName', 'sell.amount', 'sell.currency', 'buyCurrency', 'requestType', 'paymentMethod', 'memberRef', 'note'];
const fid = (key: string) => `f-${key.replace('.', '-')}`;

// One-click demo scenarios for the three paths (placeholder rules). Shown only in a development build.
const SCENARIOS: { label: string; hint: string; v: Partial<Values> & { sell: Values['sell'] } }[] = [
  { label: 'Small exchange', hint: 'expect auto-approve', v: { sell: { amount: '500.00', currency: 'CAD' }, buyCurrency: 'USD' } },
  { label: 'Unsupported pair', hint: 'expect auto-decline', v: { sell: { amount: '100.00', currency: 'CAD' }, buyCurrency: 'JPY' } },
  { label: 'Large amount', hint: 'expect head-office review', v: { sell: { amount: '20000.00', currency: 'CAD' }, buyCurrency: 'USD' } },
  { label: 'Wire request', hint: 'expect head-office review', v: { sell: { amount: '300.00', currency: 'CAD' }, buyCurrency: 'USD', requestType: 'WIRE' } },
];

/** Same rule as the server: trimmed, single-spaced, letters of any script, marks, space, apostrophe, period and hyphen. No digits. */
const tidyName = (t: string) => t.trim().replace(/\s+/g, ' ');
const NAME_MESSAGE = 'Enter the name as it appears on the ID, 2 to 80 letters. Do not enter numbers.';

/** Client-side hint only; the server check is the authority. */
const looksLikeCardOrSin = (t: string) => /(?:\d[ -]?){12,18}\d/.test(t) || /(?<!\d)(?:\d[ -]?){8}\d(?!\d)/.test(t);

function validate(v: Values): Record<string, string> {
  const e: Record<string, string> = {};
  const n = tidyName(v.memberName);
  if (!n) e['memberName'] = 'Enter the member name as it appears on their ID.';
  else if (n.length < 2 || n.length > 80 || !/^[\p{L}\p{M}' .\u2019-]+$/u.test(n) || !/\p{L}/u.test(n)) e['memberName'] = NAME_MESSAGE;
  const a = v.sell.amount.trim();
  if (!a) e['sell.amount'] = 'Enter an amount, for example 500.00.';
  else if (!/^\d+(\.\d+)?$/.test(a)) e['sell.amount'] = 'Enter digits only, for example 500.00.';
  else {
    const scale = MINOR[v.sell.currency] ?? 2;
    if (/^0+(\.0+)?$/.test(a)) e['sell.amount'] = 'The amount must be more than zero.';
    else if ((a.split('.')[1]?.length ?? 0) > scale) e['sell.amount'] = `Use at most ${scale} decimal places for ${v.sell.currency}.`;
  }
  if (v.buyCurrency === v.sell.currency) e['buyCurrency'] = 'The two currencies must be different. Change one of them.';
  if (v.memberRef && !/^[A-Za-z0-9_-]*$/.test(v.memberRef)) e['memberRef'] = 'Use letters, digits, - and _ only. Do not type names or ID numbers.';
  if (v.note && looksLikeCardOrSin(v.note)) e['note'] = 'Do not include card or ID numbers. Remove the digits and try again.';
  return e;
}

type Result = { id: string; status: string; outcome: string; reason: string; quote: Quote | null };

type Estimate = { state: 'idle' } | { state: 'loading' } | { state: 'ok'; quote: Quote } | { state: 'unsupported' } | { state: 'unavailable' };

/** Live, advisory estimate of what the teller gives the member (debounced 400 ms). The stored quote is computed by the server at submit. */
function useEstimate(amount: string, sell: string, buy: string): Estimate {
  const [est, setEst] = useState<Estimate>({ state: 'idle' });
  useEffect(() => {
    const a = amount.trim();
    const scale = MINOR[sell] ?? 2;
    if (!/^\d+(\.\d+)?$/.test(a) || /^0+(\.0*)?$/.test(a) || (a.split('.')[1]?.length ?? 0) > scale || sell === buy) { setEst({ state: 'idle' }); return; }
    const ctl = new AbortController();
    const timer = setTimeout(() => {
      setEst({ state: 'loading' });
      api<QuoteReply>(`/quote?sellAmount=${encodeURIComponent(a)}&sellCurrency=${sell}&buyCurrency=${buy}`, { signal: ctl.signal }).then(
        r => { if (!ctl.signal.aborted) setEst(!r.unavailable ? { state: 'ok', quote: r.quote } : r.reason === 'UNSUPPORTED_PAIR' ? { state: 'unsupported' } : { state: 'unavailable' }); },
        () => { if (!ctl.signal.aborted) setEst({ state: 'unavailable' }); },
      );
    }, 400);
    return () => { clearTimeout(timer); ctl.abort(); };
  }, [amount, sell, buy]);
  return est;
}

function GivePanel({ est }: { est: Estimate }) {
  return (
    <section className="give" aria-labelledby="give-h">
      <h3 id="give-h">You give the member</h3>
      <div aria-live="polite" aria-atomic="true" className="stack-tight">
        {est.state === 'idle' && <p className="muted">Enter an amount to see the estimate.</p>}
        {est.state === 'loading' && <p className="muted">Checking the rate…</p>}
        {est.state === 'unsupported' && <p>No rate for this currency pair. Check the rate board.</p>}
        {est.state === 'unavailable' && <p>Rate unavailable. You can still submit.</p>}
        {est.state === 'ok' && (
          <>
            <p className="fig"><GiveFigure quote={est.quote} /></p>
            <p className="small">{rateLine(est.quote)}</p>
            <QuoteNote quote={est.quote} />
          </>
        )}
      </div>
    </section>
  );
}

export function RequestForm({ mode }: { mode: 'new' | 'edit' | 'resubmit' }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [v, setV] = useState<Values>(EMPTY);
  const [version, setVersion] = useState<number | undefined>();
  const [infoReason, setInfoReason] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [top, setTop] = useState('');
  const [busy, setBusy] = useState<'' | 'saving' | 'submitting'>('');
  const [result, setResult] = useState<Result | null>(null);
  const [failTick, setFailTick] = useState(0);
  const summary = useRef<HTMLDivElement>(null);
  // The idempotency key is generated when the form opens (ADR-011), so a double click or retry cannot create a second request.
  const key = useRef(crypto.randomUUID());
  const draftId = useRef<string | undefined>(id);

  useEffect(() => {
    if (!id) return;
    api<Detail>(`/requests/${id}`).then(d => {
      setV({ ...EMPTY, ...d.request.values, memberName: d.request.values.memberName ?? '', memberRef: d.request.values.memberRef ?? '', note: d.request.values.note ?? '' });
      setVersion(d.request.version);
      const last = [...d.reviews].reverse().find(r => r.decisionType === 'REQUEST_INFO');
      setInfoReason(mode === 'resubmit' ? last?.reason ?? null : null);
    }, e => setTop(errorMessage(e)));
  }, [id, mode]);

  useEffect(() => { if (failTick) summary.current?.focus(); }, [failTick]);

  const est = useEstimate(v.sell.amount, v.sell.currency, v.buyCurrency);
  const set = (patch: Partial<Values>) => setV(x => ({ ...x, ...patch }));
  const clean = useMemo(() => (): Values => ({ ...v, memberName: tidyName(v.memberName), sell: { amount: v.sell.amount.trim(), currency: v.sell.currency }, memberRef: v.memberRef?.trim() || undefined, note: v.note?.trim() || undefined }), [v]);
  const showErrors = (e: Record<string, string>, message = '') => { setErrors(e); setTop(message); setFailTick(t => t + 1); };

  const fail = (e: unknown) => {
    if (e instanceof ApiError && e.issues.length) {
      const map: Record<string, string> = {};
      e.issues.forEach((i: Issue) => { map[i.path] = i.message; });
      showErrors(map);
    } else { setErrors({}); setTop(errorMessage(e)); }
  };

  const save = async (): Promise<string | null> => {
    const e = validate(v);
    if (Object.keys(e).length) { showErrors(e); return null; }
    setErrors({}); setTop('');
    if (draftId.current) { await api(`/requests/${draftId.current}`, { method: 'PUT', body: { values: clean(), expectedVersion: version } }); return draftId.current; }
    const d = await api<{ id: string }>('/requests', { body: { values: clean() } });
    draftId.current = d.id; return d.id;
  };

  const saveDraft = async () => {
    setBusy('saving');
    try { const rid = await save(); if (rid) nav(`/requests/${rid}`); } catch (e) { fail(e); } finally { setBusy(''); }
  };
  const submit = async () => {
    setBusy('submitting');
    try {
      if (mode === 'resubmit') {
        const e = validate(v); if (Object.keys(e).length) { showErrors(e); return; }
        setErrors({}); setTop('');
        setResult(await api<Result>(`/requests/${id}/resubmit`, { body: { values: clean(), expectedVersion: version } }));
        return;
      }
      const rid = await save(); if (!rid) return;
      const d = await api<Detail>(`/requests/${rid}`);
      setResult(await api<Result>(`/requests/${rid}/submit`, { body: { expectedVersion: d.request.version }, headers: { 'idempotency-key': key.current } }));
    } catch (e) { fail(e); } finally { setBusy(''); }
  };

  if (result) return <Outcome r={result} v={v} />;
  const title = mode === 'new' ? 'New exchange request' : mode === 'edit' ? 'Edit draft' : 'Update and resubmit';
  const list = FIELD_ORDER.filter(k => errors[k]).map(k => ({ id: fid(k), message: errors[k]! }));
  const extra = Object.keys(errors).filter(k => !FIELD_ORDER.includes(k)).map(k => ({ id: 'slip', message: errors[k]! }));
  const all = [...list, ...extra];
  return (
    <div>
      <div className="head"><div><h1>{title}</h1><p className="muted">Branch and time are set for you.</p></div></div>
      {infoReason && <div className="sheet warn stack"><p><strong>The reviewer asked:</strong> {infoReason}</p></div>}
      {mode === 'resubmit' && <Banner tone="info">After a request for information, a resubmission always goes to head-office review, even if it would otherwise be approved automatically.</Banner>}
      {top && <Banner tone="bad">{top}</Banner>}
      <form className="slip" id="slip" onSubmit={e => { e.preventDefault(); submit(); }} noValidate aria-label="Exchange slip">
        <div className="slip-head"><h2>Exchange slip</h2><span className="muted small">{draftId.current ? 'Draft' : 'Draft, not saved'}</span></div>
        <fieldset className="slip-body" disabled={!!busy}>
          {all.length > 0 && <ErrorSummary errors={all} innerRef={summary} />}
          <Field id={fid('memberName')} label="Member name" hint="As it appears on the member's ID. Do not enter numbers." error={errors['memberName']}>
            <input value={v.memberName} onChange={e => set({ memberName: e.target.value })} maxLength={80} autoComplete="off" autoCapitalize="words" spellCheck={false} />
          </Field>
          <div className="sale">
            <Field id={fid('sell.amount')} label="Member sells" error={errors['sell.amount']}>
              <input className="amt" inputMode="decimal" autoComplete="off" value={v.sell.amount} onChange={e => set({ sell: { ...v.sell, amount: e.target.value } })} />
            </Field>
            <Field id={fid('sell.currency')} label="From" error={errors['sell.currency']}>
              <select value={v.sell.currency} onChange={e => set({ sell: { ...v.sell, currency: e.target.value } })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field id={fid('buyCurrency')} label="To" error={errors['buyCurrency']}>
              <select value={v.buyCurrency} onChange={e => set({ buyCurrency: e.target.value })}>{CURRENCIES.map(c => <option key={c}>{c}</option>)}</select>
            </Field>
          </div>
          <GivePanel est={est} />
          <Field id={fid('requestType')} label="Request type" error={errors['requestType']}>
            <select value={v.requestType} onChange={e => set({ requestType: e.target.value })}><option value="EXCHANGE">Exchange</option><option value="WIRE">Wire</option></select>
          </Field>
          <Field id={fid('paymentMethod')} label="Payment method" error={errors['paymentMethod']}>
            <select value={v.paymentMethod} onChange={e => set({ paymentMethod: e.target.value })}><option value="ACCOUNT">From account</option><option value="CASH">Cash</option><option value="OTHER">Other</option></select>
          </Field>
          <Field id={fid('memberRef')} label="Member reference (optional)" hint="Use the reference from the core system. Do not type names or account numbers." error={errors['memberRef']}>
            <input value={v.memberRef ?? ''} onChange={e => set({ memberRef: e.target.value })} maxLength={40} autoComplete="off" autoCapitalize="off" spellCheck={false} />
          </Field>
          {/* TODO(BQ): the note hint wording needs legal review. */}
          <Field id={fid('note')} label="Note for the reviewer (optional)" hint="Do not record concerns about the member here. Use your normal escalation route." error={errors['note']}>
            <textarea rows={3} maxLength={200} value={v.note ?? ''} onChange={e => set({ note: e.target.value })} autoComplete="off" autoCapitalize="off" spellCheck={false} />
          </Field>
          <div className="actions">
            <button type="submit" className="btn">{busy === 'submitting' ? 'Submitting…' : mode === 'resubmit' ? 'Resubmit request' : 'Submit request'}</button>
            {mode !== 'resubmit' && <button type="button" className="btn sec" onClick={saveDraft}>{busy === 'saving' ? 'Saving…' : 'Save draft'}</button>}
            <Link className="btn quiet" to={id ? `/requests/${id}` : '/requests'}>Cancel</Link>
          </div>
          <p className="small muted prose">The server checks the request against the current policy. Approved requests are completed by you in the existing system; ExchangeFlow never moves money.</p>
        </fieldset>
      </form>
      {import.meta.env.DEV && (
        <details className="scenarios">
          <summary>Test scenarios (test environment only)</summary>
          <div className="in-body">
            {SCENARIOS.map(s => (
              <button key={s.label} type="button" className="btn sec sm" onClick={() => { setV(x => ({ ...EMPTY, ...s.v, memberName: x.memberName })); setErrors({}); setTop(''); }}>{s.label}, {s.hint}</button>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function Outcome({ r, v }: { r: Result; v: Values }) {
  const h = useRef<HTMLHeadingElement>(null);
  // Moving focus to the heading is what announces the outcome, once. There is deliberately no extra live region.
  useEffect(() => { h.current?.focus(); }, []);
  const ref = r.id.slice(0, 8);
  const give = r.outcome === 'AUTO_APPROVE' && r.quote;
  const kind = r.outcome === 'AUTO_APPROVE' ? 'good' : r.outcome === 'AUTO_DECLINE' ? 'bad' : 'review';
  const copy = {
    good: { stamp: 'Approved', sub: 'by rule', head: `Request ${ref} is approved`, next: 'Complete the exchange in the existing system, then record what you executed.' },
    bad: { stamp: 'Declined', sub: 'by rule', head: `Request ${ref} is declined`, next: 'Tell the member. If you think this is wrong, you can escalate it once to head office, with a reason.' },
    review: { stamp: 'In review', sub: 'head-office review', head: `Request ${ref} was sent to head-office review`, next: 'Nothing to do now. You will see the answer in your notifications and on this request.' },
  }[kind];
  return (
    <article className={`docket ${kind === 'review' ? '' : kind}`} aria-labelledby="outcome-h">
      <div className="in-body">
        <div className={`stamp land ${kind}`} role="img" aria-label={`${copy.stamp}, ${copy.sub}`}>{copy.stamp}<small>{copy.sub}</small></div>
        <h2 id="outcome-h" tabIndex={-1} ref={h}>{copy.head}</h2>
        {give
          ? <div className="line"><span>Give the member</span><GiveFigure className="big" quote={r.quote!} /></div>
          : kind === 'good' && <div className="line"><span>Give the member</span><span>Rate unavailable. Check the rate board before you hand over cash.</span></div>}
        <div className="line"><span className="muted">Member sells</span><Money className={give ? '' : 'big'} amount={v.sell.amount} currency={v.sell.currency} /></div>
        <div className="line"><span className="muted">Member buys</span><span className="money">{v.buyCurrency}</span></div>
        {kind !== 'good' && r.quote && (
          <div>
            <p className="est small muted">Estimated at submit: <GiveFigure quote={r.quote} />, {rateLine(r.quote).toLowerCase()}.</p>
            <QuoteNote quote={r.quote} />
          </div>
        )}
        {give && <div><p className="small">{rateLine(r.quote!)}</p><QuoteNote quote={r.quote!} /></div>}
        <div className="line"><span className="muted">Why</span><span className="why">{r.reason}</span></div>
        <div className="next"><strong>Next step.</strong> {copy.next}</div>
        <div className="actions"><Link className="btn" to={`/requests/${r.id}`}>Open request</Link><Link className="btn sec" to="/requests/new" reloadDocument>New request</Link></div>
      </div>
      <div className="tear" />
    </article>
  );
}
