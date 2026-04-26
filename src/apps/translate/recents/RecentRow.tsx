import React from 'react';
import { motion } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { Star, Trash2 } from 'lucide-react';
import type { HistoryEntry } from '../hooks/useHistory';

export interface RecentRowProps {
  entry: HistoryEntry;
  isFavorited: boolean;
  onPick: (entry: HistoryEntry) => void;
  onToggleFavorite: (entry: HistoryEntry) => void;
  /** When provided, row reveals a delete button (always visible as affordance). */
  onDelete?: (id: string) => void;
}

const ROW_OUTER: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderBottom: '1px solid var(--color-separator)',
};

const ROW_INNER: React.CSSProperties = {
  // position:relative is load-bearing — without it, the row paints BEFORE
  // the absolutely-positioned delete bg (per CSS paint order: non-positioned
  // elements draw under positioned ones), and the delete bg covers the
  // entire row content. Making this positioned puts both siblings in the
  // same paint layer; source order then puts the row on top.
  position: 'relative',
  display: 'flex',
  alignItems: 'flex-start',
  width: '100%',
  padding: '12px 16px',
  background: 'var(--color-secondarySystemBackground)',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  gap: 8,
};

const DELETE_BG: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--color-systemRed)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: 24,
  color: 'white',
  fontSize: 15,
  fontWeight: 600,
};

const STAR_BTN: React.CSSProperties = {
  flexShrink: 0,
  width: 32,
  height: 32,
  borderRadius: 16,
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

export function RecentRow({ entry, isFavorited, onPick, onToggleFavorite, onDelete }: RecentRowProps) {
  return (
    <div style={ROW_OUTER}>
      {onDelete && (
        /* aria-hidden + tabIndex=-1: delete sits behind the row as a swipe-reveal
           affordance; hiding it from a11y until M2 SheetGesture lands a proper
           drag-reveal-disclose pattern that announces itself correctly. */
        <button
          type="button"
          aria-label="删除"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => onDelete(entry.id)}
          style={{ ...DELETE_BG, border: 'none', cursor: 'pointer' }}
        >
          <Trash2 size={18} strokeWidth={2.2} style={{ marginRight: 6 }} />
          删除
        </button>
      )}
      <motion.div
        drag={onDelete ? 'x' : false}
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.05}
        transition={spring.snappy}
        style={ROW_INNER}
      >
        <button
          type="button"
          onClick={() => onPick(entry)}
          aria-label="恢复此条历史"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            textAlign: 'left',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <div
            style={{
              fontSize: 13,
              color: 'var(--color-secondaryLabel)',
              marginBottom: 2,
            }}
          >
            {entry.sourceLang.native} → {entry.targetLang.native}
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'var(--color-label)',
              marginBottom: 2,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {entry.sourceText}
          </div>
          <div
            style={{
              fontSize: 15,
              color: 'var(--color-secondaryLabel)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {entry.targetText}
          </div>
        </button>
        <motion.button
          type="button"
          aria-label={isFavorited ? '取消收藏' : '收藏'}
          onClick={() => {
            onToggleFavorite(entry);
          }}
          whileTap={{ scale: 1.3 }}
          transition={spring.bouncy}
          style={STAR_BTN}
        >
          <Star
            size={20}
            strokeWidth={2}
            color={isFavorited ? 'var(--color-systemYellow)' : 'var(--color-tertiaryLabel)'}
            fill={isFavorited ? 'var(--color-systemYellow)' : 'none'}
          />
        </motion.button>
      </motion.div>
    </div>
  );
}
