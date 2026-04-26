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

const ROW =
  'flex items-center w-full min-h-12 px-5 py-3 border-none bg-transparent text-[17px] text-left text-[var(--color-label)] cursor-pointer';

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
        <div
          className="absolute inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="langsheet-title"
        >
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
            className="absolute left-0 right-0 bottom-0 bg-[var(--color-secondarySystemBackground)] rounded-t-2xl pt-3 pb-6 max-h-[70%] overflow-y-auto"
          >
            <div className="w-9 h-[5px] rounded-[3px] mx-auto mb-2 bg-[var(--color-tertiaryLabel)]" />
            <div
              id="langsheet-title"
              className="text-[13px] font-semibold text-[var(--color-secondaryLabel)] px-5 pt-1 pb-2"
            >
              选择语言
            </div>

            {showAuto && (
              <button type="button" className={ROW} onClick={() => onPick(AUTO_LANG)}>
                {AUTO_LANG.native}
              </button>
            )}
            {CURATED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                className={ROW}
                onClick={() => onPick(lang)}
              >
                {lang.native}
              </button>
            ))}

            <div className="h-px bg-[var(--color-separator)] mx-5 my-2" />

            <button
              type="button"
              className={`${ROW} !text-[var(--color-systemBlue)]`}
              onClick={onPickCustom}
            >
              <Sparkles size={18} strokeWidth={2.2} className="mr-2.5" />
              自定义…
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
