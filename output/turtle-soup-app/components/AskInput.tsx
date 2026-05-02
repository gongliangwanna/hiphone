import React, { useState } from 'react';
import { motion } from '@hiphone/motion';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AskInput({ onSend, disabled, placeholder }: Props) {
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const canSend = !disabled && text.trim().length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText('');
  };

  return (
    <div className="flex items-end gap-2">
      <div
        className="flex flex-1 items-center gap-2 border px-3 py-2 transition-colors"
        style={{
          background: '#EADBC0',
          borderColor: focused ? '#1A0F0A' : 'rgba(26,15,10,0.35)',
        }}
      >
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#8C765C]">
          Q ›
        </span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          rows={1}
          placeholder={placeholder ?? '问一个是非题，比如「他活着吗？」'}
          className="max-h-32 min-h-[24px] flex-1 resize-none bg-transparent text-[15px] leading-relaxed text-[#1A0F0A] caret-[#B8362E] outline-none placeholder:text-[#8C765C]/80 disabled:cursor-not-allowed"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={submit}
        disabled={!canSend}
        className="flex h-[42px] w-[42px] shrink-0 items-center justify-center font-mono text-[11px] font-extrabold uppercase tracking-[0.18em] text-[#F1E4CC] disabled:opacity-30"
        style={{
          background: canSend ? '#B8362E' : '#5C4937',
          boxShadow: canSend ? 'inset 0 0 0 1.5px rgba(241,228,204,0.4)' : 'none',
        }}
        aria-label="发送提问"
      >
        问
      </motion.button>
    </div>
  );
}
