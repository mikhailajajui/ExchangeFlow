import { cloneElement, useEffect, useRef, useState, type FormEvent, type ReactElement, type ReactNode, type Ref } from 'react';
import type { DeskConfig, DeskRecord, QuoteView, ResultKind } from '../shared';
import { checkRequest, DeskError, getConfig, getQuote, PROTOTYPE } from './api';
import { ALTERNA_LOGO_URL, DESK_VERSION, fmtAmount, PAYMENT_LABEL, rateLine, short } from './format';

// ---------- small pieces ----------

const Wordmark = () => <span className="brand">Exchange<span className="wordmark-flow">Flow</span></span>;

/** Alterna's logo by URL; if it cannot load (offline, blocked), the text wordmark stands alone. */
function Logo() {
  const [failed, setFailed] = useState(false);
  // Not on the public prototype until Alterna gives permission (DL-N37); the local desk shows it (ADR-029).
  if (failed || PROTOTYPE) return null;
  return <span className="logo-plate"><img className="logo" src={ALTERNA_LOGO_URL} alt="Alterna Savings" referrerPolicy="no-referrer" onError={() => setFailed(true)} /></span>;
}

const TONE: Record<ResultKind, { tone: 'good' | 'review' | 'bad'; glyph: string }> = {
  WITHIN_LIMITS: { tone: 'good', glyph: '✓' },
  HEAD_OFFICE_REVIEW: { tone: 'review', glyph: '' },
  NOT_AT_BRANCH: { tone: 'bad', glyph: '✕' },
};

/** Per-viewer convenience only (branch and staff ID); the page works without it. */
const remembered = {
  get(key: string): string { try { return localStorage.getItem(`efd.${key}`) ?? ''; } catch { return ''; } },
  set(key: string, v: string) { try { localStorage.setItem(`efd.${key}`, v); } catch { /* storage blocked */ } },
};

function Field({ id, label, hint, error, optional, children }: { id: string; label: string; hint?: string; error?: string; optional?: boolean; children: ReactElement<Record<string, unknown>> }) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;
  const control = cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined });
  return (
    <div className={`f ${error ? 'err' : ''}`}>
      <label htmlFor={id}>{label}{optional && <span className="opt"> (optional)</span>}</label>
      {hint && <span id={`${id}-hint`} className="hint">{hint}</span>}
      {control}
      {error && <span id={`${id}-err`} className="msg">{error}</span>}
    </div>
  );
}

// ---------- form state ----------

interface FormState {
  branchId: string; tellerId: string; memberName: string; memberRef: string;
  amount: string; sellCurrency: string; buyCurrency: string; paymentMethod: string; note: string;
}
const emptyForm = (cfg: DeskConfig | null): FormState => {
  const branch = remembered.get('branch');
  const sell = cfg?.currencies.includes('CAD') ? 'CAD' : cfg?.currencies[0] ?? '';
  return {
    branchId: cfg?.branches.some(b => b.id === branch) ? branch : '',
    tellerId: remembered.get('teller'), memberName: '', memberRef: '', amount: '',
    sellCurrency: sell, buyCurrency: cfg?.currencies.find(c => c !== sell) ?? '', paymentMethod: '', note: '',
  };
};

/** Server issue paths mapped to the form field that shows them. */
const PATH_FIELD: Record<string, keyof FormState> = {
  branchId: 'branchId', tellerId: 'tellerId', memberName: 'memberName', memberRef: 'memberRef', 'sell.amount': 'amount',
  'sell.currency': 'sellCurrency', buyCurrency: 'buyCurrency', paymentMethod: 'paymentMethod', note: 'note',
};
const FIELD_NAME: Record<keyof FormState, string> = {
  branchId: 'Branch', tellerId: 'Your staff ID', memberName: 'Member name', memberRef: 'Member reference', amount: 'Amount the member gives',
  sellCurrency: 'Currency the member gives', buyCurrency: 'Currency the member receives', paymentMethod: 'Payment method', note: 'Note',
};

