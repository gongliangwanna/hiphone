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

export function BuilderChat({ onSend, onAbort }: BuilderChatProps) {
  const chatHistory = useAIAppBuilderStore((s) => s.chatHistory);
  const status = useAIAppBuilderStore((s) => s.status);
  const lastError = useAIAppBuilderStore((s) => s.lastError);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new turns
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
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
        {chatHistory.length === 0 && <EmptyState />}
        {chatHistory.map((turn, i) => {
          switch (turn.kind) {
            case 'user':
            case 'agent-text':
              return <ChatBubble key={i} turn={turn} />;
            case 'tool-call':
              return <ToolCallCard key={i} turn={turn} />;
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

function EmptyState() {
  return (
    <div
      style={{
        textAlign: 'center',
        color: 'var(--color-secondaryLabel)',
        fontSize: 14,
        padding: '40px 16px',
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--color-label)' }}>
        AI 工坊
      </div>
      <div>用一句话描述你想要的 app — AI 会生成代码,你预览满意后一键安装。</div>
      <div style={{ marginTop: 12, fontSize: 13 }}>
        例如:
        <br />· 番茄钟,25 分钟工作 5 分钟休息
        <br />· 习惯打卡,每天最多 5 个习惯
        <br />· 简易记账,按分类汇总
      </div>
    </div>
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
}: {
  turn: Extract<ChatTurn, { kind: 'tool-call' }>;
}) {
  const [expanded, setExpanded] = useState(false);
  const summary = summarizeToolArgs(turn.tool, turn.args);
  const Icon = turn.ok ? Wrench : XCircle;
  const iconColor = turn.ok ? 'var(--color-secondaryLabel)' : 'var(--color-systemRed)';

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
          borderRadius: 8,
          border: '0.5px solid var(--color-separator)',
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
          borderRadius: 8,
          border: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          padding: '8px 12px',
          color: 'var(--color-label)',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>计划</div>
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
        <CheckCircle2
          size={14}
          color="var(--color-systemGreen)"
          style={{ flexShrink: 0, marginTop: 3 }}
        />
        <span>{turn.summary}</span>
      </div>
    </motion.div>
  );
}
