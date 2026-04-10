interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}

/** iOS-style toggle switch (31×18 capsule) */
export function Toggle({ value, onChange, disabled = false, testId }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => onChange(!value)}
      className="relative flex-shrink-0"
      style={{
        width: 51,
        height: 31,
        borderRadius: 31,
        backgroundColor: value ? 'var(--color-systemGreen)' : 'rgba(120,120,128,0.16)',
        transition: 'background-color 0.2s ease',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
      data-testid={testId}
    >
      <span
        className="absolute block rounded-full bg-white shadow-sm"
        style={{
          width: 27,
          height: 27,
          top: 2,
          left: value ? 22 : 2,
          transition: 'left 0.2s ease',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );
}
