import { Locate, LocateFixed, Layers } from 'lucide-react';
import { Material } from '@/system';

// ---------------------------------------------------------------------------
// MapControls — floating right-side grouped buttons (iOS Maps style)
// ---------------------------------------------------------------------------

interface MapControlsProps {
  onLocate: () => void;
  isLocating: boolean;
}

export function MapControls({ onLocate, isLocating }: MapControlsProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(var(--app-safe-top, 48px) + 56px)',
        right: 12,
        zIndex: 20,
      }}
    >
      <Material
        variant="chrome"
        className="flex flex-col"
        style={{
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 2px 12px rgba(0,0,0,0.1)',
          border: '0.5px solid var(--color-separator)',
        }}
      >
        <ControlButton ariaLabel="图层">
          <Layers size={22} strokeWidth={2} />
        </ControlButton>
        
        <div style={{ height: 0.5, backgroundColor: 'var(--color-separator)', width: '100%' }} />

        <ControlButton onClick={onLocate} ariaLabel="定位">
          {isLocating ? (
            <LocateFixed size={22} strokeWidth={2} color="#007AFF" />
          ) : (
            <Locate size={22} strokeWidth={2} />
          )}
        </ControlButton>
      </Material>
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
    <div
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
    </div>
  );
}
