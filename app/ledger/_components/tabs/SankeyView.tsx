'use client';

import { useMemo, useState } from 'react';
import { useLedger } from '@/lib/stores/ledgerStore';
import { buildFlows } from '@/lib/viz/sankey/buildFlows';
import SankeyChart from '@/lib/viz/sankey/SankeyChart';
import { cn } from '@/lib/utils';

const CURRENCIES = ['ALL', 'USD', 'EUR'] as const;
type CurrencyFilter = typeof CURRENCIES[number];

export default function SankeyView() {
  const transactions = useLedger((s) => s.transactions);
  const accounts     = useLedger((s) => s.accounts);
  const [filter, setFilter] = useState<CurrencyFilter>('USD');

  const { nodes, links } = useMemo(
    () => buildFlows(transactions, accounts, filter),
    [transactions, accounts, filter],
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <span className="text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)] mr-2">Currency</span>
        {CURRENCIES.map((c) => (
          <button
            key={c}
            onClick={() => setFilter(c)}
            className={cn(
              'px-2 py-1 text-xs rounded-md',
              filter === c ? 'bg-[color:var(--color-foreground)] text-[color:var(--color-background)]' : 'border hover:bg-[color:var(--color-muted)]',
            )}
          >
            {c}
          </button>
        ))}
        <span className="ml-auto text-xs text-[color:var(--color-muted-foreground)]">
          {links.length} flow edges across {nodes.length} accounts
        </span>
      </div>
      <div className="flex-1 min-h-0 p-4">
        {nodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-lg font-medium mb-1">No flows yet</div>
            <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-md">
              Run a scenario to see money flow between accounts.
            </p>
          </div>
        ) : (
          <SankeyChart nodes={nodes} links={links} currency={filter === 'ALL' ? 'USD' : filter} />
        )}
      </div>
    </div>
  );
}
