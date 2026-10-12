import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type RequestView } from '../api';
import { Banner, Money, PauseUpdates, StatusMark, TableRegion, ago, errorMessage, fmtTime, rowTone, usePolling } from '../ui';
import { MemberGets } from '../quote';
import { useSession, has } from '../App';

const TABS = [
  { key: 'all', label: 'All branch requests', q: '' },
  { key: 'mine', label: 'My requests', q: 'scope=mine' },
  { key: 'attention', label: 'Needs my action', q: 'status=MORE_INFO_NEEDED,AUTO_DECLINED,APPROVED' },
  { key: 'drafts', label: 'Drafts', q: 'status=DRAFT' },
];
/** A teller has something to do on these; they sort first. Escalation is offered once per request. */
const needsAction = (r: RequestView) => r.status === 'MORE_INFO_NEEDED' || r.status === 'APPROVED' || (r.status === 'AUTO_DECLINED' && !r.escalated);

export function Requests() {
  const { actor } = useSession();
  const nav = useNavigate();
  const [tab, setTab] = useState('all');
  const [rows, setRows] = useState<RequestView[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => {
    const q = TABS.find(t => t.key === tab)!.q;
    api<RequestView[]>('/requests' + (q ? `?${q}` : '')).then(r => { setRows(r); setErr(''); }, e => setErr(errorMessage(e)));
  }, [tab]);
  useEffect(() => { setRows(null); load(); }, [load]);
  usePolling(load);
  const staff = has(actor, 'STAFF');
  const sorted = rows && (staff ? [...rows].sort((a, b) => Number(needsAction(b)) - Number(needsAction(a))) : rows);
  const attention = rows?.filter(needsAction).length ?? 0;
  return (
    <div>
      <div className="head">
        <div><h1>Requests</h1><p className="muted">Exchange requests for {actor.branchId ?? 'all branches'}.{rows && staff ? ` ${attention} ${attention === 1 ? 'needs' : 'need'} your action.` : ''}</p></div>
        {staff && <Link className="btn" to="/requests/new">New request</Link>}
      </div>
      <div className="filters" role="group" aria-label="Filter by status">
        {TABS.map(t => <button key={t.key} type="button" aria-pressed={tab === t.key} onClick={() => setTab(t.key)}>{t.label}</button>)}
        <span className="sp" /><PauseUpdates />
      </div>
      {err && <Banner tone="bad">{err}</Banner>}
      <TableRegion label="Requests, scrollable">
        <table className="ledger">
          <caption className="hidden-visually">Requests</caption>
          <thead><tr><th scope="col">Status</th><th scope="col">Ref</th><th scope="col">Member</th><th scope="col">Type</th><th scope="col" className="n">Member sells</th><th scope="col">Buys</th><th scope="col" className="n">Member gets</th><th scope="col">Submitted by</th><th scope="col">Updated</th></tr></thead>
          <tbody>
            {sorted === null && <tr><td colSpan={9} className="empty">Loading…</td></tr>}
            {sorted?.length === 0 && <tr><td colSpan={9} className="empty">No requests here yet. {staff && <Link to="/requests/new">Start with a new request.</Link>}</td></tr>}
            {sorted?.map(r => (
              <tr key={r.id} className={`click ${rowTone(r.status)}`} onClick={() => nav(`/requests/${r.id}`)}>
                <td><StatusMark status={r.status} />{r.escalated && <span className="tag">Escalated</span>}</td>
                <td><Link className="ref" to={`/requests/${r.id}`} onClick={e => e.stopPropagation()}>{r.shortId}</Link></td>
                <td>{r.values.memberName}</td>
                <td>{r.values.requestType === 'WIRE' ? 'Wire' : 'Exchange'}</td>
                <td className="n"><Money amount={r.values.sell.amount} currency={r.values.sell.currency} /></td>
                <td>{r.values.buyCurrency}</td>
                <td className="n"><MemberGets give={r.give} /></td>
                <td>{r.submittedBy}</td>
                <td className="muted" title={fmtTime(r.updatedAt)}>{ago(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableRegion>
    </div>
  );
}
