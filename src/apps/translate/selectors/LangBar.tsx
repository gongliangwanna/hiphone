import React from 'react';
import { motion } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { ArrowLeftRight } from 'lucide-react';
import type { Language } from '../constants/languages';

export interface LangBarProps {
  sourceLang: Language;
  targetLang: Language;
  onSwap: () => void;
  /** S4 will wire these to open LangSheet. S3 keeps them as no-op stubs. */
  onTapSource?: () => void;
  onTapTarget?: () => void;
}

const PILL_STYLE: React.CSSProperties = {
  flex: 1,
  height: 44,
  borderRadius: 22,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 17,
  fontWeight: 500,
  color: 'var(--color-label)',
  backgroundColor: 'var(--color-secondarySystemFill)',
  cursor: 'pointer',
  userSelect: 'none',
};

export function LangBar({
  sourceLang,
  targetLang,
  onSwap,
  onTapSource,
  onTapTarget,
}: LangBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
      }}
    >
      <button
        type="button"
        style={{ ...PILL_STYLE, border: 'none' }}
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
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          border: 'none',
          backgroundColor: 'var(--color-systemBlue)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <motion.span
          // 360 each toggle keeps the icon visually rotating each tap.
          animate={{ rotate: 0 }}
          whileTap={{ rotate: 180 }}
          transition={spring.bouncy}
          style={{ display: 'inline-flex' }}
        >
          <ArrowLeftRight size={20} strokeWidth={2.2} />
        </motion.span>
      </motion.button>

      <button
        type="button"
        style={{ ...PILL_STYLE, border: 'none' }}
        onClick={onTapTarget}
        aria-label={`目标语言 ${targetLang.name}`}
      >
        {targetLang.native}
      </button>
    </div>
  );
}
