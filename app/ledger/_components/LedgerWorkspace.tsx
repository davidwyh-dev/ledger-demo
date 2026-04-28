'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/stores/usePolling';
import { useLedger } from '@/lib/stores/ledgerStore';
import TAccountsView from './tabs/TAccountsView';
import StreamView from './tabs/StreamView';
import SankeyView from './tabs/SankeyView';
import ActionsDropdown from './ActionsDropdown';
import StoryModePanel from './StoryModePanel';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Tab = 'ledger' | 'sankey';

export default function LedgerWorkspace() {
  usePolling(true);
  const [tab, setTab] = useState<Tab>('ledger');
  const isPolling = useLedger((s) => s.isPolling);
  const txnCount = useLedger((s) => s.transactions.length);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Ledger Demo
        </Link>
        <div className="flex items-center gap-4 text-sm text-[color:var(--color-muted-foreground)]">
          <span className="flex items-center gap-2">
            <span className={cn('inline-block size-2 rounded-full bg-emerald-500', isPolling && 'live-dot')} />
            {isPolling ? 'live' : 'paused'} · {txnCount} txns
          </span>
          <ActionsDropdown />
          <Link href="/how-it-works" className="hover:text-foreground">how it works</Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <nav className="flex items-center gap-1 border-b px-3 py-2">
          <TabButton active={tab === 'ledger'} onClick={() => setTab('ledger')}>Ledger</TabButton>
          <TabButton active={tab === 'sankey'} onClick={() => setTab('sankey')}>Money flow</TabButton>
        </nav>
        <div className="flex-1 min-h-0">
          {tab === 'ledger' && (
            <div className="flex h-full min-h-0">
              <div className="flex-1 min-w-0 overflow-auto">
                <TAccountsView />
              </div>
              <div className="w-[420px] flex-shrink-0 border-l overflow-y-auto">
                <StreamView />
              </div>
            </div>
          )}
          {tab === 'sankey' && (
            <div className="h-full overflow-auto">
              <SankeyView />
            </div>
          )}
        </div>
        <StoryModePanel />
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-1.5 text-sm rounded-md transition-colors',
        active ? 'bg-[color:var(--color-muted)] font-medium' : 'text-[color:var(--color-muted-foreground)] hover:bg-[color:var(--color-muted)]/60',
      )}
    >
      {children}
    </button>
  );
}
