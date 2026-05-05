import React from 'react';
import { motion, spring } from '@hiphone/motion';
import { Wine } from 'lucide-react';
import { Character, accentFor } from '../constants/character';

interface Props {
  characters: Character[];
  onPick: (character: Character) => void;
}

export function BuddyPicker({ characters, onPick }: Props) {
  return (
    <div className="min-h-full px-5 pb-10 pt-6">
      <div className="mb-6">
        <div className="text-3xl">🍸</div>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--color-label)]">微醺酒馆</h1>
        <p className="mt-1 text-sm text-[var(--color-secondaryLabel)]">
          挑一个今晚陪你喝酒的角色，越喝聊得越嗨。
        </p>
        <p className="mt-1 text-xs text-[var(--color-secondaryLabel)]">
          今晚的对话不会写进 ta 的记忆，醒来谁也不记得。
        </p>
      </div>

      {characters.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-separator)] bg-[var(--color-secondarySystemBackground)] px-4 py-8 text-center">
          <Wine size={28} className="mx-auto text-[var(--color-secondaryLabel)]" />
          <div className="mt-2 text-sm font-medium text-[var(--color-label)]">
            酒馆今晚没人
          </div>
          <div className="mt-1 text-xs text-[var(--color-secondaryLabel)]">
            还没有可对话的角色，先去添加几个角色再回来吧。
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {characters.map((c, i) => {
            const accent = accentFor(c.id);
            return (
              <motion.button
                key={c.id}
                onClick={() => onPick(c)}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring.smooth, delay: i * 0.04 }}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-4 rounded-2xl border border-[var(--color-separator)] bg-[var(--color-secondarySystemBackground)] px-4 py-4 text-left"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-semibold text-white"
                  style={{ background: accent }}
                >
                  {c.avatar ? (
                    <img
                      src={c.avatar}
                      alt={c.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    c.name.slice(0, 1)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-[var(--color-label)]">
                    {c.name}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-sm text-[var(--color-secondaryLabel)]">
                    {c.description?.trim() || '今晚陪你喝两杯。'}
                  </div>
                </div>
                <div className="text-sm text-[var(--color-systemBlue)]">入座 →</div>
              </motion.button>
            );
          })}
        </div>
      )}

      <p className="mt-8 text-center text-xs text-[var(--color-secondaryLabel)]">
        理性饮酒 · 这里只是赛博酒馆，喝多了不上头也不头疼
      </p>
    </div>
  );
}
