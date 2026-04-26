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

export function RecentRow({ entry, isFavorited, onPick, onToggleFavorite, onDelete }: RecentRowProps) {
  return (
    <div className="relative overflow-hidden border-b border-[var(--color-separator)]">
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
          className="absolute inset-0 bg-[var(--color-systemRed)] flex items-center justify-end pr-6 text-white text-[15px] font-semibold border-none cursor-pointer"
        >
          <Trash2 size={18} strokeWidth={2.2} className="mr-1.5" />
          删除
        </button>
      )}
      <motion.div
        drag={onDelete ? 'x' : false}
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.05}
        transition={spring.snappy}
        // position:relative is load-bearing — without it, the row paints BEFORE
        // the absolutely-positioned delete bg (per CSS paint order: non-positioned
        // elements draw under positioned ones), and the delete bg covers the
        // entire row content. Making this positioned puts both siblings in the
        // same paint layer; source order then puts the row on top.
        className="relative flex items-start w-full px-4 py-3 bg-[var(--color-secondarySystemBackground)] border-none text-left cursor-pointer gap-2"
      >
        <button
          type="button"
          onClick={() => onPick(entry)}
          aria-label="恢复此条历史"
          className="flex-1 bg-transparent border-none text-left cursor-pointer p-0"
        >
          <div className="text-[13px] text-[var(--color-secondaryLabel)] mb-0.5">
            {entry.sourceLang.native} → {entry.targetLang.native}
          </div>
          <div className="text-[15px] text-[var(--color-label)] mb-0.5 whitespace-pre-wrap break-words">
            {entry.sourceText}
          </div>
          <div className="text-[15px] text-[var(--color-secondaryLabel)] whitespace-pre-wrap break-words">
            {entry.targetText}
          </div>
        </button>
        <motion.button
          type="button"
          aria-label={isFavorited ? '取消收藏' : '收藏'}
          onClick={() => onToggleFavorite(entry)}
          whileTap={{ scale: 1.3 }}
          transition={spring.bouncy}
          className="shrink-0 w-8 h-8 rounded-full border-none bg-transparent flex items-center justify-center cursor-pointer"
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
