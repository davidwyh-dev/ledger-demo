export type LedgerErrorPayload = {
  kind: 'invariant' | 'validation' | 'other';
  message: string;
  pgCode?: string;
};

/**
 * Convert any error thrown by postTransaction or a flow into a structured
 * payload suitable for the UI. Postgres exception messages from our
 * RAISE EXCEPTION calls are surfaced verbatim — that *is* the demo on
 * the "Break it" path.
 */
export function toLedgerError(err: unknown): LedgerErrorPayload {
  // postgres.js sets `code` to the SQLSTATE; our RAISE EXCEPTION emits 'P0001'
  const e = err as { message?: string; code?: string };
  const message = e?.message ?? String(err);
  if (typeof message === 'string' && message.includes('Ledger invariant violated')) {
    return { kind: 'invariant', message, pgCode: e?.code };
  }
  if (typeof message === 'string' && message.includes('append-only')) {
    return { kind: 'invariant', message, pgCode: e?.code };
  }
  return { kind: e?.code ? 'validation' : 'other', message, pgCode: e?.code };
}
