import { useMemo, useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import type { GomokuAiStatus, GomokuMessage } from './gomokuStore';

const FALLBACK_USER_AVATAR = '/resource/avatars/cute.png';
const FALLBACK_AI_AVATAR = '/resource/avatars/preset-01.jpg';

export function GomokuChatPanel({
  messages,
  userAvatar,
  aiAvatar,
  aiName,
  aiStatus,
  disabled,
  silenced,
  onSend,
}: {
  messages: GomokuMessage[];
  userAvatar?: string;
  aiAvatar?: string;
  aiName: string;
  aiStatus: GomokuAiStatus;
  disabled?: boolean;
  silenced?: boolean;
  onSend: (text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const statusText = useMemo(() => {
    switch (aiStatus) {
      case 'thinking':
        return `${aiName} 正在想`;
      case 'retrying':
        return `${aiName} 正在重试`;
      case 'fallback':
        return '系统代走中';
      case 'failed':
        return '回复失败';
      default:
        return '';
    }
  }, [aiName, aiStatus]);

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSend(text);
    setDraft('');
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col border-t border-black/6 bg-[#F2F2F7]"
      data-testid="gomoku-chat-panel"
    >
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center text-[13px] leading-5 text-[#8E8E93]">
            <span>
              {silenced
                ? '本局已进入只下棋模式。'
                : `可以直接落子,也可以先和${aiName}聊两句。`}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                message={message}
                userAvatar={userAvatar || FALLBACK_USER_AVATAR}
                aiAvatar={aiAvatar || FALLBACK_AI_AVATAR}
              />
            ))}
          </div>
        )}
      </div>

      {statusText && (
        <div className="flex items-center gap-2 px-4 pb-2 text-[12px] text-[#8E8E93]">
          <Loader2 size={13} className="animate-spin" />
          <span>{statusText}</span>
        </div>
      )}

      <div className="flex items-end gap-2 border-t border-black/6 bg-white/92 px-3 py-2 pb-safe">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
          placeholder={silenced ? '本局只下棋' : '聊天'}
          aria-label={silenced ? '本局只下棋' : '聊天'}
          rows={1}
          disabled={disabled}
          className="max-h-20 min-h-9 flex-1 resize-none rounded-[18px] border border-black/10 bg-[#F2F2F7] px-4 py-2 text-[15px] leading-5 text-[#1C1C1E] outline-none placeholder:text-[#8E8E93] disabled:opacity-50"
          data-testid="gomoku-chat-input"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || draft.trim().length === 0}
          aria-label="发送"
          className="mb-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-[#007AFF] text-white active:scale-95 disabled:bg-[#D1D1D6]"
          data-testid="gomoku-chat-send"
        >
          <Send size={17} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}

function ChatBubble({
  message,
  userAvatar,
  aiAvatar,
}: {
  message: GomokuMessage;
  userAvatar: string;
  aiAvatar: string;
}) {
  if (message.role === 'system') {
    return (
      <div
        className="mx-auto max-w-[86%] rounded-full bg-black/6 px-3 py-1.5 text-center text-[12px] leading-4 text-[#6E6E73]"
        data-testid="gomoku-system-message"
      >
        {message.text}
      </div>
    );
  }

  const isUser = message.role === 'user';
  return (
    <div
      className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
      data-testid={isUser ? 'gomoku-user-message' : 'gomoku-ai-message'}
    >
      {!isUser && <AvatarImage src={aiAvatar} />}
      <div
        className={`max-w-[74%] whitespace-pre-wrap break-words rounded-[18px] px-3 py-2 text-[15px] leading-5 ${
          isUser
            ? 'rounded-br-[5px] bg-[#007AFF] text-white'
            : 'rounded-bl-[5px] bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
        }`}
      >
        {message.text}
      </div>
      {isUser && <AvatarImage src={userAvatar} />}
    </div>
  );
}

function AvatarImage({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      className="h-7 w-7 shrink-0 rounded-full object-cover"
      data-testid="gomoku-chat-avatar"
    />
  );
}
