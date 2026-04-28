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

const TYPE_LABEL_PLURAL: Record<string, string> = {
  asset:     'Assets',
  liability: 'Liabilities',
  revenue:   'Revenue',
  expense:   'Expenses',
  equity:    'Equity',
};

// Debit-normal types (left column = "Asset side") and credit-normal types
// (right column = "Liability side"), per the accounting equation:
//   Assets + Expenses = Liabilities + Equity + Revenue
const ASSET_SIDE_TYPES = ['asset', 'expense'] as const;
const LIABILITY_SIDE_TYPES = ['liability', 'equity', 'revenue'] as const;

type Posting = { txnId: number; direction: 'debit' | 'credit'; amountMinor: number; currency: string; postingId: number };

export default function TAccountsView() {
  const accounts      = useLedger((s) => s.accounts);
  const transactions  = useLedger((s) => s.transactions);
  const highlight     = useLedger((s) => s.highlightedAccounts);
  const selectedTxnId = useLedger((s) => s.selectedTxnId);

  // Build per-account posting list, ordered chronologically
  const postingsByAccount = useMemo(() => {
    const map = new Map<string, Posting[]>();
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
        body="Trigger a flow or run a story from the Actions menu to see T-accounts populate. Try the “Happy path” story as a starting point."
      />
    );
  }

  const assetSide     = visibleAccounts.filter((a) => (ASSET_SIDE_TYPES     as readonly string[]).includes(a.type));
  const liabilitySide = visibleAccounts.filter((a) => (LIABILITY_SIDE_TYPES as readonly string[]).includes(a.type));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-6">
      <ColumnSection
        label="Assets"
        accounts={assetSide}
        subtypes={ASSET_SIDE_TYPES}
        postingsByAccount={postingsByAccount}
        highlight={highlight}
        selectedTxnId={selectedTxnId}
      />
      <ColumnSection
        label="Liabilities"
        accounts={liabilitySide}
        subtypes={LIABILITY_SIDE_TYPES}
        postingsByAccount={postingsByAccount}
        highlight={highlight}
        selectedTxnId={selectedTxnId}
      />
    </div>
  );
}

function ColumnSection({
  label,
  accounts,
  subtypes,
  postingsByAccount,
  highlight,
  selectedTxnId,
}: {
  label: string;
  accounts: { code: string; name: string; type: string; currency: string; balanceMinor: number }[];
  subtypes: readonly string[];
  postingsByAccount: Map<string, Posting[]>;
  highlight: string[];
  selectedTxnId: number | null;
}) {
  const usedSubtypes = subtypes.filter((t) => accounts.some((a) => a.type === t));
  const showSubtypeHeaders = usedSubtypes.length > 1;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm uppercase tracking-wide font-semibold text-[color:var(--color-muted-foreground)] border-b pb-1">
        {label}
      </h2>
      {accounts.length === 0 ? (
        <p className="text-xs text-[color:var(--color-muted-foreground)]">No {label.toLowerCase()} postings yet.</p>
      ) : (
        usedSubtypes.map((subtype) => {
          const subAccounts = accounts.filter((a) => a.type === subtype);
          if (subAccounts.length === 0) return null;
          return (
            <div key={subtype} className="flex flex-col gap-3">
              {showSubtypeHeaders && (
                <h3 className="text-[11px] uppercase tracking-wide font-medium text-[color:var(--color-muted-foreground)]">
                  {TYPE_LABEL_PLURAL[subtype] ?? TYPE_LABEL[subtype]}
                </h3>
              )}
              {subAccounts.map((acct) => {
                const postings = postingsByAccount.get(acct.code) ?? [];
                const txnSelected = selectedTxnId !== null && postings.some((p) => p.txnId === selectedTxnId);
                return (
                  <TAccountCard
                    key={acct.code}
                    code={acct.code}
                    name={acct.name}
                    type={acct.type}
                    currency={acct.currency}
                    balanceMinor={acct.balanceMinor}
                    postings={postings}
                    highlighted={highlight.includes(acct.code) || txnSelected}
                    selectedTxnId={selectedTxnId}
                  />
                );
              })}
            </div>
          );
        })
      )}
    </section>
  );
}

function TAccountCard({
  code, name, type, currency, balanceMinor, postings, highlighted, selectedTxnId,
}: {
  code: string;
  name: string;
  type: string;
  currency: string;
  balanceMinor: number;
  postings: Posting[];
  highlighted: boolean;
  selectedTxnId: number | null;
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
              <PostingRow key={p.postingId} p={p} selected={p.txnId === selectedTxnId} align="debit" />
            ))}
          </AnimatePresence>
        </Column>
        <Column title="Credits" colorClass="text-[color:var(--color-credit)]">
          <AnimatePresence initial={false}>
            {credits.map((p) => (
              <PostingRow key={p.postingId} p={p} selected={p.txnId === selectedTxnId} align="credit" />
            ))}
          </AnimatePresence>
        </Column>
      </div>
    </motion.div>
  );
}

function PostingRow({ p, selected, align }: { p: Posting; selected: boolean; align: 'debit' | 'credit' }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: align === 'debit' ? -8 : 8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      data-selected={selected || undefined}
      className={cn(
        'flex items-center justify-between px-3 py-1.5 text-sm font-mono tabular-nums transition-colors',
        selected && 'bg-[color:var(--color-accent)]/15 ring-1 ring-inset ring-[color:var(--color-accent)]/40',
      )}
    >
      {align === 'debit' ? (
        <>
          <span className="text-[color:var(--color-muted-foreground)] text-xs">#{p.txnId}</span>
          <span>{formatMoney(p.amountMinor, p.currency)}</span>
        </>
      ) : (
        <>
          <span>{formatMoney(p.amountMinor, p.currency)}</span>
          <span className="text-[color:var(--color-muted-foreground)] text-xs">#{p.txnId}</span>
        </>
      )}
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
