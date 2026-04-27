import { NextResponse } from 'next/server';
import { getReaderSql, getWriterSql } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

/**
 * Liveness for the load balancer. Returns 200 only when both the
 * writer and reader pools can satisfy SELECT 1; otherwise 503 with
 * which pool failed.
 *
 * In a single-node setup (no DATABASE_URL_READER) the reader and
 * writer point at the same pool, so this collapses to one ping.
 */
export async function GET() {
  const checks: Record<string, 'ok' | string> = {};

  try {
    await getWriterSql()`SELECT 1`;
    checks.writer = 'ok';
  } catch (err) {
    checks.writer = (err as Error)?.message ?? 'error';
  }

  try {
    await getReaderSql()`SELECT 1`;
    checks.reader = 'ok';
  } catch (err) {
    checks.reader = (err as Error)?.message ?? 'error';
  }

  const ok = checks.writer === 'ok' && checks.reader === 'ok';
  return NextResponse.json({ ok, checks }, { status: ok ? 200 : 503 });
}
