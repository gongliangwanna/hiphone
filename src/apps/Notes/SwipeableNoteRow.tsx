import { useCallback, useEffect, useRef } from 'react';
import { motion, useMotionValue, animate, type PanInfo } from 'motion/react';
import { Trash2 } from 'lucide-react';
import { spring } from '@/platform/design-tokens/motion';
import { format, isToday, isThisYear } from 'date-fns';
import type { Note } from './notesDataStore';

const OPEN_WIDTH = 80;
const AXIS_LOCK_THRESHOLD = 8;
const OPEN_SNAP_THRESHOLD = 40;
const VELOCITY_SNAP_THRESHOLD = 500;
const TAP_SUPPRESS_MS = 280;

function formatNoteDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isThisYear(date)) return format(date, 'M月d日');
  return format(date, 'yyyy/M/d');
}

interface SwipeableNoteRowProps {
  note: Note;
  isOpen: boolean;
  isLast: boolean;
  swipeable: boolean;
  onOpen: () => void;
  onCloseRequest: () => void;
  onTap: () => void;
  onDelete: () => void;
}

export function SwipeableNoteRow({
  note,
  isOpen,
  isLast,
  swipeable,
  onOpen,
  onCloseRequest,
  onTap,
  onDelete,
}: SwipeableNoteRowProps) {
  const x = useMotionValue(0);

  const baseXRef = useRef(0);
  const lockedAxisRef = useRef<'x' | 'y' | null>(null);
  const didPanRef = useRef(false);
  const lastPanEndAtRef = useRef(0);

  // Sync with external isOpen changes (e.g. another row opened)
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      x.set(isOpen ? -OPEN_WIDTH : 0);
      return;
    }
    const controls = animate(x, isOpen ? -OPEN_WIDTH : 0, spring.interactive);
    return () => controls.stop();
  }, [isOpen, x]);

  const handlePanStart = useCallback(() => {
    if (!swipeable) return;
    baseXRef.current = x.get();
    lockedAxisRef.current = null;
    didPanRef.current = false;
  }, [x, swipeable]);

  const handlePan = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!swipeable) return;
      const dx = info.offset.x;
      const dy = info.offset.y;

      if (lockedAxisRef.current === null) {
        const adx = Math.abs(dx);
        const ady = Math.abs(dy);
        if (adx < AXIS_LOCK_THRESHOLD && ady < AXIS_LOCK_THRESHOLD) return;
        lockedAxisRef.current = adx > ady ? 'x' : 'y';
        if (lockedAxisRef.current === 'y') return;
        didPanRef.current = true;
      }

      if (lockedAxisRef.current !== 'x') return;

      let next = baseXRef.current + dx;
      if (next > 0) {
        next = next * 0.3;
      } else if (next < -OPEN_WIDTH) {
        next = -OPEN_WIDTH + (next + OPEN_WIDTH) * 0.3;
      }
      x.set(next);
    },
    [x, swipeable],
  );

  const handlePanEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!swipeable) return;
      if (lockedAxisRef.current !== 'x') {
        lockedAxisRef.current = null;
        return;
      }
      lockedAxisRef.current = null;
      lastPanEndAtRef.current = Date.now();

      const currentX = x.get();
      const shouldOpen =
        currentX < -OPEN_SNAP_THRESHOLD ||
        info.velocity.x < -VELOCITY_SNAP_THRESHOLD;

      animate(x, shouldOpen ? -OPEN_WIDTH : 0, spring.interactive);

      if (shouldOpen) {
        onOpen();
      } else {
        onCloseRequest();
      }
    },
    [x, swipeable, onOpen, onCloseRequest],
  );

  const handleTap = useCallback(() => {
    if (didPanRef.current) {
      didPanRef.current = false;
      return;
    }
    if (Date.now() - lastPanEndAtRef.current < TAP_SUPPRESS_MS) {
      return;
    }
    onTap();
  }, [onTap]);

  return (
    <div
      className="relative"
      style={{ overflow: 'hidden', backgroundColor: 'var(--color-systemBackground)' }}
    >
      {/* Red delete button behind */}
      {swipeable && (
        <div
          className="absolute top-0 bottom-0 right-0 flex"
          style={{ width: OPEN_WIDTH }}
        >
          <button
            type="button"
            className="flex h-full w-full flex-col items-center justify-center"
            style={{
              backgroundColor: '#FF3B30',
              color: '#fff',
              gap: 2,
              WebkitUserSelect: 'none',
              userSelect: 'none',
            }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            data-testid={`note-delete-${note.id}`}
          >
            <Trash2 size={20} strokeWidth={2} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>删除</span>
          </button>
        </div>
      )}

      {/* Foreground draggable row */}
      <motion.div
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        onTap={handleTap}
        className="relative flex w-full flex-col justify-center text-left"
        style={{
          x,
          minHeight: 64,
          padding: '10px 16px',
          backgroundColor: 'var(--color-systemBackground)',
          WebkitUserSelect: 'none',
          userSelect: 'none',
          cursor: 'pointer',
          touchAction: 'pan-y',
        }}
        data-testid={`note-cell-${note.id}`}
      >
        <span
          className="truncate"
          style={{
            fontSize: 'var(--font-size-body)',
            fontWeight: 'var(--font-weight-semibold)',
            color: 'var(--color-label)',
            lineHeight: 1.3,
          }}
        >
          {note.title || '新建备忘录'}
        </span>
        <span
          className="flex gap-2 truncate"
          style={{
            fontSize: 'var(--font-size-subhead)',
            color: 'var(--color-secondaryLabel)',
            lineHeight: 1.4,
            marginTop: 2,
          }}
        >
          <span>{formatNoteDate(note.updatedAt)}</span>
          <span style={{ opacity: 0.6 }}>{note.body.slice(0, 50) || '无附加文本'}</span>
        </span>
        {!isLast && (
          <div
            className="absolute bottom-0 right-0"
            style={{
              left: 16,
              height: 0.5,
              backgroundColor: 'var(--color-separator)',
            }}
          />
        )}
      </motion.div>
    </div>
  );
}
