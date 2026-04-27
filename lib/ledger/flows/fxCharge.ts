import type { Sql } from 'postgres';
import { postTransaction, type PostedTransaction } from '../post';
import { A } from '../accounts';

export type FxChargeInput = {
  /** Customer-side charge amount in EUR minor units. */
  customerAmountMinorEur: number;
  /** Mid-market FX rate EUR→USD (e.g. 1.08 means €1 = $1.08). */
  midMarketRate?: number;
  /** Stripe FX margin in basis points (default 200 = 2%). */
  marginBps?: number;
  externalId?: string;
};

/**
 * Cross-currency charge: customer pays in EUR; merchant is paid in USD;
 * Stripe earns the FX margin in USD.
 *
 * The transaction has two currency legs that each balance independently:
 *   EUR leg: customer funding (Dr) → FX clearing EUR (Cr)
 *   USD leg: FX clearing USD (Dr) → merchant payable USD + Stripe FX revenue (Cr)
 *
 * The "imbalance" between EUR and USD clearing accounts represents the
 * FX exposure Stripe carries until it converts the EUR for itself.
 * (A real Stripe also runs periodic revaluation; out of scope here.)
 */
export async function fxCharge(sql: Sql, input: FxChargeInput): Promise<PostedTransaction> {
  const eurMinor = input.customerAmountMinorEur;
  const midRate  = input.midMarketRate ?? 1.08;
  const marginBps = input.marginBps ?? 200;
  const effectiveRate = midRate * (1 - marginBps / 10000);

  // Convert EUR minor → USD minor at mid-market and at effective rate
  // EUR/USD have same minor_unit (2), so minor units are directly comparable.
  const usdAtMid       = Math.round(eurMinor * midRate);
  const usdAtEffective = Math.round(eurMinor * effectiveRate);
  const fxMargin       = usdAtMid - usdAtEffective;

  return postTransaction(sql, {
    kind: 'fx_conversion',
    description: `FX charge: €${(eurMinor / 100).toFixed(2)} → $${(usdAtEffective / 100).toFixed(2)} merchant + $${(fxMargin / 100).toFixed(2)} margin`,
    externalId: input.externalId,
    metadata: { midMarketRate: midRate, marginBps, effectiveRate },
    postings: [
      // EUR leg
      { accountCode: A.CUSTOMER_FUNDING_EUR, direction: 'debit',  amountMinor: eurMinor, currency: 'EUR' },
      { accountCode: A.FX_CLEARING_EUR,      direction: 'credit', amountMinor: eurMinor, currency: 'EUR' },
      // USD leg
      { accountCode: A.FX_CLEARING_USD,        direction: 'debit',  amountMinor: usdAtMid,       currency: 'USD' },
      { accountCode: A.MERCHANT_PAYABLE_USD,   direction: 'credit', amountMinor: usdAtEffective, currency: 'USD' },
      { accountCode: A.STRIPE_FX_REVENUE_USD,  direction: 'credit', amountMinor: fxMargin,       currency: 'USD' },
    ],
  });
}
