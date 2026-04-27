import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type FeeInput = {
  /** Gross charge amount used to compute the fee (in minor units). */
  grossAmountMinor: number;
  /** Override the standard 2.9% + 30¢ rate if needed (in minor units). */
  feeAmountMinor?: number;
  externalId?: string;
};

const RATE_BPS = 290; // 2.9%
const FIXED_MINOR = 30; // 30¢

export function computeStripeFee(grossMinor: number) {
  return Math.round((grossMinor * RATE_BPS) / 10000) + FIXED_MINOR;
}

/**
 * Stripe assesses a fee on a settled charge. The merchant payable is
 * reduced and Stripe fee revenue recognized. Fees are USD-only in the
 * demo (Stripe's fee billing currency varies by merchant in real life).
 */
export async function fee(sql: Sql, input: FeeInput): Promise<PostedTransaction> {
  const feeAmount = input.feeAmountMinor ?? computeStripeFee(input.grossAmountMinor);

  return postTransaction(sql, {
    kind: 'fee',
    description: `Stripe fee on ${formatAmount(input.grossAmountMinor)} = ${formatAmount(feeAmount)}`,
    externalId: input.externalId,
    postings: [
      { accountCode: A.MERCHANT_PAYABLE_USD,   direction: 'debit',  amountMinor: feeAmount, currency: 'USD' },
      { accountCode: A.STRIPE_FEE_REVENUE_USD, direction: 'credit', amountMinor: feeAmount, currency: 'USD' },
    ],
  });
}

function formatAmount(minor: number) {
  return `$${(minor / 100).toFixed(2)}`;
}
