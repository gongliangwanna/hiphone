import { motion } from 'motion/react';
import type { CharacterCard } from '@/platform/stores/characterStore';

interface CharacterPickerProps {
  characters: CharacterCard[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function CharacterPicker({
  characters,
  selectedId,
  onSelect,
}: CharacterPickerProps) {
  return (
    <section className="px-4" aria-labelledby="presence-character-title">
      <h2
        id="presence-character-title"
        className="mb-3 text-[13px] font-semibold tracking-[0.01em]"
        style={{ color: 'var(--color-label)' }}
      >
        选择角色
      </h2>
      {characters.length === 0 ? (
        <div
          className="rounded-[18px] px-4 py-5 text-center text-[14px]"
          style={{
            backgroundColor: 'rgba(255,255,255,0.72)',
            border: '0.5px solid rgba(60,60,67,0.14)',
            color: 'var(--color-secondaryLabel)',
            boxShadow: '0 14px 40px rgba(20,22,28,0.08)',
          }}
          data-testid="presence-empty-characters"
        >
          还没有角色
        </div>
      ) : (
        <div
          className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 pt-3"
          data-testid="presence-character-picker"
          style={{ scrollbarWidth: 'none' }}
        >
          {characters.map((character) => {
            const active = character.id === selectedId;
            return (
              <motion.button
                key={character.id}
                type="button"
                onClick={() => onSelect(character.id)}
                className="relative flex w-[82px] shrink-0 flex-col items-center gap-2 rounded-[20px] px-2 py-3 text-center"
                style={{
                  backgroundColor: active
                    ? 'rgba(255,255,255,0.88)'
                    : 'rgba(255,255,255,0.54)',
                  border: active
                    ? '1px solid rgba(0,122,255,0.38)'
                    : '0.5px solid rgba(60,60,67,0.14)',
                  color: 'var(--color-label)',
                  boxShadow: active
                    ? '0 16px 34px rgba(0,122,255,0.18)'
                    : '0 10px 24px rgba(20,22,28,0.08)',
                }}
                animate={{ y: active ? -2 : 0, scale: active ? 1.03 : 1 }}
                whileTap={{ scale: 0.96 }}
                transition={{ type: 'spring', stiffness: 420, damping: 30 }}
                data-testid="presence-character-option"
                aria-pressed={active}
              >
                <span
                  className="absolute inset-0 rounded-[20px] opacity-70"
                  style={{
                    background: active
                      ? 'linear-gradient(180deg, rgba(0,122,255,0.14), rgba(255,255,255,0))'
                      : 'linear-gradient(180deg, rgba(255,255,255,0.52), rgba(255,255,255,0))',
                  }}
                />
                <img
                  src={character.avatar || '/resource/avatars/preset-01.jpg'}
                  alt=""
                  className="relative h-12 w-12 rounded-full object-cover"
                  style={{
                    boxShadow: active
                      ? '0 0 0 3px rgba(0,122,255,0.18), 0 8px 18px rgba(0,0,0,0.16)'
                      : '0 7px 16px rgba(0,0,0,0.12)',
                  }}
                />
                <span className="relative w-full truncate text-[13px] font-semibold">
                  {character.name || '未命名'}
                </span>
              </motion.button>
            );
          })}
        </div>
      )}
    </section>
  );
}
