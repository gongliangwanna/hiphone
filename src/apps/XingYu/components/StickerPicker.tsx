import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Pencil } from 'lucide-react';
import { useStickerStore } from '../stickerStore';
import type { StickerPack } from '../data';
import { T } from '../theme';

interface StickerPickerProps {
  visible: boolean;
  onSendSticker: (stickerUrl: string, stickerDesc: string) => void;
  onManage: () => void;
}

export function StickerPicker({ visible, onSendSticker, onManage }: StickerPickerProps) {
  const packs = useStickerStore((s) => s.packs);
  const [activePackId, setActivePackId] = useState<string>('');

  const activeId = activePackId || packs[0]?.id || '';
  const activePack = packs.find((p) => p.id === activeId);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 280, opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          className="shrink-0 overflow-hidden"
          style={{ backgroundColor: T.bg, borderTop: `0.5px solid ${T.separator}` }}
        >
          <GridView
            packs={packs}
            activePack={activePack}
            activeId={activeId}
            onSelectPack={setActivePackId}
            onSend={onSendSticker}
            onManage={onManage}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ── Grid View: 发送表情 ── */
function GridView({
  packs,
  activePack,
  activeId,
  onSelectPack,
  onSend,
  onManage,
}: {
  packs: StickerPack[];
  activePack?: StickerPack;
  activeId: string;
  onSelectPack: (id: string) => void;
  onSend: (url: string, desc: string) => void;
  onManage: () => void;
}) {
  if (packs.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <span style={{ fontSize: 14, color: T.textMuted }}>还没有表情包</span>
        <motion.button
          className="flex items-center gap-1.5 rounded-full"
          style={{ padding: '8px 20px', background: T.accentGrad }}
          onClick={onManage}
          whileTap={{ scale: 0.95 }}
        >
          <Plus size={16} strokeWidth={2.5} color="#fff" />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>创建表情包</span>
        </motion.button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Top pack tabs */}
      <div
        className="scrollbar-hide flex shrink-0 items-center gap-1 overflow-x-auto px-2 py-1.5"
        style={{ borderBottom: `0.5px solid ${T.separator}` }}
      >
        {packs.map((pack) => {
          const cover = pack.stickers[0]?.imageData;
          const isActive = pack.id === activeId;
          return (
            <button
              key={pack.id}
              className="flex shrink-0 items-center justify-center overflow-hidden rounded-md"
              style={{
                width: 36,
                height: 36,
                backgroundColor: isActive ? `${T.accent}18` : 'transparent',
                border: isActive ? `1.5px solid ${T.accent}40` : '1.5px solid transparent',
              }}
              onClick={() => onSelectPack(pack.id)}
            >
              {cover ? (
                <img src={cover} alt={pack.name} className="h-full w-full object-contain" style={{ padding: 3 }} />
              ) : (
                <span style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>
                  {pack.name.slice(0, 1)}
                </span>
              )}
            </button>
          );
        })}
        <button
          className="flex shrink-0 items-center justify-center rounded-md"
          style={{ width: 36, height: 36 }}
          onClick={onManage}
        >
          <Pencil size={16} strokeWidth={2} color={T.textMuted} />
        </button>
      </div>

      {/* Sticker grid */}
      <div
        className="scrollbar-hide grid min-h-0 flex-1 grid-cols-4 gap-2 overflow-y-auto px-3 pt-2"
        style={{ paddingBottom: 'max(8px, calc(var(--safe-bottom, 0px) + 8px))' }}
      >
        {activePack?.stickers.map((sticker) => (
          <motion.button
            key={sticker.id}
            type="button"
            className="flex items-center justify-center overflow-hidden rounded-lg"
            style={{ aspectRatio: '1', backgroundColor: `${T.accent}08` }}
            onClick={() => onSend(sticker.imageData, sticker.description)}
            whileTap={{ scale: 0.88 }}
          >
            <img
              src={sticker.imageData}
              alt={sticker.description}
              className="h-full w-full object-contain"
              draggable={false}
              style={{ padding: 4 }}
            />
          </motion.button>
        ))}
        {activePack && activePack.stickers.length === 0 && (
          <div className="col-span-4 flex items-center justify-center py-8">
            <span style={{ fontSize: 13, color: T.textMuted }}>这个表情包还是空的</span>
          </div>
        )}
      </div>
    </div>
  );
}
