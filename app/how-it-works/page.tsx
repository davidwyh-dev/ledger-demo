import Link from 'next/link';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { codeToHtml } from 'shiki';

export const dynamic = 'force-static';

async function readSql(file: string) {
  const fullPath = path.resolve(process.cwd(), 'drizzle', file);
  return readFile(fullPath, 'utf8');
}

async function highlight(sql: string) {
  return codeToHtml(sql, {
    lang: 'sql',
    themes: { light: 'github-light', dark: 'github-dark' },
  });
}

export default async function HowItWorks() {
  const initSql = await readSql('0000_init.sql');
  const initHtml = await highlight(initSql);

  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <Link href="/" className="font-semibold tracking-tight">Ledger Demo</Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link
            href="/ledger"
            className="rounded-md bg-[color:var(--color-foreground)] text-[color:var(--color-background)] px-3 py-1.5 hover:opacity-90"
          >
            Open demo
          </Link>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs uppercase tracking-wide font-medium text-[color:var(--color-muted-foreground)] mb-3">
            How it works
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mb-6">
            The SQL is the demo.
          </h1>
          <p className="text-lg text-[color:var(--color-muted-foreground)] leading-relaxed mb-10">
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

          <h2 className="text-xl font-semibold mt-16 mb-4">The full schema</h2>
          <p className="text-sm text-[color:var(--color-muted-foreground)] mb-4">
            This is the verbatim contents of{' '}
            <code>drizzle/0000_init.sql</code> — the file applied to a fresh
            database. Every invariant above is a piece of this file.
          </p>
          <div
            className="rounded-lg border p-4 overflow-auto text-xs leading-relaxed [&_pre]:bg-transparent! [&_pre]:p-0!"
            dangerouslySetInnerHTML={{ __html: initHtml }}
          />
        </div>
      </main>
    </div>
  );
}

function Section({ n, title, body }: { n: string; title: string; body: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-semibold mb-2 flex items-baseline gap-3">
        <span className="text-sm text-[color:var(--color-muted-foreground)] font-mono">{n}.</span>
        {title}
      </h2>
      <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-3 [&_code]:text-xs [&_code]:bg-[color:var(--color-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded">
        {body}
      </div>
    </section>
  );
}
