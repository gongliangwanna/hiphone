import type { ReactNode } from 'react';
import { useRef, useCallback } from 'react';

interface SliderProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (v: number) => void;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  showValue?: boolean;
  valueFormatter?: (v: number) => string;
  testId?: string;
}

/** iOS-style horizontal slider with optional side icons */
export function Slider({
  value,
  min = 0,
  max = 1,
  step = 0.01,
  onChange,
  leftIcon,
  rightIcon,
  showValue = false,
  valueFormatter,
  testId,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  const pct = ((value - min) / (max - min)) * 100;

  const resolveValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const raw = min + ratio * (max - min);
      const stepped = Math.round(raw / step) * step;
      onChange(Math.max(min, Math.min(max, stepped)));
    },
    [min, max, step, onChange],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);
      resolveValue(e.clientX);
    },
    [resolveValue],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return;
      resolveValue(e.clientX);
    },
    [resolveValue],
  );

  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      {leftIcon && <span className="flex-shrink-0 opacity-60">{leftIcon}</span>}
      <div
        ref={trackRef}
        className="relative flex-1"
        style={{ height: 28, cursor: 'pointer' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        {/* Track background */}
        <div
          className="absolute rounded-full"
          style={{
            top: 12,
            left: 0,
            right: 0,
            height: 4,
            backgroundColor: 'rgba(120,120,128,0.16)',
          }}
        />
        {/* Track fill */}
        <div
          className="absolute rounded-full"
          style={{
            top: 12,
            left: 0,
            width: `${pct}%`,
            height: 4,
            backgroundColor: 'var(--color-systemBlue)',
          }}
        />
        {/* Thumb */}
        <div
          className="absolute rounded-full bg-white"
          style={{
            width: 28,
            height: 28,
            top: 0,
            left: `calc(${pct}% - 14px)`,
            boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          }}
        />
      </div>
      {rightIcon && <span className="flex-shrink-0 opacity-60">{rightIcon}</span>}
      {showValue && (
        <span
          className="flex-shrink-0 tabular-nums"
          style={{
            width: 42,
            textAlign: 'right',
            fontSize: 'var(--font-size-callout)',
            color: 'var(--color-secondaryLabel)',
          }}
        >
          {valueFormatter ? valueFormatter(value) : value.toFixed(step < 1 ? 2 : 0)}
        </span>
      )}
    </div>
  );
}
