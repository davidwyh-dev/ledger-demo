'use client';

import { motion, AnimatePresence } from 'motion/react';
import { useLedger } from '@/lib/stores/ledgerStore';
import { SCENARIOS } from '@/lib/ledger/scenarios';

export default function StoryModePanel() {
  const storyStep = useLedger((s) => s.storyStep);
  const scenario = storyStep ? SCENARIOS.find((s) => s.slug === storyStep.scenarioSlug) : null;
  const total = scenario?.steps.length ?? 0;

  return (
    <AnimatePresence>
      {storyStep && (
        <motion.div
          key="story"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t bg-[color:var(--color-muted)]/95 backdrop-blur-sm shadow-lg"
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
      )}
    </AnimatePresence>
  );
}
