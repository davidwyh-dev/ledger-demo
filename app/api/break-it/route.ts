import { NextResponse } from 'next/server';
import { getWriterSql } from '@/lib/db/client';
import { postTransaction } from '@/lib/ledger/post';
import { toLedgerError } from '@/lib/ledger/errors';
import { A } from '@/lib/ledger/accounts';

export const dynamic = 'force-dynamic';

/**
 * Deliberately try to post an unbalanced transaction so the database
 * rejects it. The literal RAISE EXCEPTION text is returned so the UI
 * can surface it in a toast — proving the invariants are enforced in
 * Postgres, not in JavaScript.
 */
export async function POST() {
  try {
    await postTransaction(getWriterSql(), {
      kind: 'authorize',
      description: 'BREAK IT — intentionally unbalanced (debits ≠ credits)',
      postings: [
        { accountCode: A.CUSTOMER_FUNDING_USD,   direction: 'debit',  amountMinor: 10000, currency: 'USD' },
        { accountCode: A.AUTHORIZATION_HOLD_USD, direction: 'credit', amountMinor:  9000, currency: 'USD' },
      ],
    });
    // Should never reach here.
    return NextResponse.json({ ok: false, error: { kind: 'other', message: 'Unexpectedly accepted unbalanced transaction' } }, { status: 500 });
  } catch (err) {
    const e = toLedgerError(err);
    return NextResponse.json({ ok: true, demo: 'invariant-rejected', rejection: e });
  }
}
