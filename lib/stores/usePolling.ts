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
 *
 * In addition to the periodic cadence, an immediate fetch is triggered
 * whenever `lastWriteLsn` advances in the store. Mutation handlers call
 * `setLastWriteLsn(lsn)` on success, so the UI updates right after every
 * transaction instead of waiting up to INTERVAL ms for the next tick.
 */
export function usePolling(active = true) {
  const appendTransactions = useLedger((s) => s.appendTransactions);
  const setAccounts        = useLedger((s) => s.setAccounts);
  const setPolling         = useLedger((s) => s.setPolling);
  const lastSeenIdRef = useRef(0);
  const lastWriteLsnRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) {
      setPolling(false);
      return;
    }
    setPolling(true);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let pendingKick = false;
    let seenLsn: string | null = useLedger.getState().lastWriteLsn;
    lastWriteLsnRef.current = seenLsn;

    async function runFetch() {
      // Coalesce overlapping calls: if a fetch is in flight when an LSN
      // kick or interval tick fires, mark a pending kick so we run once
      // more right after the current call completes.
      if (inFlight) {
        pendingKick = true;
        return;
      }
      inFlight = true;
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
        // swallow — next tick or kick will retry
      } finally {
        inFlight = false;
        if (!cancelled && pendingKick) {
          pendingKick = false;
          // Run again to pick up whatever advanced the LSN mid-fetch.
          void runFetch();
        }
      }
    }

    async function tick() {
      await runFetch();
      if (!cancelled) timer = setTimeout(tick, INTERVAL);
    }
    tick();

    // Mirror lastWriteLsn into the ref AND trigger an immediate fetch when
    // it advances (i.e. a write just landed). The reducer is monotonic, so
    // any change here is a real advance — but we still compare to avoid
    // re-firing on unrelated store updates.
    const unsub = useLedger.subscribe((s) => {
      if (s.lastWriteLsn === seenLsn) return;
      seenLsn = s.lastWriteLsn;
      lastWriteLsnRef.current = s.lastWriteLsn;
      void runFetch();
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsub();
      setPolling(false);
    };
  }, [active, appendTransactions, setAccounts, setPolling]);
}
