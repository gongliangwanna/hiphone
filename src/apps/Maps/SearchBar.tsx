import { useRef } from 'react';
import { Material } from '@/system';

// ---------------------------------------------------------------------------
// SF Symbol search icon
// ---------------------------------------------------------------------------

function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="10.5" cy="10.5" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M15.5 15.5L21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconClear({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center"
      style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--color-tertiaryFill)', border: 'none', cursor: 'pointer', flexShrink: 0 }}
    >
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
        <path d="M2 2L10 10M10 2L2 10" stroke="var(--color-secondaryLabel)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}

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
        <span style={{ color: 'var(--color-tertiaryLabel)', flexShrink: 0 }}>
          <IconSearch />
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
        {value.length > 0 && <IconClear onClick={handleClear} />}
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
