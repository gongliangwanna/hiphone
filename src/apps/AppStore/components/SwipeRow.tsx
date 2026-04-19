import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  onDelete: () => void;
  deleteLabel?: string;
}

const ACTION_WIDTH = 92;
const THRESHOLD = 32;

export function SwipeRow({ children, onDelete, deleteLabel = '卸载' }: Props) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    startX.current = e.clientX;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const delta = e.clientX - startX.current;
    const base = open ? -ACTION_WIDTH : 0;
    const next = Math.min(0, Math.max(-ACTION_WIDTH, base + delta));
    setOffset(next);
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    setOffset((current) => {
      const shouldOpen = current < -THRESHOLD;
      setOpen(shouldOpen);
      return shouldOpen ? -ACTION_WIDTH : 0;
    });
  };

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        data-testid="swipe-delete-action"
        aria-label={deleteLabel}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 text-white bg-[var(--color-systemRed)] min-h-[44px]"
        style={{ width: ACTION_WIDTH }}
      >
        <Trash2 size={18} strokeWidth={2} />
        <span className="text-[13px]">{deleteLabel}</span>
      </button>
      <div
        data-testid="swipe-row-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative bg-[var(--color-background)] touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging.current ? 'none' : 'transform 180ms ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
}
