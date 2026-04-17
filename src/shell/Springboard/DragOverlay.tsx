import { memo } from 'react';
import { motion, type MotionValue } from 'motion/react';
import type { AppInfo } from './apps.data';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import { spring } from '@/platform/design-tokens/motion';

interface DragOverlayProps {
  app: AppInfo;
  metrics: SpringboardMetrics;
  /** MotionValue — position updates bypass React re-render. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  hideIconImages?: boolean;
  /** True while the overlay is animating to the target grid cell. */
  isSettling?: boolean;
}

/** Spring for the scale settle animation (drag release → grid snap). */
const SETTLE_TRANSITION = { type: 'spring' as const, ...spring.interactive };

/**
 * Floating icon rendered during drag.
 * Uses position:absolute within the gesture area so it's not clipped by overflow:hidden.
 *
 * Position is driven by MotionValues in `style` — the parent hook animates
 * them imperatively (instant `.set()` during drag, spring `animate()` during
 * settle). This component only re-renders when `isSettling` or `app` change,
 * not on every pointermove.
 */
export const DragOverlay = memo(function DragOverlay({
  app,
  metrics,
  x,
  y,
  hideIconImages,
  isSettling = false,
}: DragOverlayProps) {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-50"
      animate={{ scale: isSettling ? 1 : 1.1 }}
      transition={SETTLE_TRANSITION}
      style={{
        x,
        y,
        width: `${metrics.iconSize}px`,
        height: `${metrics.iconSize}px`,
        willChange: 'transform',
        filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))',
      }}
      data-testid="drag-overlay"
    >
      <div
        className="h-full w-full overflow-hidden"
        style={{ borderRadius: 'var(--radius-icon)' }}
      >
        {hideIconImages ? (
          <div className="h-full w-full bg-gray-400" />
        ) : (
          <img
            src={app.icon}
            alt={app.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
      </div>
    </motion.div>
  );
});
