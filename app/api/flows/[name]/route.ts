import { NextResponse } from 'next/server';
import { getWriterSql } from '@/lib/db/client';
import { FLOW_REGISTRY, type FlowName } from '@/lib/ledger/flows';
import { toLedgerError } from '@/lib/ledger/errors';

export const dynamic = 'force-dynamic';

type Params = Promise<{ name: string }>;

export async function POST(req: Request, ctx: { params: Params }) {
  const { name } = await ctx.params;
  if (!(name in FLOW_REGISTRY)) {
    return NextResponse.json({ error: { kind: 'validation', message: `Unknown flow: ${name}` } }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));

  // Idempotency key: header wins, body.externalId falls back, then a server-generated
  // UUID as a last resort. The server-generated path is NOT failover-safe — clients
  // that retry across a transport error must send the same Idempotency-Key on each
  // attempt to get exactly-once posting.
  const idempotencyKey =
    req.headers.get('Idempotency-Key') ??
    (typeof body?.externalId === 'string' ? body.externalId : null) ??
    crypto.randomUUID();

  try {
    const result = await FLOW_REGISTRY[name as FlowName].run(
      getWriterSql(),
      { ...body, externalId: idempotencyKey },
    );
    const replayed = (result as { replayed?: boolean }).replayed === true;
    const lsn = (result as { lsn?: string | null }).lsn ?? null;

    const headers = new Headers();
    if (lsn) headers.set('X-Postgres-Lsn', lsn);
    if (replayed) headers.set('Idempotency-Replayed', 'true');

    return NextResponse.json(
      { ok: true, result, replayed, lsn },
      { status: replayed ? 200 : 201, headers },
    );
  } catch (err) {
    const e = toLedgerError(err);
    return NextResponse.json({ ok: false, error: e }, { status: 400 });
  }
}
