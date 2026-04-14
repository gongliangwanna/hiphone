import { useMemo } from 'react';
import { motion } from 'motion/react';
import { ChevronRight } from 'lucide-react';
import { useCharacterStore, type CharacterCard } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { Avatar } from '../components/Avatar';
import { T, springs } from '../theme';

/** 角色 avatar 为空时的兜底图,来自 public/resource/avatars/ */
const FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

export function ContactsTab() {
  const openChat = useXYNav((s) => s.openChat);
  const openIdol = useXYNav((s) => s.openIdol);
  const characters = useCharacterStore((s) => s.characters);
  const persona = usePersonaStore((s) => s.getActivePersona());
  const { phoneOwnerId, isViewingOther } = usePerspective();
  const ensureCharacterConversation = useXYData((s) => s.ensureCharacterConversation);

  // 查手机模式: 联系人 = 玩家 + 其他 AI（排除手机主人自己）
  const contactList = useMemo(() => {
    if (!phoneOwnerId) return characters;
    return characters.filter((c) => c.id !== phoneOwnerId);
  }, [characters, phoneOwnerId]);

  const handleOpenCharacter = (id: string) => {
    const convId = ensureCharacterConversation(id);
    openChat(convId);
  };

  const handleOpenCharacterProfile = (id: string) => {
    openIdol(id);
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-2">
        {contactList.length === 0 && !isViewingOther ? (
          <div
            className="flex flex-col items-center justify-center py-10"
            style={{ backgroundColor: T.card, borderRadius: 12 }}
          >
            <span style={{ fontSize: 32, marginBottom: 10 }}>✨</span>
            <span style={{ fontSize: 13, color: T.textMuted, fontWeight: 500 }}>
              还没有角色,去设置里创建吧
            </span>
          </div>
        ) : (
          <div
            style={{ backgroundColor: T.card, borderRadius: 12, overflow: 'hidden' }}
          >
            {/* 查手机模式: 玩家作为第一个联系人 */}
            {isViewingOther && persona && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0, ...springs.gentle }}
              >
                <CharacterRow
                  character={{
                    id: 'player',
                    name: persona.name || '用户',
                    avatar: persona.avatar || FALLBACK_AVATAR,
                    description: persona.description || '',
                    personality: '',
                    scenario: '',
                    firstMessage: '',
                    messageExamples: '',
                    alternateGreetings: [],
                    systemPrompt: '',
                    postHistoryInstructions: '',
                    creatorNotes: '',
                    tags: [],
                    version: '1.0',
                  }}
                  onTap={() => {
                    // 查手机模式下打开与玩家的对话
                    if (phoneOwnerId) {
                      const convId = ensureCharacterConversation(phoneOwnerId);
                      openChat(convId);
                    }
                  }}
                  onAvatarTap={() => {}}
                  isLast={contactList.length === 0}
                />
              </motion.div>
            )}
            {contactList.map((character, i) => (
              <motion.div
                key={character.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: (isViewingOther ? i + 1 : i) * 0.04, ...springs.gentle }}
              >
                <CharacterRow
                  character={character}
                  onTap={isViewingOther ? () => {} : () => handleOpenCharacter(character.id)}
                  onAvatarTap={isViewingOther ? () => {} : () => handleOpenCharacterProfile(character.id)}
                  isLast={i === contactList.length - 1}
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

function CharacterRow({
  character,
  onTap,
  onAvatarTap,
  isLast,
}: {
  character: CharacterCard;
  onTap: () => void;
  onAvatarTap: () => void;
  isLast?: boolean;
}) {
  const avatar = character.avatar?.trim() || FALLBACK_AVATAR;
  const subtitle = character.description?.slice(0, 40) || character.personality || '';

  return (
    <motion.div
      className="flex w-full items-center gap-3 relative"
      style={{
        padding: '10px 16px',
        backgroundColor: 'transparent',
      }}
    >
      <motion.button
        onClick={(e) => {
          e.stopPropagation();
          onAvatarTap();
        }}
        whileTap={{ scale: 0.9 }}
        transition={springs.press}
      >
        <Avatar src={avatar} size={44} ringIndex={0} />
      </motion.button>

      <motion.button
        className="flex min-w-0 flex-1 items-center justify-between gap-3"
        onClick={onTap}
        whileTap={{ backgroundColor: 'rgba(0,0,0,0.04)' }}
        transition={{ duration: 0 }}
      >
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
      </motion.button>

      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{ height: 0.5, backgroundColor: T.separator, left: 68 }}
        />
      )}
    </motion.div>
  );
}
