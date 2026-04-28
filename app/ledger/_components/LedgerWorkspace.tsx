'use client';

import { useState } from 'react';
import { usePolling } from '@/lib/stores/usePolling';
import { useLedger } from '@/lib/stores/ledgerStore';
import TAccountsView from './tabs/TAccountsView';
import StreamView from './tabs/StreamView';
import SankeyView from './tabs/SankeyView';
import ActionsSidePanel from './ActionsSidePanel';
import StoryModePanel from './StoryModePanel';
import HowItWorksModal from './HowItWorksModal';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type Tab = 'ledger' | 'sankey';

export default function LedgerWorkspace({ howItWorksHtml }: { howItWorksHtml: string }) {
  usePolling(true);
  const [tab, setTab] = useState<Tab>('ledger');
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const isPolling = useLedger((s) => s.isPolling);
  const txnCount = useLedger((s) => s.transactions.length);

  return (
    <div className="flex flex-col h-screen min-h-0">
      <header className="flex items-center justify-between border-b px-6 py-3">
        <Link href="/" className="font-semibold tracking-tight">
          Ledger Demo
        </Link>
        <div className="flex items-center gap-4 text-sm text-[color:var(--color-muted-foreground)]">
          <span className="flex items-center gap-2">
            <span className={cn('inline-block size-2 rounded-full bg-emerald-500', isPolling && 'live-dot')} />
            {isPolling ? 'live' : 'paused'} · {txnCount} txns
          </span>
          <button
            type="button"
            onClick={() => setHowItWorksOpen(true)}
            className="hover:text-foreground"
          >
            how it works
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col min-w-0 min-h-0">
        <nav className="flex items-center gap-1 border-b px-3 py-2">
          <TabButton active={tab === 'ledger'} onClick={() => setTab('ledger')}>Ledger</TabButton>
          <TabButton active={tab === 'sankey'} onClick={() => setTab('sankey')}>Money flow</TabButton>
        </nav>
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 min-w-0 overflow-auto">
              {tab === 'ledger' ? <TAccountsView /> : <SankeyView />}
            </div>
            <aside className="w-[360px] flex-shrink-0 border-l overflow-y-auto">
              <ActionsSidePanel />
            </aside>
          </div>
          <div className="h-[300px] flex-shrink-0 border-t overflow-y-auto">
            <StreamView />
          </div>
        </div>
        <StoryModePanel />
      </main>

      <HowItWorksModal
        open={howItWorksOpen}
        onClose={() => setHowItWorksOpen(false)}
        html={howItWorksHtml}
      />
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
