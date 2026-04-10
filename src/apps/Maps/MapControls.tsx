import { Material } from '@/system';

// ---------------------------------------------------------------------------
// SF-Symbol–style SVG icons (stroke, round linecap, 1.5-2px)
// ---------------------------------------------------------------------------

function IconLocation({ active }: { active?: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      {active ? (
        <path
          d="M12 2L12 5M12 19L12 22M2 12L5 12M19 12L22 12"
          stroke="#007AFF"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="M12 2L12 5M12 19L12 22M2 12L5 12M19 12L22 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
      <circle
        cx="12" cy="12" r="5"
        stroke={active ? '#007AFF' : 'currentColor'}
        strokeWidth="2"
        fill={active ? '#007AFF' : 'none'}
      />
      {active && <circle cx="12" cy="12" r="2.5" fill="white" />}
    </svg>
  );
}

function IconCompass() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <polygon points="12,5 14,12 12,19 10,12" fill="currentColor" opacity="0.7" />
      <polygon points="12,5 14,12 12,12 10,12" fill="#FF3B30" />
      <text x="12" y="3.5" textAnchor="middle" fill="#FF3B30" fontSize="4.5" fontWeight="700">N</text>
    </svg>
  );
}

function IconStack() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 3L3 8L12 13L21 8L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M3 12L12 17L21 12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 16L12 21L21 16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// MapControls — floating right-side buttons
// ---------------------------------------------------------------------------

interface MapControlsProps {
  onLocate: () => void;
  isLocating: boolean;
}

export function MapControls({ onLocate, isLocating }: MapControlsProps) {
  return (
    <div
      className="flex flex-col"
      style={{
        position: 'absolute',
        top: 'calc(var(--app-safe-top, 48px) + 56px)',
        right: 12,
        zIndex: 20,
        gap: 1,
      }}
    >
      <ControlButton onClick={onLocate} ariaLabel="定位">
        <IconLocation active={isLocating} />
      </ControlButton>
      <div style={{ height: 0.5, background: 'var(--color-separator)', margin: '0 6px' }} />
      <ControlButton ariaLabel="指南针">
        <IconCompass />
      </ControlButton>
      <div style={{ height: 0.5, background: 'var(--color-separator)', margin: '0 6px' }} />
      <ControlButton ariaLabel="图层">
        <IconStack />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  children,
  onClick,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  ariaLabel: string;
}) {
  return (
    <Material
      variant="chrome"
      className="flex items-center justify-center"
      style={{
        width: 44,
        height: 44,
        color: 'var(--color-label)',
        cursor: 'pointer',
      }}
      onClick={onClick}
      role="button"
      aria-label={ariaLabel}
    >
      {children}
    </Material>
  );
}
