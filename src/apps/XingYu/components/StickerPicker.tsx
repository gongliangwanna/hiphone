import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Download, ChevronLeft } from 'lucide-react';
import { STICKER_PACKS } from '../data';
import type { StickerPack } from '../data';
import { useXYData } from '../xingYuDataStore';
import { T, springs } from '../theme';

interface StickerPickerProps {
  visible: boolean;
  onSendSticker: (emoji: string) => void;
}

export function StickerPicker({ visible, onSendSticker }: StickerPickerProps) {
  const installedIds = useXYData((s) => s.installedStickerPackIds);
  const installPack = useXYData((s) => s.installStickerPack);
  const [activePackId, setActivePackId] = useState<string>(installedIds[0] ?? '');
  const [showStore, setShowStore] = useState(false);

  const installedPacks = STICKER_PACKS.filter((p) => installedIds.includes(p.id));
  const storePacks = STICKER_PACKS.filter((p) => !installedIds.includes(p.id));
  const activePack = STICKER_PACKS.find((p) => p.id === activePackId);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 260, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden"
          style={{ backgroundColor: T.bg, borderTop: `0.5px solid ${T.separator}` }}
        >
          {showStore ? (
            <StoreView
              packs={storePacks}
              onInstall={(id) => {
                installPack(id);
                setActivePackId(id);
                setShowStore(false);
              }}
              onBack={() => setShowStore(false)}
            />
          ) : (
            <>
              {/* Pack tabs */}
              <div
                className="scrollbar-hide flex items-center gap-1 overflow-x-auto px-3 py-2"
                style={{ borderBottom: `0.5px solid ${T.separator}` }}
              >
                {installedPacks.map((pack) => (
                  <motion.button
                    key={pack.id}
                    className="flex shrink-0 items-center justify-center rounded-lg"
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor:
                        activePackId === pack.id ? `${T.accent}20` : 'transparent',
                    }}
                    onClick={() => setActivePackId(pack.id)}
                    whileTap={{ scale: 0.9 }}
                  >
                    <span style={{ fontSize: 20 }}>{pack.icon}</span>
                  </motion.button>
                ))}
                {storePacks.length > 0 && (
                  <motion.button
                    className="flex shrink-0 items-center justify-center rounded-lg"
                    style={{ width: 36, height: 36 }}
                    onClick={() => setShowStore(true)}
                    whileTap={{ scale: 0.9 }}
                  >
                    <Plus size={18} strokeWidth={2} color={T.textMuted} />
                  </motion.button>
                )}
              </div>

              {/* Stickers grid */}
              {activePack && (
                <div
                  className="scrollbar-hide grid grid-cols-5 gap-1 overflow-y-auto px-3 pt-2"
                  style={{
                    maxHeight: 210,
                    paddingBottom: 'max(8px, calc(var(--safe-bottom, 0px) + 8px))',
                  }}
                >
                  {activePack.stickers.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      className="flex flex-col items-center justify-center rounded-xl transition-transform active:scale-90"
                      style={{ height: 56, touchAction: 'manipulation' }}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        onSendSticker(sticker.emoji);
                      }}
                    >
                      <span style={{ fontSize: 28 }}>{sticker.emoji}</span>
                      <span style={{ fontSize: 9, color: T.textMuted, marginTop: 1 }}>
                        {sticker.label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StoreView({
  packs,
  onInstall,
  onBack,
}: {
  packs: StickerPack[];
  onInstall: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `0.5px solid ${T.separator}` }}>
        <motion.button
          onClick={onBack}
          whileTap={{ scale: 0.85 }}
          className="flex items-center justify-center"
          style={{ width: 32, height: 32 }}
        >
          <ChevronLeft size={20} strokeWidth={2} color={T.accent} />
        </motion.button>
        <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>表情商店</span>
      </div>

      {/* Pack list */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {packs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <span style={{ fontSize: 13, color: T.textMuted }}>全部表情包已添加</span>
          </div>
        ) : (
          packs.map((pack) => (
            <div
              key={pack.id}
              className="mb-2 flex items-center gap-3 rounded-xl"
              style={{ padding: '10px 12px', backgroundColor: T.card, boxShadow: T.shadow1 }}
            >
              <span style={{ fontSize: 28 }}>{pack.icon}</span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
                  {pack.name}
                </span>
                <span style={{ fontSize: 11, color: T.textMuted }}>{pack.description}</span>
              </div>
              <motion.button
                className="flex items-center gap-1 rounded-full"
                style={{
                  padding: '5px 12px',
                  background: T.accentGrad,
                }}
                onClick={() => onInstall(pack.id)}
                whileTap={{ scale: 0.9 }}
                transition={springs.press}
              >
                <Download size={12} strokeWidth={2.5} color={T.textOnAccent} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.textOnAccent }}>
                  添加
                </span>
              </motion.button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
