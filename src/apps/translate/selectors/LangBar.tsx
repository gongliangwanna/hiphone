import { motion } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { ArrowLeftRight } from 'lucide-react';
import type { Language } from '../constants/languages';

export interface LangBarProps {
  sourceLang: Language;
  targetLang: Language;
  onSwap: () => void;
  onTapSource?: () => void;
  onTapTarget?: () => void;
}

const PILL =
  'flex-1 h-11 rounded-[22px] flex items-center justify-center text-[17px] font-medium ' +
  'text-[var(--color-label)] bg-[var(--color-secondarySystemFill)] border-none cursor-pointer select-none';

export function LangBar({
  sourceLang,
  targetLang,
  onSwap,
  onTapSource,
  onTapTarget,
}: LangBarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <button
        type="button"
        className={PILL}
        onClick={onTapSource}
        aria-label={`源语言 ${sourceLang.name}`}
      >
        {sourceLang.native}
      </button>

      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={onSwap}
        aria-label="交换语种"
        className="w-11 h-11 rounded-[22px] border-none bg-[var(--color-systemBlue)] text-white flex items-center justify-center cursor-pointer"
      >
        <motion.span
          animate={{ rotate: 0 }}
          whileTap={{ rotate: 180 }}
          transition={spring.bouncy}
          className="inline-flex"
        >
          <ArrowLeftRight size={20} strokeWidth={2.2} />
        </motion.span>
      </motion.button>

      <button
        type="button"
        className={PILL}
        onClick={onTapTarget}
        aria-label={`目标语言 ${targetLang.name}`}
      >
        {targetLang.native}
      </button>
    </div>
  );
}
