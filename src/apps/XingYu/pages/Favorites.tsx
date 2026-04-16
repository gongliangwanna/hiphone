import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, Trash2, Star } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import type { Favorite } from '../data';
import { T } from '../theme';

export function Favorites() {
  const close = useXYNav((s) => s.closeFavorites);
  const favorites = useXYData((s) => s.favorites);
  const removeFavorite = useXYData((s) => s.removeFavorite);

  const sorted = useMemo(
    () => [...favorites].sort((a, b) => b.favoritedAt - a.favoritedAt),
    [favorites],
  );

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
              <span style={{ fontSize: 16, color: T.accent, marginLeft: -4 }}>我的</span>
            </motion.button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <span style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
              我的收藏
            </span>
          </div>
          <div className="w-1/4" />
        </div>
      </div>

      <div
        className="scrollbar-hide min-h-0 flex-1 overflow-y-auto"
        style={{ paddingBottom: 'max(20px, var(--safe-bottom, 0px))' }}
      >
        {sorted.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-3"
            style={{ color: T.textMuted }}
          >
            <Star size={40} strokeWidth={1.5} color={T.textMuted} />
            <span style={{ fontSize: 14 }}>还没有收藏的内容</span>
            <span style={{ fontSize: 12, color: T.textMuted }}>
              在聊天里长按消息 → 收藏
            </span>
          </div>
        ) : (
          <div className="px-3 pt-3 flex flex-col gap-2.5">
            {sorted.map((fav) => (
              <FavoriteItem key={fav.id} fav={fav} onRemove={() => removeFavorite(fav.id)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FavoriteItem({ fav, onRemove }: { fav: Favorite; onRemove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      style={{
        background: T.card,
        borderRadius: 14,
        border: `0.5px solid ${T.border}`,
        boxShadow: T.shadow1,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2 min-w-0">
          <span
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}
          >
            {fav.senderName}
          </span>
          <span style={{ fontSize: 11, color: T.textMuted, flexShrink: 0 }}>
            {formatFavTime(fav.favoritedAt)}
          </span>
        </div>
        <motion.button
          type="button"
          onClick={onRemove}
          whileTap={{ scale: 0.85 }}
          className="flex items-center justify-center"
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'transparent',
            flexShrink: 0,
          }}
        >
          <Trash2 size={14} strokeWidth={2} color={T.rose} />
        </motion.button>
      </div>
      <FavoriteContent fav={fav} />
    </motion.div>
  );
}

function FavoriteContent({ fav }: { fav: Favorite }) {
  const { content } = fav;

  if (content.imageUrl) {
    return (
      <img
        src={content.imageUrl}
        alt=""
        style={{
          maxWidth: '100%',
          maxHeight: 220,
          borderRadius: 10,
          objectFit: 'cover',
          display: 'block',
        }}
      />
    );
  }

  if (content.stickerUrl) {
    return (
      <img
        src={content.stickerUrl}
        alt=""
        style={{ width: 96, height: 96, objectFit: 'contain', display: 'block' }}
      />
    );
  }

  if (content.noteRef) {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, #FFF9D2 0%, #FCEB82 100%)',
          borderRadius: 10,
          padding: '10px 12px',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: '#2C2C2E', marginBottom: 4 }}>
          {content.noteRef.title || '无标题备忘录'}
        </div>
        <div
          style={{
            fontSize: 12,
            color: '#666',
            lineHeight: 1.4,
            whiteSpace: 'pre-wrap',
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {content.noteRef.body || '无附加文本'}
        </div>
      </div>
    );
  }

  if (content.songRef) {
    return (
      <div
        className="flex items-center gap-3"
        style={{ background: T.bg, borderRadius: 10, padding: '8px 10px' }}
      >
        <img
          src={content.songRef.artworkUrl}
          alt=""
          style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }}
        />
        <div className="min-w-0 flex-1">
          <div
            className="truncate"
            style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary }}
          >
            {content.songRef.title}
          </div>
          <div
            className="truncate"
            style={{ fontSize: 12, color: T.textSecondary, marginTop: 2 }}
          >
            {content.songRef.artist}
          </div>
        </div>
      </div>
    );
  }

  if (content.forwardCard) {
    return (
      <div
        style={{
          background: T.bg,
          borderRadius: 10,
          padding: '10px 12px',
          border: `0.5px solid ${T.separator}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: T.textPrimary, marginBottom: 4 }}>
          {content.forwardCard.title}
        </div>
        {content.forwardCard.preview.slice(0, 4).map((line, i) => (
          <div
            key={i}
            className="truncate"
            style={{ fontSize: 11, color: T.textSecondary, lineHeight: 1.5 }}
          >
            {line}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        fontSize: 14,
        color: T.textPrimary,
        lineHeight: 1.5,
        wordBreak: 'break-word',
        whiteSpace: 'pre-wrap',
      }}
    >
      {content.text || '(无内容)'}
    </div>
  );
}

function formatFavTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const hh = d.getHours().toString().padStart(2, '0');
  const mm = d.getMinutes().toString().padStart(2, '0');
  if (sameDay) return `今天 ${hh}:${mm}`;
  const mo = d.getMonth() + 1;
  const dd = d.getDate();
  return `${mo}/${dd} ${hh}:${mm}`;
}
