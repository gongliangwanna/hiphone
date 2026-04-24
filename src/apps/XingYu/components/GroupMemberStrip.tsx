import { motion } from 'motion/react';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from './Avatar';
import { T } from '../theme';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

interface Props {
  memberIds: string[];
  /** null = unlocked; characterId = that member is generating */
  generatingId: string | null;
  onTapMember: (characterId: string) => void;
}

export function GroupMemberStrip({ memberIds, generatingId, onTapMember }: Props) {
  const characters = useCharacterStore((s) => s.characters);
  const locked = generatingId !== null;

  return (
    <div
      className="shrink-0"
      style={{
        padding: '8px 12px 6px',
        backgroundColor: T.overlay,
        borderTop: `0.5px solid ${T.separator}`,
        opacity: locked ? 0.55 : 1,
        pointerEvents: locked ? 'none' : 'auto',
      }}
    >
      <div
        className="scrollbar-hide flex gap-3 overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {memberIds.map((id) => {
          const ch = characters.find((c) => c.id === id);
          const isGenerating = generatingId === id;
          return (
            <motion.button
              key={id}
              className="flex shrink-0 flex-col items-center"
              style={{ width: 52 }}
              whileTap={locked ? undefined : { scale: 0.92 }}
              onClick={() => !locked && onTapMember(id)}
              disabled={locked}
            >
              <div className="relative">
                <Avatar src={ch?.avatar?.trim() || CHAR_FALLBACK_AVATAR} size={40} ringIndex={0} />
                {isGenerating && (
                  <motion.div
                    className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full"
                    style={{ width: 16, height: 16, backgroundColor: T.accent, color: '#fff', fontSize: 10 }}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                  >
                    …
                  </motion.div>
                )}
              </div>
              <span
                className="mt-1 w-full truncate text-center"
                style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.1 }}
              >
                {ch?.name ?? '未知'}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
