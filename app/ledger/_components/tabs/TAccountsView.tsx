'use client';

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLedger } from '@/lib/stores/ledgerStore';
import { cn, formatMoney } from '@/lib/utils';

const TYPE_LABEL: Record<string, string> = {
  asset:     'Asset',
  liability: 'Liability',
  revenue:   'Revenue',
  expense:   'Expense',
  equity:    'Equity',
};

export default function TAccountsView() {
  const accounts     = useLedger((s) => s.accounts);
  const transactions = useLedger((s) => s.transactions);
  const highlight    = useLedger((s) => s.highlightedAccounts);

  // Build per-account posting list, ordered chronologically
  const postingsByAccount = useMemo(() => {
    const map = new Map<string, { txnId: number; direction: 'debit' | 'credit'; amountMinor: number; currency: string; postingId: number }[]>();
    for (const t of transactions) {
      for (const p of t.postings) {
        if (!map.has(p.accountCode)) map.set(p.accountCode, []);
        map.get(p.accountCode)!.push({
          txnId: t.id,
          direction: p.direction,
          amountMinor: p.amountMinor,
          currency: p.currency,
          postingId: p.id,
        });
      }
    }
    return map;
  }, [transactions]);

  // Only show accounts that have postings, sorted by relevance (highlight first, then by activity)
  const visibleAccounts = useMemo(() => {
    const withActivity = accounts.filter((a) => (postingsByAccount.get(a.code)?.length ?? 0) > 0);
    return withActivity.sort((a, b) => {
      const aH = highlight.includes(a.code) ? 1 : 0;
      const bH = highlight.includes(b.code) ? 1 : 0;
      if (aH !== bH) return bH - aH;
      return a.code.localeCompare(b.code);
    });
  }, [accounts, postingsByAccount, highlight]);

  if (visibleAccounts.length === 0) {
    return (
      <EmptyState
        title="No postings yet"
        body="Trigger a scenario or a flow from the control panel to see T-accounts populate. Try the “Happy path” scenario as a starting point."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
      {visibleAccounts.map((acct) => (
        <TAccountCard
          key={acct.code}
          code={acct.code}
          name={acct.name}
          type={acct.type}
          currency={acct.currency}
          balanceMinor={acct.balanceMinor}
          postings={postingsByAccount.get(acct.code) ?? []}
          highlighted={highlight.includes(acct.code)}
        />
      ))}
    </div>
  );
}

function TAccountCard({
  code, name, type, currency, balanceMinor, postings, highlighted,
}: {
  code: string;
  name: string;
  type: string;
  currency: string;
  balanceMinor: number;
  postings: { txnId: number; direction: 'debit' | 'credit'; amountMinor: number; currency: string; postingId: number }[];
  highlighted: boolean;
}) {
  const debits  = postings.filter((p) => p.direction === 'debit');
  const credits = postings.filter((p) => p.direction === 'credit');

  return (
    <motion.div
      layout
      animate={{
        boxShadow: highlighted ? '0 0 0 2px var(--color-accent)' : '0 0 0 0px transparent',
      }}
      transition={{ duration: 0.25 }}
      className="rounded-lg border bg-[color:var(--color-background)] overflow-hidden"
    >
      <div className="flex items-baseline justify-between gap-2 border-b px-4 py-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)]">
            {TYPE_LABEL[type] ?? type} · {currency}
          </div>
          <div className="text-sm font-medium truncate" title={name}>{name}</div>
          <div className="text-[10px] font-mono text-[color:var(--color-muted-foreground)] truncate">{code}</div>
        </div>
        <div className={cn(
          'font-mono text-base tabular-nums',
          balanceMinor === 0
            ? 'text-[color:var(--color-muted-foreground)]'
            : balanceMinor > 0 ? 'text-[color:var(--color-foreground)]' : 'text-[color:var(--color-invariant)]',
        )}>
          {formatMoney(balanceMinor, currency)}
        </div>
      </div>
      <div className="grid grid-cols-2 divide-x">
        <Column title="Debits" colorClass="text-[color:var(--color-debit)]">
          <AnimatePresence initial={false}>
            {debits.map((p) => (
              <motion.div
                key={p.postingId}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between px-3 py-1.5 text-sm font-mono tabular-nums"
              >
                <span className="text-[color:var(--color-muted-foreground)] text-xs">#{p.txnId}</span>
                <span>{formatMoney(p.amountMinor, p.currency)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </Column>
        <Column title="Credits" colorClass="text-[color:var(--color-credit)]">
          <AnimatePresence initial={false}>
            {credits.map((p) => (
              <motion.div
                key={p.postingId}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="flex items-center justify-between px-3 py-1.5 text-sm font-mono tabular-nums"
              >
                <span>{formatMoney(p.amountMinor, p.currency)}</span>
                <span className="text-[color:var(--color-muted-foreground)] text-xs">#{p.txnId}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </Column>
      </div>
    </motion.div>
  );
}

function Column({ title, colorClass, children }: { title: string; colorClass: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn('px-3 py-1 text-[11px] uppercase tracking-wide font-medium border-b bg-[color:var(--color-muted)]/40', colorClass)}>
        {title}
      </div>
      <div className="min-h-12">{children}</div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-12 text-center">
      <div className="text-lg font-medium mb-1">{title}</div>
      <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-md">{body}</p>
    </div>
  );
}
