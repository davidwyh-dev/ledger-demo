import { NextResponse } from 'next/server';
import { getReaderSql, getWriterSql, waitForLsn } from '@/lib/db/client';
import { getBalances } from '@/lib/ledger/balances';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const afterLsn = url.searchParams.get('after_lsn');

  let sql = getReaderSql();
  let fenceTimedOut = false;
  if (afterLsn) {
    const ok = await waitForLsn(sql, afterLsn, 500);
    if (!ok) {
      fenceTimedOut = true;
      sql = getWriterSql();
    }
  }

  const balances = await getBalances(sql);

  const headers = new Headers();
  if (fenceTimedOut) headers.set('X-Lsn-Fence', 'timeout-fellback-to-writer');
  return NextResponse.json({ accounts: balances }, { headers });
}
