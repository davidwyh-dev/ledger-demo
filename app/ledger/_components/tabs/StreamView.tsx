'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useLedger } from '@/lib/stores/ledgerStore';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<string, string> = {
  authorize: 'Authorize',
  capture: 'Capture',
  settle: 'Settle',
  fee: 'Fee',
  payout: 'Payout',
  refund: 'Refund',
  dispute_open: 'Dispute opened',
  dispute_won: 'Dispute won',
  dispute_lost: 'Dispute lost',
  fx_conversion: 'FX charge',
  reversal: 'Reversal',
};

const KIND_HUE: Record<string, string> = {
  authorize: 'bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200',
  capture: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  settle: 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100',
  fee: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  payout: 'bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200',
  refund: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  dispute_open: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  dispute_won: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  dispute_lost: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  fx_conversion: 'bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200',
  reversal: 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
};

export default function StreamView() {
  const transactions    = useLedger((s) => s.transactions);
  const selectedTxnId   = useLedger((s) => s.selectedTxnId);
  const setSelectedTxnId = useLedger((s) => s.setSelectedTxnId);
  const ordered = [...transactions].sort((a, b) => b.id - a.id);

  if (ordered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center">
        <div className="text-base font-medium mb-1">No transactions yet</div>
        <p className="text-xs text-[color:var(--color-muted-foreground)] max-w-xs">
          Each row here is one transaction. Click a row to highlight the postings it wrote in the T-accounts.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3">
      <ol className="flex flex-col gap-1.5">
        <AnimatePresence initial={false}>
          {ordered.map((t) => (
            <motion.li
              key={t.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TransactionRow
                t={t}
                selected={selectedTxnId === t.id}
                onClick={() => setSelectedTxnId(t.id)}
              />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

function TransactionRow({
  t,
  selected,
  onClick,
}: {
  t: import('@/lib/ledger/query').TransactionWithPostings;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-2 px-2.5 py-2 text-left rounded-md border transition-colors',
        selected
          ? 'border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10'
          : 'bg-[color:var(--color-background)] hover:bg-[color:var(--color-muted)]/40',
      )}
    >
      <span className="font-mono text-xs text-[color:var(--color-muted-foreground)] w-8 shrink-0">#{t.id}</span>
      <span className={cn('text-[11px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap', KIND_HUE[t.kind] ?? 'bg-zinc-100')}>
        {KIND_LABEL[t.kind] ?? t.kind}
      </span>
      <span className="text-xs flex-1 truncate">{t.description}</span>
      <span className="text-[10px] text-[color:var(--color-muted-foreground)] tabular-nums shrink-0">
        {new Date(t.occurredAt).toLocaleTimeString()}
      </span>
    </button>
  );
}
