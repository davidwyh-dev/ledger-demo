import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type CaptureInput = {
  authAmountMinor: number;
  captureAmountMinor?: number; // defaults to full capture
  currency?: 'USD' | 'EUR';
  externalId?: string;
};

/**
 * Capture an authorization.
 *
 * Capture reverses the auth+customer-funding memo lines in full
 * (the original auth was a tentative hold, not a real charge), then
 * books the captured amount as a real receivable + merchant payable.
 *
 * Partial captures simply reverse the full hold and book the smaller
 * amount — the difference is implicitly released.
 */
export async function capture(sql: Sql, input: CaptureInput): Promise<PostedTransaction> {
  const ccy = input.currency ?? 'USD';
  const auth = input.authAmountMinor;
  const cap  = input.captureAmountMinor ?? input.authAmountMinor;
  if (cap > auth) throw new Error('capture amount exceeds authorized amount');
  if (cap <= 0)   throw new Error('capture amount must be positive');

  const customer = ccy === 'USD' ? A.CUSTOMER_FUNDING_USD     : A.CUSTOMER_FUNDING_EUR;
  const hold     = ccy === 'USD' ? A.AUTHORIZATION_HOLD_USD   : A.AUTHORIZATION_HOLD_EUR;
  const recv     = ccy === 'USD' ? A.PROCESSOR_RECEIVABLE_USD : A.PROCESSOR_RECEIVABLE_EUR;
  const payable  = ccy === 'USD' ? A.MERCHANT_PAYABLE_USD     : A.MERCHANT_PAYABLE_EUR;

  return postTransaction(sql, {
    kind: 'capture',
    description: cap === auth
      ? `Capture ${formatAmount(cap, ccy)}`
      : `Partial capture ${formatAmount(cap, ccy)} of ${formatAmount(auth, ccy)} auth`,
    externalId: input.externalId,
    postings: [
      // Reverse the auth hold + customer funding memo (always full auth amount)
      { accountCode: hold,     direction: 'debit',  amountMinor: auth, currency: ccy },
      { accountCode: customer, direction: 'credit', amountMinor: auth, currency: ccy },
      // Book the actual captured amount as receivable + merchant payable
      { accountCode: recv,     direction: 'debit',  amountMinor: cap,  currency: ccy },
      { accountCode: payable,  direction: 'credit', amountMinor: cap,  currency: ccy },
    ],
  });
}

function formatAmount(minor: number, ccy: string) {
  return `${(minor / 100).toFixed(2)} ${ccy}`;
}
