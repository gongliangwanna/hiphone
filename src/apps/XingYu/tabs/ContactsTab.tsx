import { motion } from 'motion/react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useCharacterStore, type CharacterCard } from '@/platform/stores/characterStore';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { Avatar } from '../components/Avatar';
import { T, springs } from '../theme';

/** 角色 avatar 为空时的兜底图,来自 public/resource/avatars/ */
const FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

export function ContactsTab() {
  const openChat = useXYNav((s) => s.openChat);
  const characters = useCharacterStore((s) => s.characters);
  const ensureCharacterConversation = useXYData((s) => s.ensureCharacterConversation);

  const handleOpen = (id: string) => {
    const convId = ensureCharacterConversation(id);
    openChat(convId);
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <Section
          icon={<Sparkles size={13} strokeWidth={2} color={T.accent} />}
          title="我的角色"
        />
        {characters.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16"
            style={{ backgroundColor: T.card, borderRadius: 12 }}
          >
            <span style={{ fontSize: 40, marginBottom: 12 }}>✨</span>
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
              还没有角色,去设置里创建吧
            </span>
          </div>
        ) : (
          <div
            style={{ backgroundColor: T.card, borderRadius: 12, overflow: 'hidden' }}
          >
            {characters.map((character, i) => (
              <motion.div
                key={character.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, ...springs.gentle }}
              >
                <CharacterRow
                  character={character}
                  onTap={() => handleOpen(character.id)}
                  isLast={i === characters.length - 1}
                />
              </motion.div>
            ))}
          </div>
        )}
        <div style={{ height: 16 }} />
      </div>
    </div>
  );
}

function Section({ title }: { icon?: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 mt-4 flex items-center gap-1.5 px-2">
      <span
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: T.textMuted,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </span>
    </div>
  );
}

function CharacterRow({
  character,
  onTap,
  isLast,
}: {
  character: CharacterCard;
  onTap: () => void;
  isLast?: boolean;
}) {
  const avatar = character.avatar?.trim() || FALLBACK_AVATAR;
  const subtitle = character.description?.slice(0, 40) || character.personality || '';

  return (
    <motion.button
      className="flex w-full items-center gap-3 relative"
      style={{
        padding: '10px 16px',
        backgroundColor: 'transparent',
      }}
      onClick={onTap}
      whileTap={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
      transition={{ duration: 0 }}
    >
      <Avatar src={avatar} size={44} ringIndex={0} />

      <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col items-start gap-0.5">
          <span
            style={{ fontSize: 16, fontWeight: 500, color: T.textPrimary }}
          >
            {character.name}
          </span>
          {subtitle && (
            <span
              className="truncate"
              style={{
                fontSize: 13,
                color: T.textSecondary,
                maxWidth: '100%',
                textAlign: 'left',
              }}
            >
              {subtitle}
            </span>
          )}
        </div>
        <ChevronRight size={16} color={T.textMuted} strokeWidth={1.5} />
      </div>

      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{ height: 0.5, backgroundColor: T.separator, left: 68 }}
        />
      )}
    </motion.button>
  );
}
