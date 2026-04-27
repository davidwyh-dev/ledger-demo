import type { Sql } from 'postgres';
import { z } from 'zod';
import { authorize } from './authorize';
import { capture } from './capture';
import { settle } from './settle';
import { fee } from './fee';
import { payout } from './payout';
import { refund } from './refund';
import { disputeOpen, disputeWon, disputeLost } from './dispute';
import { fxCharge } from './fxCharge';

const ccy = z.enum(['USD', 'EUR']).optional();
// Every write flow accepts an optional externalId so client-supplied
// idempotency keys flow through Zod validation into postTransaction.
const idem = { externalId: z.string().optional() };

export const FLOW_REGISTRY = {
  authorize: {
    schema: z.object({ ...idem, amountMinor: z.number().int().positive(), currency: ccy }),
    run: (sql: Sql, p: unknown) => authorize(sql, FLOW_REGISTRY.authorize.schema.parse(p)),
  },
  capture: {
    schema: z.object({
      ...idem,
      authAmountMinor: z.number().int().positive(),
      captureAmountMinor: z.number().int().positive().optional(),
      currency: ccy,
    }),
    run: (sql: Sql, p: unknown) => capture(sql, FLOW_REGISTRY.capture.schema.parse(p)),
  },
  settle: {
    schema: z.object({ ...idem, amountMinor: z.number().int().positive(), currency: ccy }),
    run: (sql: Sql, p: unknown) => settle(sql, FLOW_REGISTRY.settle.schema.parse(p)),
  },
  fee: {
    schema: z.object({ ...idem, grossAmountMinor: z.number().int().positive(), feeAmountMinor: z.number().int().nonnegative().optional() }),
    run: (sql: Sql, p: unknown) => fee(sql, FLOW_REGISTRY.fee.schema.parse(p)),
  },
  payout: {
    schema: z.object({ ...idem, amountMinor: z.number().int().positive(), currency: ccy }),
    run: (sql: Sql, p: unknown) => payout(sql, FLOW_REGISTRY.payout.schema.parse(p)),
  },
  refund: {
    schema: z.object({
      ...idem,
      grossAmountMinor: z.number().int().positive(),
      refundFee: z.boolean().optional(),
      originalFeeMinor: z.number().int().nonnegative().optional(),
    }),
    run: (sql: Sql, p: unknown) => refund(sql, FLOW_REGISTRY.refund.schema.parse(p)),
  },
  disputeOpen: {
    schema: z.object({ ...idem, amountMinor: z.number().int().positive() }),
    run: (sql: Sql, p: unknown) => disputeOpen(sql, FLOW_REGISTRY.disputeOpen.schema.parse(p)),
  },
  disputeWon: {
    schema: z.object({ ...idem, amountMinor: z.number().int().positive() }),
    run: (sql: Sql, p: unknown) => disputeWon(sql, FLOW_REGISTRY.disputeWon.schema.parse(p)),
  },
  disputeLost: {
    schema: z.object({ ...idem, amountMinor: z.number().int().positive(), merchantHasFunds: z.boolean().optional() }),
    run: (sql: Sql, p: unknown) => disputeLost(sql, FLOW_REGISTRY.disputeLost.schema.parse(p)),
  },
  fxCharge: {
    schema: z.object({
      ...idem,
      customerAmountMinorEur: z.number().int().positive(),
      midMarketRate: z.number().positive().optional(),
      marginBps: z.number().int().nonnegative().optional(),
    }),
    run: (sql: Sql, p: unknown) => fxCharge(sql, FLOW_REGISTRY.fxCharge.schema.parse(p)),
  },
} as const;

export type FlowName = keyof typeof FLOW_REGISTRY;

export const FLOW_NAMES = Object.keys(FLOW_REGISTRY) as FlowName[];
