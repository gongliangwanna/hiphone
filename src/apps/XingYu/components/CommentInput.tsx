import { useState, useRef, useEffect } from 'react';
import { motion } from 'motion/react';
import { Send } from 'lucide-react';
import { T, springs } from '../theme';

interface CommentInputProps {
  onSubmit: (text: string) => void;
}

export function CommentInput({ onSubmit }: CommentInputProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <motion.div
      className="flex items-center gap-2 px-4 pb-3 pt-2"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
    >
      <div
        className="flex min-w-0 flex-1 items-center"
        style={{
          height: 34,
          borderRadius: T.r.xl,
          backgroundColor: T.bg,
          paddingLeft: 12,
          paddingRight: 4,
          border: `1px solid ${T.border}`,
        }}
      >
        <input
          ref={inputRef}
          className="min-w-0 flex-1 bg-transparent outline-none"
          style={{ fontSize: 13, color: T.textPrimary }}
          placeholder="写评论..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />
        {text.trim() && (
          <motion.button
            className="flex items-center justify-center rounded-full"
            style={{ width: 26, height: 26, background: T.accentGrad }}
            onClick={handleSubmit}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={springs.smooth}
          >
            <Send size={12} strokeWidth={2.5} color={T.textOnAccent} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
