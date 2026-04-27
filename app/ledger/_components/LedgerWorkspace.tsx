'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/stores/usePolling';
import { useLedger } from '@/lib/stores/ledgerStore';
import TAccountsView from './tabs/TAccountsView';
import StreamView from './tabs/StreamView';
import SankeyView from './tabs/SankeyView';
import ControlPanel from './ControlPanel';
import StoryModePanel from './StoryModePanel';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Tab = 't-accounts' | 'sankey' | 'stream';

export default function LedgerWorkspace() {
  usePolling(true);
  const [tab, setTab] = useState<Tab>('t-accounts');
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
          <Link href="/how-it-works" className="hover:text-foreground">how it works</Link>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <main className="flex-1 flex flex-col min-w-0 border-r">
          <nav className="flex items-center gap-1 border-b px-3 py-2">
            <TabButton active={tab === 't-accounts'} onClick={() => setTab('t-accounts')}>T-accounts</TabButton>
            <TabButton active={tab === 'sankey'}     onClick={() => setTab('sankey')}>Money flow</TabButton>
            <TabButton active={tab === 'stream'}     onClick={() => setTab('stream')}>Transaction stream</TabButton>
          </nav>
          <div className="flex-1 overflow-auto">
            {tab === 't-accounts' && <TAccountsView />}
            {tab === 'sankey'     && <SankeyView />}
            {tab === 'stream'     && <StreamView />}
          </div>
          <StoryModePanel />
        </main>

        <aside className="w-[360px] flex-shrink-0 overflow-y-auto">
          <ControlPanel />
        </aside>
      </div>
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
