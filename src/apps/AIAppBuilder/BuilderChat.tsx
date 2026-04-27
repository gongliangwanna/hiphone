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
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAIAppBuilderStore, type ChatTurn } from './aiAppBuilderStore';

interface BuilderChatProps {
  onSend: (text: string) => void;
}

export function BuilderChat({ onSend }: BuilderChatProps) {
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
          <EmptyState />
        )}
        {chatHistory.map((turn, i) => (
          <ChatBubble key={i} turn={turn} />
        ))}
        {isGenerating && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--color-secondaryLabel)',
              fontSize: 13,
              padding: '8px 0',
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            生成中...
          </div>
        )}
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
              fontSize: 14,
              padding: '8px 12px',
              borderRadius: 8,
              border: '0.5px solid var(--color-separator)',
              backgroundColor: 'var(--color-systemBackground)',
              color: 'var(--color-label)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
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
            }}
          >
            <Send size={16} />
          </button>
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
      <div>
        用一句话描述你想要的 app — AI 会生成代码,你预览满意后一键安装。
      </div>
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
  // S6: tool-call / plan-update / finish kinds get proper rendering in S8.
  // For now, only user + agent-text bubbles render; other kinds are skipped.
  if (turn.kind !== 'user' && turn.kind !== 'agent-text') return null;
  const isUser = turn.kind === 'user';
  return (
    <div
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
    </div>
  );
}
