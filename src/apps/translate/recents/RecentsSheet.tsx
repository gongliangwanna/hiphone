import React from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { RecentRow } from './RecentRow';
import type { HistoryEntry } from '../hooks/useHistory';

export interface RecentsSheetProps {
  open: boolean;
  history: HistoryEntry[];
  isFavorited: (id: string) => boolean;
  onPick: (entry: HistoryEntry) => void;
  onToggleFavorite: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const CONTAINER: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 100 };
const BACKDROP: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  border: 'none',
  cursor: 'pointer',
};
const SHEET: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
  background: 'var(--color-secondarySystemBackground)',
  borderTopLeftRadius: 16,
  borderTopRightRadius: 16,
  padding: '12px 0 24px',
  maxHeight: '75%',
  display: 'flex',
  flexDirection: 'column',
};
const HANDLE: React.CSSProperties = {
  width: 36,
  height: 5,
  borderRadius: 3,
  margin: '0 auto 8px',
  background: 'var(--color-tertiaryLabel)',
};
const TITLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--color-secondaryLabel)',
  padding: '4px 20px 8px',
};
const EMPTY: React.CSSProperties = {
  fontSize: 15,
  color: 'var(--color-tertiaryLabel)',
  textAlign: 'center',
  padding: '40px 20px',
};

export function RecentsSheet({
  open,
  history,
  isFavorited,
  onPick,
  onToggleFavorite,
  onDelete,
  onClose,
}: RecentsSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div style={CONTAINER} role="dialog" aria-modal="true" aria-labelledby="recentssheet-title">
          <motion.button
            type="button"
            aria-label="关闭历史"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={spring.smooth}
            style={BACKDROP}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring.snappy}
            style={SHEET}
          >
            <div style={HANDLE} />
            <div id="recentssheet-title" style={TITLE}>
              历史
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {history.length === 0 ? (
                <div style={EMPTY}>暂无历史</div>
              ) : (
                history.map((e) => (
                  <RecentRow
                    key={e.id}
                    entry={e}
                    isFavorited={isFavorited(e.id)}
                    onPick={(entry) => {
                      onPick(entry);
                      onClose();
                    }}
                    onToggleFavorite={onToggleFavorite}
                    onDelete={onDelete}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
