import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type SettleInput = {
  amountMinor: number;
  currency?: 'USD' | 'EUR';
  externalId?: string;
};

/**
 * Settle: the card network actually pays Stripe. The receivable becomes
 * cash. No merchant-side accounting changes — the merchant is still
 * owed the same amount they were after capture.
 */
export async function settle(sql: Sql, input: SettleInput): Promise<PostedTransaction> {
  const ccy = input.currency ?? 'USD';
  const cash = ccy === 'USD' ? A.STRIPE_CASH_USD          : A.STRIPE_CASH_EUR;
  const recv = ccy === 'USD' ? A.PROCESSOR_RECEIVABLE_USD : A.PROCESSOR_RECEIVABLE_EUR;

  return postTransaction(sql, {
    kind: 'settle',
    description: `Settle ${formatAmount(input.amountMinor, ccy)} from processor`,
    externalId: input.externalId,
    postings: [
      { accountCode: cash, direction: 'debit',  amountMinor: input.amountMinor, currency: ccy },
      { accountCode: recv, direction: 'credit', amountMinor: input.amountMinor, currency: ccy },
    ],
  });
}

function formatAmount(minor: number, ccy: string) {
  return `${(minor / 100).toFixed(2)} ${ccy}`;
}
