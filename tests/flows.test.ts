import { describe, expect, it } from 'vitest';
import { getSql } from './setup';
import { authorize } from '@/lib/ledger/flows/authorize';
import { capture } from '@/lib/ledger/flows/capture';
import { settle } from '@/lib/ledger/flows/settle';
import { fee, computeStripeFee } from '@/lib/ledger/flows/fee';
import { payout } from '@/lib/ledger/flows/payout';
import { refund } from '@/lib/ledger/flows/refund';
import { disputeOpen, disputeWon, disputeLost } from '@/lib/ledger/flows/dispute';
import { fxCharge } from '@/lib/ledger/flows/fxCharge';
import { getBalance, balanceSheetEquationsByCurrency } from '@/lib/ledger/balances';
import { A } from '@/lib/ledger/accounts';

describe('Flow: authorize', () => {
  it('debits customer funding and credits auth hold', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    expect(await getBalance(sql, A.CUSTOMER_FUNDING_USD)).toBe(10000);
    expect(await getBalance(sql, A.AUTHORIZATION_HOLD_USD)).toBe(10000);
  });
});

describe('Flow: capture', () => {
  it('full capture closes auth, books receivable + merchant payable', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    expect(await getBalance(sql, A.CUSTOMER_FUNDING_USD)).toBe(0);
    expect(await getBalance(sql, A.AUTHORIZATION_HOLD_USD)).toBe(0);
    expect(await getBalance(sql, A.PROCESSOR_RECEIVABLE_USD)).toBe(10000);
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(10000);
  });

  it('partial capture closes full auth, books only captured amount', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000, captureAmountMinor: 6000 });
    expect(await getBalance(sql, A.AUTHORIZATION_HOLD_USD)).toBe(0);
    expect(await getBalance(sql, A.CUSTOMER_FUNDING_USD)).toBe(0);
    expect(await getBalance(sql, A.PROCESSOR_RECEIVABLE_USD)).toBe(6000);
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(6000);
  });
});

describe('Flow: settle', () => {
  it('moves from receivable to cash', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await settle(sql, { amountMinor: 10000 });
    expect(await getBalance(sql, A.PROCESSOR_RECEIVABLE_USD)).toBe(0);
    expect(await getBalance(sql, A.STRIPE_CASH_USD)).toBe(10000);
  });
});

describe('Flow: fee', () => {
  it('computes 2.9% + 30¢ correctly', () => {
    expect(computeStripeFee(10000)).toBe(290 + 30);   // $100 → $3.20
    expect(computeStripeFee(2500)).toBe(73 + 30);     // $25 → $1.03
  });

  it('debits merchant payable, credits Stripe fee revenue', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await fee(sql, { grossAmountMinor: 10000 });
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(10000 - 320);
    expect(await getBalance(sql, A.STRIPE_FEE_REVENUE_USD)).toBe(320);
  });
});

describe('Flow: payout', () => {
  it('zeros merchant payable and reduces cash', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await settle(sql, { amountMinor: 10000 });
    await fee(sql, { grossAmountMinor: 10000 });
    await payout(sql, { amountMinor: 10000 - 320 });
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(0);
    expect(await getBalance(sql, A.STRIPE_CASH_USD)).toBe(320);
  });
});

describe('Flow: refund', () => {
  it('full refund without fee return: merchant clawed back, fee retained, cash out', async () => {
    const sql = getSql();
    // setup: charge $100, fee $3.20
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await settle(sql, { amountMinor: 10000 });
    await fee(sql, { grossAmountMinor: 10000 });
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(9680);

    await refund(sql, { grossAmountMinor: 10000, refundFee: false, originalFeeMinor: 320 });
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(9680 - 10000); // negative — owed back
    expect(await getBalance(sql, A.STRIPE_CASH_USD)).toBe(0); // cash returned
    expect(await getBalance(sql, A.STRIPE_FEE_REVENUE_USD)).toBe(320); // fee kept
    expect(await getBalance(sql, A.REFUND_CLEARING_USD)).toBe(0);
  });

  it('full refund WITH fee return zeros fee revenue', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await settle(sql, { amountMinor: 10000 });
    await fee(sql, { grossAmountMinor: 10000 });
    await refund(sql, { grossAmountMinor: 10000, refundFee: true, originalFeeMinor: 320 });
    expect(await getBalance(sql, A.STRIPE_FEE_REVENUE_USD)).toBe(0);
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(0); // 9680 - 9680 = 0
    expect(await getBalance(sql, A.STRIPE_CASH_USD)).toBe(0);
  });
});

describe('Flow: dispute', () => {
  it('open: merchant payable → reserve', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await disputeOpen(sql, { amountMinor: 10000 });
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(0);
    expect(await getBalance(sql, A.DISPUTE_RESERVE_USD)).toBe(10000);
  });

  it('won: reserve releases back to merchant', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await disputeOpen(sql, { amountMinor: 10000 });
    await disputeWon(sql, { amountMinor: 10000 });
    expect(await getBalance(sql, A.DISPUTE_RESERVE_USD)).toBe(0);
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(10000);
  });

  it('lost (merchant has funds): reserve → cash out', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await settle(sql, { amountMinor: 10000 });
    await disputeOpen(sql, { amountMinor: 10000 });
    await disputeLost(sql, { amountMinor: 10000, merchantHasFunds: true });
    expect(await getBalance(sql, A.DISPUTE_RESERVE_USD)).toBe(0);
    expect(await getBalance(sql, A.STRIPE_CASH_USD)).toBe(0);
  });

  it('lost (Stripe absorbs): chargeback expense + cash out', async () => {
    const sql = getSql();
    await authorize(sql, { amountMinor: 10000 });
    await capture(sql, { authAmountMinor: 10000 });
    await settle(sql, { amountMinor: 10000 });
    await disputeLost(sql, { amountMinor: 10000, merchantHasFunds: false });
    expect(await getBalance(sql, A.STRIPE_CASH_USD)).toBe(0);
    expect(await getBalance(sql, A.CHARGEBACK_LOSS_USD)).toBe(10000);
  });
});

describe('Flow: fxCharge', () => {
  it('books EUR leg, USD leg with margin, balances per currency', async () => {
    const sql = getSql();
    await fxCharge(sql, {
      customerAmountMinorEur: 10000, // €100
      midMarketRate: 1.08,
      marginBps: 200,
    });
    // €100 mid-market → $108
    // Effective rate = 1.08 * (1 - 0.02) = 1.0584 → $105.84 to merchant
    // Margin = $108 - $105.84 = $2.16
    expect(await getBalance(sql, A.CUSTOMER_FUNDING_EUR)).toBe(10000);
    expect(await getBalance(sql, A.FX_CLEARING_EUR)).toBe(10000); // liability of 10000 EUR
    expect(await getBalance(sql, A.FX_CLEARING_USD)).toBe(10800);
    expect(await getBalance(sql, A.MERCHANT_PAYABLE_USD)).toBe(10584);
    expect(await getBalance(sql, A.STRIPE_FX_REVENUE_USD)).toBe(216);
  });

  it('balance-sheet equation holds per currency after FX charge', async () => {
    const sql = getSql();
    await fxCharge(sql, { customerAmountMinorEur: 10000 });
    const eqs = await balanceSheetEquationsByCurrency(sql);
    for (const eq of eqs) {
      // Each currency should net to 0 (all postings within a currency balance)
      expect(eq.netMinor).toBe(0);
    }
  });
});
