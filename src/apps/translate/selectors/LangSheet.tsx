import React from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { Sparkles } from 'lucide-react';
import {
  CURATED_LANGUAGES,
  AUTO_LANG,
  type Language,
} from '../constants/languages';

export interface LangSheetProps {
  open: boolean;
  showAuto: boolean;
  /** Called when the user taps a curated or auto language. */
  onPick: (lang: Language) => void;
  /** Called when the user taps the "自定义..." row. Caller opens CustomLangInput. */
  onPickCustom: () => void;
  onClose: () => void;
}

const SHEET_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--color-secondarySystemBackground)',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: '12px 0 24px',
  maxHeight: '70%',
  overflowY: 'auto',
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  minHeight: 48,
  padding: '12px 20px',
  border: 'none',
  background: 'transparent',
  fontSize: 17,
  textAlign: 'left',
  color: 'var(--color-label)',
  cursor: 'pointer',
};

const HANDLE_STYLE: React.CSSProperties = {
  width: 36,
  height: 5,
  borderRadius: 3,
  margin: '0 auto 8px',
  backgroundColor: 'var(--color-tertiaryLabel)',
};

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-secondaryLabel)',
  padding: '4px 20px 8px',
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  border: 'none',
  cursor: 'pointer',
};

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 100,
};

export function LangSheet({
  open,
  showAuto,
  onPick,
  onPickCustom,
  onClose,
}: LangSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div style={CONTAINER_STYLE} role="dialog" aria-modal="true" aria-labelledby="langsheet-title">
          <motion.button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={BACKDROP_STYLE}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.snappy}
            style={SHEET_STYLE}
          >
            <div style={HANDLE_STYLE} />
            <div id="langsheet-title" style={TITLE_STYLE}>选择语言</div>

            {showAuto && (
              <button type="button" style={ROW_STYLE} onClick={() => onPick(AUTO_LANG)}>
                {AUTO_LANG.native}
              </button>
            )}
            {CURATED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                style={ROW_STYLE}
                onClick={() => onPick(lang)}
              >
                {lang.native}
              </button>
            ))}

            <div style={{ height: 1, backgroundColor: 'var(--color-separator)', margin: '8px 20px' }} />

            <button
              type="button"
              style={{ ...ROW_STYLE, color: 'var(--color-systemBlue)' }}
              onClick={onPickCustom}
            >
              <Sparkles size={18} strokeWidth={2.2} style={{ marginRight: 10 }} />
              自定义…
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
