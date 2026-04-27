import type { Sql } from 'postgres';

export type AccountBalance = {
  id: number;
  code: string;
  name: string;
  type: 'asset' | 'liability' | 'revenue' | 'expense' | 'equity';
  currency: string;
  balanceMinor: number;
};

export async function getBalances(sql: Sql): Promise<AccountBalance[]> {
  const rows = await sql<
    { id: number; code: string; name: string; type: AccountBalance['type']; currency: string; balance_minor: number }[]
  >`SELECT id, code, name, type, currency, balance_minor FROM account_balances ORDER BY code`;
  return rows.map((r) => ({
    id: Number(r.id),
    code: r.code,
    name: r.name,
    type: r.type,
    currency: r.currency,
    balanceMinor: Number(r.balance_minor),
  }));
}

export async function getBalance(sql: Sql, accountCode: string): Promise<number> {
  const rows = await sql<{ balance_minor: number }[]>`
    SELECT balance_minor FROM account_balances WHERE code = ${accountCode}
  `;
  if (rows.length === 0) throw new Error(`Unknown account: ${accountCode}`);
  return Number(rows[0].balance_minor);
}

/**
 * The fundamental balance-sheet equation per currency:
 *   assets - liabilities - equity - (revenue - expenses) = 0
 *
 * For a healthy ledger this should always hold. Used in scenario tests
 * to assert end-state correctness.
 */
export async function balanceSheetEquationsByCurrency(sql: Sql) {
  const rows = await sql<{ currency: string; net: number }[]>`
    SELECT
      a.currency,
      SUM(CASE
        WHEN a.type IN ('asset','expense') THEN ab.balance_minor
        WHEN a.type IN ('liability','revenue','equity') THEN -ab.balance_minor
        ELSE 0
      END)::BIGINT AS net
    FROM accounts a
    JOIN account_balances ab ON ab.id = a.id
    GROUP BY a.currency
  `;
  return rows.map((r) => ({ currency: r.currency, netMinor: Number(r.net) }));
}
