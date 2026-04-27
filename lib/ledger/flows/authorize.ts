import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type AuthorizeInput = {
  amountMinor: number;
  currency?: 'USD' | 'EUR';
  externalId?: string;
};

/**
 * Authorize a charge. The customer's funding source is debited and
 * an authorization-hold liability is credited. No real money has moved
 * yet — the hold is a memo line that capture or void will resolve.
 */
export async function authorize(sql: Sql, input: AuthorizeInput): Promise<PostedTransaction> {
  const ccy = input.currency ?? 'USD';
  const customer = ccy === 'USD' ? A.CUSTOMER_FUNDING_USD   : A.CUSTOMER_FUNDING_EUR;
  const hold     = ccy === 'USD' ? A.AUTHORIZATION_HOLD_USD : A.AUTHORIZATION_HOLD_EUR;

  return postTransaction(sql, {
    kind: 'authorize',
    description: `Authorize ${formatAmount(input.amountMinor, ccy)}`,
    externalId: input.externalId,
    postings: [
      { accountCode: customer, direction: 'debit',  amountMinor: input.amountMinor, currency: ccy },
      { accountCode: hold,     direction: 'credit', amountMinor: input.amountMinor, currency: ccy },
    ],
  });
}

function formatAmount(minor: number, ccy: string) {
  return `${(minor / 100).toFixed(2)} ${ccy}`;
}
