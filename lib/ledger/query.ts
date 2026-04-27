import type { Sql } from 'postgres';

export type TransactionWithPostings = {
  id: number;
  kind: string;
  description: string;
  occurredAt: string;
  externalId: string | null;
  reversesId: number | null;
  postings: Array<{
    id: number;
    accountId: number;
    accountCode: string;
    accountName: string;
    direction: 'debit' | 'credit';
    amountMinor: number;
    currency: string;
  }>;
};

/**
 * Return all transactions with postings, optionally only those after a given id.
 * Used by the polling endpoint to deliver incremental updates.
 */
export async function listTransactions(sql: Sql, sinceId = 0, limit = 200): Promise<TransactionWithPostings[]> {
  const rows = await sql<{
    id: number;
    kind: string;
    description: string;
    occurred_at: Date;
    external_id: string | null;
    reverses_id: number | null;
    postings: Array<{
      id: number;
      account_id: number;
      code: string;
      name: string;
      direction: 'debit' | 'credit';
      amount_minor: number;
      currency: string;
    }>;
  }[]>`
    SELECT
      t.id, t.kind, t.description, t.occurred_at, t.external_id, t.reverses_id,
      COALESCE(json_agg(
        json_build_object(
          'id',           p.id,
          'account_id',   p.account_id,
          'code',         a.code,
          'name',         a.name,
          'direction',    p.direction,
          'amount_minor', p.amount_minor,
          'currency',     p.currency
        ) ORDER BY p.id
      ) FILTER (WHERE p.id IS NOT NULL), '[]'::json) AS postings
    FROM transactions t
    LEFT JOIN postings p ON p.transaction_id = t.id
    LEFT JOIN accounts a ON a.id = p.account_id
    WHERE t.id > ${sinceId}
    GROUP BY t.id
    ORDER BY t.id ASC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    id: Number(r.id),
    kind: r.kind,
    description: r.description,
    occurredAt: r.occurred_at.toISOString(),
    externalId: r.external_id,
    reversesId: r.reverses_id == null ? null : Number(r.reverses_id),
    postings: r.postings.map((p) => ({
      id: Number(p.id),
      accountId: Number(p.account_id),
      accountCode: p.code,
      accountName: p.name,
      direction: p.direction,
      amountMinor: Number(p.amount_minor),
      currency: p.currency,
    })),
  }));
}
