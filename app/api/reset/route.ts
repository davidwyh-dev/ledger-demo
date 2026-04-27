import { NextResponse } from 'next/server';
import { getWriterSql } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function POST() {
  // TRUNCATE bypasses our append-only triggers (which fire on UPDATE/DELETE),
  // so the demo can reset cleanly between visitors. RESTART IDENTITY makes
  // ids deterministic across resets so the demo always starts at id=1.
  await getWriterSql().unsafe(`TRUNCATE TABLE postings, transactions RESTART IDENTITY CASCADE;`);
  return NextResponse.json({ ok: true });
}
