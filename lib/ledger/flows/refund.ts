import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type RefundInput = {
  /** Gross charge amount being refunded (in minor units). */
  grossAmountMinor: number;
  /** Whether to refund the Stripe fee back to the merchant too. */
  refundFee?: boolean;
  /** Stripe fee from the original charge (in minor units). */
  originalFeeMinor?: number;
  externalId?: string;
};

/**
 * Refund flow: produces TWO transactions to model the lifecycle cleanly.
 *
 * 1. Reduce merchant payable by the refunded amount (+ optionally restore fee
 *    revenue), and credit a refund_clearing liability.
 * 2. Cash actually leaves Stripe to the customer: refund_clearing closes,
 *    Stripe cash goes down.
 */
export async function refund(sql: Sql, input: RefundInput) {
  const gross = input.grossAmountMinor;
  const fee   = input.refundFee ? (input.originalFeeMinor ?? 0) : 0;
  const merchantClawback = gross - fee; // what we take back from the merchant

  const txn1: PostedTransaction = await postTransaction(sql, {
    kind: 'refund',
    description: `Refund ${formatAmount(gross)} (fee refunded: ${input.refundFee ? 'yes' : 'no'})`,
    externalId: input.externalId,
    postings: [
      { accountCode: A.MERCHANT_PAYABLE_USD, direction: 'debit',  amountMinor: merchantClawback, currency: 'USD' },
      ...(fee > 0
        ? [{ accountCode: A.STRIPE_FEE_REVENUE_USD, direction: 'debit' as const, amountMinor: fee, currency: 'USD' }]
        : []),
      { accountCode: A.REFUND_CLEARING_USD,  direction: 'credit', amountMinor: gross, currency: 'USD' },
    ],
  });

  const txn2: PostedTransaction = await postTransaction(sql, {
    kind: 'refund',
    description: `Refund ${formatAmount(gross)} - cash out`,
    postings: [
      { accountCode: A.REFUND_CLEARING_USD, direction: 'debit',  amountMinor: gross, currency: 'USD' },
      { accountCode: A.STRIPE_CASH_USD,     direction: 'credit', amountMinor: gross, currency: 'USD' },
    ],
  });

  return [txn1, txn2];
}

function formatAmount(minor: number) {
  return `$${(minor / 100).toFixed(2)}`;
}
