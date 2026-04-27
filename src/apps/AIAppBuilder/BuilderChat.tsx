/**
 * Chat UI for the AI 工坊. Displays alternating user/builder turns
 * plus a status banner (generating / parse-error / etc.) and an input
 * box at the bottom.
 *
 * Send button dispatches:
 *   - First message in session → store.startNewDraft
 *   - Subsequent → store.appendUserMessage
 * Then triggers generateDraft via the parent (AIAppBuilderApp) which
 * pumps the result back into the store.
 *
 * S8: renders the four non-user ChatTurn kinds emitted by the agent
 * loop (agent-text / tool-call / plan-update / finish) and shows a
 * 停止 button while generating.
 */

import { useState, useRef, useEffect, useMemo, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import {
  Send,
  Sparkles,
  Wrench,
  XCircle,
  CheckCircle,
  Circle,
  SkipForward,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Square,
} from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import { useAIAppBuilderStore, type ChatTurn } from './aiAppBuilderStore';

interface BuilderChatProps {
  onSend: (text: string) => void;
  onAbort?: () => void;
}

type ToolGroupPos = 'only' | 'first' | 'middle' | 'last';

export function BuilderChat({ onSend, onAbort }: BuilderChatProps) {
  const chatHistory = useAIAppBuilderStore((s) => s.chatHistory);
  const status = useAIAppBuilderStore((s) => s.status);
  const lastError = useAIAppBuilderStore((s) => s.lastError);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new turns. First-mount stays instant; subsequent
  // additions glide so message arrival doesn't feel like a hard cut.
  const hasScrolledRef = useRef(false);
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({
      top: el.scrollHeight,
      behavior: hasScrolledRef.current ? 'smooth' : 'auto',
    });
    hasScrolledRef.current = true;
  }, [chatHistory.length, status]);

  const isGenerating = status === 'generating';
  const canSend = input.trim().length > 0 && !isGenerating;

  // Pre-compute the set of plan-update indices that are stale (a later
  // plan-update exists with no intervening 'user' turn). Walk forward from
  // each plan-update; if we hit another plan-update without seeing 'user',
  // the earlier one is stale.
  const stalePlanIndices = useMemo(() => {
    const stale = new Set<number>();
    for (let i = 0; i < chatHistory.length; i++) {
      if (chatHistory[i]!.kind !== 'plan-update') continue;
      for (let j = i + 1; j < chatHistory.length; j++) {
        const t = chatHistory[j]!;
        if (t.kind === 'user') break;
        if (t.kind === 'plan-update') {
          stale.add(i);
          break;
        }
      }
    }
    return stale;
  }, [chatHistory]);

  // Group consecutive tool-call turns into a single iOS Reminders–style
  // card by tagging each tool-call with its position in the group. Stale
  // plan-updates render null, so they don't break visual adjacency.
  const toolGroupPosition = useMemo(() => {
    const visibleKinds: { idx: number; kind: ChatTurn['kind'] }[] = [];
    for (let i = 0; i < chatHistory.length; i++) {
      const t = chatHistory[i]!;
      if (t.kind === 'plan-update' && stalePlanIndices.has(i)) continue;
      visibleKinds.push({ idx: i, kind: t.kind });
    }
    const map = new Map<number, ToolGroupPos>();
    for (let r = 0; r < visibleKinds.length; r++) {
      if (visibleKinds[r]!.kind !== 'tool-call') continue;
      const prevIsTool = r > 0 && visibleKinds[r - 1]!.kind === 'tool-call';
      const nextIsTool =
        r < visibleKinds.length - 1 && visibleKinds[r + 1]!.kind === 'tool-call';
      const pos: ToolGroupPos =
        prevIsTool && nextIsTool
          ? 'middle'
          : prevIsTool
            ? 'last'
            : nextIsTool
              ? 'first'
              : 'only';
      map.set(visibleKinds[r]!.idx, pos);
    }
    return map;
  }, [chatHistory, stalePlanIndices]);

  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    onSend(text);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAbort = () => {
    onAbort?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 16px',
          backgroundColor: 'var(--color-secondarySystemBackground)',
        }}
      >
        {chatHistory.length === 0 && (
          <EmptyState onPickSuggestion={(text) => setInput(text)} />
        )}
        {chatHistory.map((turn, i) => {
          switch (turn.kind) {
            case 'user':
            case 'agent-text':
              return <ChatBubble key={i} turn={turn} />;
            case 'tool-call':
              return (
                <ToolCallCard
                  key={i}
                  turn={turn}
                  groupPos={toolGroupPosition.get(i) ?? 'only'}
                />
              );
            case 'plan-update':
              if (stalePlanIndices.has(i)) return null;
              return <PlanCard key={i} turn={turn} />;
            case 'finish':
              return <FinishBubble key={i} turn={turn} />;
            default:
              return null;
          }
        })}
        {isGenerating && <TypingIndicator />}
        {status === 'compile-error' && lastError && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: 'rgba(255,59,48,0.1)',
              color: 'var(--color-systemRed)',
              fontSize: 13,
              marginTop: 8,
            }}
          >
            编译失败: {lastError}
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: '0.5px solid var(--color-separator)',
          padding: 12,
          backgroundColor: 'var(--color-tertiarySystemBackground)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={chatHistory.length === 0 ? '描述你想要的 app...' : '继续完善...'}
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              fontSize: 15,
              lineHeight: 1.4,
              padding: '10px 14px',
              borderRadius: 22,
              border: 'none',
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              color: 'var(--color-label)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          {isGenerating && onAbort ? (
            <motion.button
              type="button"
              onClick={handleAbort}
              whileTap={{ scale: 0.92 }}
              transition={spring.snappy}
              aria-label="停止生成"
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: 'none',
                backgroundColor: 'var(--color-systemRed)',
                color: 'white',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
              data-testid="builder-chat-abort"
            >
              <Square size={12} fill="currentColor" />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              onClick={handleSend}
              disabled={!canSend}
              whileTap={canSend ? { scale: 0.92 } : undefined}
              transition={spring.snappy}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                border: 'none',
                backgroundColor: canSend ? 'var(--color-systemBlue)' : 'var(--color-separator)',
                color: 'white',
                cursor: canSend ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background-color 200ms ease',
              }}
            >
              <Send size={16} />
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  '番茄钟,25 分钟工作 5 分钟休息',
  '习惯打卡,每天最多 5 个习惯',
  '简易记账,按分类汇总',
] as const;

