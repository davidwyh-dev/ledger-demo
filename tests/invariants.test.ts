import { describe, expect, it } from 'vitest';
import { getSql } from './setup';
import { postTransaction } from '@/lib/ledger/post';
import { A } from '@/lib/ledger/accounts';

describe('Ledger invariants (enforced by Postgres)', () => {
  it('rejects a transaction with a single debit and no offsetting credit', async () => {
    const sql = getSql();
    await expect(
      postTransaction(sql, {
        kind: 'authorize',
        description: 'unbalanced single debit',
        postings: [
          { accountCode: A.CUSTOMER_FUNDING_USD, direction: 'debit', amountMinor: 100, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(/Ledger invariant violated.*net = 100/);
  });

  it('rejects a transaction where debits != credits in the same currency', async () => {
    const sql = getSql();
    await expect(
      postTransaction(sql, {
        kind: 'capture',
        description: 'unbalanced amounts',
        postings: [
          { accountCode: A.CUSTOMER_FUNDING_USD,   direction: 'debit',  amountMinor: 100, currency: 'USD' },
          { accountCode: A.AUTHORIZATION_HOLD_USD, direction: 'credit', amountMinor:  90, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(/Ledger invariant violated.*net = 10/);
  });

  it('rejects a posting whose currency does not match its account currency', async () => {
    const sql = getSql();
    await expect(
      postTransaction(sql, {
        kind: 'capture',
        description: 'currency mismatch',
        postings: [
          { accountCode: A.CUSTOMER_FUNDING_USD,   direction: 'debit',  amountMinor: 100, currency: 'EUR' },
          { accountCode: A.AUTHORIZATION_HOLD_USD, direction: 'credit', amountMinor: 100, currency: 'EUR' },
        ],
      }),
    ).rejects.toThrow(/posting currency EUR does not match account .* currency USD/);
  });

  it('rejects UPDATE on postings (append-only)', async () => {
    const sql = getSql();
    await postTransaction(sql, {
      kind: 'authorize',
      description: 'seed for update test',
      postings: [
        { accountCode: A.CUSTOMER_FUNDING_USD,   direction: 'debit',  amountMinor: 100, currency: 'USD' },
        { accountCode: A.AUTHORIZATION_HOLD_USD, direction: 'credit', amountMinor: 100, currency: 'USD' },
      ],
    });
    await expect(
      sql`UPDATE postings SET amount_minor = 999 WHERE id = (SELECT id FROM postings LIMIT 1)`,
    ).rejects.toThrow(/postings is append-only/);
  });

  it('rejects DELETE on transactions (append-only)', async () => {
    const sql = getSql();
    const txn = await postTransaction(sql, {
      kind: 'authorize',
      description: 'seed for delete test',
      postings: [
        { accountCode: A.CUSTOMER_FUNDING_USD,   direction: 'debit',  amountMinor: 100, currency: 'USD' },
        { accountCode: A.AUTHORIZATION_HOLD_USD, direction: 'credit', amountMinor: 100, currency: 'USD' },
      ],
    });
    await expect(
      sql`DELETE FROM transactions WHERE id = ${txn.id}`,
    ).rejects.toThrow(/transactions is append-only/);
  });

  it('rejects a cross-currency transaction where one currency leg is unbalanced', async () => {
    const sql = getSql();
    await expect(
      postTransaction(sql, {
        kind: 'fx_conversion',
        description: 'EUR leg unbalanced',
        postings: [
          // EUR leg is fine: debits 10000, credits 10000
          { accountCode: A.CUSTOMER_FUNDING_EUR, direction: 'debit',  amountMinor: 10000, currency: 'EUR' },
          { accountCode: A.FX_CLEARING_EUR,      direction: 'credit', amountMinor: 10000, currency: 'EUR' },
          // USD leg is unbalanced: debits 9000, credits 10000
          { accountCode: A.FX_CLEARING_USD,        direction: 'debit',  amountMinor:  9000, currency: 'USD' },
          { accountCode: A.MERCHANT_PAYABLE_USD,   direction: 'credit', amountMinor: 10000, currency: 'USD' },
        ],
      }),
    ).rejects.toThrow(/Ledger invariant violated.*USD/);
  });

  it('accepts a valid balanced transaction', async () => {
    const sql = getSql();
    const txn = await postTransaction(sql, {
      kind: 'authorize',
      description: 'happy authorize',
      postings: [
        { accountCode: A.CUSTOMER_FUNDING_USD,   direction: 'debit',  amountMinor: 10000, currency: 'USD' },
        { accountCode: A.AUTHORIZATION_HOLD_USD, direction: 'credit', amountMinor: 10000, currency: 'USD' },
      ],
    });
    expect(txn.id).toBeGreaterThan(0);
    expect(txn.postings).toHaveLength(2);
  });
});
