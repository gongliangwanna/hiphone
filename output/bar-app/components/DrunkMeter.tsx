import React from 'react';
import { motion, spring } from '@hiphone/motion';
import { DrunkStage } from '../constants/drunkStates';

interface Props {
  drunk: number;
  stage: DrunkStage;
  drinkCount: number;
  accent: string;
}

export function DrunkMeter({ drunk, stage, drinkCount, accent }: Props) {
  const pct = Math.max(0, Math.min(100, drunk));
  return (
    <div className="rounded-2xl border border-[var(--color-separator)] bg-[var(--color-secondarySystemBackground)] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">{stage.emoji}</span>
          <span className="text-sm font-semibold text-[var(--color-label)]">{stage.label}</span>
          <span className="text-xs text-[var(--color-secondaryLabel)]">·</span>
          <span className="text-xs text-[var(--color-secondaryLabel)]">已喝 {drinkCount} 杯</span>
        </div>
        <span className="text-xs tabular-nums text-[var(--color-secondaryLabel)]">
          {Math.round(pct)} / 100
        </span>
      </div>

      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-tertiarySystemBackground)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: accent }}
          initial={false}
          animate={{ width: pct + '%' }}
          transition={spring.smooth}
        />
      </div>

      <div className="mt-2 text-xs text-[var(--color-secondaryLabel)]">{stage.hint}</div>
    </div>
  );
}
