import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type RequestView } from '../api';
import { MemberGets } from '../quote';
import { Banner, Meter, Money, PauseUpdates, TableRegion, causeLabel, errorMessage, usePolling, waiting } from '../ui';

type Row = RequestView & { cause?: string; escalatedItem: boolean };
const age = (r: Row) => Date.now() - new Date(r.updatedAt).getTime();

export function ReviewQueue() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const seen = useRef<Set<string> | null>(null);
  const load = useCallback(() => api<Row[]>('/review/queue').then(r => {
    // New arrivals are announced, never inserted above the row the reviewer is on: the API order is oldest first, so they land at the end.
    if (seen.current) { const n = r.filter(x => !seen.current!.has(x.id)).length; if (n) setNote(`${n} new ${n === 1 ? 'request' : 'requests'} in the queue.`); }
    seen.current = new Set(r.map(x => x.id));
    setRows(r); setErr('');
  }, e => setErr(errorMessage(e))), []);
  useEffect(() => { load(); }, [load]);
  usePolling(load);
  const longest = rows && rows.length ? Math.max(...rows.map(age)) : 0;
  return (
    <div>
      <div className="head"><div><h1>Review queue</h1>
        <p className="muted">{rows ? `${rows.length} waiting.${rows.length ? ` Longest wait ${waiting(rows.reduce((a, b) => (age(b) > age(a) ? b : a)).updatedAt)}.` : ''} Oldest first.` : 'Loading…'}</p></div></div>
      <div className="filters"><PauseUpdates /></div>
      <p className="hidden-visually" role="status">{note}</p>
      {err && <Banner tone="bad">{err}</Banner>}
      <TableRegion label="Requests waiting for review, scrollable">
        <table className="ledger">
          <caption className="hidden-visually">Requests waiting for review, oldest first</caption>
          <thead><tr><th scope="col">Waiting</th><th scope="col">Ref</th><th scope="col">Branch</th><th scope="col">Member</th><th scope="col">Submitted by</th><th scope="col" className="n">Member sells</th><th scope="col">Buys</th><th scope="col" className="n">Member gets</th><th scope="col">Why it is here</th><th scope="col"><span className="hidden-visually">Open</span></th></tr></thead>
          <tbody>
            {rows === null && <tr><td colSpan={10} className="empty">Loading…</td></tr>}
            {rows?.length === 0 && <tr><td colSpan={10} className="empty">Nothing is waiting. New requests appear here by themselves.</td></tr>}
            {rows?.map(r => (
              <tr key={r.id} className="click r-review" onClick={() => nav(`/requests/${r.id}`)}>
                <td><div className="age"><Meter fraction={longest ? age(r) / longest : 0} /><strong>{waiting(r.updatedAt)}</strong></div></td>
                <td><Link className="ref" to={`/requests/${r.id}`} onClick={e => e.stopPropagation()}>{r.shortId}</Link></td>
                <td>{r.branchId}</td>
                <td>{r.values.memberName}</td>
                <td>{r.submittedBy}</td>
                <td className="n"><Money amount={r.values.sell.amount} currency={r.values.sell.currency} /></td>
                <td>{r.values.buyCurrency}</td>
                <td className="n"><MemberGets give={r.give} /></td>
                <td>{r.escalatedItem && <span className="tag">Escalated by teller</span>}{r.cause ? <span className="tag">{causeLabel(r.cause)}</span> : null}</td>
                <td><Link className="btn sm sec" to={`/requests/${r.id}`} onClick={e => e.stopPropagation()}>Open<span className="hidden-visually"> request {r.shortId}</span></Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableRegion>
    </div>
  );
}
