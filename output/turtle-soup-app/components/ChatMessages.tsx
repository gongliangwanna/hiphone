import React, { useEffect, useRef } from 'react';
import { AnimatePresence, motion, spring } from '@hiphone/motion';
import { Character } from '../constants/character';
import { ChatTurn } from '../constants/types';
import { VERDICT_META } from '../constants/verdicts';

interface Props {
  character: Character;
  turns: ChatTurn[];
  pending: boolean;
}

export function ChatMessages({ character, turns, pending }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } catch {
      // ignore in sandbox
    }
  }, [turns.length, pending]);

  return (
    <div className="flex flex-col gap-3.5">
      <AnimatePresence initial={false}>
        {turns.map((t) => {
          if (t.role === 'system') {
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 self-stretch"
              >
                <span className="h-px flex-1 bg-[#1A0F0A]/20" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#8C765C]">
                  {t.text}
                </span>
                <span className="h-px flex-1 bg-[#1A0F0A]/20" />
              </motion.div>
            );
          }

          if (t.role === 'user') {
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={spring.smooth}
                className="flex justify-end"
              >
                <div className="max-w-[82%]">
                  <div className="text-right font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#8C765C]">
                    Q · 提问
                  </div>
                  <div
                    className="mt-1 border-r-[3px] border-[#1A0F0A] py-1 pr-3 pl-3 text-right text-[15px] leading-[1.65] text-[#1A0F0A]"
                    style={{ background: 'rgba(26,15,10,0.04)' }}
                  >
                    <div className="whitespace-pre-wrap">{t.text}</div>
                  </div>
                </div>
              </motion.div>
            );
          }

          // assistant: verdict stamp + body
          const messages = t.messages && t.messages.length > 0 ? t.messages : t.text ? [t.text] : [];
          const verdict = t.verdict ? VERDICT_META[t.verdict] : null;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={spring.smooth}
              className="flex flex-col items-start gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#8C765C]">
                  A · {character.name}
                </div>
                {verdict && <VerdictStamp meta={verdict} />}
              </div>

              <div className="max-w-[82%] space-y-2">
                {messages.map((m, idx) => (
                  <motion.div
                    key={t.id + '_m_' + idx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...spring.smooth, delay: idx * 0.06 }}
                    className="border-l-[3px] border-[#1A0F0A] pl-3 py-1 text-[15px] leading-[1.65] text-[#1A0F0A]"
                    style={{ background: 'rgba(26,15,10,0.03)' }}
                  >
                    <div className="whitespace-pre-wrap">{m}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {pending && (
        <div className="flex items-center gap-2">
          <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.22em] text-[#8C765C]">
            A · {character.name} 落笔中
          </div>
          <span className="flex gap-0.5">
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#1A0F0A]" style={{ animationDelay: '0ms' }} />
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#1A0F0A]" style={{ animationDelay: '150ms' }} />
            <span className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#1A0F0A]" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}

function VerdictStamp({ meta }: { meta: typeof VERDICT_META[keyof typeof VERDICT_META] }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, rotate: -18 }}
      animate={{ opacity: 0.92, scale: 1, rotate: -8 }}
      transition={spring.snappy}
      className="relative flex items-center gap-1.5 rounded-sm border-[2px] px-1.5 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-[0.22em]"
      style={{
        borderColor: meta.color,
        color: meta.color,
        background: meta.bg,
      }}
    >
      <span className="text-[12px] leading-none">{meta.symbol}</span>
      <span>{meta.label}</span>
    </motion.div>
  );
}
