import { cloneElement, useEffect, useId, useRef, useSyncExternalStore, type ReactElement, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';
import { ApiError, type Status } from './api';

// ---------- status marks (shape + word + colour, never colour alone) ----------
type Tone = 'good' | 'bad' | 'review' | 'info' | 'neutral';
const GLYPH: Record<Tone, ReactNode> = { good: '✓', bad: '✕', review: '', info: <b>?</b>, neutral: '' };

export const STATUS_LABEL: Record<Status, string> = {
  DRAFT: 'Draft', UNDER_REVIEW: 'In head-office review', MORE_INFO_NEEDED: 'More information needed', APPROVED: 'Approved',
  AUTO_DECLINED: 'Declined by rule', DECLINED: 'Declined', COMPLETED: 'Completed', CANCELLED: 'Cancelled',
};
export const STATUS_TONE: Record<Status, Tone> = {
  DRAFT: 'neutral', UNDER_REVIEW: 'review', MORE_INFO_NEEDED: 'info', APPROVED: 'good', AUTO_DECLINED: 'bad', DECLINED: 'bad', COMPLETED: 'good', CANCELLED: 'neutral',
};
export const Mark = ({ tone, children }: { tone: Tone; children: ReactNode }) => <span className={`mark ${tone}`}><i aria-hidden="true">{GLYPH[tone]}</i>{children}</span>;
export const StatusMark = ({ status }: { status: Status }) => <Mark tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Mark>;
export const rowTone = (status: Status) => ({ good: 'r-good', bad: 'r-bad', review: 'r-review', info: 'r-info', neutral: '' })[STATUS_TONE[status]];

export const ACTION_LABEL: Record<string, string> = {
  'request.drafted': 'Draft saved', 'request.draft_updated': 'Draft edited', 'request.submitted': 'Submitted and evaluated',
  'request.resubmitted': 'Resubmitted', 'request.escalated': 'Escalated to head office', 'request.cancelled': 'Cancelled',
  'request.completed': 'Completed', 'review.approve': 'Approved by reviewer', 'review.decline': 'Declined by reviewer', 'review.request_info': 'More information requested',
};

export const OUTCOME_LABEL: Record<string, string> = { AUTO_APPROVE: 'Approved by rule', AUTO_DECLINE: 'Declined by rule', HUMAN_REVIEW: 'Sent to head-office review' };
export const WOULD_BE_LABEL: Record<string, string> = { AUTO_APPROVE: 'would approve', AUTO_DECLINE: 'would decline', HUMAN_REVIEW: 'would send to head-office review' };
export const DECISION_LABEL: Record<string, string> = { APPROVE: 'Approved', DECLINE: 'Declined', REQUEST_INFO: 'Asked for information' };

/** Plain words for routing causes. Raw codes are never rendered; anything unknown reads as the neutral phrase. */
const CAUSE_LABEL: Record<string, string> = {
  RESUBMISSION_FLOOR: 'Resubmitted after a request for information', ENGINE_PAUSED: 'Engine paused', ENGINE_ERROR: 'Engine error',
  RULE_REQUIRES_HUMAN: 'A rule needs a person', NO_MATCH: 'No rule covered this', MISSING_DATA: 'Some details are missing', CONFLICT: 'Rules disagree', RULE_PAUSED: 'A rule is paused',
};
export const causeLabel = (cause: string | null | undefined): string => (cause && CAUSE_LABEL[cause]) || 'Needs head-office review';

// ---------- formatting (display only; amounts stay decimal strings and are never parsed to floats for logic) ----------
export function fmtAmount(amount: string, currency: string): string {
  const [i, f] = amount.split('.');
  return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f ? '.' + f : ''} ${currency}`;
}
export const Money = ({ amount, currency, className = '' }: { amount: string; currency: string; className?: string }) => <span className={`money ${className}`}>{fmtAmount(amount, currency)}</span>;
export const fmtTime = (iso: string) => new Date(iso).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
/** Waiting time as plain text. There is no threshold and no "late" state (no SLA is defined). */
export function waiting(iso: string): string {
  const m = Math.floor(Math.max(0, Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'under 1 min'; if (m < 60) return `${m} min`; if (m < 1440) return `${Math.floor(m / 60)} h ${m % 60} min`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}

/** What happened and how to fix it. Server messages are not shown as they are. */
export function errorMessage(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Something went wrong. Try again, and tell your manager if it keeps happening.';
  switch (e.code) {
    case 'NETWORK': return 'We could not reach the server. Your entries are still here. Try again in a moment.';
    case 'STALE_REQUEST': return 'Someone else changed this request while you were looking. We have loaded the latest version. Check it and try again.';
    case 'UNAUTHENTICATED': return 'You were signed out. Sign in again to carry on.';
    case 'REASON_REQUIRED': return 'Enter a reason of at least 3 characters.';
    case 'SOD_VIOLATION': return 'You cannot decide a request you submitted. Ask another reviewer.';
    case 'FORBIDDEN': return 'You do not have permission to do this. Ask your manager if you think you should.';
    case 'NOT_FOUND': return 'We could not find that request. Check the link, or go back to the list.';
    case 'INVALID_TRANSITION': return 'This request cannot do that in its current state. Reload to see where it is now.';
    case 'ALREADY_ESCALATED': return 'This decision was already escalated once, so it cannot be escalated again.';
    case 'VALIDATION': return e.issues.length ? 'Some fields need fixing. Check the marked fields.' : 'Check what you entered and try again.';
    default: return 'Something went wrong. Try again, and tell your manager if it keeps happening.';
  }
}

// ---------- forms ----------
export function Field({ id, label, hint, error, children }: { id?: string; label: string; hint?: string; error?: string; children: ReactElement<Record<string, unknown>> }) {
  const auto = useId(); const fid = id ?? auto;
  const describedBy = error ? `${fid}-err` : hint ? `${fid}-hint` : undefined;
  return (
    <div className={`f ${error ? 'err' : ''}`}>
      <label htmlFor={fid}>{label}</label>
      {cloneElement(children, { id: fid, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined, className: ['in', children.props.className].filter(Boolean).join(' ') })}
      {hint && !error && <span className="hint" id={`${fid}-hint`}>{hint}</span>}
      {error && <span className="msg" id={`${fid}-err`}>{error}</span>}
    </div>
  );
}

export function ErrorSummary({ errors, innerRef }: { errors: { id: string; message: string }[]; innerRef: Ref<HTMLDivElement> }) {
  const tid = useId();
  return (
    <div className="sum" role="group" aria-labelledby={tid} tabIndex={-1} ref={innerRef}>
      <strong id={tid}>{errors.length === 1 ? '1 thing needs fixing before you can continue.' : `${errors.length} things need fixing before you can continue.`}</strong>
      <ul>{errors.map(e => <li key={e.id}><a href={`#${e.id}`} onClick={ev => { ev.preventDefault(); document.getElementById(e.id)?.focus(); }}>{e.message}</a></li>)}</ul>
    </div>
  );
}

