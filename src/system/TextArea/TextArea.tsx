import { useRef, useEffect } from 'react';

interface TextAreaProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  autoGrow?: boolean;
  testId?: string;
}

/** iOS-style multiline text input with optional auto-grow */
export function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  maxLength,
  autoGrow = false,
  testId,
}: TextAreaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoGrow && ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
  }, [value, autoGrow]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      maxLength={maxLength}
      className="block w-full resize-none p-3"
      style={{
        fontSize: 'var(--font-size-body)',
        color: 'var(--color-label)',
        backgroundColor: 'rgba(118,118,128,0.12)',
        borderRadius: 'inherit',
        border: 'none',
        outline: 'none',
        lineHeight: 1.5,
      }}
      data-testid={testId}
    />
  );
}