function EmptyState({
  onPickSuggestion,
}: {
  onPickSuggestion: (text: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        padding: '48px 16px 16px',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 16,
          background:
            'linear-gradient(135deg, var(--color-systemBlue) 0%, var(--color-systemPurple) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        }}
      >
        <Sparkles size={32} color="white" strokeWidth={2} />
      </div>
      <div
        style={{
          fontSize: 20,
          fontWeight: 600,
          color: 'var(--color-label)',
          marginBottom: 6,
        }}
      >
        AI 工坊
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--color-secondaryLabel)',
          lineHeight: 1.5,
          maxWidth: 280,
          marginBottom: 20,
        }}
      >
        用一句话描述你想要的 app, AI 会生成代码并一键安装到桌面。
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          width: '100%',
          maxWidth: 320,
        }}
      >
        {SUGGESTIONS.map((text) => (
          <motion.button
            key={text}
            type="button"
            onClick={() => onPickSuggestion(text)}
            whileTap={{ scale: 0.96 }}
            transition={spring.snappy}
            style={{
              padding: '10px 14px',
              borderRadius: 18,
              border: '0.5px solid var(--color-separator)',
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              color: 'var(--color-label)',
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
            }}
          >
            {text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  // Only handles user / agent-text — other kinds have dedicated components.
  if (turn.kind !== 'user' && turn.kind !== 'agent-text') return null;
  const isUser = turn.kind === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={isUser ? spring.snappy : spring.smooth}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: 14,
          fontSize: 14,
          lineHeight: 1.5,
          backgroundColor: isUser
            ? 'var(--color-systemBlue)'
            : 'var(--color-tertiarySystemBackground)',
          color: isUser ? 'white' : 'var(--color-label)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {turn.text}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={spring.smooth}
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 14px',
          borderRadius: 18,
          backgroundColor: 'var(--color-tertiarySystemBackground)',
        }}
      >
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: 'var(--color-secondaryLabel)',
              display: 'inline-block',
            }}
            animate={{ y: [0, -3, 0], opacity: [0.3, 0.9, 0.3] }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.16,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/** Build a short human-readable summary of a tool call's args. */
function summarizeToolArgs(tool: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  switch (tool) {
    case 'read_file':
    case 'write_file':
    case 'delete_file':
    case 'compile_check':
      return typeof a.path === 'string' && a.path ? a.path : 'all files';
    case 'list_files':
      return '...';
    case 'read_fixture':
      return typeof a.name === 'string' ? a.name : '';
    case 'update_plan': {
      const steps = Array.isArray(a.steps) ? a.steps : [];
      return `${steps.length} steps`;
    }
    case 'mark_step':
      return `${String(a.id ?? '')} → ${String(a.status ?? '')}`;
    default: {
      const s = JSON.stringify(args ?? {});
      return s.length > 30 ? s.slice(0, 30) : s;
    }
  }
}

function ToolCallCard({
  turn,
  groupPos,
}: {
  turn: Extract<ChatTurn, { kind: 'tool-call' }>;
  groupPos: ToolGroupPos;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeToolArgs(turn.tool, turn.args);
  const Icon = turn.ok ? Wrench : XCircle;
  const iconColor = turn.ok ? 'var(--color-secondaryLabel)' : 'var(--color-systemRed)';

  // iOS Reminders cells: 12px outer radius, hairlines between rows in a group
  const radTop = groupPos === 'only' || groupPos === 'first' ? 12 : 0;
  const radBottom = groupPos === 'only' || groupPos === 'last' ? 12 : 0;
  const showTopBorder = groupPos === 'middle' || groupPos === 'last';
  const dropBottomBorder = groupPos === 'first' || groupPos === 'middle';
  const stackedSpacing = groupPos === 'only' || groupPos === 'last' ? 6 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={spring.smooth}
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: stackedSpacing,
      }}
    >
      <div
        style={{
          maxWidth: '90%',
          borderTopLeftRadius: radTop,
          borderTopRightRadius: radTop,
          borderBottomLeftRadius: radBottom,
          borderBottomRightRadius: radBottom,
          border: '0.5px solid var(--color-separator)',
          borderTop: showTopBorder
            ? '0.5px solid var(--color-separator)'
            : '0.5px solid var(--color-separator)',
          borderBottom: dropBottomBorder
            ? 'none'
            : '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          fontSize: 13,
          color: 'var(--color-label)',
          overflow: 'hidden',
        }}
      >
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
        >
          {expanded ? (
            <ChevronDown size={12} color="var(--color-secondaryLabel)" />
          ) : (
            <ChevronRight size={12} color="var(--color-secondaryLabel)" />
          )}
          <Icon size={12} color={iconColor} />
          <span style={{ fontWeight: 600 }}>{turn.tool}</span>
          <span style={{ color: 'var(--color-secondaryLabel)' }}>· {summary}</span>
        </button>
        {expanded && (
          <div
            style={{
              padding: '0 12px 8px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <DetailBlock label="args" value={turn.args} />
            <DetailBlock label="result" value={turn.result} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DetailBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--color-secondaryLabel)', marginBottom: 2 }}>
        {label}
      </div>
      <pre
        style={{
          margin: 0,
          padding: 8,
          fontSize: 12,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          backgroundColor: 'var(--color-secondarySystemBackground)',
          borderRadius: 6,
          maxHeight: 240,
          overflow: 'auto',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {safeStringify(value)}
      </pre>
    </div>
  );
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function PlanCard({ turn }: { turn: Extract<ChatTurn, { kind: 'plan-update' }> }) {
  const total = turn.steps.length;
  const done = turn.steps.filter((s) => s.status === 'done').length;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={spring.smooth}
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: 6,
      }}
    >
      <div
        style={{
          maxWidth: '90%',
          borderRadius: 12,
          border: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          padding: '8px 12px',
          color: 'var(--color-label)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 6,
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 600 }}>计划</span>
          <span style={{ fontSize: 12, color: 'var(--color-secondaryLabel)' }}>
            {done}/{total}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {turn.steps.map((step) => {
            const StepIcon =
              step.status === 'done'
                ? CheckCircle
                : step.status === 'skipped'
                  ? SkipForward
                  : Circle;
            const iconColor =
              step.status === 'done'
                ? 'var(--color-systemGreen)'
                : step.status === 'skipped'
                  ? 'var(--color-secondaryLabel)'
                  : 'var(--color-secondaryLabel)';
            return (
              <div
                key={step.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 13,
                  color:
                    step.status === 'skipped'
                      ? 'var(--color-secondaryLabel)'
                      : 'var(--color-label)',
                  textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
                }}
              >
                <StepIcon size={13} color={iconColor} />
                <span>{step.title}</span>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function FinishBubble({ turn }: { turn: Extract<ChatTurn, { kind: 'finish' }> }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={spring.smooth}
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: 14,
          fontSize: 14,
          lineHeight: 1.5,
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          color: 'var(--color-label)',
          border: '1px solid var(--color-systemGreen)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          display: 'flex',
          alignItems: 'flex-start',
          gap: 6,
        }}
      >
        <motion.span
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ ...spring.bouncy, delay: 0.15 }}
          style={{ flexShrink: 0, marginTop: 3, display: 'inline-flex' }}
        >
          <CheckCircle2 size={14} color="var(--color-systemGreen)" />
        </motion.span>
        <span>{turn.summary}</span>
      </div>
    </motion.div>
  );
}
