import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { RecentRow } from './RecentRow';
import type { FavoriteEntry, HistoryEntry } from '../hooks/useHistory';

export interface FavoritesSheetProps {
  open: boolean;
  favorites: FavoriteEntry[];
  isFavorited: (id: string) => boolean;
  onPick: (entry: HistoryEntry) => void;
  onToggleFavorite: (entry: HistoryEntry) => void;
  onClose: () => void;
}

export function FavoritesSheet({
  open,
  favorites,
  isFavorited,
  onPick,
  onToggleFavorite,
  onClose,
}: FavoritesSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="absolute inset-0 z-[100]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="favoritessheet-title"
        >
          <motion.button
            type="button"
            aria-label="关闭收藏"
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
            className="absolute left-0 right-0 bottom-0 bg-[var(--color-secondarySystemBackground)] rounded-t-2xl pt-3 pb-6 max-h-[75%] flex flex-col"
          >
            <div className="w-9 h-[5px] rounded-[3px] mx-auto mb-2 bg-[var(--color-tertiaryLabel)]" />
            <div
              id="favoritessheet-title"
              className="text-[13px] font-semibold text-[var(--color-secondaryLabel)] px-5 pt-1 pb-2"
            >
              收藏
            </div>
            <div className="overflow-y-auto flex-1">
              {favorites.length === 0 ? (
                <div className="text-[15px] text-[var(--color-tertiaryLabel)] text-center px-5 py-10">
                  暂无收藏
                </div>
              ) : (
                favorites.map((e) => (
                  <RecentRow
                    key={e.id}
                    entry={e}
                    isFavorited={isFavorited(e.id)}
                    onPick={(entry) => {
                      onPick(entry);
                      onClose();
                    }}
                    onToggleFavorite={onToggleFavorite}
                    // No onDelete — favorites removed by toggling star
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
