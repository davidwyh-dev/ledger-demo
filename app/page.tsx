import Link from 'next/link';
import { ArrowRight, Code2, Database, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="flex flex-col flex-1 min-h-screen">
      <header className="flex items-center justify-between px-6 py-4 border-b">
        <span className="font-semibold tracking-tight">Ledger Demo</span>
        <nav className="flex items-center gap-4 text-sm text-[color:var(--color-muted-foreground)]">
          <Link
            href="/ledger"
            className="rounded-md bg-[color:var(--color-foreground)] text-[color:var(--color-background)] px-3 py-1.5 hover:opacity-90"
          >
            Open demo
          </Link>
        </nav>
      </header>

      <main className="flex-1 flex flex-col items-center px-6 py-16 lg:py-24">
        <div className="max-w-2xl text-center">
          <p className="text-xs uppercase tracking-wide font-medium text-[color:var(--color-muted-foreground)] mb-4">
            Inspired by Stripe&rsquo;s ledger system
          </p>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1] mb-6">
            A double-entry ledger you can <span className="italic">break</span>.
          </h1>
          <p className="text-lg text-[color:var(--color-muted-foreground)] leading-relaxed mb-10">
            Trigger flows like authorize, capture, dispute, and cross-currency FX.
            Watch T-accounts post in real time. Then click <em>Break it</em> and
            watch the database refuse an unbalanced transaction.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/ledger"
              className="rounded-md bg-[color:var(--color-foreground)] text-[color:var(--color-background)] px-5 py-2.5 font-medium hover:opacity-90 flex items-center gap-2"
            >
              Open the demo <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mt-20 w-full">
          <Card
            icon={<Database className="size-4" />}
            title="The SQL is the demo."
            body="Invariants live in Postgres CHECK constraints, deferred constraint triggers, and REVOKE UPDATE/DELETE — not in JavaScript. Open the demo and click 'how it works' to see the actual schema."
          />
          <Card
            icon={<Zap className="size-4" />}
            title="Click to break it."
            body="Send a deliberately unbalanced transaction. The database raises and refuses. The literal RAISE EXCEPTION text shows up in the toast. Proof, not theatre."
          />
          <Card
            icon={<Code2 className="size-4" />}
            title="Three live views."
            body="T-accounts, money-flow Sankey, and a transaction stream — all subscribed to the same store, all updated by polling /api/transactions every 750ms."
          />
        </div>
      </main>

      <footer className="px-6 py-8 border-t text-xs text-[color:var(--color-muted-foreground)] text-center">
        Built with Next.js, Postgres on Neon, Drizzle, and d3-sankey.
      </footer>
    </div>
  );
}

function Card({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-lg border p-5 bg-[color:var(--color-background)]">
      <div className="flex items-center gap-2 mb-2 text-[color:var(--color-muted-foreground)]">{icon}</div>
      <div className="font-medium mb-2">{title}</div>
      <p className="text-sm text-[color:var(--color-muted-foreground)] leading-relaxed">{body}</p>
    </div>
  );
}
