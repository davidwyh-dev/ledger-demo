'use client';

import { create } from 'zustand';
import type { TransactionWithPostings } from '@/lib/ledger/query';
import type { AccountBalance } from '@/lib/ledger/balances';

/** Postgres LSNs are strings of the form "X/Y" where X and Y are hex. Compare as the pair. */
function compareLsn(a: string, b: string): number {
  const [aHi, aLo] = a.split('/');
  const [bHi, bLo] = b.split('/');
  const aHiN = BigInt(`0x${aHi}`);
  const bHiN = BigInt(`0x${bHi}`);
  if (aHiN !== bHiN) return aHiN < bHiN ? -1 : 1;
  const aLoN = BigInt(`0x${aLo}`);
  const bLoN = BigInt(`0x${bLo}`);
  if (aLoN !== bLoN) return aLoN < bLoN ? -1 : 1;
  return 0;
}

type Toast = {
  id: string;
  kind: 'success' | 'error' | 'info' | 'invariant';
  title: string;
  body?: string;
};

type LedgerState = {
  transactions: TransactionWithPostings[];
  accounts: AccountBalance[];
  highlightedAccounts: string[];
  storyStep: { scenarioSlug: string; index: number; story: string; label: string } | null;
  toasts: Toast[];
  isPolling: boolean;
  lastSeenId: number;
  /**
   * Writer WAL LSN of the most recent successful write made by this client.
   * Read endpoints accept `?after_lsn=<lsn>` so the next poll can be fenced
   * against a possibly-stale replica, giving read-your-writes.
   */
  lastWriteLsn: string | null;

  // actions
  setAccounts: (a: AccountBalance[]) => void;
  appendTransactions: (t: TransactionWithPostings[]) => void;
  setLastSeenId: (id: number) => void;
  setHighlight: (codes: string[]) => void;
  clearHighlight: () => void;
  setStoryStep: (s: LedgerState['storyStep']) => void;
  pushToast: (t: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  setPolling: (v: boolean) => void;
  setLastWriteLsn: (lsn: string | null) => void;
  reset: () => void;
};

export const useLedger = create<LedgerState>((set) => ({
  transactions: [],
  accounts: [],
  highlightedAccounts: [],
  storyStep: null,
  toasts: [],
  isPolling: false,
  lastSeenId: 0,
  lastWriteLsn: null,

  setAccounts: (a) => set({ accounts: a }),
  appendTransactions: (t) =>
    set((s) => {
      if (t.length === 0) return s;
      const seen = new Set(s.transactions.map((x) => x.id));
      const fresh = t.filter((x) => !seen.has(x.id));
      const next = [...s.transactions, ...fresh];
      const maxId = Math.max(s.lastSeenId, ...fresh.map((x) => x.id));
      return { transactions: next, lastSeenId: maxId };
    }),
  setLastSeenId: (id) => set({ lastSeenId: id }),
  setHighlight: (codes) => set({ highlightedAccounts: codes }),
  clearHighlight: () => set({ highlightedAccounts: [] }),
  setStoryStep: (s) => set({ storyStep: s }),
  pushToast: (t) =>
    set((s) => ({ toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }] })),
  removeToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
  setPolling: (v) => set({ isPolling: v }),
  setLastWriteLsn: (lsn) =>
    set((s) => {
      // Monotonic: never regress to an older LSN. LSNs sort lexicographically
      // when zero-padded, but the canonical form `X/Y` does not — split and
      // compare as bigints.
      if (!lsn) return s;
      if (!s.lastWriteLsn || compareLsn(lsn, s.lastWriteLsn) > 0) {
        return { lastWriteLsn: lsn };
      }
      return s;
    }),
  reset: () =>
    set({
      transactions: [],
      accounts: [],
      highlightedAccounts: [],
      storyStep: null,
      lastSeenId: 0,
      lastWriteLsn: null,
    }),
}));
