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

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  useLayoutEffect,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
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
  Bot,
  ClipboardList,
  Code2,
  Terminal,
  Check,
  Paperclip,
  ArrowUp,
} from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import { useAIAppBuilderStore, type ChatTurn } from './aiAppBuilderStore';

interface BuilderChatProps {
  onSend: (text: string) => void;
  onAbort?: () => void;
}

type ToolGroupPos = 'only' | 'first' | 'middle' | 'last';

const COMPOSER_INPUT_LINE_HEIGHT = 22;
const COMPOSER_INPUT_VERTICAL_PADDING = 16;
const COMPOSER_INPUT_MIN_HEIGHT =
  COMPOSER_INPUT_LINE_HEIGHT + COMPOSER_INPUT_VERTICAL_PADDING;
const COMPOSER_INPUT_MAX_ROWS = 10;
const COMPOSER_INPUT_MAX_HEIGHT =
  COMPOSER_INPUT_LINE_HEIGHT * COMPOSER_INPUT_MAX_ROWS + COMPOSER_INPUT_VERTICAL_PADDING;

export function BuilderChat({ onSend, onAbort }: BuilderChatProps) {
  const chatHistory = useAIAppBuilderStore((s) => s.chatHistory);
  const status = useAIAppBuilderStore((s) => s.status);
  const lastError = useAIAppBuilderStore((s) => s.lastError);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;

    el.style.height = 'auto';
    const nextHeight = Math.max(
      COMPOSER_INPUT_MIN_HEIGHT,
      Math.min(el.scrollHeight, COMPOSER_INPUT_MAX_HEIGHT),
    );
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [input]);

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

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#f7f9fd' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '8px 16px 96px',
          backgroundColor: '#f7f9fd',
        }}
      >
        {chatHistory.length === 0 && (
          <EmptyState onPickSuggestion={(text) => setInput(text)} />
        )}
        {chatHistory.map((turn, i) => {
          switch (turn.kind) {
            case 'user':
              return <ChatBubble key={i} turn={turn} showAvatar={false} />;
            case 'agent-text':
              return (
                <ChatBubble
                  key={i}
                  turn={turn}
                  showAvatar={i === 0 || chatHistory[i - 1]?.kind === 'user'}
                />
              );
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
          padding: '10px 14px 14px',
          backgroundColor: 'rgba(247,249,253,0.94)',
        }}
      >
        <div
          style={{
            minHeight: 56,
            borderRadius: 20,
            border: '0.5px solid rgba(60,60,67,0.12)',
            backgroundColor: 'rgba(255,255,255,0.92)',
            boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
            display: 'flex',
            gap: 10,
            alignItems: 'flex-end',
            padding: '8px 10px',
          }}
        >
          <button
            type="button"
            aria-label="添加附件"
            style={{
              width: 38,
              height: 38,
              borderRadius: 19,
              border: 'none',
              background: 'transparent',
              color: 'var(--color-secondaryLabel)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              cursor: 'pointer',
            }}
          >
            <Paperclip size={23} strokeWidth={2.3} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKey}
            placeholder={chatHistory.length === 0 ? '描述你想要的 app...' : '继续完善...'}
            rows={1}
            style={{
              flex: 1,
              height: COMPOSER_INPUT_MIN_HEIGHT,
              minHeight: COMPOSER_INPUT_MIN_HEIGHT,
              maxHeight: COMPOSER_INPUT_MAX_HEIGHT,
              resize: 'none',
              fontSize: 16,
              lineHeight: `${COMPOSER_INPUT_LINE_HEIGHT}px`,
              padding: '8px 12px',
              borderRadius: 19,
              border: 'none',
              backgroundColor: '#f8f9fc',
              color: 'var(--color-label)',
              outline: 'none',
              fontFamily: 'inherit',
              overflowY: 'hidden',
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
                width: 44,
                height: 44,
                borderRadius: 22,
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
              aria-label="发送"
              whileTap={canSend ? { scale: 0.92 } : undefined}
              transition={spring.snappy}
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
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
              {canSend ? <ArrowUp size={21} strokeWidth={2.6} /> : <Send size={18} />}
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
        padding: '42px 16px 18px',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          backgroundColor: 'rgba(0,122,255,0.12)',
          color: 'var(--color-systemBlue)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 16,
          boxShadow: '0 12px 26px rgba(0,122,255,0.10)',
        }}
      >
        <Sparkles size={32} color="var(--color-systemBlue)" strokeWidth={2} />
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
              borderRadius: 16,
              border: '0.5px solid rgba(60,60,67,0.12)',
              backgroundColor: 'rgba(255,255,255,0.94)',
              color: 'var(--color-label)',
              fontSize: 14,
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              boxShadow: '0 8px 18px rgba(15,23,42,0.04)',
            }}
          >
            {text}
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function ChatBubble({ turn, showAvatar }: { turn: ChatTurn; showAvatar: boolean }) {
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
        alignItems: 'flex-end',
        gap: 10,
        marginBottom: 14,
      }}
    >
      {!isUser && (showAvatar ? <AssistantAvatar /> : <div style={{ width: 42, flexShrink: 0 }} />)}
      <div
        style={{
          maxWidth: isUser ? '76%' : '78%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          gap: 4,
        }}
      >
        <div
          style={{
            padding: isUser ? '12px 16px' : '11px 15px',
            borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
            fontSize: 16,
            lineHeight: 1.42,
            backgroundColor: isUser ? 'var(--color-systemBlue)' : 'rgba(255,255,255,0.96)',
            color: isUser ? 'white' : 'var(--color-label)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxShadow: isUser
              ? '0 8px 18px rgba(0,122,255,0.24)'
              : '0 8px 22px rgba(15,23,42,0.06)',
            border: isUser ? 'none' : '0.5px solid rgba(60,60,67,0.10)',
          }}
        >
          {turn.text}
        </div>
        <span
          style={{
            fontSize: 12,
            color: 'var(--color-tertiaryLabel)',
            paddingInline: 4,
          }}
        >
          {formatChatTime(turn.timestamp)}
        </span>
      </div>
    </motion.div>
  );
}

