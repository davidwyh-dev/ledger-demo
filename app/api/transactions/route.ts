import { NextResponse } from 'next/server';
import { getReaderSql, getWriterSql, waitForLsn } from '@/lib/db/client';
import { listTransactions } from '@/lib/ledger/query';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get('since') ?? 0) || 0;
  const afterLsn = url.searchParams.get('after_lsn');

  // Default: read from a (possibly stale) replica. If the caller passes
  // ?after_lsn=<lsn>, fence the read so we don't return data that's older
  // than the writer's known commit at that LSN. On fence timeout, fall back
  // to the writer rather than serve stale data.
  let sql = getReaderSql();
  let fenceTimedOut = false;
  if (afterLsn) {
    const ok = await waitForLsn(sql, afterLsn, 500);
    if (!ok) {
      fenceTimedOut = true;
      sql = getWriterSql();
    }
  }

  const txns = await listTransactions(sql, since);

  const headers = new Headers();
  if (fenceTimedOut) headers.set('X-Lsn-Fence', 'timeout-fellback-to-writer');
  return NextResponse.json({ transactions: txns }, { headers });
}
