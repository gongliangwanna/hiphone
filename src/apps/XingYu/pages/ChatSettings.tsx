import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, X, Users, Check, Upload } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from '../components/Avatar';
import { T, springs } from '../theme';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

export function ChatSettings() {
  const activeChatId = useXYNav((s) => s.activeChatId);
  const closeChatSettings = useXYNav((s) => s.closeChatSettings);
  const openChat = useXYNav((s) => s.openChat);
  const conversations = useXYData((s) => s.conversations);
  const updateConvSettings = useXYData((s) => s.updateConversationSettings);
  const createGroup = useXYData((s) => s.createGroupConversation);
  const characters = useCharacterStore((s) => s.characters);

  const conv = useMemo(
    () => conversations.find((c) => c.id === activeChatId),
    [conversations, activeChatId],
  );

  // 原始对端名称
  const originalName = useMemo(() => {
    if (!conv) return '';
    if (conv.groupName) return conv.groupName;
    if (conv.characterId) {
      const ch = characters.find((c) => c.id === conv.characterId);
      return ch?.name ?? '';
    }
    return getIdol(conv.idolId)?.name ?? '';
  }, [conv, characters]);

  const [remarkName, setRemarkName] = useState(conv?.remarkName ?? '');
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const bgFileRef = useRef<HTMLInputElement>(null);

  if (!conv) return null;

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // 重置 value 以允许重复选同一张图
    e.target.value = '';
    try {
      const dataUrl = await compressBgImage(file);
      updateConvSettings(conv.id, { backgroundUrl: dataUrl });
    } catch (err) {
      console.warn('[ChatSettings] bg compress failed:', err);
    }
  };

  const handleSaveRemark = () => {
    const trimmed = remarkName.trim();
    if (trimmed !== (conv.remarkName ?? '')) {
      updateConvSettings(conv.id, { remarkName: trimmed || undefined });
    }
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div
        className="flex shrink-0 items-center gap-2.5 px-2"
        style={{
          height: 56,
          backgroundColor: T.overlay,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <motion.button
          className="flex items-center justify-center"
          style={{ width: 36, height: 36 }}
          onClick={closeChatSettings}
          whileTap={{ scale: 0.85 }}
          transition={springs.press}
        >
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>聊天设置</span>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {/* ── Section 1: 聊天背景 ── */}
        <motion.div
          style={{
            padding: '16px 20px',
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            聊天背景
          </span>
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2, marginBottom: 12 }}>
            为当前聊天设置个性化背景
          </p>

          {/* 预览 */}
          {conv.backgroundUrl && (
            <div
              className="relative w-full overflow-hidden"
              style={{ height: 120, borderRadius: T.r.md }}
            >
              <img
                src={conv.backgroundUrl}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                style={{ borderRadius: T.r.md }}
              />
            </div>
          )}

          {/* 隐藏的文件输入 — 用 opacity:0 + absolute 而非 display:none，兼容性更好 */}
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            style={{ position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden' }}
            onChange={handleBgUpload}
          />

          <div className={`flex gap-3 ${conv.backgroundUrl ? 'mt-3' : ''}`}>
            <motion.button
              className="flex flex-1 items-center justify-center gap-2"
              style={{
                height: 40,
                borderRadius: T.r.sm,
                border: `1.5px dashed ${T.border}`,
                backgroundColor: T.bg,
                fontSize: 13,
                color: T.textSecondary,
                fontWeight: 500,
              }}
              onClick={() => bgFileRef.current?.click()}
              whileTap={{ scale: 0.97 }}
            >
              <Upload size={16} color={T.textMuted} strokeWidth={2} />
              {conv.backgroundUrl ? '更换图片' : '上传图片'}
            </motion.button>

            {conv.backgroundUrl && (
              <motion.button
                className="flex flex-1 items-center justify-center"
                style={{
                  height: 40,
                  borderRadius: T.r.sm,
                  backgroundColor: T.bg,
                  border: `1px solid ${T.border}`,
                  fontSize: 13,
                  color: T.rose,
                  fontWeight: 500,
                }}
                onClick={() => updateConvSettings(conv.id, { backgroundUrl: undefined })}
                whileTap={{ scale: 0.97 }}
              >
                恢复默认
              </motion.button>
            )}
          </div>
        </motion.div>

        {/* ── Section 2: 备注名 ── */}
        <motion.div
          className="mt-4"
          style={{
            padding: '16px 20px',
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, ...springs.gentle }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            备注名
          </span>
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2, marginBottom: 12 }}>
            原名: {originalName}
          </p>
          <input
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: 16,
              fontWeight: 600,
              color: T.textPrimary,
              padding: '8px 0',
              borderBottom: `1px solid ${T.border}`,
            }}
            value={remarkName}
            onChange={(e) => setRemarkName(e.target.value)}
            onBlur={handleSaveRemark}
            maxLength={20}
            placeholder={originalName || '输入备注名...'}
          />
        </motion.div>

        {/* ── Section 3: 发起群聊 ── */}
        <motion.div
          className="mt-4"
          style={{
            padding: '16px 20px',
            borderRadius: T.r.xl,
            backgroundColor: T.card,
            boxShadow: T.shadow2,
          }}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, ...springs.gentle }}
        >
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
            群聊
          </span>
          <p style={{ fontSize: 11, color: T.textMuted, marginTop: 2, marginBottom: 12 }}>
            邀请好友创建群聊
          </p>
          <motion.button
            className="flex w-full items-center justify-center gap-2"
            style={{
              height: 44,
              borderRadius: T.r.md,
              background: T.accentGrad,
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
            }}
            onClick={() => setShowGroupPicker(true)}
            whileTap={{ scale: 0.97 }}
          >
            <Users size={18} strokeWidth={2} color="#fff" />
            发起群聊
          </motion.button>
        </motion.div>
      </div>

      {/* 群聊创建 */}
      <AnimatePresence>
        {showGroupPicker && (
          <GroupPicker
            onClose={() => setShowGroupPicker(false)}
            onCreate={(name, memberIds) => {
              const convId = createGroup(name, memberIds);
              setShowGroupPicker(false);
              openChat(convId);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── 背景图压缩 ──
 * 手机照片原图可达 5-10 MB base64，会撑爆 localStorage 并导致移动端渲染黑屏。
 * 压缩到 max 800px 长边 + JPEG 0.7 品质，控制在 ~100-200 KB。 */

const BG_MAX_SIZE = 800;
const BG_QUALITY = 0.7;

async function compressBgImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  let { width: w, height: h } = bitmap;
  if (w > BG_MAX_SIZE || h > BG_MAX_SIZE) {
    const scale = BG_MAX_SIZE / Math.max(w, h);
    w = Math.round(w * scale);
    h = Math.round(h * scale);
  }
  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: BG_QUALITY });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/* ── Group Chat Contact Picker ── */

function GroupPicker({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
}) {
  const [groupName, setGroupName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const characters = useCharacterStore((s) => s.characters);

  const contacts = useMemo(() => {
    return characters.map((c) => ({
      id: `char-${c.id}`,
      name: c.name,
      avatar: c.avatar?.trim() || CHAR_FALLBACK_AVATAR,
      ringIndex: 0,
    }));
  }, [characters]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreate = () => {
    if (selected.size < 2) return;
    const name = groupName.trim() || contacts.filter((c) => selected.has(c.id)).map((c) => c.name).join('、');
    onCreate(name, Array.from(selected));
  };

  return (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <motion.div
        className="mt-auto flex flex-col"
        style={{
          backgroundColor: T.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '80%',
        }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        {/* 拖拽指示条 */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: T.separator }} />
        </div>

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 pb-3">
          <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>选择成员</span>
          <motion.button
            onClick={onClose}
            whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center"
            style={{ width: 28, height: 28 }}
          >
            <X size={18} strokeWidth={2} color={T.textMuted} />
          </motion.button>
        </div>

        {/* 群名输入 */}
        <div className="px-5 pb-3">
          <input
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: 14,
              color: T.textPrimary,
              padding: '8px 12px',
              borderRadius: T.r.sm,
              backgroundColor: T.card,
              border: `1px solid ${T.border}`,
            }}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="输入群聊名称（可选）"
            maxLength={20}
          />
        </div>

        {/* 联系人列表 */}
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5">
          {contacts.map((c) => {
            const isSelected = selected.has(c.id);
            return (
              <motion.button
                key={c.id}
                className="flex w-full items-center gap-3"
                style={{
                  padding: '10px 0',
                  borderBottom: `0.5px solid ${T.separator}`,
                }}
                onClick={() => toggle(c.id)}
                whileTap={{ scale: 0.97 }}
              >
                <Avatar src={c.avatar} size={40} ringIndex={c.ringIndex} />
                <span className="flex-1 text-left" style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary }}>
                  {c.name}
                </span>
                <div
                  className="flex items-center justify-center rounded-full"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: '50%',
                    backgroundColor: isSelected ? T.accent : 'transparent',
                    border: isSelected ? 'none' : `1.5px solid ${T.border}`,
                  }}
                >
                  {isSelected && <Check size={14} strokeWidth={3} color="#fff" />}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* 底部创建按钮 */}
        <div className="px-5 pt-3 pb-6">
          <motion.button
            className="flex w-full items-center justify-center"
            style={{
              height: 44,
              borderRadius: T.r.md,
              background: selected.size >= 2 ? T.accentGrad : T.border,
              color: selected.size >= 2 ? '#fff' : T.textMuted,
              fontSize: 15,
              fontWeight: 600,
            }}
            onClick={handleCreate}
            whileTap={selected.size >= 2 ? { scale: 0.97 } : undefined}
          >
            创建群聊{selected.size > 0 ? `(${selected.size})` : ''}
          </motion.button>
          {selected.size > 0 && selected.size < 2 && (
            <p className="mt-2 text-center" style={{ fontSize: 11, color: T.textMuted }}>
              至少选择 2 位成员
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
