import { NextResponse } from 'next/server';
import { getWriterSql, getCurrentLsn } from '@/lib/db/client';
import { findScenario } from '@/lib/ledger/scenarios';
import { FLOW_REGISTRY } from '@/lib/ledger/flows';
import { toLedgerError } from '@/lib/ledger/errors';

export const dynamic = 'force-dynamic';

type Params = Promise<{ slug: string }>;

/**
 * Run all steps of a scenario back-to-back, server side. Useful for
 * quickly populating state. For paced playback (story mode), the
 * client calls /api/flows/[name] per step instead.
 *
 * Each step is given a deterministic externalId derived from the
 * client-supplied Idempotency-Key (or a generated UUID), so that
 * replaying the whole scenario after a transport error is safe.
 */
export async function POST(req: Request, ctx: { params: Params }) {
  const { slug } = await ctx.params;
  const scenario = findScenario(slug);
  if (!scenario) {
    return NextResponse.json({ error: { kind: 'validation', message: `Unknown scenario: ${slug}` } }, { status: 404 });
  }
  const sql = getWriterSql();
  const baseKey = req.headers.get('Idempotency-Key') ?? crypto.randomUUID();
  const results: unknown[] = [];
  try {
    for (let i = 0; i < scenario.steps.length; i++) {
      const step = scenario.steps[i];
      const params = { ...step.params, externalId: `${baseKey}:${i}` };
      results.push(await FLOW_REGISTRY[step.flow].run(sql, params));
    }
    const lsn = await getCurrentLsn(sql);
    const headers = new Headers();
    if (lsn) headers.set('X-Postgres-Lsn', lsn);
    return NextResponse.json({ ok: true, results, lsn }, { headers });
  } catch (err) {
    return NextResponse.json({ ok: false, error: toLedgerError(err) }, { status: 400 });
  }
}
