import { useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Material } from '@/system';

// ---------------------------------------------------------------------------
// SearchBar
// ---------------------------------------------------------------------------

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onFocus: () => void;
  onCancel: () => void;
  isFocused: boolean;
}

export function SearchBar({ value, onChange, onFocus, onCancel, isFocused }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const handleCancel = () => {
    onChange('');
    inputRef.current?.blur();
    onCancel();
  };

  return (
    <div
      className="flex items-center"
      style={{
        padding: '0 16px',
        gap: 10,
      }}
    >
      <Material
        variant="thin"
        className="flex flex-1 items-center"
        style={{
          height: 36,
          borderRadius: 10,
          padding: '0 10px',
          gap: 6,
          backgroundColor: 'var(--color-tertiarySystemFill)',
        }}
      >
        <span style={{ color: 'var(--color-tertiaryLabel)', flexShrink: 0, display: 'flex' }}>
          <Search size={16} strokeWidth={2} />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          placeholder="搜索地图"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 17,
            color: 'var(--color-label)',
            lineHeight: '36px',
            padding: 0,
            minWidth: 0,
          }}
        />
        {value.length > 0 && (
          <button
            onClick={handleClear}
            className="flex items-center justify-center"
            style={{
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'var(--color-tertiaryLabel)',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          >
            <X size={10} strokeWidth={3} color="var(--color-systemBackground)" />
          </button>
        )}
      </Material>

      {isFocused && (
        <button
          onClick={handleCancel}
          style={{
            border: 'none',
            background: 'none',
            color: 'var(--color-systemBlue)',
            fontSize: 17,
            padding: 0,
            cursor: 'pointer',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          取消
        </button>
      )}
    </div>
  );
}
