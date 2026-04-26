import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import type { Language } from '../constants/languages';

export interface CustomLangInputProps {
  open: boolean;
  onSubmit: (lang: Language) => void;
  onClose: () => void;
}

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: 110, // above LangSheet (100)
};

const BACKDROP_STYLE: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.4)',
  border: 'none',
  cursor: 'pointer',
};

const SHEET_STYLE: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: 'var(--color-secondarySystemBackground)',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: 16,
};

const HANDLE_STYLE: React.CSSProperties = {
  width: 36,
  height: 5,
  borderRadius: 3,
  margin: '0 auto 12px',
  backgroundColor: 'var(--color-tertiaryLabel)',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  fontSize: 17,
  borderRadius: 10,
  border: 'none',
  outline: 'none',
  backgroundColor: 'var(--color-tertiarySystemFill)',
  color: 'var(--color-label)',
  marginBottom: 12,
};

const ROW_STYLE: React.CSSProperties = {
  display: 'flex',
  gap: 8,
};

function makeCustomLang(name: string): Language {
  return { code: `custom:${name}`, name, native: name };
}

export function CustomLangInput({ open, onSubmit, onClose }: CustomLangInputProps) {
  const [value, setValue] = useState('');

  // Clear value whenever the sheet (re)opens — feels right for iOS dialogs:
  // each invocation is fresh.
  useEffect(() => {
    if (open) setValue('');
  }, [open]);

  const trimmed = value.trim();
  const canSubmit = trimmed.length > 0;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(makeCustomLang(trimmed));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <div style={CONTAINER_STYLE} role="dialog" aria-modal="true" aria-label="自定义语种">
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
            onClick={(e) => e.stopPropagation()}
          >
            <div style={HANDLE_STYLE} />
            <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 12, color: 'var(--color-label)' }}>
              输入语种名
            </div>
            <input
              autoFocus
              type="text"
              placeholder="如：古希腊语、文言文、Klingon... 输入语种名"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit();
              }}
              style={INPUT_STYLE}
            />
            <div style={ROW_STYLE}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 17,
                  fontWeight: 500,
                  backgroundColor: 'var(--color-tertiarySystemFill)',
                  color: 'var(--color-label)',
                  cursor: 'pointer',
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                style={{
                  flex: 1,
                  minHeight: 44,
                  borderRadius: 10,
                  border: 'none',
                  fontSize: 17,
                  fontWeight: 600,
                  backgroundColor: canSubmit
                    ? 'var(--color-systemBlue)'
                    : 'var(--color-tertiarySystemFill)',
                  color: canSubmit ? 'white' : 'var(--color-tertiaryLabel)',
                  cursor: canSubmit ? 'pointer' : 'default',
                }}
              >
                确认
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
