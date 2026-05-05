import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, spring } from '@hiphone/motion';
import { Character, accentFor } from '../constants/character';
import { ChatMessage } from '../hooks/useBarSession';
import { DRINKS } from '../constants/drinks';

interface Props {
  character: Character;
  messages: ChatMessage[];
  pending: boolean;
}

function drinkLabel(id?: string) {
  const d = DRINKS.find((x) => x.id === id);
  return d ? d.emoji + ' ' + d.name : '';
}

export function ChatMessages({ character, messages, pending }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const accent = accentFor(character.id);

  useEffect(() => {
    try {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {
      // ignore - sandboxed env may not support
    }
  }, [messages.length, pending]);

  if (messages.length === 0 && !pending) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center text-sm text-[var(--color-secondaryLabel)]">
        <div className="text-3xl">🥂</div>
        <div className="mt-2 font-medium text-[var(--color-label)]">{character.name} 已入座</div>
        {character.description?.trim() && (
          <div className="mt-1 line-clamp-3">{character.description}</div>
        )}
        <div className="mt-4 max-w-[260px]">
          先点一杯酒打开话匣子，或者直接和 {character.name} 说点什么。
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {messages.map((m) => {
          if (m.role === 'system') {
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.smooth}
                className="self-center rounded-full bg-[var(--color-tertiarySystemBackground)] px-3 py-1 text-xs text-[var(--color-secondaryLabel)]"
              >
                {m.text}
                {m.drunkAt !== undefined && (
                  <span className="ml-1 opacity-60">· 醉度 {Math.round(m.drunkAt)}</span>
                )}
              </motion.div>
            );
          }

          const isUser = m.role === 'user';
          return (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.smooth}
              className={'flex ' + (isUser ? 'justify-end' : 'justify-start')}
            >
              <div
                className={
                  'max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed shadow-sm ' +
                  (isUser
                    ? 'bg-[var(--color-systemBlue)] text-white'
                    : 'bg-[var(--color-secondarySystemBackground)] text-[var(--color-label)]')
                }
                style={!isUser ? { borderLeft: '3px solid ' + accent + 'AA' } : undefined}
              >
                {!isUser && (
                  <div className="mb-0.5 text-xs font-medium" style={{ color: accent }}>
                    {character.name}
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>
                {m.drinkId && (
                  <div className="mt-1 text-[11px] opacity-70">{drinkLabel(m.drinkId)}</div>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {pending && (
        <div className="flex justify-start">
          <div
            className="rounded-2xl bg-[var(--color-secondarySystemBackground)] px-3.5 py-2 text-sm text-[var(--color-secondaryLabel)]"
            style={{ borderLeft: '3px solid ' + accent + 'AA' }}
          >
            <span className="mr-1 inline-block animate-pulse">…</span>
            {character.name}正在举杯思考
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
