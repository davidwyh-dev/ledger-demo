import { NextResponse } from 'next/server';
import { SCENARIOS } from '@/lib/ledger/scenarios';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ scenarios: SCENARIOS });
}
