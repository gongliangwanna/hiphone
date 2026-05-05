import React, { useState } from 'react';
import { AnimatePresence, motion, spring } from '@hiphone/motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { DRINKS, Drink } from '../constants/drinks';

interface Props {
  onOrder: (drink: Drink) => void;
  disabled?: boolean;
}

export function DrinkMenu({ onOrder, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-2xl border border-[var(--color-separator)] bg-[var(--color-secondarySystemBackground)]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-[var(--color-label)]">点一杯</div>
          <div className="text-xs text-[var(--color-secondaryLabel)]">
            喝得越烈，聊得越上头
          </div>
        </div>
        {open ? (
          <ChevronDown size={18} className="text-[var(--color-secondaryLabel)]" />
        ) : (
          <ChevronUp size={18} className="text-[var(--color-secondaryLabel)]" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="menu"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring.smooth}
            className="overflow-hidden"
          >
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              {DRINKS.map((d) => (
                <motion.button
                  key={d.id}
                  whileTap={{ scale: 0.96 }}
                  disabled={disabled}
                  onClick={() => {
                    onOrder(d);
                  }}
                  className="flex items-center gap-2 rounded-xl border border-[var(--color-separator)] bg-[var(--color-tertiarySystemBackground)] px-3 py-2 text-left disabled:opacity-50"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                    style={{ background: d.color + '33' }}
                  >
                    {d.emoji}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--color-label)]">
                      {d.name}
                    </div>
                    <div className="truncate text-xs text-[var(--color-secondaryLabel)]">
                      +{d.alcohol} 醉度
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
