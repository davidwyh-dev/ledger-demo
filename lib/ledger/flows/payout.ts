import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type PayoutInput = {
  amountMinor: number;
  currency?: 'USD' | 'EUR';
  externalId?: string;
};

/**
 * Payout: Stripe wires the merchant's net balance to the merchant's bank.
 * Merchant payable goes down, Stripe cash goes down.
 */
export async function payout(sql: Sql, input: PayoutInput): Promise<PostedTransaction> {
  const ccy = input.currency ?? 'USD';
  const cash    = ccy === 'USD' ? A.STRIPE_CASH_USD      : A.STRIPE_CASH_EUR;
  const payable = ccy === 'USD' ? A.MERCHANT_PAYABLE_USD : A.MERCHANT_PAYABLE_EUR;

  return postTransaction(sql, {
    kind: 'payout',
    description: `Payout ${formatAmount(input.amountMinor, ccy)} to merchant`,
    externalId: input.externalId,
    postings: [
      { accountCode: payable, direction: 'debit',  amountMinor: input.amountMinor, currency: ccy },
      { accountCode: cash,    direction: 'credit', amountMinor: input.amountMinor, currency: ccy },
    ],
  });
}

function formatAmount(minor: number, ccy: string) {
  return `${(minor / 100).toFixed(2)} ${ccy}`;
}
