import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MINOR_PER: Record<string, number> = { USD: 100, EUR: 100, GBP: 100, JPY: 1 };
const SYM: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', JPY: '¥' };

export function formatMoney(minor: number, currency: string, opts: { signed?: boolean } = {}): string {
  const minorPer = MINOR_PER[currency] ?? 100;
  const sym = SYM[currency] ?? currency + ' ';
  const negative = minor < 0;
  const abs = Math.abs(minor) / minorPer;
  const decimals = minorPer === 1 ? 0 : 2;
  const formatted = abs.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (opts.signed && minor !== 0) {
    return `${negative ? '-' : '+'}${sym}${formatted}`;
  }
  return `${negative ? '-' : ''}${sym}${formatted}`;
}

export function formatMoneyTerse(minor: number, currency: string): string {
  return formatMoney(minor, currency).replace(/\.00$/, '');
}
