'use client';

import { useEffect, useRef } from 'react';
import { useLedger } from './ledgerStore';

const INTERVAL = 750;

/**
 * Polls /api/transactions and /api/accounts at INTERVAL ms while `active`
 * is true (or always, if you don't pass an arg). Dedupes transactions by id.
 *
 * Each poll passes `after_lsn=<lastWriteLsn>` so the API can fence the
 * read against a stale replica — a write made by this client will be
 * visible on the very next poll, not eventually.
 */
export function usePolling(active = true) {
  const appendTransactions = useLedger((s) => s.appendTransactions);
  const setAccounts        = useLedger((s) => s.setAccounts);
  const setPolling         = useLedger((s) => s.setPolling);
  const lastSeenIdRef = useRef(0);
  const lastWriteLsnRef = useRef<string | null>(null);

  // Keep the ref synced with the store without causing the effect below to
  // re-run on every write — the polling loop reads through the ref.
  useEffect(() => {
    return useLedger.subscribe((s) => {
      lastWriteLsnRef.current = s.lastWriteLsn;
    });
  }, []);

  useEffect(() => {
    if (!active) {
      setPolling(false);
      return;
    }
    setPolling(true);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function tick() {
      try {
        const lsn = lastWriteLsnRef.current;
        const lsnQs = lsn ? `&after_lsn=${encodeURIComponent(lsn)}` : '';
        const acctQs = lsn ? `?after_lsn=${encodeURIComponent(lsn)}` : '';
        const [txnRes, acctRes] = await Promise.all([
          fetch(`/api/transactions?since=${lastSeenIdRef.current}${lsnQs}`, { cache: 'no-store' }),
          fetch(`/api/accounts${acctQs}`, { cache: 'no-store' }),
        ]);
        const txnJson = await txnRes.json();
        const acctJson = await acctRes.json();
        if (cancelled) return;
        if (Array.isArray(txnJson.transactions) && txnJson.transactions.length > 0) {
          appendTransactions(txnJson.transactions);
          const maxId = Math.max(...txnJson.transactions.map((t: { id: number }) => t.id));
          if (maxId > lastSeenIdRef.current) lastSeenIdRef.current = maxId;
        }
        if (Array.isArray(acctJson.accounts)) setAccounts(acctJson.accounts);
      } catch {
        // swallow — next tick will retry
      } finally {
        if (!cancelled) timer = setTimeout(tick, INTERVAL);
      }
    }
    tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      setPolling(false);
    };
  }, [active, appendTransactions, setAccounts, setPolling]);
}
