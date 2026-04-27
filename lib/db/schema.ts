import {
  pgTable,
  bigserial,
  bigint,
  text,
  smallint,
  char,
  timestamp,
  pgEnum,
  numeric,
  jsonb,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';

export const accountType   = pgEnum('account_type',   ['asset','liability','revenue','expense','equity']);
export const accountNormal = pgEnum('account_normal', ['debit','credit']);
export const txnKind       = pgEnum('txn_kind', [
  'authorize','capture','settle','fee','payout',
  'refund','dispute_open','dispute_won','dispute_lost',
  'fx_conversion','reversal',
]);

export const currencies = pgTable('currencies', {
  code:      char('code', { length: 3 }).primaryKey(),
  minorUnit: smallint('minor_unit').notNull(),
  symbol:    text('symbol').notNull(),
});

export const fxRates = pgTable(
  'fx_rates',
  {
    id:          bigserial('id', { mode: 'number' }).primaryKey(),
    fromCcy:     char('from_ccy', { length: 3 }).notNull().references(() => currencies.code),
    toCcy:       char('to_ccy',   { length: 3 }).notNull().references(() => currencies.code),
    rate:        numeric('rate', { precision: 20, scale: 10 }).notNull(),
    effectiveAt: timestamp('effective_at', { withTimezone: true }).notNull().defaultNow(),
    source:      text('source').notNull().default('demo-static'),
  },
  (t) => [index('fx_rates_lookup').on(t.fromCcy, t.toCcy, t.effectiveAt)],
);

export const accounts = pgTable('accounts', {
  id:            bigserial('id', { mode: 'number' }).primaryKey(),
  code:          text('code').notNull().unique(),
  name:          text('name').notNull(),
  type:          accountType('type').notNull(),
  normalBalance: accountNormal('normal_balance').notNull(),
  currency:      char('currency', { length: 3 }).notNull().references(() => currencies.code),
  metadata:      jsonb('metadata').notNull().default({}),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable(
  'transactions',
  {
    id:          bigserial('id', { mode: 'number' }).primaryKey(),
    externalId:  text('external_id').unique(),
    kind:        txnKind('kind').notNull(),
    description: text('description').notNull(),
    occurredAt:  timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    reversesId:  bigint('reverses_id', { mode: 'number' }).references((): AnyPgColumn => transactions.id),
    metadata:    jsonb('metadata').notNull().default({}),
    createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('transactions_occurred_at').on(t.occurredAt)],
);

export const postings = pgTable(
  'postings',
  {
    id:            bigserial('id', { mode: 'number' }).primaryKey(),
    transactionId: bigint('transaction_id', { mode: 'number' }).notNull().references(() => transactions.id),
    accountId:     bigint('account_id', { mode: 'number' }).notNull().references(() => accounts.id),
    direction:     accountNormal('direction').notNull(),
    amountMinor:   bigint('amount_minor', { mode: 'number' }).notNull(),
    currency:      char('currency', { length: 3 }).notNull().references(() => currencies.code),
    // signed_amount is GENERATED ALWAYS in SQL; not exposed to writes from app code.
    signedAmount:  bigint('signed_amount', { mode: 'number' }).notNull(),
    createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('postings_by_txn').on(t.transactionId),
    index('postings_by_account').on(t.accountId, t.createdAt),
  ],
);

export type Account     = typeof accounts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Posting     = typeof postings.$inferSelect;
export type Currency    = typeof currencies.$inferSelect;
export type FxRate      = typeof fxRates.$inferSelect;