/** Checks the page can make before asking the server; the server repeats every check. */
function localErrors(f: FormState): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (!f.branchId) e.branchId = 'Choose your branch.';
  if (!/^[A-Za-z0-9_-]{2,20}$/.test(f.tellerId.trim())) e.tellerId = 'Enter your staff ID: 2 to 20 letters or digits.';
  if (f.memberName.trim().length < 2) e.memberName = 'Enter the name as it appears on the ID, 2 to 80 letters. Do not enter numbers.';
  if (!/^\d+(\.\d+)?$/.test(f.amount.trim())) e.amount = 'Enter an amount in figures, for example 250.00. Do not type commas or a currency sign.';
  if (f.sellCurrency && f.sellCurrency === f.buyCurrency) e.buyCurrency = 'Choose a different currency from the one the member gives.';
  if (!f.paymentMethod) e.paymentMethod = 'Choose how the member pays.';
  return e;
}

// ---------- page ----------

export function App() {
  const [cfg, setCfg] = useState<DeskConfig | null>(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState<FormState>(emptyForm(null));
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [busy, setBusy] = useState(false);
  const [fail, setFail] = useState('');
  const [record, setRecord] = useState<DeskRecord | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const recordRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    getConfig().then(c => { setCfg(c); setForm(emptyForm(c)); })
      .catch(e => setLoadError(e instanceof DeskError && e.problem.code === 'RULES_UNAVAILABLE'
        ? 'The head-office rules could not be loaded, so requests cannot be checked. Ask head office to check the rules file.'
        : 'The branch desk server is not responding. Check that it is running, then reload this page.'));
  }, []);

  // The saved PDF takes its name from the page title: the record number only, never the member name.
  useEffect(() => {
    document.title = record ? `Exchange record ${record.recordNo}` : 'ExchangeFlow branch desk';
    if (record) recordRef.current?.focus();
  }, [record]);

  const set = <K extends keyof FormState>(k: K) => (v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: undefined }));
  };

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    setFail('');
    const local = localErrors(form);
    setErrors(local);
    if (Object.keys(local).length) { requestAnimationFrame(() => summaryRef.current?.focus()); return; }
    setBusy(true);
    try {
      const values = {
        requestType: 'EXCHANGE', sell: { amount: form.amount.trim(), currency: form.sellCurrency }, buyCurrency: form.buyCurrency,
        paymentMethod: form.paymentMethod, memberName: form.memberName,
        ...(form.memberRef.trim() ? { memberRef: form.memberRef.trim() } : {}), ...(form.note.trim() ? { note: form.note.trim() } : {}),
      };
      setRecord(await checkRequest({ branchId: form.branchId, tellerId: form.tellerId, values }));
      remembered.set('branch', form.branchId); remembered.set('teller', form.tellerId.trim());
    } catch (e) {
      if (e instanceof DeskError && e.problem.code === 'VALIDATION' && e.problem.issues?.length) {
        const mapped: Partial<Record<keyof FormState, string>> = {};
        for (const i of e.problem.issues) { const k = PATH_FIELD[i.path]; if (k && !mapped[k]) mapped[k] = sentence(i.message); }
        setErrors(mapped);
        if (e.problem.issues.some(i => !PATH_FIELD[i.path]) || !Object.keys(mapped).length) setFail('The request could not be checked. Check what you entered and try again, then reload the page if it keeps happening.');
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else if (e instanceof DeskError && e.problem.code === 'RULES_UNAVAILABLE') {
        setFail('The head-office rules could not be loaded, so this request was not checked. Your entries are still here. Ask head office to check the rules file.');
        requestAnimationFrame(() => summaryRef.current?.focus());
      } else {
        setFail(e instanceof DeskError && e.problem.code === 'RATE_LIMITED'
          ? 'Too many checks in a minute. Wait a moment, then try again. Your entries are still here.'
          : 'We could not reach the branch desk server. Your entries are still here. Try again in a moment.');
        requestAnimationFrame(() => summaryRef.current?.focus());
      }
    } finally { setBusy(false); }
  }

  function newRequest() {
    setRecord(null); setErrors({}); setFail('');
    setForm(f => ({ ...emptyForm(cfg), branchId: f.branchId, tellerId: f.tellerId }));
    requestAnimationFrame(() => document.getElementById('member-start')?.focus());
  }

  const errorList = (Object.keys(errors) as (keyof FormState)[]).filter(k => errors[k]);

  return (
    <>
      <a className="skip" href="#main">Skip to the form</a>
      <header className="bar no-print">
        <Logo />
        <Wordmark />
        <span className="desk-name">Branch desk</span>
        <span className="sp" />
        {cfg && <span className="who">Rules <strong className="ref">{cfg.ruleSet.id} · {cfg.ruleSet.version}</strong></span>}
      </header>

      {PROTOTYPE && (
        <p className="proto no-print">
          <strong>Prototype for stakeholder feedback.</strong> It runs in your browser with the interim rules and a sample rate; nothing is sent or saved.
          Do not enter real member details. Not an Alterna Savings service.
        </p>
      )}
      <main id="main" tabIndex={-1} className="page">
        {loadError && <div className="banner bad" role="alert"><strong>Not available.</strong> {loadError}</div>}
        {!cfg && !loadError && <p className="muted">Loading the head-office rules…</p>}

        {cfg && (
          <div className={`desk ${record ? 'has-record' : ''}`}>
            <form className="slip no-print" onSubmit={submit} noValidate aria-labelledby="form-title">
              <div className="slip-head">
                <h1 id="form-title">Currency exchange request</h1>
                <span className="small muted">Every field is required unless it says optional</span>
              </div>
              <fieldset className="slip-body" disabled={!!record || busy}>
                {(errorList.length > 0 || fail) && (
                  <div className="sum" ref={summaryRef} tabIndex={-1} role="alert">
                    {fail ? <p>{fail}</p> : <>
                      <strong>Fix {errorList.length === 1 ? 'this field' : `these ${errorList.length} fields`} before you check the request:</strong>
                      <ul>{errorList.map(k => <li key={k}><a href={`#f-${k}`} onClick={e => { e.preventDefault(); focusField(k); }}>{FIELD_NAME[k]}: {errors[k]}</a></li>)}</ul>
                    </>}
                  </div>
                )}

                <div className="row2">
                  <Field id="f-branchId" label="Branch" error={errors.branchId}>
                    <select className="in" value={form.branchId} onChange={e => set('branchId')(e.target.value)}>
                      <option value="">Choose a branch</option>
                      {cfg.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </Field>
                  <Field id="f-tellerId" label="Your staff ID" error={errors.tellerId}>
                    <input className="in" value={form.tellerId} onChange={e => set('tellerId')(e.target.value)} autoComplete="username" spellCheck={false} maxLength={20} />
                  </Field>
                </div>

                <h2 className="section" id="member-start" tabIndex={-1}>Member</h2>
                <Field id="f-memberName" label="Member name" hint="As it appears on the member’s ID." error={errors.memberName}>
                  <input className="in" value={form.memberName} onChange={e => set('memberName')(e.target.value)} autoComplete="off" spellCheck={false} maxLength={80} />
                </Field>
                <Field id="f-memberRef" label="Member reference" optional hint="The member or account reference from the banking system. Letters, digits, - and _." error={errors.memberRef}>
                  <input className="in" value={form.memberRef} onChange={e => set('memberRef')(e.target.value)} autoComplete="off" spellCheck={false} maxLength={40} />
                </Field>

                <h2 className="section">Exchange</h2>
                <div className="sale">
                  <Field id="f-amount" label="Member gives" hint="In figures, for example 250.00." error={errors.amount}>
                    <input className="in amt" inputMode="decimal" value={form.amount} onChange={e => set('amount')(e.target.value)} autoComplete="off" />
                  </Field>
                  <Field id="f-sellCurrency" label="Currency" error={errors.sellCurrency}>
                    <select className="in" value={form.sellCurrency} onChange={e => set('sellCurrency')(e.target.value)}>
                      {cfg.currencies.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field id="f-buyCurrency" label="Member receives" error={errors.buyCurrency}>
                    <select className="in" value={form.buyCurrency} onChange={e => set('buyCurrency')(e.target.value)}>
                      {cfg.currencies.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </Field>
                </div>
                <Estimate amount={form.amount.trim()} sell={form.sellCurrency} buy={form.buyCurrency} />

                <fieldset className={`f group ${errors.paymentMethod ? 'err' : ''}`} aria-describedby={errors.paymentMethod ? 'pm-err' : undefined}>
                  <legend className="lbl">Payment method</legend>
                  {cfg.paymentMethods.map(m => (
                    <label key={m} className="choice">
                      <input id={`f-paymentMethod-${m}`} type="radio" name="paymentMethod" value={m} checked={form.paymentMethod === m} onChange={() => set('paymentMethod')(m)} />
                      {PAYMENT_LABEL[m] ?? m}
                    </label>
                  ))}
                  {errors.paymentMethod && <span id="pm-err" className="msg">{errors.paymentMethod}</span>}
                </fieldset>

                <Field id="f-note" label="Note" optional hint="Up to 200 characters. Do not type card or ID numbers." error={errors.note}>
                  <textarea className="in" value={form.note} onChange={e => set('note')(e.target.value)} maxLength={200} />
                </Field>

                <div className="actions">
                  <button className="btn" type="submit" disabled={busy || !!record}>{busy ? 'Checking…' : 'Check request'}</button>
                </div>
              </fieldset>
            </form>

            {record && <RecordView record={record} headingRef={recordRef} onNew={newRequest} />}
          </div>
        )}
      </main>
      <footer className="foot no-print small muted">
        Interim branch desk {DESK_VERSION}. Rates are indicative. This page does not move money or keep a copy of the record: print or save it.
      </footer>
    </>
  );
}

function focusField(k: keyof FormState) {
  const el = document.getElementById(`f-${k}`) ?? document.querySelector<HTMLElement>(`[id^="f-${k}-"]`);
  el?.focus();
}

const sentence = (s: string) => { const t = s.charAt(0).toUpperCase() + s.slice(1); return /[.!?]$/.test(t) ? t : `${t}.`; };

// ---------- live estimate (advisory; never used by the rules) ----------

function Estimate({ amount, sell, buy }: { amount: string; sell: string; buy: string }) {
  const [q, setQ] = useState<{ state: 'idle' | 'ok' | 'none' | 'error'; quote?: QuoteView }>({ state: 'idle' });
  useEffect(() => {
    if (!/^\d+(\.\d+)?$/.test(amount) || !sell || !buy || sell === buy) { setQ({ state: 'idle' }); return; }
    let live = true;
    const t = setTimeout(() => {
      getQuote(amount, sell, buy)
        .then(r => { if (live) setQ(r.available ? { state: 'ok', quote: r.quote } : { state: 'none' }); })
        .catch(() => { if (live) setQ({ state: 'error' }); });
    }, 400);
    return () => { live = false; clearTimeout(t); };
  }, [amount, sell, buy]);

  return (
    <div className="give">
      <h3>Estimate: you give the member</h3>
      <div aria-live="polite" aria-atomic="true">
      {q.state === 'idle' && <p className="muted">Enter an amount to see an estimate.</p>}
      {q.state === 'ok' && q.quote && <>
        <p className="fig">{fmtAmount(q.quote.give.amount, q.quote.give.currency)}</p>
        <p className="small muted">{rateLine(q.quote.rate, sell, buy)}, rounded down to the cent. The record shows the estimate at the time of the check.</p>
        {q.quote.stale && <p className="stale small">The rate could not be refreshed. This estimate uses the last rate we had.</p>}
      </>}
      {q.state === 'none' && <p className="muted">No estimate for this amount or pair. Use the rate in the banking system.</p>}
      {q.state === 'error' && <p className="muted">The estimate is not available right now. You can still check the request.</p>}
      </div>
    </div>
  );
}

// ---------- the printable record ----------

function RecordView({ record: r, headingRef, onNew }: { record: DeskRecord; headingRef: Ref<HTMLHeadingElement>; onNew: () => void }) {
  const t = TONE[r.result.kind];
  const subject = `Exchange record ${r.recordNo}, ${r.branch.name}: ${r.result.label}`;
  const body = `Please confirm the attached exchange record ${r.recordNo} (${r.result.label}).\n\nStaff ID: ${r.tellerId}\n`;
  const mailto = `mailto:${r.confirmationEmail}?${new URLSearchParams({ subject, body }).toString().replace(/\+/g, '%20')}`;

  return (
    <section className={`record ${t.tone}`} aria-labelledby="record-title">
      <div className="record-paper">
        {PROTOTYPE && <p className="proto-record">Prototype: sample data, not a real record</p>}
        <header className="record-head">
          <div>
            <p className="record-brand"><Logo /><Wordmark /></p>
            <h2 id="record-title" ref={headingRef} tabIndex={-1}>Exchange decision record<span className="vh">: {r.result.label}</span></h2>
            <p className="ref">No. {r.recordNo}</p>
          </div>
          <p className={`stamp ${t.tone}`}><span className={`mark ${t.tone}`}><i aria-hidden="true">{t.glyph}</i></span>{r.result.label}</p>
        </header>

        <div className="next">
          {r.result.reasonText && <p><strong>{r.result.reasonText}</strong></p>}
          <p>{r.result.nextStep}</p>
        </div>

        <dl className="kv">
          <dt>Date and time</dt><dd>{r.branchLocalTime} <span className="muted small">({r.branch.timezone})</span></dd>
          <dt>Branch</dt><dd>{r.branch.name} <span className="ref">{r.branch.id}</span></dd>
          <dt>Staff ID</dt><dd className="ref">{r.tellerId}</dd>
          <dt>Member name</dt><dd>{r.member.name}</dd>
          {r.member.ref && <><dt>Member reference</dt><dd className="ref">{r.member.ref}</dd></>}
          <dt>Member gives</dt><dd className="money">{fmtAmount(r.request.sell.amount, r.request.sell.currency)}</dd>
          <dt>Member receives</dt>
          <dd>{r.quote
            ? <><span className="money">{fmtAmount(r.quote.give.amount, r.quote.give.currency)}</span> <span className="muted small">estimate</span></>
            : <>{r.request.buyCurrency} <span className="muted small">(no estimate: use the rate in the banking system)</span></>}</dd>
          {r.quote && <><dt>Rate</dt><dd>{rateLine(r.quote.rate, r.request.sell.currency, r.request.buyCurrency)} <span className="muted small">indicative, feed time {r.quote.feedUpdatedAt}{r.quote.stale ? ', not refreshed' : ''}</span></dd></>}
          <dt>Payment method</dt><dd>{PAYMENT_LABEL[r.request.paymentMethod] ?? r.request.paymentMethod}</dd>
          {r.request.note && <><dt>Note</dt><dd>{r.request.note}</dd></>}
        </dl>

        <dl className="kv meta small">
          <dt>Rules</dt><dd>{r.ruleSet.id}, version {r.ruleSet.version}, {r.ruleSet.status === 'APPROVED' ? `approved by ${r.ruleSet.approvedBy} on ${r.ruleSet.approvedOn}` : 'status trial'}</dd>
          <dt>Checked</dt><dd>{r.createdAt.slice(0, 16).replace('T', ' ')} UTC · engine {r.engine.version} · desk {DESK_VERSION}</dd>
          <dt>Fingerprint</dt><dd className="ref">rules {short(r.ruleSet.policyHash)} · request {short(r.engine.contextHash)}</dd>
        </dl>

        <div className="sign">
          <Sign label="Staff signature" />
          <Sign label="Head-office confirmation (name, signature)" />
        </div>
        <p className="small muted fine">Produced by the ExchangeFlow interim branch desk. It records the result of the head-office rules for this request; it is not a transaction. Amounts received are estimates; the banking system is the record of what was exchanged.</p>
      </div>

      <div className="actions no-print">
        <button className="btn" type="button" onClick={() => window.print()}>Print or save as PDF</button>
        <a className="btn sec" href={mailto}>Email head office</a>
        <button className="btn quiet" type="button" onClick={onNew}>New request</button>
      </div>
      <p className="small muted no-print">To email it: choose “Save as PDF” in the print window, then attach the PDF to the email to {r.confirmationEmail}.</p>
    </section>
  );
}

const Sign = ({ label }: { label: ReactNode }) => (
  <div className="sign-line"><span className="line" /><span className="small">{label}</span><span className="line short" /><span className="small">Date</span></div>
);
