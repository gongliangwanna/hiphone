import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Minus, Search, Image as ImageIcon } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from './Avatar';
import { T, springs } from '../theme';
import type { Conversation } from '../data';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

interface Props {
  conv: Conversation;
  onOpenPicker: (mode: 'add' | 'initial') => void;
  onCompressImage: (file: File) => Promise<string>;
}

export function GroupSettings({ conv, onOpenPicker, onCompressImage }: Props) {
  const closeChatSettings = useXYNav((s) => s.closeChatSettings);
  const openChatSearch = useXYNav((s) => s.openChatSearch);
  const deleteConv = useXYData((s) => s.deleteConversation);
  const updateGroup = useXYData((s) => s.updateGroupSettings);
  const removeMember = useXYData((s) => s.removeGroupMember);
  const updateConvSettings = useXYData((s) => s.updateConversationSettings);
  const characters = useCharacterStore((s) => s.characters);

  const [deleteMode, setDeleteMode] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [showAnnouncementEditor, setShowAnnouncementEditor] = useState(false);
  const [nameDraft, setNameDraft] = useState(conv.groupName ?? '');
  const [announcementDraft, setAnnouncementDraft] = useState(conv.groupAnnouncement ?? '');
  const groupAvatarRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const memberIds = conv.groupMemberIds ?? [];

  const handleRemove = (id: string) => {
    try {
      removeMember(conv.id, id);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await onCompressImage(file);
      updateGroup(conv.id, { groupAvatar: url });
    } catch (err) { console.warn(err); }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await onCompressImage(file);
      updateConvSettings(conv.id, { backgroundUrl: url });
    } catch (err) { console.warn(err); }
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 px-2"
        style={{ height: 56, backgroundColor: T.overlay, borderBottom: `0.5px solid ${T.separator}` }}>
        <motion.button style={{ width: 36, height: 36 }} onClick={closeChatSettings} whileTap={{ scale: 0.85 }}>
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>群聊设置</span>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {/* ── 成员区 ── */}
        <section className="mb-4 rounded-2xl p-4" style={{ backgroundColor: T.card, boxShadow: T.shadow2 }}>
          <div className="mb-3 flex items-center justify-between">
            <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
              群成员（{memberIds.length}）
            </span>
            {deleteMode && (
              <button onClick={() => setDeleteMode(false)} style={{ fontSize: 13, color: T.accent }}>完成</button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {memberIds.map((id) => {
              const ch = characters.find((c) => c.id === id);
              return (
                <motion.button
                  key={id}
                  className="relative flex flex-col items-center"
                  onClick={() => deleteMode && handleRemove(id)}
                  whileTap={{ scale: 0.92 }}
                >
                  <Avatar src={ch?.avatar?.trim() || CHAR_FALLBACK_AVATAR} size={44} ringIndex={0} />
                  {deleteMode && (
                    <div className="absolute -top-1 -left-1 flex items-center justify-center rounded-full"
                      style={{ width: 18, height: 18, backgroundColor: '#FF3B30' }}>
                      <Minus size={12} strokeWidth={3} color="#fff" />
                    </div>
                  )}
                  <span className="mt-1 w-full truncate text-center" style={{ fontSize: 10, color: T.textSecondary }}>
                    {ch?.name ?? '未知'}
                  </span>
                </motion.button>
              );
            })}
            {!deleteMode && (
              <>
                <motion.button className="flex flex-col items-center" onClick={() => onOpenPicker('add')} whileTap={{ scale: 0.92 }}>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 44, height: 44, border: `1px dashed ${T.border}` }}>
                    <Plus size={18} color={T.textMuted} />
                  </div>
                  <span className="mt-1" style={{ fontSize: 10, color: T.textSecondary }}>添加</span>
                </motion.button>
                {memberIds.length > 2 && (
                  <motion.button className="flex flex-col items-center" onClick={() => setDeleteMode(true)} whileTap={{ scale: 0.92 }}>
                    <div className="flex items-center justify-center rounded-full"
                      style={{ width: 44, height: 44, border: `1px dashed ${T.border}` }}>
                      <Minus size={18} color={T.textMuted} />
                    </div>
                    <span className="mt-1" style={{ fontSize: 10, color: T.textSecondary }}>移除</span>
                  </motion.button>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── 群信息 rows ── */}
        <section className="mb-4 overflow-hidden rounded-2xl" style={{ backgroundColor: T.card, boxShadow: T.shadow2 }}>
          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => groupAvatarRef.current?.click()}>
            <span style={{ fontSize: 15, color: T.textPrimary }}>群头像</span>
            <div className="flex items-center gap-2">
              {conv.groupAvatar ? (
                <img src={conv.groupAvatar} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <ImageIcon size={18} color={T.textMuted} />
              )}
              <ChevronRight size={16} color={T.textMuted} />
            </div>
          </button>
          <input ref={groupAvatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleGroupAvatarUpload} />
          <div style={{ height: 0.5, backgroundColor: T.separator, marginLeft: 16 }} />

          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => setShowNameEditor(true)}>
            <span style={{ fontSize: 15, color: T.textPrimary }}>群聊名称</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, color: T.textMuted, maxWidth: 160 }} className="truncate">
                {conv.groupName ?? '未命名'}
              </span>
              <ChevronRight size={16} color={T.textMuted} />
            </div>
          </button>
          <div style={{ height: 0.5, backgroundColor: T.separator, marginLeft: 16 }} />

          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => setShowAnnouncementEditor(true)}>
            <span style={{ fontSize: 15, color: T.textPrimary }}>群公告</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, color: T.textMuted, maxWidth: 160 }} className="truncate">
                {conv.groupAnnouncement || '未设置'}
              </span>
              <ChevronRight size={16} color={T.textMuted} />
            </div>
          </button>
        </section>

        {/* ── 聊天 rows ── */}
        <section className="mb-4 overflow-hidden rounded-2xl" style={{ backgroundColor: T.card, boxShadow: T.shadow2 }}>
          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => openChatSearch()}>
            <div className="flex items-center gap-2.5">
              <Search size={18} color={T.textMuted} />
              <span style={{ fontSize: 15, color: T.textPrimary }}>查找聊天记录</span>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </button>
          <div style={{ height: 0.5, backgroundColor: T.separator, marginLeft: 16 }} />

          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => bgRef.current?.click()}>
            <div className="flex items-center gap-2.5">
              <ImageIcon size={18} color={T.textMuted} />
              <span style={{ fontSize: 15, color: T.textPrimary }}>设置当前聊天背景</span>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </button>
          <input ref={bgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
        </section>

        {/* ── 危险操作 ── */}
        <button
          className="flex w-full items-center justify-center rounded-2xl py-3"
          style={{ backgroundColor: T.card, color: '#FF3B30', fontSize: 15, fontWeight: 600, boxShadow: T.shadow2 }}
          onClick={() => {
            if (confirm('确认删除并退出这个群聊？')) {
              deleteConv(conv.id);
              closeChatSettings();
            }
          }}
        >
          删除并退出
        </button>
      </div>

      {/* 群名编辑浮层 */}
      <AnimatePresence>
        {showNameEditor && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNameEditor(false)}
          >
            <motion.div
              className="rounded-2xl p-5"
              style={{ width: 280, backgroundColor: T.card }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={springs.gentle}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: T.textPrimary }}>修改群名</div>
              <input
                className="w-full bg-transparent outline-none"
                style={{ fontSize: 14, color: T.textPrimary, padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}` }}
                value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                maxLength={30} autoFocus
              />
              <div className="mt-4 flex gap-2">
                <button onClick={() => setShowNameEditor(false)} className="flex-1 rounded-lg py-2"
                  style={{ backgroundColor: T.bg, fontSize: 14, color: T.textSecondary }}>取消</button>
                <button onClick={() => {
                  updateGroup(conv.id, { groupName: nameDraft.trim() || conv.groupName });
                  setShowNameEditor(false);
                }} className="flex-1 rounded-lg py-2"
                  style={{ background: T.accentGrad, color: '#fff', fontSize: 14, fontWeight: 600 }}>保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 群公告编辑浮层 */}
      <AnimatePresence>
        {showAnnouncementEditor && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col"
            style={{ backgroundColor: T.bg }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={springs.gentle}
          >
            <div className="flex shrink-0 items-center justify-between px-4" style={{ height: 52, borderBottom: `0.5px solid ${T.separator}` }}>
              <button onClick={() => setShowAnnouncementEditor(false)} style={{ fontSize: 14, color: T.textSecondary }}>取消</button>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>群公告</span>
              <button onClick={() => {
                updateGroup(conv.id, { groupAnnouncement: announcementDraft });
                setShowAnnouncementEditor(false);
              }} style={{ fontSize: 14, fontWeight: 600, color: T.accent }}>保存</button>
            </div>
            <textarea
              className="min-h-0 flex-1 resize-none bg-transparent p-4 outline-none"
              style={{ fontSize: 15, lineHeight: 1.5, color: T.textPrimary }}
              value={announcementDraft} onChange={(e) => setAnnouncementDraft(e.target.value)}
              placeholder="输入群公告..." autoFocus maxLength={500}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
