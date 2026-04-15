import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ImagePlus,
  Smile,
  X,
} from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useStickerStore, compressImage } from '../stickerStore';
import type { StickerPack } from '../data';
import { T, springs } from '../theme';

type View = 'pack-list' | 'pack-detail';

export function StickerManager() {
  const closeStickerManager = useXYNav((s) => s.closeStickerManager);
  const packs = useStickerStore((s) => s.packs);
  const createPack = useStickerStore((s) => s.createPack);
  const deletePack = useStickerStore((s) => s.deletePack);
  const renamePack = useStickerStore((s) => s.renamePack);
  const addSticker = useStickerStore((s) => s.addSticker);
  const deleteSticker = useStickerStore((s) => s.deleteSticker);
  const updateStickerDesc = useStickerStore((s) => s.updateStickerDesc);

  const [view, setView] = useState<View>('pack-list');
  const [activePackId, setActivePackId] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    count: number;
  } | null>(null);

  const activePack = packs.find((p) => p.id === activePackId);

  const handleBack = useCallback(() => {
    if (view === 'pack-detail') {
      setView('pack-list');
      setEditMode(false);
    } else {
      closeStickerManager();
    }
  }, [view, closeStickerManager]);

  const handleCreatePack = useCallback(
    (name: string) => {
      const id = createPack(name);
      setShowCreateDialog(false);
      setActivePackId(id);
      setView('pack-detail');
    },
    [createPack],
  );

  const handleOpenPack = useCallback((id: string) => {
    setActivePackId(id);
    setEditMode(false);
    setView('pack-detail');
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!deleteTarget) return;
    // If deleting the pack we're currently viewing, go back to list
    if (view === 'pack-detail' && deleteTarget.id === activePackId) {
      setView('pack-list');
      setEditMode(false);
    }
    deletePack(deleteTarget.id);
    setDeleteTarget(null);
  }, [deleteTarget, deletePack, view, activePackId]);

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* ── Header ── */}
      <div
        className="flex shrink-0 items-center px-2 relative"
        style={{
          height: 56,
          backgroundColor: T.overlay,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <motion.button
          className="flex items-center justify-center relative z-10"
          style={{ height: 44, padding: '0 8px' }}
          onClick={handleBack}
          whileTap={{ opacity: 0.5 }}
          transition={{ duration: 0 }}
        >
          <ChevronLeft size={24} strokeWidth={2.5} color={T.accent} />
          <span style={{ fontSize: 16, fontWeight: 500, color: T.accent, marginLeft: -2 }}>
            {view === 'pack-detail' ? '返回' : ''}
          </span>
        </motion.button>

        {/* Title Centered */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span
            className="truncate px-12 text-center"
            style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary, maxWidth: '60%' }}
          >
            {view === 'pack-detail' && activePack ? activePack.name : '表情包管理'}
          </span>
        </div>

        {/* Right side actions */}
        <div className="flex items-center ml-auto relative z-10">
          {view === 'pack-list' && (
            <motion.button
              className="flex items-center justify-center px-2"
              style={{ height: 44 }}
              onClick={() => setShowCreateDialog(true)}
              whileTap={{ opacity: 0.5 }}
            >
              <Plus size={24} strokeWidth={2} color={T.accent} />
            </motion.button>
          )}

          {view === 'pack-detail' && activePack && activePack.stickers.length > 0 && (
            <motion.button
              className="flex items-center justify-center px-2"
              style={{ height: 44 }}
              onClick={() => setEditMode((p) => !p)}
              whileTap={{ opacity: 0.5 }}
            >
              <span style={{ fontSize: 16, fontWeight: 500, color: editMode ? T.accent : T.textPrimary }}>
                {editMode ? '完成' : '编辑'}
              </span>
            </motion.button>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <AnimatePresence mode="popLayout" initial={false}>
        {view === 'pack-list' ? (
          <motion.div
            key="pack-list"
            className="min-h-0 flex-1 overflow-hidden"
            initial={{ x: '-30%', opacity: 0 }}
            animate={{ x: '0%', opacity: 1 }}
            exit={{ x: '-30%', opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            <PackListView
              packs={packs}
              onOpenPack={handleOpenPack}
              onLongPressPack={(pack) =>
                setDeleteTarget({ id: pack.id, name: pack.name, count: pack.stickers.length })
              }
            />
          </motion.div>
        ) : activePack ? (
          <motion.div
            key="pack-detail"
            className="min-h-0 flex-1 overflow-hidden"
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: '0%', opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            <PackDetailView
              pack={activePack}
              editMode={editMode}
              onAddSticker={(imageData, desc) => addSticker(activePack.id, imageData, desc)}
              onDeleteSticker={(sid) => deleteSticker(activePack.id, sid)}
              onUpdateDesc={(sid, desc) => updateStickerDesc(activePack.id, sid, desc)}
              onRename={(name) => renamePack(activePack.id, name)}
              onDeletePack={() =>
                setDeleteTarget({
                  id: activePack.id,
                  name: activePack.name,
                  count: activePack.stickers.length,
                })
              }
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ── Dialogs ── */}
      <CreatePackDialog
        visible={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreatePack}
      />
      <ConfirmDeleteDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PackListView
   ═══════════════════════════════════════════════════════════ */

function PackListView({
  packs,
  onOpenPack,
  onLongPressPack,
}: {
  packs: StickerPack[];
  onOpenPack: (id: string) => void;
  onLongPressPack: (pack: StickerPack) => void;
}) {
  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 py-6">
      {/* Card container */}
      <div style={{ backgroundColor: T.card, borderRadius: 12, overflow: 'hidden' }}>
        {packs.map((pack, i) => (
          <motion.div
            key={pack.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, ...springs.gentle }}
          >
            <PackRow
              pack={pack}
              onTap={() => onOpenPack(pack.id)}
              onLongPress={() => onLongPressPack(pack)}
              isLast={i === packs.length - 1}
            />
          </motion.div>
        ))}

        {/* Empty state inside card */}
        {packs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12">
            <Smile size={42} strokeWidth={1.5} color={T.textMuted} className="mb-4" />
            <span style={{ fontSize: 14, color: T.textSecondary, fontWeight: 500 }}>
              点击右上角「+」创建表情包
            </span>
          </div>
        )}
      </div>

      {/* Tip text below card */}
      {packs.length > 0 && (
        <div className="mt-3 px-2">
          <span style={{ fontSize: 13, color: T.textMuted }}>
            长按表情包可删除
          </span>
        </div>
      )}
    </div>
  );
}

/* ── Pack Row (matches ContactsTab CharacterRow pattern) ── */

function PackRow({
  pack,
  onTap,
  onLongPress,
  isLast,
}: {
  pack: StickerPack;
  onTap: () => void;
  onLongPress: () => void;
  isLast: boolean;
}) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const firedRef = useRef(false);

  const handlePointerDown = () => {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(timerRef.current);
    if (!firedRef.current) onTap();
  };

  const handlePointerCancel = () => {
    clearTimeout(timerRef.current);
  };

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const cover = pack.stickers[0]?.imageData;

  return (
    <motion.button
      className="flex w-full items-center gap-3 relative"
      style={{ padding: '10px 16px', backgroundColor: 'transparent' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      whileTap={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
      transition={{ duration: 0 }}
    >
      {/* Thumbnail */}
      <div
        className="flex shrink-0 items-center justify-center overflow-hidden"
        style={{
          width: 44,
          height: 44,
          borderRadius: 8,
          backgroundColor: `${T.accent}08`,
        }}
      >
        {cover ? (
          <img
            src={cover}
            alt=""
            className="h-full w-full object-contain"
            draggable={false}
            style={{ padding: 4 }}
          />
        ) : (
          <ImagePlus size={20} strokeWidth={1.4} color={T.textMuted} />
        )}
      </div>

      {/* Name + count */}
      <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
        <span style={{ fontSize: 16, fontWeight: 500, color: T.textPrimary }}>
          {pack.name}
        </span>
        <span style={{ fontSize: 13, color: T.textSecondary }}>
          {pack.stickers.length} 个表情
        </span>
      </div>

      <ChevronRight size={16} color={T.textMuted} strokeWidth={2} />

      {/* Divider */}
      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{ height: 0.5, backgroundColor: T.separator, left: 72 }}
        />
      )}
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════
   PackDetailView
   ═══════════════════════════════════════════════════════════ */

function PackDetailView({
  pack,
  editMode,
  onAddSticker,
  onDeleteSticker,
  onUpdateDesc,
  onRename,
  onDeletePack,
}: {
  pack: StickerPack;
  editMode: boolean;
  onAddSticker: (imageData: string, desc: string) => boolean;
  onDeleteSticker: (stickerId: string) => void;
  onUpdateDesc: (stickerId: string, desc: string) => void;
  onRename: (name: string) => void;
  onDeletePack: () => void;
}) {
  const [packName, setPackName] = useState(pack.name);
  const [editingSticker, setEditingSticker] = useState<{id: string, desc: string} | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [pendingImageData, setPendingImageData] = useState<string | null>(null);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      e.target.value = '';

      try {
        const imageData = await compressImage(file);
        setPendingImageData(imageData);
      } catch {
        // compression failed
      }
    },
    [],
  );

  const handleRename = () => {
    const trimmed = packName.trim();
    if (trimmed && trimmed !== pack.name) {
      onRename(trimmed);
    } else {
      setPackName(pack.name);
    }
  };

  return (
    <div className="scrollbar-hide h-full overflow-y-auto px-4 py-6">
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* ── Pack name edit section ── */}
      <div className="mb-1.5 px-2">
        <span style={{ fontSize: 13, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          名称
        </span>
      </div>

      <div
        className="mb-6 flex items-center"
        style={{
          backgroundColor: T.card,
          borderRadius: 12,
          overflow: 'hidden',
          padding: '12px 16px',
        }}
      >
        <input
          className="min-w-0 flex-1 bg-transparent outline-none"
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: T.textPrimary,
          }}
          value={packName}
          onChange={(e) => setPackName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          placeholder="表情包名称"
        />
      </div>

      {/* ── Sticker grid section ── */}
      <div className="mb-1.5 flex justify-between items-end px-2">
        <span style={{ fontSize: 13, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          表情 ({pack.stickers.length})
        </span>
      </div>

      <div
        style={{
          backgroundColor: T.card,
          borderRadius: 16,
          padding: 16,
        }}
      >
        <div className="grid grid-cols-4 gap-3">
          {/* Add sticker button inside grid */}
          <motion.button
            className="flex items-center justify-center overflow-hidden"
            style={{
              aspectRatio: '1',
              borderRadius: 10,
              backgroundColor: `${T.accent}1A`,
            }}
            onClick={() => fileRef.current?.click()}
            whileTap={{ scale: 0.95 }}
          >
            <Plus size={26} strokeWidth={2.5} color={T.accent} />
          </motion.button>

          {pack.stickers.map((sticker, i) => (
            <motion.div
              key={sticker.id}
              className="relative flex flex-col items-center"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.02, ...springs.gentle }}
            >
              {/* Sticker image */}
              <motion.button
                className="flex w-full items-center justify-center overflow-hidden"
                style={{
                  aspectRatio: '1',
                  borderRadius: 10,
                  backgroundColor: `${T.textPrimary}06`,
                }}
                onClick={() => {
                  if (!editMode) setEditingSticker({ id: sticker.id, desc: sticker.description });
                }}
                whileTap={{ scale: editMode ? 1 : 0.95 }}
                disabled={editMode}
              >
                <img
                  src={sticker.imageData}
                  alt={sticker.description}
                  className="h-full w-full object-contain p-1"
                  draggable={false}
                />
              </motion.button>

              <span
                className="mt-1.5 w-full truncate text-center"
                style={{ fontSize: 11, color: T.textSecondary }}
              >
                {sticker.description}
              </span>

              {/* Delete badge (edit mode only) */}
              <AnimatePresence>
                {editMode && (
                  <motion.button
                    className="absolute -right-1.5 -top-1.5 flex items-center justify-center rounded-full"
                    style={{
                      width: 20,
                      height: 20,
                      backgroundColor: T.rose,
                      boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
                      zIndex: 10,
                    }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    onClick={() => onDeleteSticker(sticker.id)}
                    whileTap={{ scale: 0.8 }}
                  >
                    <X size={12} strokeWidth={3} color="#fff" />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
      
      {!editMode && pack.stickers.length > 0 && (
        <div className="mt-2 px-2">
          <span style={{ fontSize: 12, color: T.textMuted }}>
            点击表情可修改描述（用于帮助 AI 理解）
          </span>
        </div>
      )}

      {/* ── Delete pack button ── */}
      <motion.button
        className="mt-8 flex w-full items-center justify-center"
        style={{
          padding: '14px 0',
          backgroundColor: T.card,
          borderRadius: 12,
        }}
        onClick={onDeletePack}
        whileTap={{ backgroundColor: 'rgba(255,59,48,0.06)' }}
        transition={{ duration: 0 }}
      >
        <span style={{ fontSize: 15, fontWeight: 500, color: T.rose }}>
          删除表情包
        </span>
      </motion.button>

      {/* Edit Desc Dialog */}
      <EditDescDialog
        visible={!!editingSticker || !!pendingImageData}
        initialDesc={editingSticker?.desc || ''}
        isNew={!!pendingImageData}
        onClose={() => {
          setEditingSticker(null);
          setPendingImageData(null);
        }}
        onSave={(desc) => {
          if (pendingImageData) {
            onAddSticker(pendingImageData, desc);
            setPendingImageData(null);
          } else if (editingSticker) {
            onUpdateDesc(editingSticker.id, desc);
            setEditingSticker(null);
          }
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   EditDescDialog
   ═══════════════════════════════════════════════════════════ */

function EditDescDialog({
  visible,
  initialDesc,
  isNew,
  onClose,
  onSave,
}: {
  visible: boolean;
  initialDesc: string;
  isNew?: boolean;
  onClose: () => void;
  onSave: (desc: string) => void;
}) {
  const [desc, setDesc] = useState('');

  useEffect(() => {
    if (visible) setDesc(initialDesc);
  }, [visible, initialDesc]);

  const handleSave = () => {
    const trimmed = desc.trim();
    if (!trimmed) return; // Prevent saving empty description
    onSave(trimmed);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="absolute inset-0 z-50 flex items-center justify-center">
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          <motion.div
            className="relative flex flex-col items-center"
            style={{
              width: '80%',
              maxWidth: 280,
              backgroundColor: T.card,
              borderRadius: T.r.xl,
              padding: 24,
              boxShadow: T.shadow3,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={springs.gentle}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.textPrimary,
                marginBottom: 20,
              }}
            >
              {isNew ? '添加表情' : '修改表情描述'}
            </span>

            <input
              className="w-full bg-transparent text-center outline-none"
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: T.textPrimary,
                borderBottom: `1.5px solid ${T.border}`,
                paddingBottom: 8,
              }}
              placeholder="输入描述 (必填)"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              autoFocus
            />

            <div className="mt-6 flex w-full items-center justify-center gap-4">
              <motion.button
                className="flex-1 py-2.5"
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: T.textSecondary,
                  borderRadius: T.r.sm,
                }}
                onClick={onClose}
                whileTap={{ opacity: 0.5 }}
              >
                取消
              </motion.button>
              <motion.button
                className="flex-1 py-2.5"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.textOnAccent,
                  background: desc.trim() ? T.accentGrad : T.border,
                  borderRadius: T.r.sm,
                  opacity: desc.trim() ? 1 : 0.5,
                  pointerEvents: desc.trim() ? 'auto' : 'none',
                }}
                onClick={handleSave}
                whileTap={{ scale: 0.95 }}
              >
                保存
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════
   CreatePackDialog
   ═══════════════════════════════════════════════════════════ */

function CreatePackDialog({
  visible,
  onClose,
  onCreate,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  // Reset on open
  useEffect(() => {
    if (visible) setName('');
  }, [visible]);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (trimmed) onCreate(trimmed);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            className="relative flex flex-col items-center"
            style={{
              width: '80%',
              maxWidth: 280,
              backgroundColor: T.card,
              borderRadius: T.r.xl,
              padding: 24,
              boxShadow: T.shadow3,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={springs.gentle}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.textPrimary,
                marginBottom: 20,
              }}
            >
              新建表情包
            </span>

            <input
              className="w-full bg-transparent text-center outline-none"
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: T.textPrimary,
                borderBottom: `1.5px solid ${T.border}`,
                paddingBottom: 8,
              }}
              placeholder="输入名称..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />

            <div className="mt-6 flex w-full items-center justify-center gap-4">
              <motion.button
                className="flex-1 py-2.5"
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: T.textSecondary,
                  borderRadius: T.r.sm,
                }}
                onClick={onClose}
                whileTap={{ opacity: 0.5 }}
              >
                取消
              </motion.button>
              <motion.button
                className="flex-1 py-2.5"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: T.textOnAccent,
                  background: name.trim() ? T.accentGrad : T.border,
                  borderRadius: T.r.sm,
                  opacity: name.trim() ? 1 : 0.5,
                  pointerEvents: name.trim() ? 'auto' : 'none',
                }}
                onClick={handleCreate}
                whileTap={{ scale: 0.95 }}
              >
                创建
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ═══════════════════════════════════════════════════════════
   ConfirmDeleteDialog
   ═══════════════════════════════════════════════════════════ */

function ConfirmDeleteDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: { id: string; name: string; count: number } | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AnimatePresence>
      {target && (
        <motion.div className="absolute inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
          />

          {/* Card */}
          <motion.div
            className="relative flex flex-col items-center"
            style={{
              width: '80%',
              maxWidth: 280,
              backgroundColor: T.card,
              borderRadius: T.r.xl,
              padding: 24,
              boxShadow: T.shadow3,
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={springs.gentle}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: T.textPrimary,
                marginBottom: 12,
              }}
            >
              删除表情包
            </span>

            <span
              style={{
                fontSize: 14,
                color: T.textSecondary,
                textAlign: 'center',
                lineHeight: 1.5,
              }}
            >
              确定要删除「{target.name}」吗？
              {target.count > 0 && (
                <>
                  <br />
                  包含的 {target.count} 个表情将被永久移除。
                </>
              )}
            </span>

            <div className="mt-6 flex w-full items-center justify-center gap-4">
              <motion.button
                className="flex-1 py-2.5"
                style={{
                  fontSize: 15,
                  fontWeight: 500,
                  color: T.textSecondary,
                  borderRadius: T.r.sm,
                }}
                onClick={onClose}
                whileTap={{ opacity: 0.5 }}
              >
                取消
              </motion.button>
              <motion.button
                className="flex-1 py-2.5"
                style={{
                  fontSize: 15,
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: T.rose,
                  borderRadius: T.r.sm,
                }}
                onClick={onConfirm}
                whileTap={{ scale: 0.95 }}
              >
                删除
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
