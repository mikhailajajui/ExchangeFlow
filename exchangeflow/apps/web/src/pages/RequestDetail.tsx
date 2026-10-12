import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Detail } from '../api';
import { GiveFigure, QuoteNote, rateLine } from '../quote';
import { ACTION_LABEL, Banner, DECISION_LABEL, Field, fmtAmount, Modal, Money, OUTCOME_LABEL, StatusMark, WOULD_BE_LABEL, ago, causeLabel, errorMessage, fmtTime } from '../ui';
import { useSession, has } from '../App';

type Dlg = null | 'escalate' | 'cancel' | 'complete';
const ROUND_STARTS = ['request.submitted', 'request.resubmitted', 'request.escalated'];

export function RequestDetail() {
  const { id } = useParams();
  const { actor } = useSession();
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [dlg, setDlg] = useState<Dlg>(null);
  const [text, setText] = useState('');
  const [exec, setExec] = useState({ handedOver: '', given: '', rate: '', reference: '' });
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const h1 = useRef<HTMLHeadingElement>(null);

  const load = useCallback(() => api<Detail>(`/requests/${id}`).then(x => { setD(x); setErr(''); }, e => setErr(errorMessage(e))), [id]);
  useEffect(() => { load(); }, [load]);
  // After an action the control that was used may be gone, so focus returns to the page heading.
  useEffect(() => { if (tick) h1.current?.focus(); }, [tick]);

  if (err && !d) return <div className="stack"><Banner tone="bad">{err}</Banner><Link to="/requests">Back to requests</Link></div>;
  if (!d) return <div className="muted" role="status">Loading…</div>;
  const r = d.request, can = (a: string) => r.allowedActions.includes(a);
  const infoReq = [...d.reviews].reverse().find(x => x.decisionType === 'REQUEST_INFO');
  const reviewer = has(actor, 'REVIEWER');
  const showPanel = can('REVIEW_APPROVE');
  // Present only once the API has released it (managers and policy approvers always; reviewers after deciding that cycle).
  const engine = [...d.decisions].reverse().find(x => x.shadow !== undefined);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setErr(''); setMsg('');
    try { await fn(); setMsg(ok); setDlg(null); setText(''); await load(); setTick(t => t + 1); }
    catch (e) { setErr(errorMessage(e)); if ((e as { code?: string }).code === 'STALE_REQUEST') await load(); }
    finally { setBusy(false); }
  };
  const ev = { expectedVersion: r.version };
  const openComplete = () => { setExec({ handedOver: r.values.sell.amount, given: d.quote?.give.amount ?? '', rate: d.quote?.rate ?? '', reference: '' }); setDlg('complete'); };
  const foreign = r.values.sell.currency === 'CAD' ? r.values.buyCurrency : r.values.sell.currency;
  const execReady = exec.reference.trim().length >= 3 && exec.handedOver.trim() !== '' && exec.given.trim() !== '' && exec.rate.trim() !== '';
  const completeBody = { handedOver: { amount: exec.handedOver.trim(), currency: r.values.sell.currency }, given: { amount: exec.given.trim(), currency: r.values.buyCurrency }, rateApplied: exec.rate.trim(), reference: exec.reference.trim() };

  let round = 0;
  const history = d.history.flatMap(h => {
    const starts = ROUND_STARTS.includes(h.action);
    if (starts) round++;
    return [...(starts ? [{ round }] : []), { h }] as ({ round: number } | { h: Detail['history'][number] })[];
  });

  const history_ = (
    <section className="sheet">
      <h2>History</h2>
      <ol className="timeline">
        {history.map((x, i) => 'round' in x
          ? <li key={`r${i}`}><div className="round">Round {x.round}</div></li>
          : <li key={x.h.n}><span className="when">{fmtTime(x.h.at)}</span><div className={`what ${x.h.action.startsWith('review.') ? 'cycle' : ''}`}><strong>{ACTION_LABEL[x.h.action] ?? 'Update recorded'}</strong><div className="who2">{x.h.actor}, entry {x.h.n}</div></div></li>)}
      </ol>
    </section>
  );

  return (
    <div>
      <div className="crumbs"><Link to={reviewer ? '/review' : '/requests'}>{reviewer ? 'Back to review queue' : 'Back to requests'}</Link></div>
      <div className="head">
        <div>
          <h1 tabIndex={-1} ref={h1}>Request <code>{r.shortId}</code></h1>
          <div className="status-line"><StatusMark status={r.status} />{r.escalated && <span className="tag">Escalated</span>}<span className="muted small">Round {r.cycle}, branch {r.branchId}</span></div>
        </div>
        <div className="actions">
          {can('SUBMIT') && <Link className="btn" to={`/requests/${r.id}/edit`}>Edit and submit</Link>}
          {can('ESCALATE') && <button type="button" className="btn" onClick={() => setDlg('escalate')}>Escalate</button>}
          {can('RESUBMIT') && <Link className="btn" to={`/requests/${r.id}/resubmit`}>Update and resubmit</Link>}
          {can('COMPLETE') && <button type="button" className="btn" onClick={openComplete}>Record completion</button>}
          {can('CANCEL') && <button type="button" className="btn neg" onClick={() => setDlg('cancel')}>Cancel request</button>}
        </div>
      </div>
      {msg && <Banner tone="good">{msg}</Banner>}
      {err && <Banner tone="bad">{err}</Banner>}
      {r.status === 'MORE_INFO_NEEDED' && infoReq && <div className="sheet warn stack"><p><strong>The reviewer asked:</strong> {infoReq.reason}</p></div>}

      <div className="two">
        <div className="stack">
          <section className="sheet">
            <h2>Request</h2>
            <dl className="kv">
              <dt>Member name</dt><dd>{r.values.memberName || <span className="muted">Not recorded</span>}</dd>
              <dt>Submitted by</dt><dd>{r.submittedBy}</dd>
              <dt>Member sells</dt><dd className={`money ${showPanel ? 'big' : ''}`}><Money amount={r.values.sell.amount} currency={r.values.sell.currency} /></dd>
              <dt>Member buys</dt><dd>{r.values.buyCurrency}</dd>
              <dt>Type</dt><dd>{r.values.requestType === 'WIRE' ? 'Wire' : 'Exchange'}</dd>
              <dt>Payment</dt><dd>{{ ACCOUNT: 'From account', CASH: 'Cash', OTHER: 'Other' }[r.values.paymentMethod] ?? r.values.paymentMethod}</dd>
              <dt>Member ref</dt><dd>{r.values.memberRef ? <code>{r.values.memberRef}</code> : <span className="muted">None</span>}</dd>
              {r.values.note && <><dt>Note</dt><dd>{r.values.note}</dd></>}
            </dl>
            <details className="details">
              <summary>Details</summary>
              <dl className="kv">
                <dt>Opened</dt><dd>{fmtTime(r.createdAt)}</dd>
                <dt>Version</dt><dd>{r.version}</dd>
                {d.history.some(h => h.seq !== undefined) && <><dt>Audit trail</dt><dd><ul className="plain">{d.history.map(h => <li key={h.n}><code>#{h.seq} {h.hash}</code> {ACTION_LABEL[h.action] ?? 'Update recorded'}</li>)}</ul></dd></>}
              </dl>
            </details>
          </section>

          {d.completion && (
            <section className="sheet" aria-labelledby="done-h">
              <h2 id="done-h">Completion</h2>
              <dl className="kv">
                <dt>Gave</dt><dd className="money big"><Money amount={d.completion.given.amount} currency={d.completion.given.currency} /></dd>
                <dt>Rate applied</dt><dd><span className="money">{d.completion.rateApplied}</span> {d.completion.rateSide === 'OTHER' ? '' : `CAD per ${foreign}`}</dd>
                <dt>Handed over by the member</dt><dd><Money amount={d.completion.handedOver.amount} currency={d.completion.handedOver.currency} /></dd>
                <dt>Reference</dt><dd><code>{d.completion.reference}</code></dd>
                <dt>Completed by</dt><dd>{d.completion.completedBy}, {fmtTime(d.completion.completedAt)}</dd>
              </dl>
              {d.completion.differsFromQuote && d.completion.quotedGive && (
                <p className="small muted">Quoted at submit: {fmtAmount(d.completion.quotedGive.amount, d.completion.quotedGive.currency)}. Differs from the quote.</p>
              )}
            </section>
          )}

          {r.cycle > 0 && (
            <section className="sheet" aria-labelledby="give-h">
              <h2 id="give-h">Give the member</h2>
              {d.quote ? (
                <>
                  <p className="money big"><GiveFigure quote={d.quote} /></p>
                  <p className="small">{rateLine(d.quote)}, calculated {ago(d.quote.snapshot.fetchedAt)}.</p>
                  <QuoteNote quote={d.quote} />
                  {r.status === 'APPROVED' && Date.now() - new Date(d.quote.snapshot.fetchedAt).getTime() > 15 * 60_000 && (
                    <p className="notice" role="note">Rate may have changed since submit. Check the rate board before you hand over cash.</p>
                  )}
                </>
              ) : <p className="muted">No rate was recorded at submit. Check the rate board.</p>}
            </section>
          )}

          <section className="sheet">
            <h2>Decision</h2>
            {d.decisions.length === 0 && <p className="muted">Not submitted yet. Submit the request to get a decision.</p>}
            {[...d.decisions].reverse().map(x => (
              <p key={x.cycle} className="decision-line"><strong>{OUTCOME_LABEL[x.appliedOutcome] ?? 'Sent to head-office review'}</strong> <span className="muted small">Round {x.cycle}, {fmtTime(x.asOf)}</span><br />
                {x.reasonText}{x.cause && x.appliedOutcome === 'HUMAN_REVIEW' ? <><br /><span className="muted small">Why it is here: {causeLabel(x.cause)}</span></> : null}</p>
            ))}
            {d.reviews.length > 0 && <h3>Reviewer</h3>}
            {d.reviews.map(x => <p key={x.cycle}><strong>{DECISION_LABEL[x.decisionType] ?? 'Decided'}</strong> <span className="muted small">{fmtTime(x.at)}</span>{x.reason ? <><br />{x.reason}</> : null}</p>)}
          </section>

          {engine && (
            <details className="engine">
              <summary>How the engine decided</summary>
              <div className="in-body">
                <dl className="kv">
                  <dt>Result</dt><dd>{OUTCOME_LABEL[engine.appliedOutcome] ?? 'Sent to head-office review'}</dd>
                  <dt>Reason</dt><dd>{engine.reasonText}</dd>
                  {engine.cause && <><dt>Routing</dt><dd>{causeLabel(engine.cause)}</dd></>}
                  <dt>Checked</dt><dd>{fmtTime(engine.asOf)}</dd>
                  {engine.shadow && engine.shadow.length > 0 && <><dt>Test rules</dt><dd>{engine.shadow.map(s => `${s.ruleKey} ${WOULD_BE_LABEL[s.wouldBe] ?? 'would send to head-office review'}`).join('; ')}</dd></>}
                  {engine.alerts && engine.alerts.length > 0 && <><dt>Notes</dt><dd>{engine.alerts.map(a => causeLabel(a)).join('; ')}</dd></>}
                </dl>
              </div>
            </details>
          )}
          {showPanel && history_}
        </div>
        {showPanel ? <DecisionPanel busy={busy} run={run} id={r.id} ev={ev} /> : history_}
      </div>

      {dlg === 'escalate' && <Reason title="Escalate to head office" help="An automatic decline can be escalated once. The reviewer sees the original decision." label="Reason" text={text} setText={setText} busy={busy} err={err} onClose={() => setDlg(null)}
        cta="Escalate" onOk={() => run(() => api(`/requests/${r.id}/escalate`, { body: { reason: text, ...ev } }), 'Escalated to head office.')} />}
      {dlg === 'cancel' && <Reason title="Cancel request" help="This cannot be undone." label="Reason" text={text} setText={setText} busy={busy} err={err} onClose={() => setDlg(null)}
        cta="Cancel request" onOk={() => run(() => api(`/requests/${r.id}/cancel`, { body: { reason: text, ...ev } }), 'Request cancelled.')} />}
      {dlg === 'complete' && (
        <Modal title="Record completion" onClose={() => setDlg(null)}>
          <p className="muted small">Enter what you actually handed over, even if it differs from the quote.</p>
          <Field label={`Amount the member handed over (${r.values.sell.currency})`}><input data-initial inputMode="decimal" autoComplete="off" value={exec.handedOver} onChange={e => setExec({ ...exec, handedOver: e.target.value })} /></Field>
          <Field label={`Amount you gave the member (${r.values.buyCurrency})`} hint={d.quote ? undefined : 'No quote was recorded. Enter the amount you gave.'}><input inputMode="decimal" autoComplete="off" value={exec.given} onChange={e => setExec({ ...exec, given: e.target.value })} /></Field>
          <Field label={`Rate applied (CAD per ${foreign})`} hint={d.quote ? undefined : 'No quote was recorded. Enter the rate you used.'}><input inputMode="decimal" autoComplete="off" value={exec.rate} onChange={e => setExec({ ...exec, rate: e.target.value })} /></Field>
          <Field label="Transaction reference" hint="3 to 40 letters, digits, - and _."><input value={exec.reference} autoComplete="off" autoCapitalize="off" spellCheck={false} onChange={e => setExec({ ...exec, reference: e.target.value })} /></Field>
          {err && <p className="small" role="alert">{err}</p>}
          <div className="actions"><button type="button" className="btn" disabled={busy || !execReady} onClick={() => run(() => api(`/requests/${r.id}/complete`, { body: { ...completeBody, ...ev } }), 'Completed. What you gave was recorded.')}>Record completion</button>
            <button type="button" className="btn quiet" onClick={() => setDlg(null)}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}

function DecisionPanel({ busy, run, id, ev }: { busy: boolean; run: (fn: () => Promise<unknown>, ok: string) => Promise<void>; id: string; ev: { expectedVersion: number } }) {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirming) back.current?.focus(); }, [confirming]);
  const ok = reason.trim().length >= 3;
  const decide = (decision: 'APPROVE' | 'DECLINE' | 'REQUEST_INFO', done: string) => run(() => api(`/review/${id}/decision`, { body: { decision, reason: reason.trim() || undefined, ...ev } }), done);
  return (
    <aside className="decide sticky" aria-labelledby="dp">
      <header><h2 id="dp">Your decision</h2></header>
      <div className="body">
        <p className="muted small">You cannot decide a request you submitted. Declining or asking for information needs a reason.</p>
        <Field label="Reason" hint="Needed to decline or ask for information. The teller sees it."><textarea rows={3} maxLength={300} value={reason} onChange={e => setReason(e.target.value)} /></Field>
        {confirming ? (
          <div className="confirm" role="group" aria-labelledby="confirm-h">
            <p id="confirm-h"><strong>Approve this request?</strong> This is recorded and cannot be undone.</p>
            <div className="row">
              <button type="button" className="btn approve" disabled={busy} onClick={() => decide('APPROVE', 'Approved.')}>Confirm approve</button>
              <button type="button" className="btn sec" ref={back} onClick={() => setConfirming(false)}>Back</button>
            </div>
          </div>
        ) : (
          <>
            <div className="row">
              <button type="button" className="btn approve" disabled={busy} onClick={() => setConfirming(true)}>Approve</button>
              <button type="button" className="btn neg" disabled={!ok || busy} aria-describedby="why-off" onClick={() => decide('DECLINE', 'Declined.')}>Decline</button>
              <button type="button" className="btn sec" disabled={!ok || busy} aria-describedby="why-off" onClick={() => decide('REQUEST_INFO', 'Information requested.')}>Ask for information</button>
            </div>
            <p className="muted small" id="why-off">Decline and Ask for information turn on when you write a reason of at least 3 characters.</p>
          </>
        )}
      </div>
    </aside>
  );
}

function Reason(p: { title: string; help: ReactNode; label: string; text: string; setText: (s: string) => void; busy: boolean; err: string; onClose: () => void; onOk: () => void; cta: string }) {
  const ok = p.text.trim().length >= 3;
  return (
    <Modal title={p.title} onClose={p.onClose}>
      <p className="muted small">{p.help}</p>
      <Field label={p.label} hint="At least 3 characters."><textarea data-initial rows={4} value={p.text} onChange={e => p.setText(e.target.value)} maxLength={300} /></Field>
      {p.err && <p className="small" role="alert">{p.err}</p>}
      <div className="actions"><button type="button" className="btn" disabled={!ok || p.busy} onClick={p.onOk}>{p.cta}</button><button type="button" className="btn quiet" onClick={p.onClose}>Cancel</button></div>
    </Modal>
  );
}
