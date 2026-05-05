import { memo } from 'react';
import { Reply, X } from 'lucide-react';
import { getLocationPreview, type Message } from '../data';
import { T } from '../theme';

export function getQuotePreviewText(msg: Message): string {
  switch (msg.type) {
    case 'text':
      if (msg.noteRef) return `[备忘录] ${msg.noteRef.title || '无标题'}`;
      if (msg.songRef) return `[音乐] ${msg.songRef.title}`;
      return msg.text.slice(0, 40);
    case 'image':
      return '[图片]';
    case 'location':
      return getLocationPreview(msg.location);
    case 'sticker':
      return '[贴纸]';
    case 'forward_card':
      return '[聊天记录]';
    case 'heartbeat_log':
      return '';
  }
}

interface Props {
  msg: Message;
  senderName: string;
  onClose: () => void;
}

export const QuotePreview = memo(function QuotePreview({ msg, senderName, onClose }: Props) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 10,
        padding: '8px 12px',
        margin: '0 12px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: T.shadow1,
        border: `1px solid ${T.border}`,
      }}
    >
      <Reply size={14} strokeWidth={2.2} color={T.accent} style={{ flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: T.textSecondary,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {senderName}: {getQuotePreviewText(msg)}
      </span>
      <button
        type="button"
        onClick={onClose}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
          margin: -4,
          display: 'flex',
        }}
      >
        <X size={14} strokeWidth={2} color={T.textMuted} />
      </button>
    </div>
  );
});
