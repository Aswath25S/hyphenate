/** Display formatting shared by pipeline (briefs) and UI. */
export const PRODUCT_ORDER = ['Order-to-cash', 'Treasury', 'GL accounting', 'Procure-to-pay', 'Reporting'];

export const ROLE_LABELS: Record<string, string> = {
  AR: 'AR', AP: 'AP', GL: 'GL', Revenue: 'Revenue', Treasury: 'Treasury', Reporting_FPA: 'Reporting & FP&A',
  Close_Mgmt: 'Close mgmt', Controller: 'Controller', Payroll: 'Payroll', Tax: 'Tax', Other: 'Other',
};

export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '–';
  return `${(x * 100).toFixed(digits)}%`;
}

/** Round to the nearest $100 for display: these are floors, not precise figures. */
export function usd(x: number | null | undefined, opts: { compact?: boolean } = {}): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '–';
  const neg = x < 0;
  const v = Math.abs(x);
  let s: string;
  if (opts.compact && v >= 1_000_000) s = `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  else if (opts.compact && v >= 1000) s = `$${Math.round(v / 1000)}K`;
  else s = `$${(Math.round(v / 100) * 100).toLocaleString('en-US')}`;
  return neg ? `(${s})` : s;
}

export function num(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return '–';
  return x.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function score(x: number): string {
  return x.toFixed(0);
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '–';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '–';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/** "1001-5000" → "1,001–5,000". */
export function formatBand(band: string | null | undefined): string {
  if (!band) return 'Unknown';
  return band.replace(/\d+/g, (n) => Number(n).toLocaleString('en-US')).replace(/\s*-\s*/g, '–');
}

/** "4 + 0.25×6" style share numerator used in savings explanations. */
export function savingsShare(C: number, A: number, assistedWeight: number, countAssisted = true): string {
  return countAssisted && A > 0 ? `(${C} + ${assistedWeight}×${A})` : `${C}`;
}
