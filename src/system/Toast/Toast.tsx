import { AnimatePresence, motion } from 'motion/react';
import { useToastStore } from './toastStore';
import { spring } from '@/platform/design-tokens/motion';

export function Toast() {
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);

  return (
    <AnimatePresence>
      {visible && message && (
        <motion.div
          className="pointer-events-none absolute inset-x-0 flex justify-center"
          style={{
            top: 'calc(var(--status-bar-height) + 44px + 8px)',
            zIndex: 30,
          }}
          data-perf-layer="toast"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ type: 'spring', ...spring.snappy }}
          data-testid="toast"
        >
          <div
            className="rounded-full px-4 py-2"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              maxWidth: 'calc(100% - 32px)',
            }}
          >
            <span
              className="block text-center text-sm text-white"
              style={{ fontSize: 'var(--font-size-subhead)' }}
            >
              {message}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
