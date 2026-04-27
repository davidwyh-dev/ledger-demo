import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type DisputeOpenInput = {
  amountMinor: number;
  externalId?: string;
};

export type DisputeResolveInput = {
  amountMinor: number;
  /** If true and reserve balance is insufficient, Stripe absorbs the loss. */
  merchantHasFunds?: boolean;
  externalId?: string;
};

/**
 * Dispute opened. Funds are pulled from the merchant's payable and held in
 * a dispute reserve until the dispute is resolved.
 */
export async function disputeOpen(sql: Sql, input: DisputeOpenInput): Promise<PostedTransaction> {
  return postTransaction(sql, {
    kind: 'dispute_open',
    description: `Dispute opened for ${formatAmount(input.amountMinor)}`,
    externalId: input.externalId,
    postings: [
      { accountCode: A.MERCHANT_PAYABLE_USD, direction: 'debit',  amountMinor: input.amountMinor, currency: 'USD' },
      { accountCode: A.DISPUTE_RESERVE_USD,  direction: 'credit', amountMinor: input.amountMinor, currency: 'USD' },
    ],
  });
}

/**
 * Dispute won: the reserve releases back to the merchant.
 */
export async function disputeWon(sql: Sql, input: DisputeResolveInput): Promise<PostedTransaction> {
  return postTransaction(sql, {
    kind: 'dispute_won',
    description: `Dispute won, ${formatAmount(input.amountMinor)} returned to merchant`,
    externalId: input.externalId,
    postings: [
      { accountCode: A.DISPUTE_RESERVE_USD,  direction: 'debit',  amountMinor: input.amountMinor, currency: 'USD' },
      { accountCode: A.MERCHANT_PAYABLE_USD, direction: 'credit', amountMinor: input.amountMinor, currency: 'USD' },
    ],
  });
}

/**
 * Dispute lost: cash leaves Stripe to the customer. If the merchant's
 * reserve covers it, the reserve closes. Otherwise Stripe absorbs the
 * loss (chargeback expense).
 */
export async function disputeLost(sql: Sql, input: DisputeResolveInput): Promise<PostedTransaction> {
  const merchantHasFunds = input.merchantHasFunds ?? true;

  return postTransaction(sql, {
    kind: 'dispute_lost',
    description: `Dispute lost, ${formatAmount(input.amountMinor)} returned to customer${merchantHasFunds ? '' : ' (Stripe absorbs)'}`,
    externalId: input.externalId,
    postings: merchantHasFunds
      ? [
          { accountCode: A.DISPUTE_RESERVE_USD, direction: 'debit',  amountMinor: input.amountMinor, currency: 'USD' },
          { accountCode: A.STRIPE_CASH_USD,     direction: 'credit', amountMinor: input.amountMinor, currency: 'USD' },
        ]
      : [
          { accountCode: A.CHARGEBACK_LOSS_USD, direction: 'debit',  amountMinor: input.amountMinor, currency: 'USD' },
          { accountCode: A.STRIPE_CASH_USD,     direction: 'credit', amountMinor: input.amountMinor, currency: 'USD' },
        ],
  });
}

function formatAmount(minor: number) {
  return `$${(minor / 100).toFixed(2)}`;
}
