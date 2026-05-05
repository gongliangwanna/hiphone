import { motion } from 'motion/react';
import type { PresenceTurn } from '../presenceTypes';

interface FragmentStreamProps {
  turns: PresenceTurn[];
  emptyText?: string;
  characterName?: string;
}

type AssistantLineKind = 'stage' | 'dialogue' | 'narration';

function formatTurnTime(ts: number): string {
  const date = new Date(ts);
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function unwrapPaired(text: string, pairs: Array<[string, string]>): string {
  const trimmed = text.trim();
  for (const [open, close] of pairs) {
    if (trimmed.startsWith(open) && trimmed.endsWith(close)) {
      return trimmed.slice(open.length, trimmed.length - close.length).trim();
    }
  }
  return trimmed;
}

function classifyAssistantLine(line: string): {
  kind: AssistantLineKind;
  text: string;
} {
  const trimmed = line.trim();
  const stageText = unwrapPaired(trimmed, [
    ['（', '）'],
    ['(', ')'],
  ]);
  if (stageText !== trimmed || trimmed.startsWith('（') || trimmed.startsWith('(')) {
    return { kind: 'stage', text: stageText };
  }

  const dialogueText = unwrapPaired(trimmed, [
    ['"', '"'],
    ['“', '”'],
    ['「', '」'],
    ['『', '』'],
  ]);
  if (dialogueText !== trimmed) {
    return { kind: 'dialogue', text: dialogueText };
  }

  return { kind: 'narration', text: trimmed };
}

function renderAssistantContent(content: string, characterName: string) {
  const lines = content.split('\n').filter((line) => line.trim().length > 0);

  return lines.map((line, index) => {
    const parsed = classifyAssistantLine(line);

    if (parsed.kind === 'stage') {
      return (
        <p
          key={`${index}-${parsed.text}`}
          className="text-[14px] italic leading-6"
          style={{ color: 'rgba(60,60,67,0.78)' }}
          data-testid="presence-assistant-stage-line"
        >
          {parsed.text}
        </p>
      );
    }

    if (parsed.kind === 'dialogue') {
      return (
        <p
          key={`${index}-${parsed.text}`}
          className="my-3 text-[18px] font-semibold leading-8"
          style={{
            color: 'rgba(18,22,30,0.96)',
            textShadow: '0 1px 0 rgba(255,255,255,0.32)',
          }}
          data-testid="presence-assistant-dialogue-line"
        >
          {characterName}：{parsed.text}
        </p>
      );
    }

    return (
      <p
        key={`${index}-${parsed.text}`}
        className="text-[17px] leading-8"
        style={{ color: 'rgba(20,22,28,0.94)' }}
        data-testid="presence-assistant-narration-line"
      >
        {parsed.text}
      </p>
    );
  });
}

export function FragmentStream({
  turns,
  emptyText = '写下第一句话，或者描述你的动作。',
  characterName = '角色',
}: FragmentStreamProps) {
  if (turns.length === 0) {
    return (
      <motion.div
        className="mx-5 mt-4 rounded-[28px] px-5 py-8 text-center text-[15px] leading-6"
        style={{
          background:
            'linear-gradient(180deg, rgba(255,249,236,0.82), rgba(255,255,247,0.72))',
          border: '0.5px solid rgba(255,255,255,0.48)',
          color: 'rgba(62,54,45,0.72)',
          boxShadow: '0 18px 48px rgba(0,0,0,0.2)',
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
    <div className="space-y-3 py-4" data-testid="presence-fragment-stream">
      {turns.map((turn, index) => {
        if (turn.role === 'user') {
          return (
            <motion.div
              key={turn.id}
              className="ml-auto mr-5 max-w-[72%] rounded-[20px] px-4 py-2.5 text-[15px] font-semibold leading-6 text-white"
              style={{
                background:
                  'linear-gradient(135deg, rgba(112,125,198,0.92), rgba(55,78,154,0.9))',
                border: '0.5px solid rgba(255,255,255,0.22)',
                boxShadow: '0 14px 30px rgba(25,40,110,0.3)',
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
              <span>你：{turn.content}</span>
              <span
                className="ml-3 align-baseline text-[11px] font-medium text-white/42"
                data-testid="presence-user-turn-time"
              >
                {formatTurnTime(turn.createdAt)}
              </span>
            </motion.div>
          );
        }

        return (
          <motion.article
            key={turn.id}
            className="mx-5 rounded-[30px] px-5 py-5"
            style={{
              background:
                'linear-gradient(180deg, rgba(246,236,219,0.82), rgba(255,249,238,0.74))',
              border: '0.5px solid rgba(255,255,255,0.58)',
              boxShadow: '0 24px 62px rgba(0,0,0,0.18)',
            }}
            initial={{ opacity: 0, y: 16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{
              delay: Math.min(index * 0.04, 0.22),
              duration: 0.36,
              ease: [0.22, 1, 0.36, 1],
            }}
            data-testid="presence-reading-sheet"
          >
            <section className="space-y-2" data-testid="presence-assistant-turn">
              {renderAssistantContent(turn.content, characterName)}
            </section>
          </motion.article>
        );
      })}
    </div>
  );
}
