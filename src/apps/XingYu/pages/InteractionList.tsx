import { useEffect } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Heart, MessageCircle } from 'lucide-react';
import { useXYData } from '../xingYuDataStore';
import { useXYNav } from '../xingYuNavStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { getIdol, formatTime, DEFAULT_AVATAR } from '../data';
import { Avatar } from '../components/Avatar';
import { T, springs } from '../theme';

export function InteractionList() {
  const interactions = useXYData((s) => s.interactions);
  const markInteractionsRead = useXYData((s) => s.markInteractionsRead);
  const userSettings = useXYData((s) => s.userSettings);
  const closeInteractions = useXYNav((s) => s.closeInteractions);
  const characters = useCharacterStore((s) => s.characters);

  useEffect(() => {
    markInteractionsRead();
  }, [markInteractionsRead]);

  const nameOf = (userId: string) => {
    if (userId === 'me') return userSettings.nickname || '用户';
    if (userId.startsWith('char-')) {
      const char = characters.find((c) => c.id === userId.slice(5));
      return char?.name ?? '???';
    }
    const idol = getIdol(userId);
    return idol?.name ?? '???';
  };

  const avatarOf = (userId: string) => {
    if (userId === 'me') return userSettings.avatarUrl || DEFAULT_AVATAR;
    if (userId.startsWith('char-')) {
      const char = characters.find((c) => c.id === userId.slice(5));
      return char?.avatar?.trim() || DEFAULT_AVATAR;
    }
    const idol = getIdol(userId);
    return idol?.avatar || DEFAULT_AVATAR;
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Nav bar */}
      <div
        className="flex items-center gap-2 px-4 pb-2 pt-2"
        style={{
          backgroundColor: T.surface,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <motion.button
          className="flex items-center gap-0.5"
          onClick={closeInteractions}
          whileTap={{ scale: 0.92 }}
          transition={springs.press}
        >
          <ChevronLeft size={22} color={T.accent} />
          <span style={{ fontSize: 17, color: T.accent }}>返回</span>
        </motion.button>
        <span
          className="flex-1 text-center"
          style={{ fontSize: 17, fontWeight: 600, color: T.textPrimary, marginRight: 60 }}
        >
          互动消息
        </span>
      </div>

      {/* Interaction list */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {interactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Heart size={40} color={T.textMuted} strokeWidth={1.2} />
            <span className="mt-3" style={{ fontSize: 14, color: T.textMuted }}>
              暂无互动消息
            </span>
          </div>
        ) : (
          interactions.map((item, i) => (
            <motion.div
              key={item.id}
              className="flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: `0.5px solid ${T.separator}`, backgroundColor: T.card }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03, ...springs.gentle }}
            >
              <Avatar src={avatarOf(item.userId)} size={40} ringIndex={-1} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.textPrimary }}>
                    {nameOf(item.userId)}
                  </span>
                  {item.type === 'like' ? (
                    <Heart size={13} fill={T.rose} color={T.rose} strokeWidth={0} />
                  ) : (
                    <MessageCircle size={13} color={T.accent} strokeWidth={1.6} />
                  )}
                </div>
                <p style={{ fontSize: 14, color: T.textSecondary, marginTop: 2 }}>
                  {item.type === 'like'
                    ? '赞了你的动态'
                    : `评论了你的动态：${item.commentText ?? ''}`}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className="truncate"
                    style={{
                      fontSize: 12,
                      color: T.textMuted,
                      maxWidth: '60%',
                    }}
                  >
                    「{item.momentTextSnippet}」
                  </span>
                  <span style={{ fontSize: 12, color: T.textMuted }}>
                    {formatTime(item.timestamp)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
