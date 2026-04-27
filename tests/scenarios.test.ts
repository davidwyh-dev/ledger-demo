import { describe, expect, it } from 'vitest';
import { getSql } from './setup';
import { SCENARIOS } from '@/lib/ledger/scenarios';
import { FLOW_REGISTRY } from '@/lib/ledger/flows';
import { balanceSheetEquationsByCurrency } from '@/lib/ledger/balances';

describe('Scenarios end to end', () => {
  for (const scenario of SCENARIOS) {
    it(`${scenario.slug}: each currency leg balances after every step`, async () => {
      const sql = getSql();
      for (const step of scenario.steps) {
        await FLOW_REGISTRY[step.flow].run(sql, step.params);
        const eqs = await balanceSheetEquationsByCurrency(sql);
        for (const eq of eqs) {
          expect.soft(eq.netMinor, `after step "${step.label}", currency ${eq.currency} net=${eq.netMinor}`).toBe(0);
        }
      }
    });
  }
});
