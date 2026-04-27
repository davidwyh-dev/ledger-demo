'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useLedger } from '@/lib/stores/ledgerStore';
import { postJsonIdempotent } from '@/lib/stores/writeClient';

const FLOWS = [
  { id: 'authorize', label: 'Authorize',  field: 'amountMinor',           defaultDollars: 100, params: (m: number) => ({ amountMinor: m }) },
  { id: 'capture',   label: 'Capture',    field: 'authAmountMinor',       defaultDollars: 100, params: (m: number) => ({ authAmountMinor: m }) },
  { id: 'settle',    label: 'Settle',     field: 'amountMinor',           defaultDollars: 100, params: (m: number) => ({ amountMinor: m }) },
  { id: 'fee',       label: 'Stripe fee', field: 'grossAmountMinor',      defaultDollars: 100, params: (m: number) => ({ grossAmountMinor: m }) },
  { id: 'payout',    label: 'Payout',     field: 'amountMinor',           defaultDollars:  97, params: (m: number) => ({ amountMinor: m }) },
  { id: 'fxCharge',  label: 'EUR charge', field: 'customerAmountMinorEur', defaultDollars: 100, params: (m: number) => ({ customerAmountMinorEur: m, midMarketRate: 1.08, marginBps: 200 }) },
];

type FlowResponse = { ok?: boolean; result?: unknown; error?: { message?: string } };

export default function QuickActions({
  disabled,
  onBusy,
}: { disabled: boolean; onBusy: (id: string | null) => void }) {
  const [amounts, setAmounts] = useState<Record<string, string>>(
    () => Object.fromEntries(FLOWS.map((f) => [f.id, String(f.defaultDollars)])),
  );
  const setLastWriteLsn = useLedger((s) => s.setLastWriteLsn);

  const trigger = async (flow: typeof FLOWS[number]) => {
    const dollars = parseFloat(amounts[flow.id] || '0');
    if (!Number.isFinite(dollars) || dollars <= 0) {
      toast.error('Enter a positive amount');
      return;
    }
    const minor = Math.round(dollars * 100);
    onBusy(`flow:${flow.id}`);
    // One UUID per click = one logical user intent. Reused across retries.
    const idempotencyKey = crypto.randomUUID();
    try {
      const { json, lsn } = await postJsonIdempotent<FlowResponse>(
        `/api/flows/${flow.id}`,
        flow.params(minor),
        idempotencyKey,
      );
      if (lsn) setLastWriteLsn(lsn);
      if (!json.ok) {
        toast.error(`${flow.label} failed`, { description: json.error?.message ?? 'Unknown error' });
      }
    } catch (err) {
      toast.error(`${flow.label} failed`, {
        description: (err as Error)?.message ?? 'Network error after retries',
      });
    } finally {
      onBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {FLOWS.map((f) => (
        <div key={f.id} className="flex items-center gap-2">
          <label className="text-xs w-20 shrink-0 text-[color:var(--color-muted-foreground)]">{f.label}</label>
          <div className="flex-1 flex items-center gap-1">
            <span className="text-xs text-[color:var(--color-muted-foreground)]">$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={amounts[f.id]}
              onChange={(e) => setAmounts({ ...amounts, [f.id]: e.target.value })}
              className="flex-1 min-w-0 px-2 py-1 text-sm rounded border bg-[color:var(--color-background)] tabular-nums focus:outline-none focus:ring-1 focus:ring-[color:var(--color-accent)]"
            />
          </div>
          <button
            onClick={() => trigger(f)}
            disabled={disabled}
            className="px-2 py-1 text-xs rounded border hover:bg-[color:var(--color-muted)] disabled:opacity-50 shrink-0"
          >
            Run
          </button>
        </div>
      ))}
    </div>
  );
}
