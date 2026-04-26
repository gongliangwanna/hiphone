import React from 'react';
import { X } from 'lucide-react';

export interface SourcePanelProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const CONTAINER_STYLE: React.CSSProperties = {
  position: 'relative',
  margin: '0 16px',
  backgroundColor: 'var(--color-tertiarySystemBackground)',
  borderRadius: 12,
  padding: 12,
  minHeight: 140,
};

const TEXTAREA_STYLE: React.CSSProperties = {
  width: '100%',
  height: '100%',
  minHeight: 116,
  border: 'none',
  outline: 'none',
  resize: 'none',
  background: 'transparent',
  fontSize: 17,
  lineHeight: 1.4,
  color: 'var(--color-label)',
  fontFamily: 'inherit',
};

const CLEAR_BTN_STYLE: React.CSSProperties = {
  position: 'absolute',
  right: 8,
  top: 8,
  width: 28,
  height: 28,
  borderRadius: 14,
  border: 'none',
  backgroundColor: 'var(--color-tertiarySystemFill)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  color: 'var(--color-secondaryLabel)',
};

export function SourcePanel({
  value,
  onChange,
  placeholder = '输入要翻译的文本',
  disabled,
}: SourcePanelProps) {
  return (
    <div style={CONTAINER_STYLE}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        rows={5}
        style={TEXTAREA_STYLE}
      />
      {value.length > 0 && !disabled && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="清空"
          style={CLEAR_BTN_STYLE}
        >
          <X size={16} strokeWidth={2.2} />
        </button>
      )}
    </div>
  );
}
