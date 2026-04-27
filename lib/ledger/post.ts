import type { Sql } from 'postgres';
import type { TransactionInput } from './types';

export type PostedTransaction = {
  id: number;
  kind: string;
  description: string;
  occurredAt: Date;
  /** True when this transaction already existed for the given external_id and was returned as-is. */
  replayed: boolean;
  /** Writer WAL LSN immediately after commit. Null if the database doesn't expose pg_current_wal_lsn. */
  lsn: string | null;
  postings: Array<{
    id: number;
    accountId: number;
    accountCode: string;
    direction: 'debit' | 'credit';
    amountMinor: number;
    currency: string;
  }>;
};

const MAX_SERIALIZATION_RETRIES = 3;

/**
 * Atomically write a transaction with its postings.
 *
 * Invariants enforced by the database (NOT this function):
 *   - per-currency sum of signed_amount = 0 across all postings (deferred constraint trigger)
 *   - posting currency must match account currency (BEFORE INSERT trigger)
 *   - postings/transactions are append-only (BEFORE UPDATE/DELETE triggers)
 *
 * Concurrency: runs at SERIALIZABLE isolation. On a serialization failure
 * (SQLSTATE 40001) the entire txn is retried up to MAX_SERIALIZATION_RETRIES
 * times. Other errors propagate.
 *
 * Idempotency: if `input.externalId` is set and a transaction with that
 * external_id already exists, the existing transaction is returned with
 * replayed=true. This makes client-side retries safe across failover.
 *
 * If any invariant fires, the entire transaction rolls back and this throws.
 */
export async function postTransaction(
  sql: Sql,
  input: TransactionInput,
): Promise<PostedTransaction> {
  if (input.postings.length === 0) {
    throw new Error('postTransaction: at least one posting is required');
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt++) {
    try {
      return await runOnce(sql, input);
    } catch (err) {
      // Idempotent replay: caller used an external_id that already exists.
      if (input.externalId && isUniqueViolation(err, 'transactions_external_id_key')) {
        const existing = await loadByExternalId(sql, input.externalId);
        if (existing) return existing;
        // Fell through (e.g. race), retry the loop.
      }
      // Retry on serialization failure only.
      if (isSerializationFailure(err) && attempt < MAX_SERIALIZATION_RETRIES - 1) {
        lastErr = err;
        continue;
      }
      throw err;
    }
  }
  throw lastErr ?? new Error('postTransaction: exhausted serialization retries');
}

async function runOnce(sql: Sql, input: TransactionInput): Promise<PostedTransaction> {
  return sql.begin(async (tx) => {
    await tx`SET TRANSACTION ISOLATION LEVEL SERIALIZABLE`;

    const [txnRow] = await tx<
      { id: number; kind: string; description: string; occurred_at: Date }[]
    >`
      INSERT INTO transactions (external_id, kind, description, occurred_at, reverses_id, metadata)
      VALUES (
        ${input.externalId ?? null},
        ${input.kind}::txn_kind,
        ${input.description},
        ${input.occurredAt ?? new Date()},
        ${input.reversesId ?? null},
        ${tx.json((input.metadata ?? {}) as Record<string, unknown> as never)}
      )
      RETURNING id, kind, description, occurred_at
    `;

    const codes = [...new Set(input.postings.map((p) => p.accountCode))];
    const acctRows = await tx<
      { id: number; code: string; currency: string }[]
    >`
      SELECT id, code, currency FROM accounts WHERE code IN ${tx(codes)}
    `;
    const byCode = new Map(acctRows.map((r) => [r.code, r]));

    for (const code of codes) {
      if (!byCode.has(code)) {
        throw new Error(`postTransaction: unknown account code "${code}"`);
      }
    }

    const postingRows = await tx<
      { id: number; account_id: number; direction: 'debit' | 'credit'; amount_minor: number; currency: string }[]
    >`
      INSERT INTO postings (transaction_id, account_id, direction, amount_minor, currency)
      VALUES ${tx(
        input.postings.map((p) => [
          txnRow.id,
          byCode.get(p.accountCode)!.id,
          p.direction,
          p.amountMinor,
          p.currency,
        ]),
      )}
      RETURNING id, account_id, direction, amount_minor, currency
    `;

    // Captured inside the txn so the LSN reflects the work just performed.
    // (On a connection that doesn't support pg_current_wal_lsn this returns null.)
    let lsn: string | null = null;
    try {
      const [lsnRow] = await tx<{ lsn: string }[]>`SELECT pg_current_wal_lsn()::text AS lsn`;
      lsn = lsnRow?.lsn ?? null;
    } catch {
      lsn = null;
    }

    return {
      id: Number(txnRow.id),
      kind: txnRow.kind,
      description: txnRow.description,
      occurredAt: txnRow.occurred_at,
      replayed: false,
      lsn,
      postings: postingRows.map((p, i) => ({
        id: Number(p.id),
        accountId: Number(p.account_id),
        accountCode: input.postings[i].accountCode,
        direction: p.direction,
        amountMinor: Number(p.amount_minor),
        currency: p.currency,
      })),
    };
  }) as unknown as PostedTransaction;
}

async function loadByExternalId(sql: Sql, externalId: string): Promise<PostedTransaction | null> {
  const txnRows = await sql<
    { id: number; kind: string; description: string; occurred_at: Date }[]
  >`
    SELECT id, kind, description, occurred_at
    FROM transactions
    WHERE external_id = ${externalId}
    LIMIT 1
  `;
  if (txnRows.length === 0) return null;
  const txn = txnRows[0];

  const postingRows = await sql<
    { id: number; account_id: number; code: string; direction: 'debit' | 'credit'; amount_minor: number; currency: string }[]
  >`
    SELECT p.id, p.account_id, a.code, p.direction, p.amount_minor, p.currency
    FROM postings p
    JOIN accounts a ON a.id = p.account_id
    WHERE p.transaction_id = ${txn.id}
    ORDER BY p.id
  `;

  return {
    id: Number(txn.id),
    kind: txn.kind,
    description: txn.description,
    occurredAt: txn.occurred_at,
    replayed: true,
    lsn: null, // Replay path doesn't need a fresh LSN — the data is already visible.
    postings: postingRows.map((p) => ({
      id: Number(p.id),
      accountId: Number(p.account_id),
      accountCode: p.code,
      direction: p.direction,
      amountMinor: Number(p.amount_minor),
      currency: p.currency,
    })),
  };
}

function isSerializationFailure(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === '40001';
}

function isUniqueViolation(err: unknown, constraint?: string): boolean {
  const e = err as { code?: string; constraint_name?: string } | null;
  if (e?.code !== '23505') return false;
  if (!constraint) return true;
  return e.constraint_name === constraint;
}
