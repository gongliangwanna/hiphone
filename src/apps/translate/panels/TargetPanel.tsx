import React from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { Copy } from 'lucide-react';
import { show as toastShow, error as toastError } from '@hiphone/toast';

export type TargetStatus = 'idle' | 'loading' | 'success' | 'error';

export interface TargetPanelProps {
  text: string;
  status: TargetStatus;
  errorMessage?: string;
}

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'relative',
  margin: '12px 16px 0',
  backgroundColor: 'var(--color-secondarySystemBackground)',
  borderRadius: 12,
  padding: 12,
  minHeight: 140,
  color: 'var(--color-label)',
};

export function TargetPanel({ text, status, errorMessage }: TargetPanelProps) {
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
    <div style={CONTAINER_STYLE}>
      <AnimatePresence mode="wait">
        {status === 'loading' && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={{
              fontSize: 15,
              color: 'var(--color-secondaryLabel)',
            }}
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
            style={{
              fontSize: 15,
              color: 'var(--color-systemRed)',
              whiteSpace: 'pre-wrap',
            }}
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
            style={{
              fontSize: 17,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              paddingRight: 32,
            }}
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
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            width: 32,
            height: 32,
            borderRadius: 16,
            border: 'none',
            backgroundColor: 'var(--color-tertiarySystemFill)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--color-systemBlue)',
          }}
        >
          <Copy size={16} strokeWidth={2.2} />
        </motion.button>
      )}
    </div>
  );
}
