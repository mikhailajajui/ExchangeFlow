import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { ago, usePolling } from '../ui';

interface Item { id: number; requestId: string | null; kind: string; message: string; createdAt: string; read: boolean }

/** In-app notifications written by the outbox relay; the browser polls (FR-50). */
export function Inbox() {
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const load = useCallback(() => api<Item[]>('/inbox').then(setItems, () => {}), []);
  useEffect(() => { load(); }, [load]);
  usePolling(load);
  useEffect(() => { const c = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener('mousedown', c); return () => document.removeEventListener('mousedown', c); }, []);
  const unread = items.filter(i => !i.read).length;
  const toggle = async () => { const next = !open; setOpen(next); if (next && unread) { await api('/inbox/read', { method: 'POST', body: {} }); setTimeout(load, 600); } };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
  return (
    <div className="inbox" ref={box} onKeyDown={onKey}>
      <button type="button" className="btn quiet" ref={btn} aria-expanded={open} aria-controls="notifications" onClick={toggle}>
        Notifications{unread > 0 && <span className="badge"><span className="hidden-visually">{unread} unread </span><span aria-hidden="true">{unread}</span></span>}
      </button>
      {open && (
        <div className="popover" id="notifications" role="region" aria-label="Notifications">
          {items.length === 0 && <div className="muted pad">No notifications yet. Updates on your requests will appear here.</div>}
          {items.map(i => (
            <div key={i.id} className={`pop-item ${i.read ? '' : 'unread'}`}>
              {i.requestId ? <Link to={`/requests/${i.requestId}`} onClick={() => setOpen(false)}>{i.message}</Link> : i.message}
              <div className="muted small">{ago(i.createdAt)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
