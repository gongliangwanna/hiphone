import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import type { Language } from '../constants/languages';

export interface CustomLangInputProps {
  open: boolean;
  onSubmit: (lang: Language) => void;
  onClose: () => void;
}

const ACTION_BTN = 'flex-1 min-h-11 rounded-[10px] border-none text-[17px] cursor-pointer';

function makeCustomLang(name: string): Language {
  return { code: `custom:${name}`, name, native: name };
}

export function CustomLangInput({ open, onSubmit, onClose }: CustomLangInputProps) {
  const [value, setValue] = useState('');

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
        // z-110: above LangSheet (z-100).
        <div className="absolute inset-0 z-[110]" role="dialog" aria-modal="true" aria-label="自定义语种">
          <motion.button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            className="absolute inset-0 bg-black/40 border-none cursor-pointer"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.snappy}
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 right-0 bottom-0 bg-[var(--color-secondarySystemBackground)] rounded-t-2xl p-4"
          >
            <div className="w-9 h-[5px] rounded-[3px] mx-auto mb-3 bg-[var(--color-tertiaryLabel)]" />
            <div className="text-[17px] font-semibold mb-3 text-[var(--color-label)]">
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
              className="w-full min-h-11 px-3 py-2.5 text-[17px] rounded-[10px] border-none outline-none bg-[var(--color-tertiarySystemFill)] text-[var(--color-label)] mb-3"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className={`${ACTION_BTN} font-medium bg-[var(--color-tertiarySystemFill)] text-[var(--color-label)]`}
              >
                取消
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit}
                className={
                  canSubmit
                    ? `${ACTION_BTN} font-semibold bg-[var(--color-systemBlue)] text-white`
                    : `${ACTION_BTN} font-semibold bg-[var(--color-tertiarySystemFill)] text-[var(--color-tertiaryLabel)] !cursor-default`
                }
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
