import type { TransactionWithPostings } from '@/lib/ledger/query';
import type { AccountBalance } from '@/lib/ledger/balances';

export type SankeyFlow = {
  source: string;
  target: string;
  value: number;
  currency: string;
  txnIds: number[];
};

/**
 * Aggregate postings into source→target flows for a Sankey diagram.
 *
 * For each transaction, classify postings into "outflows" (account balance
 * decreased) and "inflows" (account balance increased). Then proportionally
 * connect each outflow to every inflow, weighted by the inflow's share of
 * total inflow magnitude. Sums across all transactions.
 *
 * Per-currency separation: cross-currency transactions naturally split into
 * independent same-currency flows (the FX_CLEARING accounts bridge them).
 */
export function buildFlows(
  transactions: TransactionWithPostings[],
  accounts: AccountBalance[],
  currencyFilter: 'ALL' | 'USD' | 'EUR' = 'ALL',
): { nodes: { id: string; label: string }[]; links: SankeyFlow[] } {
  const normalByCode = new Map<string, 'debit' | 'credit'>();
  const labelByCode  = new Map<string, string>();
  for (const a of accounts) {
    // We only have `type` here, so derive normal from convention.
    const normal: 'debit' | 'credit' = a.type === 'asset' || a.type === 'expense' ? 'debit' : 'credit';
    normalByCode.set(a.code, normal);
    labelByCode.set(a.code, a.name);
  }

  type Edge = { source: string; target: string; currency: string; value: number; txnIds: Set<number> };
  const aggregate = new Map<string, Edge>();

  for (const txn of transactions) {
    const byCcy = new Map<string, { outflows: { code: string; amt: number }[]; inflows: { code: string; amt: number }[] }>();
    for (const p of txn.postings) {
      if (currencyFilter !== 'ALL' && p.currency !== currencyFilter) continue;
      const normal = normalByCode.get(p.accountCode);
      if (!normal) continue;
      const isInflow = normal === p.direction;
      const bucket = byCcy.get(p.currency) ?? { outflows: [], inflows: [] };
      (isInflow ? bucket.inflows : bucket.outflows).push({ code: p.accountCode, amt: p.amountMinor });
      byCcy.set(p.currency, bucket);
    }

    for (const [ccy, { outflows, inflows }] of byCcy) {
      const totalIn = inflows.reduce((s, i) => s + i.amt, 0);
      if (totalIn === 0) continue;
      for (const out of outflows) {
        for (const inn of inflows) {
          const value = (out.amt * inn.amt) / totalIn;
          if (value <= 0) continue;
          const key = `${out.code}→${inn.code}|${ccy}`;
          const e = aggregate.get(key) ?? { source: out.code, target: inn.code, currency: ccy, value: 0, txnIds: new Set<number>() };
          e.value += value;
          e.txnIds.add(txn.id);
          aggregate.set(key, e);
        }
      }
    }
  }

  const nodeIds = new Set<string>();
  const links: SankeyFlow[] = [];
  for (const e of aggregate.values()) {
    if (e.value < 1) continue;
    nodeIds.add(e.source);
    nodeIds.add(e.target);
    links.push({
      source: e.source,
      target: e.target,
      currency: e.currency,
      value: e.value,
      txnIds: [...e.txnIds],
    });
  }

  const nodes = [...nodeIds].map((id) => ({ id, label: labelByCode.get(id) ?? id }));
  return { nodes, links };
}
