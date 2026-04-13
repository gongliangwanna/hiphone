import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle } from 'lucide-react';
import { getIdol, formatTime, ME, DEFAULT_AVATAR } from '../data';
import type { Moment } from '../data';
import { useXYData } from '../xingYuDataStore';
import { useXYNav } from '../xingYuNavStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from './Avatar';
import { CommentInput } from './CommentInput';
import { T, springs } from '../theme';

interface MomentCardProps {
  moment: Moment;
  /** Hide avatar navigation when already on an idol profile */
  disableAvatarNav?: boolean;
  onImageClick?: (imageUrl: string) => void;
}

export function MomentCard({ moment, disableAvatarNav, onImageClick }: MomentCardProps) {
  const toggleLike = useXYData((s) => s.toggleLike);
  const addComment = useXYData((s) => s.addComment);
  const openIdol = useXYNav((s) => s.openIdol);

  const [imgLoaded, setImgLoaded] = useState(false);
  const [showCommentInput, setShowCommentInput] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const userSettings = useXYData((s) => s.userSettings);

  const characters = useCharacterStore((s) => s.characters);

  const isMe = moment.idolId === 'me';
  const author = isMe
    ? { name: userSettings.nickname || ME.name, avatar: userSettings.avatarUrl || DEFAULT_AVATAR, ringIndex: 0 }
    : (() => {
        // char-xxx → characterStore lookup (heartbeat-posted moments)
        if (moment.idolId.startsWith('char-')) {
          const charId = moment.idolId.slice(5);
          const char = characters.find((c) => c.id === charId);
          return char
            ? { name: char.name, avatar: char.avatar?.trim() || DEFAULT_AVATAR, ringIndex: 0 }
            : { name: '???', avatar: '', ringIndex: 0 };
        }
        // Legacy idol lookup
        const idol = getIdol(moment.idolId);
        return idol
          ? { name: idol.name, avatar: idol.avatar, ringIndex: idol.ringIndex }
          : { name: '???', avatar: '', ringIndex: 0 };
      })();

  const handleAvatarTap = () => {
    if (disableAvatarNav || isMe) return;
    // char-xxx moments: navigate to the character's profile using the characterId
    if (moment.idolId.startsWith('char-')) {
      openIdol(moment.idolId.slice(5));
    } else {
      openIdol(moment.idolId);
    }
  };

  const visibleComments = showAllComments ? moment.comments : moment.comments.slice(0, 3);

  return (
    <div
      className="mb-4 overflow-hidden"
      style={{
        borderRadius: T.r.lg,
        backgroundColor: T.card,
        boxShadow: T.shadow2,
      }}
    >
      {/* Author */}
      <div className="flex items-center gap-2.5 px-4 pt-3.5 pb-2">
        <motion.button
          onClick={handleAvatarTap}
          whileTap={disableAvatarNav || isMe ? undefined : { scale: 0.9 }}
          disabled={disableAvatarNav || isMe}
        >
          <Avatar src={author.avatar} size={34} ringIndex={author.ringIndex} />
        </motion.button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>{author.name}</span>
          <span style={{ fontSize: 11, color: T.textMuted }}>{formatTime(moment.timestamp)}</span>
        </div>
      </div>

      {/* Text */}
      <div className="px-4 pb-2.5">
        <p style={{ fontSize: 14, lineHeight: 1.65, color: T.textPrimary, whiteSpace: 'pre-line' }}>
          {moment.text}
        </p>
      </div>

      {/* Image */}
      {moment.imageUrl && (
        <div className="px-4 pb-3">
          <motion.button 
            className="block w-full"
            style={{ borderRadius: T.r.md, overflow: 'hidden', backgroundColor: `${T.accent}08` }}
            onClick={() => onImageClick?.(moment.imageUrl!)}
            whileTap={{ opacity: 0.8 }}
          >
            <img
              src={moment.imageUrl}
              alt=""
              className="block w-full"
              style={{
                opacity: imgLoaded ? 1 : 0,
                transition: 'opacity 0.3s',
                maxHeight: 240,
                objectFit: 'cover',
              }}
              loading="lazy"
              onLoad={() => setImgLoaded(true)}
            />
          </motion.button>
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-5 px-4 pb-3"
        style={{ borderTop: `0.5px solid ${T.separator}`, paddingTop: 10 }}
      >
        <motion.button
          className="flex items-center gap-1.5"
          onClick={() => toggleLike(moment.id)}
          whileTap={{ scale: 0.88 }}
          transition={springs.press}
        >
          <Heart
            size={17}
            strokeWidth={moment.liked ? 0 : 1.6}
            fill={moment.liked ? T.rose : 'none'}
            color={moment.liked ? T.rose : T.textMuted}
          />
          <span style={{ fontSize: 13, color: moment.liked ? T.rose : T.textMuted, fontWeight: 500 }}>
            {moment.likes}
          </span>
        </motion.button>
        <motion.button
          className="flex items-center gap-1.5"
          onClick={() => setShowCommentInput((p) => !p)}
          whileTap={{ scale: 0.88 }}
          transition={springs.press}
        >
          <MessageCircle
            size={17}
            strokeWidth={1.6}
            color={showCommentInput ? T.accent : T.textMuted}
          />
          <span style={{ fontSize: 13, color: showCommentInput ? T.accent : T.textMuted }}>
            {moment.comments.length}
          </span>
        </motion.button>
      </div>

      {/* Comments */}
      {moment.comments.length > 0 && (
        <div
          className="px-4 pb-3"
          style={{
            backgroundColor: `${T.accent}04`,
            borderTop: `0.5px solid ${T.separator}`,
            paddingTop: 10,
          }}
        >
          {visibleComments.map((c, i) => {
            const isCommentFromMe = c.userId === 'me';
            const commenter = isCommentFromMe
              ? { name: userSettings.nickname }
              : c.userId.startsWith('char-')
                ? characters.find((ch) => ch.id === c.userId.slice(5))
                : getIdol(c.userId);
            return (
              <p key={i} style={{ fontSize: 12, color: T.textSecondary, marginBottom: 3, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600, color: T.accent }}>{commenter?.name ?? '???'}</span>
                {'  '}{c.text}
              </p>
            );
          })}
          {!showAllComments && moment.comments.length > 3 && (
            <motion.button
              onClick={() => setShowAllComments(true)}
              whileTap={{ scale: 0.95 }}
              style={{ fontSize: 12, color: T.accent, fontWeight: 500, marginTop: 4 }}
            >
              查看全部 {moment.comments.length} 条评论
            </motion.button>
          )}
        </div>
      )}

      {/* Comment Input */}
      <AnimatePresence>
        {showCommentInput && (
          <CommentInput
            onSubmit={(text) => {
              addComment(moment.id, text);
              setShowCommentInput(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
