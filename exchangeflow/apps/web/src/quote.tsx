import type { Give, Quote } from './api';
import { Money, fmtTime } from './ui';

/** The rate used and its side, from the institution's view. Text from the feed is rendered as plain text only. */
export const rateLine = (q: Quote) => `${q.side === 'SELL_RATE' ? 'Sell rate' : 'Buy rate'} ${q.rate} CAD per ${q.snapshot.currency}`;

/** The label every quote carries, plus a stale warning when the feed could not be reached and an older rate was used. */
export function QuoteNote({ quote }: { quote: Quote }) {
  const s = quote.snapshot;
  return (
    <>
      <p className="small muted">Indicative rate from uexchange.ca, updated {s.feedUpdatedAt}. Calculated {fmtTime(s.fetchedAt)}; rounded down to the cent.</p>
      {s.stale && <p className="small stale"><strong>Stale rate.</strong> The rate feed could not be reached, so this uses the last rate received.</p>}
    </>
  );
}

export const GiveFigure = ({ quote, className = '' }: { quote: Quote; className?: string }) => <Money className={className} amount={quote.give.amount} currency={quote.give.currency} />;

/** The amount the member gets in a list row, with a word (not only colour) saying whether it is the quote or the completed figure. */
export const MemberGets = ({ give }: { give: Give | null }) => give
  ? <><Money amount={give.amount} currency={give.currency} /> <span className="tag">{give.source === 'COMPLETED' ? 'given' : 'quoted'}</span></>
  : <span className="muted">No rate</span>;
