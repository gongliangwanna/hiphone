import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { Copy, Star } from 'lucide-react';
import { show as toastShow, error as toastError } from '@hiphone/toast';

export type TargetStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TargetPanelProps {
  text: string;
  status: TargetStatus;
  errorMessage?: string;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}

const ICON_BTN =
  'absolute bottom-2 w-8 h-8 rounded-full border-none bg-[var(--color-tertiarySystemFill)] flex items-center justify-center cursor-pointer';

export function TargetPanel({ text, status, errorMessage, isFavorited, onToggleFavorite }: TargetPanelProps) {
  const onCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toastShow('已复制');
    } catch {
      toastError('复制失败');
    }
  };

  return (
    <div className="relative mx-4 mt-3 bg-[var(--color-secondarySystemBackground)] rounded-[12px] p-3 min-h-[140px] text-[var(--color-label)]">
      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            className="text-[15px] text-[var(--color-secondaryLabel)]"
          >
            翻译中…
          </motion.div>
        )}
        {status === 'error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            className="text-[15px] text-[var(--color-systemRed)] whitespace-pre-wrap"
          >
            {errorMessage ?? '翻译失败'}
          </motion.div>
        )}
        {(status === 'success' || (status === 'idle' && text)) && text && (
          <motion.div
            key="text"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            className="text-[17px] leading-[1.4] whitespace-pre-wrap pr-8"
          >
            {text}
          </motion.div>
        )}
      </AnimatePresence>

      {text && status !== 'loading' && (
        <motion.button
          type="button"
          onClick={onCopy}
          whileTap={{ scale: 1.15 }}
          transition={spring.bouncy}
          aria-label="复制译文"
          className={`${ICON_BTN} right-2 text-[var(--color-systemBlue)]`}
        >
          <Copy size={16} strokeWidth={2.2} />
        </motion.button>
      )}

      {text && status !== 'loading' && onToggleFavorite && (
        <motion.button
          type="button"
          aria-label={isFavorited ? '取消收藏' : '收藏'}
          onClick={onToggleFavorite}
          whileTap={{ scale: 1.3 }}
          transition={spring.bouncy}
          className={`${ICON_BTN} right-12 ${isFavorited ? 'text-[var(--color-systemYellow)]' : 'text-[var(--color-systemBlue)]'}`}
        >
          <Star size={16} strokeWidth={2.2} fill={isFavorited ? 'currentColor' : 'none'} />
        </motion.button>
      )}
    </div>
  );
}
