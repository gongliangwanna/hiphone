import { motion } from 'motion/react';
import type { PresenceTurn } from '../presenceTypes';

interface FragmentStreamProps {
  turns: PresenceTurn[];
  emptyText?: string;
}

function renderAssistantContent(content: string) {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  return lines.map((line, index) => {
    const trimmed = line.trim();
    const isStage =
      /^（[\s\S]*）$/.test(trimmed) ||
      /^\([\s\S]*\)$/.test(trimmed) ||
      trimmed.startsWith('（') ||
      trimmed.startsWith('(');

    return (
      <p
        key={`${index}-${trimmed}`}
        className={isStage ? 'text-[14px] italic leading-7' : 'text-[16px] leading-7'}
        style={{
          color: isStage
            ? 'var(--color-secondaryLabel)'
            : 'var(--color-label)',
        }}
      >
        {trimmed}
      </p>
    );
  });
}

export function FragmentStream({
  turns,
  emptyText = '写下第一句话，或者描述你的动作。',
}: FragmentStreamProps) {
  if (turns.length === 0) {
    return (
      <motion.div
        className="mx-4 mt-5 rounded-[22px] px-5 py-8 text-center text-[15px] leading-6"
        style={{
          backgroundColor: 'rgba(255,255,255,0.68)',
          border: '0.5px solid rgba(60,60,67,0.12)',
          color: 'var(--color-secondaryLabel)',
          boxShadow: '0 16px 38px rgba(24,28,36,0.06)',
        }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
        data-testid="presence-empty-stream"
      >
        {emptyText}
      </motion.div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-4" data-testid="presence-fragment-stream">
      {turns.map((turn, index) => {
        if (turn.role === 'user') {
          return (
            <motion.p
              key={turn.id}
              className="border-l-2 pl-3 text-[15px] leading-7"
              style={{
                borderColor: 'rgba(0,122,255,0.34)',
                color: 'var(--color-label)',
              }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: Math.min(index * 0.035, 0.18),
                duration: 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
              data-testid="presence-user-turn"
            >
              {turn.content}
            </motion.p>
          );
        }

        return (
          <motion.article
            key={turn.id}
            className="space-y-2 rounded-[22px] px-4 py-4"
            style={{
              backgroundColor: 'rgba(255,255,255,0.72)',
              border: '0.5px solid rgba(60,60,67,0.12)',
              boxShadow: '0 14px 34px rgba(24,28,36,0.06)',
            }}
            initial={{ opacity: 0, y: 16, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: Math.min(index * 0.04, 0.22),
              type: 'spring',
              stiffness: 320,
              damping: 30,
            }}
            data-testid="presence-assistant-turn"
          >
            {renderAssistantContent(turn.content)}
          </motion.article>
        );
      })}
    </div>
  );
}
