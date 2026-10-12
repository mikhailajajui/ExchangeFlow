/** Display only: amounts stay decimal strings and are never parsed to floats. */
export function fmtAmount(amount: string, currency: string): string {
  const [i, f] = amount.split('.');
  return `${i!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${f ? '.' + f : ''} ${currency}`;
}
export const PAYMENT_LABEL: Record<string, string> = { CASH: 'Cash', ACCOUNT: 'From the member’s account', OTHER: 'Other' };
export const DESK_VERSION = '0.2.0';
/** Rate as "1 USD = 1.3912 CAD". */
export function rateLine(rate: string, sellCurrency: string, buyCurrency: string): string {
  const foreign = sellCurrency === 'CAD' ? buyCurrency : sellCurrency;
  return `1 ${foreign} = ${rate} CAD`;
}
export const short = (hash: string) => hash.slice(0, 16);
/**
 * Alterna's logo, referenced by URL rather than copied (product owner, 2026-10-12). Brand use still needs Alterna's
 * sign-off (DL-N37). The server's CSP allows images from this one host only.
 */
export const ALTERNA_LOGO_URL = 'https://www.alterna.ca/media/t0onoi0m/alterna-savings.svg';
