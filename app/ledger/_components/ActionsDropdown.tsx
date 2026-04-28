'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ChevronDown, RotateCcw, Zap, BookOpen } from 'lucide-react';
import { SCENARIOS } from '@/lib/ledger/scenarios';
import { useLedger } from '@/lib/stores/ledgerStore';
import { postJsonIdempotent } from '@/lib/stores/writeClient';
import { cn } from '@/lib/utils';
import QuickActions from './QuickActions';

type ApiOk<T> = { ok?: boolean; result?: T; error?: { message?: string } };
type BreakItResponse = { ok?: boolean; demo?: string; rejection?: { message?: string } };

async function postPlain(url: string, body: unknown = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

export default function ActionsDropdown() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const reset = useLedger((s) => s.reset);
  const setStoryStep = useLedger((s) => s.setStoryStep);
  const setHighlight = useLedger((s) => s.setHighlight);
  const clearHighlight = useLedger((s) => s.clearHighlight);
  const setLastWriteLsn = useLedger((s) => s.setLastWriteLsn);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const playStory = async (slug: string) => {
    const scenario = SCENARIOS.find((s) => s.slug === slug);
    if (!scenario) return;
    setBusy(`story:${slug}`);
    setOpen(false);
    try {
      for (let i = 0; i < scenario.steps.length; i++) {
        const step = scenario.steps[i];
        setStoryStep({ scenarioSlug: slug, index: i, story: step.story, label: step.label });
        if (step.highlight) setHighlight(step.highlight);
        try {
          const { json, lsn } = await postJsonIdempotent<ApiOk<unknown>>(
            `/api/flows/${step.flow}`,
            step.params,
            crypto.randomUUID(),
          );
          if (lsn) setLastWriteLsn(lsn);
          if (!json.ok) {
            toast.error('Story mode error', { description: json.error?.message });
            break;
          }
        } catch (err) {
          toast.error('Story mode error', { description: (err as Error)?.message ?? 'Network error' });
          break;
        }
        await new Promise((r) => setTimeout(r, 1600));
      }
      await new Promise((r) => setTimeout(r, 600));
      clearHighlight();
      setStoryStep(null);
    } finally {
      setBusy(null);
    }
  };

  // Break-it deliberately fails its DB invariant — no idempotency / retry needed.
  const breakIt = async () => {
    setBusy('break');
    setOpen(false);
    try {
      const res = (await postPlain('/api/break-it')) as BreakItResponse;
      if (res.ok && res.demo === 'invariant-rejected') {
        toast.error('Database refused the unbalanced transaction', {
          description: res.rejection?.message ?? 'Invariant violated',
          duration: 12_000,
        });
      } else {
        toast.warning('Unexpected result', { description: JSON.stringify(res) });
      }
    } finally {
      setBusy(null);
    }
  };

  // Reset is a non-ledger administrative call — no idempotency key needed.
  const doReset = async () => {
    setBusy('reset');
    setOpen(false);
    try {
      await postPlain('/api/reset');
      reset();
      toast.success('Ledger reset');
    } finally {
      setBusy(null);
    }
  };

  const handleFlowBusy = (id: string | null) => {
    setBusy(id);
    if (id === null) setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={busy !== null}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm transition-colors',
          'hover:bg-[color:var(--color-muted)]/60 disabled:opacity-50',
          open && 'bg-[color:var(--color-muted)]',
        )}
      >
        <span className="font-medium text-[color:var(--color-foreground)]">Actions</span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-[360px] z-50 rounded-md border bg-[color:var(--color-background)] shadow-lg"
          role="menu"
        >
          <div className="flex flex-col p-5 gap-6 max-h-[80vh] overflow-y-auto">
            <Section
              title="Story mode"
              subtitle="Step through a scenario with synchronized account highlights."
            >
              <div className="flex flex-col gap-2">
                {SCENARIOS.map((s) => (
                  <button
                    key={s.slug}
                    onClick={() => playStory(s.slug)}
                    disabled={busy !== null}
                    className="text-left px-3 py-2 rounded-md border hover:bg-[color:var(--color-muted)]/60 disabled:opacity-50 transition-colors flex items-center gap-2"
                  >
                    <BookOpen className="size-3.5 text-[color:var(--color-muted-foreground)]" />
                    <span className="text-sm">{s.title}</span>
                  </button>
                ))}
              </div>
            </Section>

            <Section
              title="Quick actions"
              subtitle="Trigger a single flow with parameters."
            >
              <QuickActions disabled={busy !== null} onBusy={handleFlowBusy} />
            </Section>

            <Section
              title="Demonstrate the invariants"
              subtitle="Send Postgres a deliberately unbalanced transaction. The database rejects it; the SQL exception text is surfaced verbatim in the toast."
            >
              <button
                onClick={breakIt}
                disabled={busy !== null}
                className={cn(
                  'w-full px-3 py-2 rounded-md border-2 border-[color:var(--color-invariant)] text-[color:var(--color-invariant)]',
                  'hover:bg-[color:var(--color-invariant)] hover:text-white transition-colors',
                  'disabled:opacity-50 flex items-center justify-center gap-2 font-medium',
                )}
              >
                <Zap className="size-4" />
                Break it
              </button>
            </Section>

            <button
              onClick={doReset}
              disabled={busy !== null}
              className="px-3 py-2 rounded-md border hover:bg-[color:var(--color-muted)]/60 disabled:opacity-50 flex items-center justify-center gap-2 text-sm text-[color:var(--color-muted-foreground)]"
            >
              <RotateCcw className="size-3.5" /> Reset ledger
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <h3 className="text-xs uppercase tracking-wide font-semibold text-[color:var(--color-muted-foreground)]">{title}</h3>
        {subtitle && <p className="text-xs text-[color:var(--color-muted-foreground)] mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}
