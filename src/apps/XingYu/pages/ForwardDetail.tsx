import { motion } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { formatChatTime } from '../data';
import { T } from '../theme';

export function ForwardDetail() {
  const messages = useXYNav((s) => s.forwardCardMessages);
  const close = useXYNav((s) => s.closeForwardDetail);

  if (!messages) return null;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
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

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.map((m, i) => (
          <div key={i} className="mb-3 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}>
                {m.senderName}
              </span>
              <span style={{ fontSize: 11, color: T.textMuted }}>
                {formatChatTime(m.timestamp)}
              </span>
            </div>
            <div
              style={{
                marginLeft: 0,
                background: T.card,
                borderRadius: 12,
                padding: '8px 12px',
                fontSize: 14,
                color: T.textPrimary,
                lineHeight: 1.5,
                wordBreak: 'break-word',
                border: `0.5px solid ${T.border}`,
              }}
            >
              {m.type === 'image' && m.imageUrl && (
                <img
                  src={m.imageUrl}
                  alt=""
                  style={{ maxWidth: '100%', borderRadius: 8, display: 'block' }}
                />
              )}
              {m.type === 'sticker' && m.stickerUrl && (
                <img
                  src={m.stickerUrl}
                  alt=""
                  style={{ width: 80, height: 80, objectFit: 'contain', display: 'block' }}
                />
              )}
              {m.type === 'text' && (m.text || '')}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
