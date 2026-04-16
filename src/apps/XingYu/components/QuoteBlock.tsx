import { memo } from 'react';
import type { QuoteRef } from '../data';

interface Props {
  quoteRef: QuoteRef;
  isMine: boolean;
  senderName: string;
  onTap: (msgId: string) => void;
}

export const QuoteBlock = memo(function QuoteBlock({ quoteRef, isMine, senderName, onTap }: Props) {
  return (
    <button
      type="button"
      onClick={() => onTap(quoteRef.msgId)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: isMine ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)',
        borderRadius: 8,
        padding: '6px 10px',
        marginBottom: 6,
        cursor: 'pointer',
        border: 'none',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: isMine ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)',
          fontWeight: 500,
          marginBottom: 1,
        }}
      >
        {senderName}
      </div>
      <div
        style={{
          fontSize: 12,
          color: isMine ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.5)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {quoteRef.preview}
      </div>
    </button>
  );
});
