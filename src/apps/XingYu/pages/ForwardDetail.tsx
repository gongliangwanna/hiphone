import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { formatChatTime, getIdol, DEFAULT_AVATAR } from '../data';
import type { ForwardedMsg } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from '../components/Avatar';
import { T } from '../theme';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

export function ForwardDetail() {
  const view = useXYNav((s) => s.forwardCardView);
  const close = useXYNav((s) => s.closeForwardDetail);
  const characters = useCharacterStore((s) => s.characters);
  const userSettings = useXYData((s) => s.userSettings);

  const resolveAvatar = useMemo(() => {
    return (m: ForwardedMsg): string => {
      if (m.senderId === 'me') return userSettings.avatarUrl || DEFAULT_AVATAR;
      const charId = m.senderId.replace(/^char-/, '');
      const ch = characters.find((c) => c.id === charId);
      if (ch?.avatar?.trim()) return ch.avatar;
      const idol = getIdol(m.senderId);
      if (idol?.avatar) return idol.avatar;
      return CHAR_FALLBACK_AVATAR;
    };
  }, [characters, userSettings.avatarUrl]);

  if (!view) return null;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* ── Header ── */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: 'rgba(248,246,249,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <div className="flex items-center justify-between px-2" style={{ height: 44 }}>
          <div className="flex w-1/4 items-center justify-start">
            <motion.button
              className="flex items-center justify-center gap-1"
              onClick={close}
              whileTap={{ opacity: 0.5 }}
              transition={{ duration: 0 }}
            >
              <ChevronLeft size={24} strokeWidth={2} color={T.accent} />
              <span style={{ fontSize: 16, color: T.accent, marginLeft: -4 }}>返回</span>
            </motion.button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <span style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
              聊天记录
            </span>
          </div>
          <div className="w-1/4" />
        </div>
      </div>

      {/* ── Body ── */}
      <div
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto"
        style={{ paddingBottom: 'max(20px, var(--safe-bottom, 0px))' }}
      >
        {/* Title card */}
        <div
          className="mx-4 mt-4 mb-2"
          style={{
            background: T.card,
            borderRadius: 14,
            padding: '14px 16px',
            border: `0.5px solid ${T.border}`,
            boxShadow: T.shadow1,
          }}
        >
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4 }}>
            转发的聊天记录
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
            {view.title}
          </div>
          <div style={{ fontSize: 12, color: T.textSecondary, marginTop: 6 }}>
            共 {view.messages.length} 条消息
          </div>
        </div>

        {/* Messages */}
        <div className="px-4 pt-2">
          {view.messages.map((m, i) => {
            const prev = view.messages[i - 1];
            const sameSender = prev && prev.senderId === m.senderId;
            return (
              <div key={i} className="mb-3 flex items-start gap-2">
                <div className="shrink-0" style={{ width: 32 }}>
                  {!sameSender && (
                    <Avatar src={resolveAvatar(m)} size={32} ringIndex={0} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {!sameSender && (
                    <div
                      className="mb-1 flex items-baseline gap-2"
                      style={{ fontSize: 12 }}
                    >
                      <span style={{ color: T.textPrimary, fontWeight: 600 }}>
                        {m.senderName}
                      </span>
                      <span style={{ color: T.textMuted, fontSize: 11 }}>
                        {formatChatTime(m.timestamp)}
                      </span>
                    </div>
                  )}
                  <ForwardedBubble msg={m} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ForwardedBubble({ msg }: { msg: ForwardedMsg }) {
  if (msg.type === 'image' && msg.imageUrl) {
    return (
      <img
        src={msg.imageUrl}
        alt=""
        style={{
          maxWidth: '70%',
          borderRadius: 12,
          display: 'block',
          boxShadow: T.shadow1,
        }}
      />
    );
  }
  if (msg.type === 'sticker' && msg.stickerUrl) {
    return (
      <img
        src={msg.stickerUrl}
        alt=""
        style={{ width: 96, height: 96, objectFit: 'contain', display: 'block' }}
      />
    );
  }
  if (!msg.text) return null;
  return (
    <div
      style={{
        display: 'inline-block',
        maxWidth: '85%',
        background: T.card,
        borderRadius: 14,
        borderTopLeftRadius: 4,
        padding: '8px 12px',
        fontSize: 14,
        lineHeight: 1.5,
        color: T.textPrimary,
        border: `0.5px solid ${T.border}`,
        boxShadow: T.shadow1,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}
    >
      {msg.text}
    </div>
  );
}
