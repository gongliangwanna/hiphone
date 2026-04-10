import { useRef, useEffect, useCallback, useLayoutEffect } from 'react';

export interface WheelPickerItem {
  value: string;
  label: string;
}

interface WheelPickerProps {
  items: WheelPickerItem[];
  value: string;
  onChange: (value: string) => void;
  /** Height of each item in pixels. Default 40. */
  itemHeight?: number;
  /** Number of visible rows (must be odd). Default 7. */
  visibleCount?: number;
}

const SCROLL_END_DELAY = 80;

/**
 * iOS-style drum-roller wheel picker.
 *
 * Uses native scroll + scroll-snap for momentum physics.
 * Per-item opacity/scale applied via direct DOM manipulation (60 fps).
 */
export function WheelPicker({
  items,
  value,
  onChange,
  itemHeight = 40,
  visibleCount = 7,
}: WheelPickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const itemElsRef = useRef<(HTMLDivElement | null)[]>([]);
  const endTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const suppressRef = useRef(false);
  const mountedRef = useRef(false);

  const containerHeight = itemHeight * visibleCount;
  const half = Math.floor(visibleCount / 2);
  const paddingY = half * itemHeight;

  const findIdx = useCallback(
    (v: string) => {
      const idx = items.findIndex((i) => i.value === v);
      return idx >= 0 ? idx : 0;
    },
    [items],
  );

  // Per-item visual transforms — called on every scroll frame
  const applyVisuals = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const center = el.scrollTop / itemHeight;

    for (let i = 0; i < itemElsRef.current.length; i++) {
      const node = itemElsRef.current[i];
      if (!node) continue;
      const d = Math.abs(i - center);
      node.style.opacity = String(Math.max(0.12, 1 - d * 0.3));
      node.style.transform = `scale(${Math.max(0.85, 1 - d * 0.04)})`;
    }
  }, [itemHeight]);

  // Mount: instant jump to value
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = findIdx(value) * itemHeight;
    applyVisuals();
    requestAnimationFrame(() => {
      mountedRef.current = true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value change → smooth scroll
  useEffect(() => {
    if (!mountedRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const target = findIdx(value) * itemHeight;
    if (Math.abs(el.scrollTop - target) < 2) return;
    suppressRef.current = true;
    el.scrollTo({ top: target, behavior: 'smooth' });
    const t = setTimeout(() => {
      suppressRef.current = false;
      applyVisuals();
    }, 280);
    return () => clearTimeout(t);
  }, [value, findIdx, itemHeight, applyVisuals]);

  // Scroll handler: update visuals + debounced snap → onChange
  const onScroll = useCallback(() => {
    applyVisuals();
    clearTimeout(endTimer.current);
    endTimer.current = setTimeout(() => {
      if (suppressRef.current) return;
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / itemHeight);
      const clamped = Math.max(0, Math.min(items.length - 1, idx));
      if (items[clamped] && items[clamped].value !== value) {
        onChange(items[clamped].value);
      }
    }, SCROLL_END_DELAY);
  }, [items, itemHeight, value, onChange, applyVisuals]);

  return (
    <div
      className="relative overflow-hidden"
      style={{ height: containerHeight, minWidth: 0 }}
    >
      {/* Center highlight band */}
      <div
        className="pointer-events-none absolute"
        style={{
          left: 3,
          right: 3,
          top: half * itemHeight,
          height: itemHeight,
          borderRadius: 9,
          backgroundColor: 'var(--color-tertiarySystemFill)',
        }}
      />

      {/* Scrollable wheel */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="scrollbar-hide absolute inset-0"
        style={{
          overflowY: 'auto',
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{ height: paddingY }} />
        {items.map((item, i) => (
          <div
            key={item.value}
            ref={(el) => {
              itemElsRef.current[i] = el;
            }}
            style={{
              height: itemHeight,
              scrollSnapAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              fontWeight: 400,
              fontVariantNumeric: 'tabular-nums',
              color: 'var(--color-label)',
              userSelect: 'none',
              willChange: 'transform, opacity',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
          </div>
        ))}
        <div style={{ height: paddingY }} />
      </div>
    </div>
  );
}
