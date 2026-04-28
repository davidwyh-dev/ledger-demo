'use client';

import { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export default function HowItWorksModal({
  open,
  onClose,
  html,
}: { open: boolean; onClose: () => void; html: string }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="how-it-works-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <motion.div
            key="how-it-works-modal"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-[min(900px,90vw)] max-h-[85vh] overflow-y-auto rounded-lg border bg-[color:var(--color-background)] shadow-xl"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-[color:var(--color-muted)]/60 transition-colors"
            >
              <X className="size-4" />
            </button>

            <div className="px-8 py-10">
              <p className="text-xs uppercase tracking-wide font-medium text-[color:var(--color-muted-foreground)] mb-3">
                How it works
              </p>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mb-6">
                The SQL is the demo.
              </h1>
              <p className="text-base text-[color:var(--color-muted-foreground)] leading-relaxed mb-10">
                A ledger is only as trustworthy as the invariants it enforces. In
                this project, the invariants live in Postgres — not in
                JavaScript — so they are demonstrably enforced regardless of which
                client writes to the database.
              </p>

              <Section
                n="1"
                title="Per-currency sum-zero per transaction"
                body={
                  <>
                    <p>
                      Every transaction must consist of postings that net to zero per
                      currency. A single debit without an offsetting credit, or a
                      cross-currency transaction where one currency leg is unbalanced,
                      is rejected at <code>COMMIT</code> time by a deferred constraint
                      trigger.
                    </p>
                    <p>
                      Deferred matters: each posting is inserted in turn, and the
                      trigger only validates the full set when the transaction
                      commits.
                    </p>
                  </>
                }
              />

              <Section
                n="2"
                title="Posting currency must match account currency"
                body={
                  <p>
                    A posting on a USD account must be in USD. A <code>BEFORE INSERT </code>
                    trigger guards against ever charging an EUR amount to a USD-denominated
                    account.
                  </p>
                }
              />

              <Section
                n="3"
                title="Append-only — never UPDATE, never DELETE"
                body={
                  <p>
                    Postings and transactions are immutable. The schema both
                    <code> REVOKE</code>s update/delete privileges and adds rejection
                    triggers as a belt-and-suspenders. Corrections are made by
                    inserting a <em>new</em> transaction with{' '}
                    <code>reverses_id</code> pointing back to the original.
                  </p>
                }
              />

              <Section
                n="4"
                title="Balances are computed, never stored"
                body={
                  <p>
                    The <code>account_balances</code> view sums postings on demand.
                    There is no balance column to drift out of sync with the postings
                    that produced it.
                  </p>
                }
              />

              <h2 className="text-lg font-semibold mt-12 mb-3">The full schema</h2>
              <p className="text-sm text-[color:var(--color-muted-foreground)] mb-4">
                This is the verbatim contents of{' '}
                <code>drizzle/0000_init.sql</code> — the file applied to a fresh
                database. Every invariant above is a piece of this file.
              </p>
              <div
                className="rounded-lg border p-4 overflow-auto text-xs leading-relaxed [&_pre]:bg-transparent! [&_pre]:p-0!"
                dangerouslySetInnerHTML={{ __html: html }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ n, title, body }: { n: string; title: string; body: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold mb-2 flex items-baseline gap-3">
        <span className="text-sm text-[color:var(--color-muted-foreground)] font-mono">{n}.</span>
        {title}
      </h2>
      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-3 [&_code]:text-xs [&_code]:bg-[color:var(--color-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
        {body}
      </div>
    </section>
  );
}
