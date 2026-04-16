import { memo } from 'react';
import { LayoutGrid, ChevronRight } from 'lucide-react';
import type { ForwardCardMessage } from '../data';
import { T } from '../theme';

interface Props {
  msg: ForwardCardMessage;
  isMine: boolean;
  onTap: (msg: ForwardCardMessage) => void;
}

export const ForwardCardBubble = memo(function ForwardCardBubble({ msg, isMine, onTap }: Props) {
  const { title, preview } = msg.forwardCard;
  return (
    <button
      type="button"
      onClick={() => onTap(msg)}
      style={{
        display: 'block',
        width: 250,
        textAlign: 'left',
        marginLeft: isMine ? 'auto' : undefined,
        background: T.card,
        borderRadius: 14,
        boxShadow: T.shadow1,
        border: `0.5px solid ${T.border}`,
        overflow: 'hidden',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <div
        style={{
          padding: '10px 14px 8px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <LayoutGrid size={14} strokeWidth={2} color={T.accent} />
        <span style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, flex: 1 }}>
          {title}
        </span>
        <ChevronRight size={14} color={T.textMuted} strokeWidth={2} />
      </div>
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {preview.slice(0, 4).map((line, i) => (
          <span
            key={i}
            style={{
              fontSize: 12,
              color: T.textSecondary,
              lineHeight: 1.4,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {line}
          </span>
        ))}
        {msg.forwardCard.messages.length > 4 && (
          <span style={{ fontSize: 11, color: T.textMuted, marginTop: 2 }}>
            共 {msg.forwardCard.messages.length} 条消息
          </span>
        )}
      </div>
    </button>
  );
});
