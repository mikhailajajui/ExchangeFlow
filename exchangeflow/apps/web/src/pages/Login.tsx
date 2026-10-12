import { useEffect, useState } from 'react';
import { api, type Actor } from '../api';
import { errorMessage } from '../ui';

interface DevUser { id: string; displayName: string; roles: string[]; branchName: string | null }
const ROLE: Record<string, string> = { STAFF: 'Teller', REVIEWER: 'Head-office reviewer', POLICY_APPROVER: 'Policy approver', MANAGER: 'Branch manager', COMPLIANCE: 'Compliance' };

export function Login({ onLogin }: { onLogin: (a: Actor) => void }) {
  const [users, setUsers] = useState<DevUser[]>([]);
  const [err, setErr] = useState('');
  // The dev picker exists only in a development build; the production bundle contains neither the call nor the list.
  useEffect(() => { if (import.meta.env.DEV) api<DevUser[]>('/dev/users').then(setUsers, e => setErr(errorMessage(e))); }, []);
  const go = async (userId: string) => {
    try { const r = await api<{ actor: Actor }>('/session', { method: 'POST', body: { userId } }); onLogin(r.actor); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <div className="login">
      {import.meta.env.DEV && <div className="env">Test environment. Sample data only.</div>}
      <main className="slip login-slip" id="main">
        <div className="slip-head"><h1>Sign in</h1><span className="brand">Exchange<span className="wordmark-flow">Flow</span></span></div>
        <div className="slip-body">
          {import.meta.env.DEV ? (
            <>
              <p className="muted prose">Choose a test user. In production you sign in with your credit union account.</p>
              {err && <div className="banner bad" role="alert"><strong>Problem.</strong> {err} Check that the server is running (pnpm dev).</div>}
              <div className="user-list">
                {users.map(u => (
                  <button type="button" key={u.id} className="user-row" onClick={() => go(u.id)}>
                    <strong>{u.displayName}</strong>
                    <span className="role">{u.roles.map(r => ROLE[r] ?? r).join(', ')}{u.branchName ? `, ${u.branchName}` : ''}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className="muted prose">Sign in with your credit union account.</p>
              {err && <div className="banner bad" role="alert"><strong>Problem.</strong> {err}</div>}
              <button type="button" className="btn" disabled>Sign in with your credit union account</button>
              <p className="small muted">Single sign-on is not connected in this build.</p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