const LEAD = { good: 'Done', bad: 'Problem', warn: 'Heads up', info: 'Note' } as const;
export const Banner = ({ tone, lead, children }: { tone: 'good' | 'bad' | 'warn' | 'info'; lead?: string; children: ReactNode }) =>
  <div className={`banner ${tone}`} role={tone === 'bad' ? 'alert' : 'status'}><strong>{lead ?? LEAD[tone]}.</strong> {children}</div>;

export function TableRegion({ label, children }: { label: string; children: ReactNode }) {
  return <div className="table-scroll" role="region" aria-label={label} tabIndex={0}>{children}</div>;
}

// ---------- dialog ----------
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Modal dialog. Focus starts on the element marked data-initial (the reason field, or Cancel for a confirm-only dialog),
 * is trapped, and returns to the opener. The rest of the app is inert while it is open. Escape closes; a backdrop click does not,
 * because every dialog here takes input.
 */
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const close = useRef(onClose); close.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = document.getElementById('root');
    const el = box.current!;
    root?.setAttribute('inert', ''); document.body.setAttribute('data-dialog-open', '');
    (el.querySelector<HTMLElement>('[data-initial]') ?? el.querySelector<HTMLElement>(FOCUSABLE) ?? el).focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab') return;
      const f = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (!f.length) { e.preventDefault(); return; }
      const first = f[0]!, last = f[f.length - 1]!, a = document.activeElement;
      if (e.shiftKey && (a === first || !el.contains(a))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (a === last || !el.contains(a))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('keydown', key); root?.removeAttribute('inert'); document.body.removeAttribute('data-dialog-open'); opener?.focus?.(); };
  }, []);
  return createPortal(
    <div className="modal-backdrop">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={box} tabIndex={-1}>
        <h2 id={titleId}>{title}</h2>{children}
      </div>
    </div>, document.body);
}

// ---------- auto-refresh (pausable, never while a dialog is open) ----------
let paused = false;
const subs = new Set<() => void>();
const pauseStore = { get: () => paused, toggle: () => { paused = !paused; subs.forEach(f => f()); }, subscribe: (f: () => void) => { subs.add(f); return () => { subs.delete(f); }; } };

export function usePolling(load: () => void, ms = 15000) {
  const ref = useRef(load); ref.current = load;
  useEffect(() => {
    const t = setInterval(() => { if (!pauseStore.get() && !document.body.hasAttribute('data-dialog-open') && !document.hidden) ref.current(); }, ms);
    return () => clearInterval(t);
  }, [ms]);
}
export function PauseUpdates() {
  const p = useSyncExternalStore(pauseStore.subscribe, pauseStore.get);
  return (
    <>
      <button type="button" className="btn sec sm" aria-pressed={p} onClick={pauseStore.toggle}>Pause updates</button>
      {p && <span className="small muted">Updates are paused. Turn the button off to refresh again.</span>}
    </>
  );
}

/** A relative bar with no threshold: width is the share of the longest wait. Width is set through the CSSOM, never an inline style attribute. */
export function Meter({ fraction }: { fraction: number }) {
  return <span className="meter" aria-hidden="true"><span ref={el => { el?.style.setProperty('--w', `${Math.round(Math.min(1, Math.max(0, fraction)) * 100)}%`); }} /></span>;
}
