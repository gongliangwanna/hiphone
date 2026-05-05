import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { motion } from '@hiphone/motion';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function MessageInput({ onSend, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="flex items-end gap-2 rounded-2xl border border-[var(--color-separator)] bg-[var(--color-secondarySystemBackground)] px-3 py-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={1}
        placeholder={placeholder ?? '说点什么…'}
        className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[var(--color-label)] outline-none placeholder:text-[var(--color-secondaryLabel)]"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={submit}
        disabled={!canSend}
        className="flex h-9 w-9 items-center justify-center rounded-full text-white disabled:opacity-40"
        style={{ background: 'var(--color-systemBlue)' }}
      >
        <Send size={16} />
      </motion.button>
    </div>
  );
}
