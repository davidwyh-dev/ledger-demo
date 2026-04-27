import postgres, { type Sql } from 'postgres';

declare global {
  var __ledger_pg_writer__: Sql | undefined;
  var __ledger_pg_reader__: Sql | undefined;
}

function connect(url: string): Sql {
  return postgres(url, {
    max: 5,
    prepare: false,
    onnotice: () => {},
    connect_timeout: 30,
  });
}

function writerUrl(): string {
  const url = process.env.DATABASE_URL_WRITER ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL_WRITER (or DATABASE_URL) is not set. For local dev: `npm run dev:db` and copy .env.local.example to .env.local.',
    );
  }
  return url;
}

function readerUrl(): string {
  // Falls back to writer URL when no replica is configured (single-node dev).
  return process.env.DATABASE_URL_READER ?? writerUrl();
}

/**
 * Pool against the cluster writer endpoint. All transaction-writing paths
 * (postTransaction, flows, scenarios) and any read that must observe the
 * writer's latest committed state should use this.
 */
export function getWriterSql(): Sql {
  if (global.__ledger_pg_writer__) return global.__ledger_pg_writer__;
  global.__ledger_pg_writer__ = connect(writerUrl());
  return global.__ledger_pg_writer__;
}

/**
 * Pool against a (possibly stale) reader endpoint. Use for dashboard /
 * polling reads that tolerate bounded staleness, optionally fenced via
 * waitForLsn() to provide read-your-writes.
 *
 * In a single-node setup (no DATABASE_URL_READER), this returns the same
 * pool as getWriterSql(), so behaviour is identical.
 */
export function getReaderSql(): Sql {
  // When reader and writer URLs match, share the pool to avoid wasting connections.
  const wUrl = writerUrl();
  const rUrl = readerUrl();
  if (wUrl === rUrl) return getWriterSql();
  if (global.__ledger_pg_reader__) return global.__ledger_pg_reader__;
  global.__ledger_pg_reader__ = connect(rUrl);
  return global.__ledger_pg_reader__;
}

/**
 * Backward-compatible alias. Always returns the writer pool — anything
 * that imported `getSql()` predates the read-routing distinction and
 * should be safe to keep on the writer until reviewed.
 */
export function getSql(): Sql {
  return getWriterSql();
}

/**
 * Read pool with an optional consistency hint. `fresh: true` returns the
 * writer pool (linearizable). `fresh: false` returns the reader pool
 * (potentially stale; pair with waitForLsn() for read-your-writes).
 */
export function getSqlForRead({ fresh }: { fresh: boolean }): Sql {
  return fresh ? getWriterSql() : getReaderSql();
}

/**
 * Capture the writer's current WAL LSN. Call right after a committed
 * write so the response can advertise the LSN to the client, which can
 * then fence subsequent replica reads on it.
 *
 * Returns null if the database doesn't support pg_current_wal_lsn (e.g.
 * a connection-pooler that exposes only a subset of functions, or a
 * test fixture that's been mocked).
 */
export async function getCurrentLsn(sql: Sql): Promise<string | null> {
  try {
    const [row] = await sql<{ lsn: string }[]>`SELECT pg_current_wal_lsn()::text AS lsn`;
    return row?.lsn ?? null;
  } catch {
    return null;
  }
}

/**
 * Wait for a replica to replay up to `lsn`. Used to give the client
 * read-your-writes against a reader endpoint after a known write.
 *
 * Returns true if the replica caught up (or we're talking to the writer,
 * which is caught up by definition), false on timeout or error. Callers
 * should fall back to the writer pool on `false`.
 *
 * Implementation polls pg_last_wal_replay_lsn rather than calling
 * pg_wait_for_replay_lsn, because the latter raises on a primary
 * ("recovery is not in progress") and isn't available on every managed
 * Postgres flavour.
 */
export async function waitForLsn(sql: Sql, lsn: string, timeoutMs = 500): Promise<boolean> {
  try {
    const [{ in_recovery }] = await sql<{ in_recovery: boolean }[]>`
      SELECT pg_is_in_recovery() AS in_recovery
    `;
    if (!in_recovery) return true;
  } catch {
    return false;
  }

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const [{ caught_up }] = await sql<{ caught_up: boolean }[]>`
        SELECT pg_last_wal_replay_lsn() >= ${lsn}::pg_lsn AS caught_up
      `;
      if (caught_up) return true;
    } catch {
      return false;
    }
    await new Promise((r) => setTimeout(r, 25));
  }
  return false;
}
