import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, MapPin } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { formatChatTime, getIdol, DEFAULT_AVATAR, formatCoordinate, getLocationTitle } from '../data';
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
        <div className="px-3 pt-3">
          {view.messages.map((m, i) => {
            const prev = view.messages[i - 1];
            const sameSender = prev && prev.senderId === m.senderId;
            const isMine = m.senderId === 'me';
            return (
              <div
                key={i}
                className="mb-3 flex items-start gap-2"
                style={{ flexDirection: isMine ? 'row-reverse' : 'row' }}
              >
                <div className="shrink-0" style={{ width: 32 }}>
                  {!sameSender && (
                    <Avatar src={resolveAvatar(m)} size={32} ringIndex={0} />
                  )}
                </div>
                <div
                  className="min-w-0 flex flex-col"
                  style={{
                    maxWidth: 'calc(100% - 48px)',
                    alignItems: isMine ? 'flex-end' : 'flex-start',
                  }}
                >
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
                  <ForwardedBubble msg={m} isMine={isMine} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ForwardedBubble({ msg, isMine }: { msg: ForwardedMsg; isMine: boolean }) {
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
  if (msg.type === 'location' && msg.location) {
    return (
      <div
        className="flex items-center gap-3"
        style={{
          width: 220,
          background: T.card,
          border: `0.5px solid ${T.border}`,
          borderRadius: 14,
          padding: '10px 12px',
          boxShadow: T.shadow1,
        }}
      >
        <div
          className="flex shrink-0 items-center justify-center"
          style={{ width: 38, height: 38, borderRadius: 12, background: T.accentGrad }}
        >
          <MapPin size={20} strokeWidth={2.2} color="#fff" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate" style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
            {getLocationTitle(msg.location)}
          </div>
          <div className="truncate" style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}>
            {formatCoordinate(msg.location.latitude)}, {formatCoordinate(msg.location.longitude)}
          </div>
        </div>
      </div>
    );
  }
  if (!msg.text) return null;
  return (
    <div
      style={{
        display: 'inline-block',
        maxWidth: '100%',
        background: isMine ? T.accentGrad : T.card,
        color: isMine ? T.textOnAccent : T.textPrimary,
        borderRadius: 14,
        borderTopRightRadius: isMine ? 4 : 14,
        borderTopLeftRadius: isMine ? 14 : 4,
        padding: '8px 12px',
        fontSize: 14,
        lineHeight: 1.5,
        border: isMine ? 'none' : `0.5px solid ${T.border}`,
        boxShadow: T.shadow1,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}
    >
      {msg.text}
    </div>
  );
}
