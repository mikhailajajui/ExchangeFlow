import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { Banner, Field, Mark, Modal, TableRegion, errorMessage } from '../ui';

interface Status {
  controlRevision: number; globalPaused: boolean; pausedRuleIds: string[]; environment: string; canPause: boolean; canResume: boolean;
  /** `hash` is present only for policy approvers, managers and compliance. */
  policy: { id: string; number: number; hash?: string; rules: { ruleKey: string; outcome: string; mode: string; nonProduction: boolean }[] } | null;
}
const RESULT: Record<string, string> = { AUTO_APPROVE: 'Approves', AUTO_DECLINE: 'Declines', HUMAN_REVIEW: 'Needs a person' };
type Dlg = { kind: 'pause' | 'resume'; ruleKey?: string };
const dlgName = (d: Dlg) => `${d.kind === 'pause' ? 'Pause' : 'Resume'} ${d.ruleKey ? `rule ${d.ruleKey}` : 'the whole engine'}`;

export function EnginePanel() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const [dlg, setDlg] = useState<Dlg | null>(null);
  const [reason, setReason] = useState('');
  const load = useCallback(() => api<Status>('/engine').then(setS, e => setErr(errorMessage(e))), []);
  useEffect(() => { load(); }, [load]);
  if (!s) return <div className="muted" role="status">{err || 'Loading…'}</div>;
  const act = async () => {
    try { await api(`/engine/${dlg!.kind}`, { body: { reason, ruleKey: dlg!.ruleKey } }); setOk(`${dlg!.kind === 'pause' ? 'Paused' : 'Resumed'}${dlg!.ruleKey ? ' rule ' + dlg!.ruleKey : ' the engine'}.`); setDlg(null); setReason(''); setErr(''); load(); }
    catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <div>
      <div className="head"><div><h1>Decision engine</h1>
        <p className="muted">Policy v{s.policy?.number}{s.policy?.hash ? <>, hash <code>{s.policy.hash}</code></> : null}, control revision {s.controlRevision}, {s.environment === 'dev' ? 'test environment' : s.environment}</p></div>
        <div className="actions">
          {!s.globalPaused && s.canPause && <button type="button" className="btn neg" onClick={() => setDlg({ kind: 'pause' })}>Pause the whole engine</button>}
          {s.globalPaused && s.canResume && <button type="button" className="btn" onClick={() => setDlg({ kind: 'resume' })}>Resume the whole engine</button>}
        </div></div>
      {ok && <Banner tone="good">{ok}</Banner>}{err && <Banner tone="bad">{err}</Banner>}
      {s.globalPaused && <div className="paused-band" role="status"><Mark tone="info">Engine paused</Mark> Every new request goes to head-office review. Pausing only makes outcomes more careful.</div>}
      <TableRegion label="Rules, scrollable">
        <table className="ledger">
          <caption className="hidden-visually">Rules in the current policy</caption>
          <thead><tr><th scope="col">Rule</th><th scope="col">Result</th><th scope="col">Mode</th><th scope="col">State</th><th scope="col"><span className="hidden-visually">Action</span></th></tr></thead>
          <tbody>{s.policy?.rules.map(r => {
            const paused = s.pausedRuleIds.includes(r.ruleKey);
            return (
              <tr key={r.ruleKey} className={paused ? 'r-info' : 'r-good'}>
                <td><code>{r.ruleKey}</code>{r.nonProduction && <span className="tag">test rule</span>}</td>
                <td>{RESULT[r.outcome] ?? 'Needs a person'}</td><td>{r.mode === 'SHADOW' ? 'Shadow' : 'Live'}</td>
                <td>{paused ? <Mark tone="info">Paused</Mark> : <Mark tone="good">Live</Mark>}</td>
                <td className="n">
                  {!paused && s.canPause && <button type="button" className="btn sm sec" onClick={() => setDlg({ kind: 'pause', ruleKey: r.ruleKey })}>Pause<span className="hidden-visually"> rule {r.ruleKey}</span></button>}
                  {paused && s.canResume && <button type="button" className="btn sm sec" onClick={() => setDlg({ kind: 'resume', ruleKey: r.ruleKey })}>Resume<span className="hidden-visually"> rule {r.ruleKey}</span></button>}
                </td>
              </tr>);
          })}</tbody>
        </table>
      </TableRegion>
      {dlg && (
        <Modal title={dlgName(dlg)} onClose={() => { setDlg(null); setReason(''); }}>
          <Field label="Reason (required)" hint="At least 3 characters. It is kept in the record."><textarea rows={3} data-initial value={reason} onChange={e => setReason(e.target.value)} /></Field>
          {err && <p className="small" role="alert">{err}</p>}
          <div className="actions"><button type="button" className="btn" disabled={reason.trim().length < 3} onClick={act}>{dlgName(dlg)}</button><button type="button" className="btn quiet" onClick={() => { setDlg(null); setReason(''); }}>Cancel</button></div>
        </Modal>
      )}
    </div>
  );
}
