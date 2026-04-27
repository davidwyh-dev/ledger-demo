import { computeStripeFee } from '../flows/fee';
import type { FlowName } from '../flows';

export type ScenarioStep = {
  label: string;
  /** Plain-English explanation surfaced in story mode. */
  story: string;
  flow: FlowName;
  params: Record<string, unknown>;
  /** Account codes the step "spotlights" — used by story mode for highlights. */
  highlight?: string[];
};

export type Scenario = {
  slug: string;
  title: string;
  blurb: string;
  steps: ScenarioStep[];
};

export const SCENARIOS: Scenario[] = [
  {
    slug: 'happy-path',
    title: 'Happy path: $100 charge → fee → payout',
    blurb: 'A clean lifecycle: customer charged, Stripe earns its fee, merchant gets paid out.',
    steps: [
      {
        label: 'Authorize $100',
        story: 'Customer\'s card is authorized for $100. No real money has moved — the auth hold is a tentative claim.',
        flow: 'authorize',
        params: { amountMinor: 10000 },
        highlight: ['CUSTOMER_FUNDING_USD', 'AUTHORIZATION_HOLD_USD'],
      },
      {
        label: 'Capture $100',
        story: 'The merchant captures the auth. The hold is released and a real receivable is booked: card network owes Stripe, Stripe owes merchant.',
        flow: 'capture',
        params: { authAmountMinor: 10000 },
        highlight: ['AUTHORIZATION_HOLD_USD', 'CUSTOMER_FUNDING_USD', 'PROCESSOR_RECEIVABLE_USD', 'MERCHANT_PAYABLE_ACME_USD'],
      },
      {
        label: 'Settle from processor',
        story: 'Two days later the card network actually wires Stripe the money. Receivable becomes operating cash.',
        flow: 'settle',
        params: { amountMinor: 10000 },
        highlight: ['PROCESSOR_RECEIVABLE_USD', 'STRIPE_CASH_USD'],
      },
      {
        label: 'Stripe fee ($3.20)',
        story: 'Stripe takes its 2.9% + 30¢ fee out of the merchant\'s payable balance and recognizes it as revenue.',
        flow: 'fee',
        params: { grossAmountMinor: 10000 },
        highlight: ['MERCHANT_PAYABLE_ACME_USD', 'STRIPE_FEE_REVENUE_USD'],
      },
      {
        label: 'Payout $96.80',
        story: 'Stripe wires the merchant their net balance. Merchant payable closes to zero; Stripe\'s remaining cash is the fee revenue.',
        flow: 'payout',
        params: { amountMinor: 10000 - computeStripeFee(10000) },
        highlight: ['MERCHANT_PAYABLE_ACME_USD', 'STRIPE_CASH_USD'],
      },
    ],
  },
  {
    slug: 'partial-refund',
    title: 'Partial refund after fees',
    blurb: 'Merchant refunds the charge after the fee was already taken. Stripe keeps its fee.',
    steps: [
      { label: 'Authorize $50', story: 'Auth a $50 charge.', flow: 'authorize', params: { amountMinor: 5000 }, highlight: ['CUSTOMER_FUNDING_USD','AUTHORIZATION_HOLD_USD'] },
      { label: 'Capture $50',   story: 'Capture in full.', flow: 'capture',   params: { authAmountMinor: 5000 }, highlight: ['PROCESSOR_RECEIVABLE_USD','MERCHANT_PAYABLE_ACME_USD'] },
      { label: 'Settle',        story: 'Network pays Stripe.', flow: 'settle', params: { amountMinor: 5000 }, highlight: ['PROCESSOR_RECEIVABLE_USD','STRIPE_CASH_USD'] },
      { label: 'Fee $1.75',     story: '2.9% + 30¢ on $50 = $1.75.', flow: 'fee', params: { grossAmountMinor: 5000 }, highlight: ['MERCHANT_PAYABLE_ACME_USD','STRIPE_FEE_REVENUE_USD'] },
      {
        label: 'Refund $50 (no fee return)',
        story: 'Customer refunded the full $50 but Stripe keeps its $1.75 fee — the merchant ends with -$1.75 owed back to Stripe.',
        flow: 'refund',
        params: { grossAmountMinor: 5000, refundFee: false, originalFeeMinor: computeStripeFee(5000) },
        highlight: ['MERCHANT_PAYABLE_ACME_USD','REFUND_CLEARING_USD','STRIPE_CASH_USD'],
      },
    ],
  },
  {
    slug: 'dispute-won',
    title: 'Dispute opened, then won',
    blurb: 'Customer files a chargeback; merchant fights and wins. Funds release back from reserve.',
    steps: [
      { label: 'Authorize $200', story: 'Auth $200.', flow: 'authorize', params: { amountMinor: 20000 } },
      { label: 'Capture $200',   story: 'Capture in full.', flow: 'capture', params: { authAmountMinor: 20000 } },
      { label: 'Settle',         story: 'Network pays Stripe.', flow: 'settle', params: { amountMinor: 20000 } },
      {
        label: 'Dispute opened',
        story: 'Customer disputes. Stripe pulls $200 from the merchant\'s payable into the dispute reserve until the case resolves.',
        flow: 'disputeOpen', params: { amountMinor: 20000 },
        highlight: ['MERCHANT_PAYABLE_ACME_USD','DISPUTE_RESERVE_USD'],
      },
      {
        label: 'Dispute won',
        story: 'Merchant wins. Reserve releases — funds flow back to merchant payable, ready to be paid out.',
        flow: 'disputeWon', params: { amountMinor: 20000 },
        highlight: ['DISPUTE_RESERVE_USD','MERCHANT_PAYABLE_ACME_USD'],
      },
    ],
  },
  {
    slug: 'dispute-lost',
    title: 'Dispute opened, then lost',
    blurb: 'Customer disputes and wins. Reserve releases as cash to the customer.',
    steps: [
      { label: 'Authorize $200', story: 'Auth $200.', flow: 'authorize', params: { amountMinor: 20000 } },
      { label: 'Capture $200',   story: 'Capture in full.', flow: 'capture', params: { authAmountMinor: 20000 } },
      { label: 'Settle',         story: 'Network pays Stripe.', flow: 'settle', params: { amountMinor: 20000 } },
      {
        label: 'Dispute opened',
        story: 'Customer disputes. Reserve takes the merchant\'s funds out of payable.',
        flow: 'disputeOpen', params: { amountMinor: 20000 },
        highlight: ['MERCHANT_PAYABLE_ACME_USD','DISPUTE_RESERVE_USD'],
      },
      {
        label: 'Dispute lost',
        story: 'Merchant loses. Reserve releases as cash to the customer — Stripe\'s cash drops by $200.',
        flow: 'disputeLost', params: { amountMinor: 20000, merchantHasFunds: true },
        highlight: ['DISPUTE_RESERVE_USD','STRIPE_CASH_USD'],
      },
    ],
  },
  {
    slug: 'cross-border-eur',
    title: 'Cross-border charge: €100 → USD merchant',
    blurb: 'EU customer pays €100; US merchant receives USD. Stripe earns a 2% FX margin.',
    steps: [
      {
        label: 'EU customer pays €100',
        story: 'Customer is charged in EUR. EUR funding hits the EUR clearing account; the USD leg books merchant payable in USD plus Stripe FX margin revenue.',
        flow: 'fxCharge',
        params: { customerAmountMinorEur: 10000, midMarketRate: 1.08, marginBps: 200 },
        highlight: ['CUSTOMER_FUNDING_EUR','FX_CLEARING_EUR','FX_CLEARING_USD','MERCHANT_PAYABLE_ACME_USD','STRIPE_FX_REVENUE_USD'],
      },
    ],
  },
];

export const findScenario = (slug: string) => SCENARIOS.find((s) => s.slug === slug);
