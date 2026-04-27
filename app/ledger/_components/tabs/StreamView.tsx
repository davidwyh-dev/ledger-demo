'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLedger } from '@/lib/stores/ledgerStore';
import { cn, formatMoney } from '@/lib/utils';

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
  const transactions = useLedger((s) => s.transactions);
  const ordered = [...transactions].sort((a, b) => b.id - a.id);

  if (ordered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-center">
        <div className="text-lg font-medium mb-1">No transactions yet</div>
        <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-md">
          The transaction stream is the chronological event log. Each row expands to show the postings that make up the transaction.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4">
      <ol className="flex flex-col gap-2">
        <AnimatePresence initial={false}>
          {ordered.map((t) => (
            <motion.li
              key={t.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <TransactionRow t={t} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </div>
  );
}

function TransactionRow({
  t,
}: {
  t: import('@/lib/ledger/query').TransactionWithPostings;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border bg-[color:var(--color-background)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-[color:var(--color-muted)]/40"
      >
        <span className="font-mono text-xs text-[color:var(--color-muted-foreground)] w-10 shrink-0">#{t.id}</span>
        <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', KIND_HUE[t.kind] ?? 'bg-zinc-100')}>
          {KIND_LABEL[t.kind] ?? t.kind}
        </span>
        <span className="text-sm flex-1 truncate">{t.description}</span>
        <span className="text-xs text-[color:var(--color-muted-foreground)] tabular-nums">
          {new Date(t.occurredAt).toLocaleTimeString()}
        </span>
        <span className={cn('text-xs transition-transform', open && 'rotate-90')}>▶</span>
      </button>
      {open && (
        <div className="border-t px-3 py-2 bg-[color:var(--color-muted)]/30">
          <table className="w-full text-sm">
            <thead className="text-xs text-[color:var(--color-muted-foreground)]">
              <tr>
                <th className="text-left font-medium py-1">Account</th>
                <th className="text-right font-medium py-1 text-[color:var(--color-debit)]">Debit</th>
                <th className="text-right font-medium py-1 text-[color:var(--color-credit)]">Credit</th>
              </tr>
            </thead>
            <tbody className="font-mono tabular-nums">
              {t.postings.map((p) => (
                <tr key={p.id}>
                  <td className="py-0.5">
                    <span className="text-xs text-[color:var(--color-muted-foreground)]">{p.accountCode}</span>
                  </td>
                  <td className={cn('py-0.5 text-right', p.direction === 'debit' ? 'text-[color:var(--color-debit)]' : 'text-[color:var(--color-muted-foreground)]')}>
                    {p.direction === 'debit'  ? formatMoney(p.amountMinor, p.currency) : ''}
                  </td>
                  <td className={cn('py-0.5 text-right', p.direction === 'credit' ? 'text-[color:var(--color-credit)]' : 'text-[color:var(--color-muted-foreground)]')}>
                    {p.direction === 'credit' ? formatMoney(p.amountMinor, p.currency) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
