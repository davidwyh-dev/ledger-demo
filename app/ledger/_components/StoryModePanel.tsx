'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useLedger } from '@/lib/stores/ledgerStore';
import { SCENARIOS } from '@/lib/ledger/scenarios';

export default function StoryModePanel() {
  const storyStep = useLedger((s) => s.storyStep);

  if (!storyStep) return null;

  const scenario = SCENARIOS.find((s) => s.slug === storyStep.scenarioSlug);
  const total = scenario?.steps.length ?? 0;

  return (
    <AnimatePresence>
      <motion.div
        key="story"
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 24, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="border-t bg-[color:var(--color-muted)]/40"
      >
        <div className="px-6 py-4">
          <div className="flex items-baseline justify-between mb-1">
            <div className="text-xs uppercase tracking-wide text-[color:var(--color-muted-foreground)] font-medium">
              Story mode · step {storyStep.index + 1} / {total}
            </div>
            <div className="text-xs text-[color:var(--color-muted-foreground)]">
              {scenario?.title}
            </div>
          </div>
          <div className="text-base font-medium mb-1">{storyStep.label}</div>
          <p className="text-sm text-[color:var(--color-muted-foreground)] max-w-3xl leading-relaxed">
            {storyStep.story}
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
