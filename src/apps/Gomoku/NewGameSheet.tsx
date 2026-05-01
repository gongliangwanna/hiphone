import { AnimatePresence, motion } from 'motion/react';
import { Check, Circle, X } from 'lucide-react';
import type { CharacterCard } from '@/platform/stores/characterStore';
import type { PlayerStone } from './gomokuStore';

const FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

export function NewGameSheet({
  open,
  characters,
  selectedCharacterId,
  selectedUserStone,
  onSelectCharacter,
  onSelectUserStone,
  onStart,
  onClose,
}: {
  open: boolean;
  characters: CharacterCard[];
  selectedCharacterId: string;
  selectedUserStone: PlayerStone;
  onSelectCharacter: (id: string) => void;
  onSelectUserStone: (stone: PlayerStone) => void;
  onStart: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <div
          className="absolute inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="gomoku-new-game-title"
          data-testid="gomoku-new-game-sheet"
        >
          <motion.button
            type="button"
            aria-label="关闭新局"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 border-none bg-black/35"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 330, damping: 30 }}
            className="absolute bottom-0 left-0 right-0 max-h-[78%] overflow-hidden rounded-t-[24px] bg-[#F2F2F7] pb-safe shadow-[0_-16px_40px_rgba(0,0,0,0.22)]"
          >
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-black/18" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3">
              <div>
                <div
                  id="gomoku-new-game-title"
                  className="text-[20px] font-bold text-[#1C1C1E]"
                >
                  新局
                </div>
                <div className="mt-0.5 text-[13px] text-[#8E8E93]">
                  选择角色和先手
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="关闭"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/6 text-[#3A3A3C]"
              >
                <X size={18} strokeWidth={2.2} />
              </button>
            </div>

            <div className="min-h-0 overflow-y-auto px-4 pb-4">
              <div className="mb-4 overflow-hidden rounded-[16px] bg-white">
                {characters.map((character, index) => {
                  const active = character.id === selectedCharacterId;
                  return (
                    <button
                      key={character.id}
                      type="button"
                      onClick={() => onSelectCharacter(character.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left active:bg-black/5"
                      data-testid={`gomoku-character-option-${character.id}`}
                    >
                      <img
                        src={character.avatar?.trim() || FALLBACK_AVATAR}
                        alt=""
                        className="h-11 w-11 rounded-full object-cover"
                      />
                      <div
                        className={`min-w-0 flex-1 ${index === characters.length - 1 ? '' : 'border-b border-black/6 pb-3'}`}
                      >
                        <div className="truncate text-[16px] font-semibold text-[#1C1C1E]">
                          {character.name || '未命名角色'}
                        </div>
                        <div className="mt-0.5 truncate text-[12px] text-[#8E8E93]">
                          {character.description || character.personality || 'AI 角色'}
                        </div>
                      </div>
                      {active && (
                        <Check
                          size={20}
                          strokeWidth={2.4}
                          className="shrink-0 text-[#007AFF]"
                        />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mb-5 rounded-[16px] bg-white p-2">
                <StoneOption
                  label="我执黑"
                  detail="你先手"
                  stone="black"
                  active={selectedUserStone === 'black'}
                  onClick={() => onSelectUserStone('black')}
                />
                <StoneOption
                  label="我执白"
                  detail="角色先手"
                  stone="white"
                  active={selectedUserStone === 'white'}
                  onClick={() => onSelectUserStone('white')}
                />
              </div>

              <button
                type="button"
                onClick={onStart}
                disabled={!selectedCharacterId}
                className="flex h-12 w-full items-center justify-center rounded-[14px] bg-[#007AFF] text-[17px] font-semibold text-white active:scale-[0.99] disabled:opacity-40"
                data-testid="gomoku-start-new-game"
              >
                开始
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function StoneOption({
  label,
  detail,
  stone,
  active,
  onClick,
}: {
  label: string;
  detail: string;
  stone: PlayerStone;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-12 w-full items-center gap-3 rounded-[12px] px-3 text-left ${active ? 'bg-[#EAF3FF]' : 'bg-transparent'}`}
      data-testid={`gomoku-user-stone-${stone}`}
    >
      <Circle
        size={18}
        fill={stone === 'black' ? '#111' : '#fff'}
        color={stone === 'black' ? '#111' : '#D1D1D6'}
      />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold text-[#1C1C1E]">{label}</div>
        <div className="text-[12px] text-[#8E8E93]">{detail}</div>
      </div>
      {active && <Check size={18} strokeWidth={2.4} className="text-[#007AFF]" />}
    </button>
  );
}