function AssistantAvatar() {
  return (
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: 'rgba(0,122,255,0.10)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 8px 20px rgba(0,122,255,0.08)',
      }}
    >
      <Bot size={21} color="var(--color-systemBlue)" strokeWidth={2.2} />
    </div>
  );
}

function formatChatTime(ts: number): string {
  if (!Number.isFinite(ts) || ts <= 0) return '';
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
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
        alignItems: 'flex-end',
        gap: 10,
        marginBottom: 14,
      }}
    >
      <AssistantAvatar />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '13px 16px',
          borderRadius: '18px 18px 18px 4px',
          backgroundColor: 'rgba(255,255,255,0.96)',
          border: '0.5px solid rgba(60,60,67,0.10)',
          boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
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

/** Build the primary target shown for a tool call row. */
function summarizeToolTarget(tool: string, args: unknown): string {
  const a = (args ?? {}) as Record<string, unknown>;
  switch (tool) {
    case 'read_file':
    case 'write_file':
    case 'delete_file':
    case 'compile_check':
      return typeof a.path === 'string' && a.path ? a.path : 'all files';
    case 'list_files':
      return 'current draft';
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
  groupPos: _groupPos,
}: {
  turn: Extract<ChatTurn, { kind: 'tool-call' }>;
  groupPos: ToolGroupPos;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const target = summarizeToolTarget(turn.tool, turn.args);
  const ToolIcon = getToolIcon(turn.tool);
  const toolTone = getToolTone(turn.tool);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={spring.smooth}
      style={{
        display: 'flex',
        justifyContent: 'flex-start',
        marginBottom: 10,
      }}
    >
      <div
        style={{
          width: '100%',
          borderRadius: 17,
          border: '0.5px solid rgba(60,60,67,0.12)',
          backgroundColor: 'rgba(255,255,255,0.94)',
          boxShadow: '0 8px 22px rgba(15,23,42,0.055)',
          fontSize: 15,
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
            gap: 11,
            minHeight: 58,
            padding: '9px 14px',
            background: 'transparent',
            border: 'none',
            color: 'inherit',
            font: 'inherit',
            cursor: 'pointer',
            width: '100%',
            textAlign: 'left',
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              backgroundColor: toolTone.background,
              color: toolTone.color,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ToolIcon size={18} strokeWidth={2.25} />
          </span>
          <span
            style={{
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              flex: 1,
            }}
          >
            <span
              style={{
                fontWeight: 800,
                color: 'var(--color-label)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {target}
            </span>
            <span
              style={{
                color: 'var(--color-secondaryLabel)',
                fontSize: 13,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {turn.tool}
            </span>
          </span>
          <span style={{ flex: '0 0 2px' }} />
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 14,
              color: turn.ok ? 'var(--color-systemGreen)' : 'var(--color-systemRed)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            {turn.ok ? <Check size={19} strokeWidth={2.6} /> : <XCircle size={19} strokeWidth={2.2} />}
          </span>
          {expanded ? (
            <ChevronDown size={17} color="var(--color-secondaryLabel)" />
          ) : (
            <ChevronRight size={17} color="var(--color-secondaryLabel)" />
          )}
        </button>
        {expanded && (
          <div
            style={{
              padding: '0 14px 13px 59px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <StructuredToolDetails turn={turn} />
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              style={{
                minHeight: 32,
                border: 'none',
                borderTop: '0.5px solid rgba(60,60,67,0.10)',
                padding: '8px 0 0',
                background: 'transparent',
                color: 'var(--color-systemBlue)',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              查看原始 JSON
            </button>
            {showRaw && (
              <>
                <DetailBlock label="args" value={turn.args} />
                <DetailBlock label="result" value={turn.result} />
              </>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function StructuredToolDetails({ turn }: { turn: Extract<ChatTurn, { kind: 'tool-call' }> }) {
  const args = (turn.args ?? {}) as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];
  if (typeof args.path === 'string') {
    rows.push({ label: 'path', value: args.path });
  } else {
    rows.push({ label: 'target', value: summarizeToolTarget(turn.tool, turn.args) });
  }
  if (typeof args.content === 'string') {
    rows.push({ label: 'content', value: formatContentSize(args.content) });
  }
  if (!turn.ok) {
    rows.push({ label: 'result', value: 'failed' });
  } else {
    rows.push({ label: 'result', value: 'ok' });
  }

  return (
    <div
      style={{
        borderRadius: 12,
        backgroundColor: '#f4f6fb',
        border: '0.5px solid rgba(60,60,67,0.10)',
        overflow: 'hidden',
      }}
    >
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${index}`}
          style={{
            display: 'grid',
            gridTemplateColumns: '72px minmax(0, 1fr)',
            gap: 10,
            alignItems: 'center',
            minHeight: 34,
            padding: '7px 10px',
            borderBottom: index === rows.length - 1 ? 'none' : '0.5px solid rgba(60,60,67,0.08)',
            fontSize: 13,
          }}
        >
          <span style={{ color: 'var(--color-secondaryLabel)', fontWeight: 600 }}>{row.label}</span>
          <span
            style={{
              color: 'var(--color-label)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatContentSize(content: string): string {
  const bytes = new Blob([content]).size;
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function getToolIcon(tool: string) {
  if (tool === 'compile_check') return Terminal;
  if (tool.includes('file') || tool.startsWith('replace') || tool.startsWith('append')) return Code2;
  return Wrench;
}

function getToolTone(tool: string): { background: string; color: string } {
  if (tool === 'compile_check') {
    return { background: 'rgba(52,199,89,0.16)', color: 'var(--color-systemGreen)' };
  }
  if (tool.includes('file') || tool.startsWith('replace') || tool.startsWith('append')) {
    return { background: 'rgba(88,86,214,0.16)', color: 'var(--color-systemIndigo, #5856d6)' };
  }
  return { background: 'rgba(0,122,255,0.13)', color: 'var(--color-systemBlue)' };
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
        marginBottom: 14,
      }}
    >
      <div
        style={{
          width: '100%',
          borderRadius: 20,
          border: '0.5px solid rgba(60,60,67,0.12)',
          backgroundColor: 'rgba(255,255,255,0.94)',
          padding: '15px 17px',
          color: 'var(--color-label)',
          boxShadow: '0 12px 30px rgba(15,23,42,0.07)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: 12,
            borderBottom: '0.5px solid rgba(60,60,67,0.12)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                color: 'var(--color-systemBlue)',
                backgroundColor: 'rgba(0,122,255,0.12)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ClipboardList size={20} strokeWidth={2.3} />
            </span>
            <span style={{ fontSize: 20, fontWeight: 800 }}>计划</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-systemBlue)' }}>
              {done}/{total}
            </span>
            <ChevronDown size={18} color="var(--color-secondaryLabel)" />
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                  gap: 12,
                  minHeight: 44,
                  borderBottom:
                    step === turn.steps[turn.steps.length - 1]
                      ? 'none'
                      : '0.5px solid rgba(60,60,67,0.10)',
                  fontSize: 16,
                  lineHeight: 1.35,
                  color:
                    step.status === 'skipped'
                      ? 'var(--color-secondaryLabel)'
                      : 'var(--color-label)',
                  textDecoration: step.status === 'skipped' ? 'line-through' : 'none',
                }}
              >
                <StepIcon size={22} color={iconColor} strokeWidth={2.2} />
                <span style={{ flex: 1 }}>{step.title}</span>
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
        marginBottom: 14,
      }}
    >
      <div
        style={{
          maxWidth: '86%',
          padding: '12px 15px',
          borderRadius: '18px 18px 18px 4px',
          fontSize: 16,
          lineHeight: 1.42,
          backgroundColor: 'rgba(255,255,255,0.96)',
          color: 'var(--color-label)',
          border: '0.5px solid rgba(52,199,89,0.34)',
          boxShadow: '0 8px 22px rgba(15,23,42,0.06)',
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
