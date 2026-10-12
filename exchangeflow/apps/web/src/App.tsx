import { useCallback, useEffect, useState, createContext, useContext } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { api, type Actor } from './api';
import { Login } from './pages/Login';
import { Requests } from './pages/Requests';
import { RequestForm } from './pages/RequestForm';
import { RequestDetail } from './pages/RequestDetail';
import { ReviewQueue } from './pages/ReviewQueue';
import { EnginePanel } from './pages/EnginePanel';
import { Inbox } from './pages/Inbox';

interface Session { actor: Actor; setActor: (a: Actor | null) => void }
const Ctx = createContext<Session>(null as never);
export const useSession = () => useContext(Ctx);
export const has = (a: Actor, ...r: string[]) => r.some(x => a.roles.includes(x));

export function App() {
  const [actor, setActor] = useState<Actor | null | undefined>(undefined);
  useEffect(() => { api<{ actor: Actor }>('/session/me').then(r => setActor(r.actor), () => setActor(null)); }, []);
  if (actor === undefined) return <div className="center muted" role="status">Loading…</div>;
  if (!actor) return <Login onLogin={setActor} />;
  return <Ctx.Provider value={{ actor, setActor }}><Shell actor={actor} /></Ctx.Provider>;
}

const ROLE_LABEL: Record<string, string> = { STAFF: 'Teller', REVIEWER: 'Reviewer', POLICY_APPROVER: 'Policy approver', MANAGER: 'Manager', COMPLIANCE: 'Compliance', ADMIN: 'Admin' };

function Shell({ actor }: { actor: Actor }) {
  const { setActor } = useSession();
  const nav = useNavigate();
  const signOut = useCallback(async () => { await api('/session', { method: 'DELETE' }); setActor(null); nav('/'); }, [setActor, nav]);
  const staff = has(actor, 'STAFF'), reviewer = has(actor, 'REVIEWER');
  const home = reviewer ? '/review' : '/requests';
  return (
    <div className="shell">
      <a className="skip" href="#main">Skip to main content</a>
      {import.meta.env.DEV && <div className="env">Test environment. Sample data only. Rules are placeholders.</div>}
      <header className="bar">
        <span className="brand">Exchange<span className="wordmark-flow">Flow</span></span>
        <nav aria-label="Main">
          {(staff || has(actor, 'MANAGER')) && <NavLink to="/requests" end>Requests</NavLink>}
          {staff && <NavLink to="/requests/new">New request</NavLink>}
          {reviewer && <NavLink to="/review">Review queue</NavLink>}
          {has(actor, 'POLICY_APPROVER', 'MANAGER', 'COMPLIANCE') && <NavLink to="/engine">Decision engine</NavLink>}
        </nav>
        <span className="sp" />
        <Inbox />
        <div className="who">
          <strong>{actor.displayName}</strong>
          {actor.roles.map(r => ROLE_LABEL[r] ?? r).join(', ')}{actor.branchId ? `, ${actor.branchId}` : ''}
        </div>
        <button type="button" className="btn quiet" onClick={signOut}>Sign out</button>
      </header>
      <main className="page" id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Navigate to={home} replace />} />
          <Route path="/requests" element={<Requests />} />
          <Route path="/requests/new" element={<RequestForm mode="new" />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/requests/:id/edit" element={<RequestForm mode="edit" />} />
          <Route path="/requests/:id/resubmit" element={<RequestForm mode="resubmit" />} />
          <Route path="/review" element={<ReviewQueue />} />
          <Route path="/engine" element={<EnginePanel />} />
          <Route path="*" element={<div className="sheet">Page not found. Use the navigation above to go back.</div>} />
        </Routes>
      </main>
    </div>
  );
}
