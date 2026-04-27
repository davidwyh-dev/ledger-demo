import { describe, expect, it } from 'vitest';
import { getSql } from './setup';
import { postTransaction } from '@/lib/ledger/post';
import { A } from '@/lib/ledger/accounts';

const TXN = (externalId: string) => ({
  kind: 'authorize' as const,
  description: 'idempotency test',
  externalId,
  postings: [
    { accountCode: A.CUSTOMER_FUNDING_USD,   direction: 'debit'  as const, amountMinor: 10000, currency: 'USD' },
    { accountCode: A.AUTHORIZATION_HOLD_USD, direction: 'credit' as const, amountMinor: 10000, currency: 'USD' },
  ],
});

describe('postTransaction idempotency', () => {
  it('returns replayed=false on first call, replayed=true on second call with same external_id', async () => {
    const sql = getSql();
    const key = 'test-key-' + Math.random().toString(36).slice(2);

    const first = await postTransaction(sql, TXN(key));
    expect(first.replayed).toBe(false);
    expect(first.id).toBeGreaterThan(0);

    const second = await postTransaction(sql, TXN(key));
    expect(second.replayed).toBe(true);
    // Same logical transaction returned.
    expect(second.id).toBe(first.id);
    expect(second.postings.map((p) => p.id).sort()).toEqual(first.postings.map((p) => p.id).sort());
  });

  it('does not double-post when the same external_id is sent twice', async () => {
    const sql = getSql();
    const key = 'no-double-post-' + Math.random().toString(36).slice(2);

    await postTransaction(sql, TXN(key));
    await postTransaction(sql, TXN(key));

    const [{ count }] = await sql<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM transactions WHERE external_id = ${key}
    `;
    expect(count).toBe(1);
  });

  it('two different external_ids produce two distinct transactions', async () => {
    const sql = getSql();
    const a = await postTransaction(sql, TXN('keyA-' + Math.random()));
    const b = await postTransaction(sql, TXN('keyB-' + Math.random()));
    expect(a.id).not.toBe(b.id);
    expect(a.replayed).toBe(false);
    expect(b.replayed).toBe(false);
  });

  it('returns lsn on the fresh-write path', async () => {
    const sql = getSql();
    const txn = await postTransaction(sql, TXN('lsn-test-' + Math.random()));
    expect(txn.lsn).toMatch(/^[0-9A-F]+\/[0-9A-F]+$/);
  });
});
