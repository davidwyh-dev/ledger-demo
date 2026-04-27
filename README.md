# Ledger Demo

A working double-entry ledger inspired by [Stripe&rsquo;s ledger system](https://stripe.dev/blog/ledger-stripe-system-for-tracking-and-validating-money-movement). Trigger flows like authorize, capture, dispute, and cross-currency FX. Watch T-accounts post in real time. Then click **Break it** and watch the database refuse an unbalanced transaction.

## The pitch

> This is a working double-entry ledger with the same invariants Stripe enforces. You can trigger the same flows Stripe runs in production &mdash; authorize, capture, dispute, FX. Watch the T-accounts update in real time, then click &lsquo;Break it&rsquo; to watch the database refuse an unbalanced transaction. The SQL `CHECK` constraints, deferred constraint triggers, and `REVOKE UPDATE/DELETE` are the demo &mdash; I&rsquo;m not asserting the invariants hold, I&rsquo;m proving they do.

## What&rsquo;s in the box

- **Postgres-enforced invariants.** Per-currency sum-zero per transaction (deferred constraint trigger), posting-currency = account-currency (`BEFORE INSERT`), append-only postings/transactions (`REVOKE` + rejection triggers). See [`drizzle/0000_init.sql`](drizzle/0000_init.sql).
- **11 money-movement flows** &mdash; authorize, capture (full + partial), settle, fee, payout, refund (with/without fee return), dispute open / won / lost, cross-currency FX charge.
- **5 pre-canned scenarios** &mdash; happy path, partial refund, dispute won, dispute lost, cross-border EUR.
- **Three live visualizations** &mdash; T-accounts, money-flow Sankey (d3-sankey), transaction stream &mdash; all subscribed to the same Zustand store and updated by 750ms polling.
- **Story mode** &mdash; steps through a scenario with synchronized account highlights and plain-English narration.
- **Break it** &mdash; deliberately posts an unbalanced transaction so the database raises and refuses; the literal `RAISE EXCEPTION` text surfaces verbatim in a toast.
- **/how-it-works** &mdash; the actual schema rendered with Shiki, alongside prose explaining each invariant.
- **27 tests** &mdash; invariant suite, per-flow balance assertions, end-to-end scenario walkthroughs. Postgres-enforced via [embedded-postgres](https://github.com/leinelissen/embedded-postgres).

## Architecture

| Layer | Stack |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind 4 |
| State | Zustand + 750ms polling against `/api/transactions` and `/api/accounts` |
| Animation | Motion (Framer Motion successor) |
| Charts | d3-sankey + thin React wrapper |
| DB | Postgres (Neon in prod, embedded-postgres in dev/tests) |
| ORM | Drizzle (schema mirror) + raw SQL for invariant triggers |
| Driver | postgres.js |
| Code highlighting | Shiki (SSR, no runtime cost) |
| Testing | Vitest + embedded-postgres |
| Deploy | Vercel + Neon |

## Run locally

Two terminals.

```bash
# Terminal 1: embedded Postgres on port 54330
cp .env.local.example .env.local
npm install
npm run dev:db          # add --fresh to reset the data dir
```

```bash
# Terminal 2: Next.js
npm run dev             # http://localhost:3000
```

## Run tests

```bash
npm test                # Vitest + embedded-postgres
```

The first test run downloads a Postgres binary (~50MB cached under `.tmp/test-pg`).

## Deploy

### Single-endpoint (simplest)

1. **Neon** &mdash; create a free Postgres on [neon.tech](https://neon.tech). Grab the connection string.
2. **Vercel** &mdash; import the repo. Set `DATABASE_URL` (server-side) to the Neon connection string.
3. **Migrations** &mdash; run once against the Neon branch:

   ```bash
   DATABASE_URL='postgres://...' npm run db:migrate
   ```

4. Visit your Vercel URL and run the happy-path scenario.

### Multi-endpoint on Neon (writer + read replica, &ldquo;pretend multi-AZ&rdquo;)

The app supports separate connection pools for writer and reader, with idempotent writes and an optional LSN fence for read-your-writes. Neon&rsquo;s read-replica compute endpoints make this trivial to demo &mdash; one Neon project, two endpoints.

1. **Create a read replica.** In the Neon console: project &rarr; **Branches** &rarr; `main` &rarr; **Add compute** &rarr; choose **Replica**. You now have two compute endpoints reading from the same shared storage:
   - the original (read-write) primary &mdash; e.g. `ep-cool-fog-...neon.tech`
   - the new replica (read-only) &mdash; e.g. `ep-still-pond-...neon.tech`
2. **Use the pooled connection strings.** For each endpoint, copy the **pooled** connection string (the one with `-pooler` in the host, suitable for serverless). The pool is configured in [`lib/db/client.ts`](lib/db/client.ts) with `prepare: false`, which is required for pgbouncer transaction pooling.
3. **Set Vercel env vars** (server-side):
   - `DATABASE_URL_WRITER` &rarr; primary pooled connection string
   - `DATABASE_URL_READER` &rarr; replica pooled connection string
   - `DATABASE_URL` is no longer required when both of the above are set, but you can keep it as a fallback.
4. **Run migrations against the writer:**

   ```bash
   DATABASE_URL_WRITER='postgres://...primary-pooler.neon.tech/...' npm run db:migrate
   ```

5. **Verify** with `GET /api/health` &mdash; should return `{"ok":true,"checks":{"writer":"ok","reader":"ok"}}`. Run a flow; the response should include an `X-Postgres-Lsn` header. The next poll&rsquo;s `?after_lsn=` query param will fence the replica read.

What this demo proves:
- the writer / reader pool split works against two independent Postgres endpoints
- idempotent retries collapse on the writer&rsquo;s `transactions.external_id` UNIQUE constraint (`Idempotency-Replayed: true` header on the second POST with the same key)
- the LSN fence (`pg_last_wal_replay_lsn()` polling on the replica) actually waits for replay before returning a read, so a write made by the client is visible on the very next poll

What it does **not** prove (because Neon&rsquo;s architecture is shared-storage):
- real failover behaviour (Neon failover is near-instant; no traditional WAL-replay catchup)
- real cross-AZ latency or partition tolerance
- split-brain risk (Neon&rsquo;s storage layer prevents it by design)

For a production multi-AZ posture in AWS the same code points at RDS Proxy writer + reader endpoints in front of an Aurora cluster &mdash; the application code is identical; only the env vars change.

## Project layout

```
app/
  page.tsx                        landing
  ledger/
    page.tsx                      tabbed demo
    _components/
      LedgerWorkspace.tsx
      ControlPanel.tsx
      QuickActions.tsx
      StoryModePanel.tsx
      tabs/
        TAccountsView.tsx
        StreamView.tsx
        SankeyView.tsx
  how-it-works/page.tsx           rendered SQL + invariant prose
  api/
    accounts/route.ts             GET balances
    transactions/route.ts         GET stream (?since=N)
    flows/[name]/route.ts         POST single flow
    scenarios/route.ts            GET scenario list
    scenarios/[slug]/route.ts     POST run a scenario
    break-it/route.ts             POST unbalanced txn (always fails)
    reset/route.ts                POST truncate ledger

drizzle/
  0000_init.sql                   schema + invariant triggers + REVOKEs
  0001_seed_currencies_fx.sql     currencies + static FX rates
  0002_seed_chart.sql             chart of accounts

lib/
  db/{client,schema,migrate}.ts
  ledger/
    post.ts                       postTransaction primitive
    accounts.ts                   account-code constants
    types.ts
    balances.ts                   account_balances view + balance-sheet checks
    query.ts                      transactions+postings query
    errors.ts                     Postgres exception → UI payload
    flows/{authorize,capture,settle,fee,payout,refund,dispute,fxCharge}.ts
    flows/index.ts                FLOW_REGISTRY (zod schema + run)
    scenarios/index.ts            5 pre-canned scenarios
  stores/
    ledgerStore.ts                Zustand
    usePolling.ts                 750ms incremental polling
  viz/
    sankey/{buildFlows,SankeyChart}.ts(x)

scripts/dev-db.ts                 long-running embedded-postgres for local dev
tests/{setup,invariants,flows,scenarios}.test.ts
```

## Why Postgres, not TigerBeetle?

Postgres on Neon was the primary pick because (a) the SQL invariants are themselves part of the demo &mdash; visible on `/how-it-works` and verifiable in `drizzle/0000_init.sql`; and (b) it&rsquo;s what real ledger systems run on. TigerBeetle would be a stronger fintech-niche signal but requires a Fly.io VM and a Zig client, which would muddle the &ldquo;deployable, free, polished&rdquo; story for a portfolio piece. A `/tigerbeetle` variant running the same scenarios is a natural v1.1.

## License

MIT.
