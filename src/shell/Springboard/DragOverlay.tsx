import { memo } from 'react';
import { motion } from 'motion/react';
import type { AppInfo } from './apps.data';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import { spring } from '@/platform/design-tokens/motion';

interface DragOverlayProps {
  app: AppInfo;
  metrics: SpringboardMetrics;
  x: number;
  y: number;
  hideIconImages?: boolean;
  /** True while the overlay is animating to the target grid cell. */
  isSettling?: boolean;
  /** Fired when the settle spring animation completes. */
  onSettleComplete?: () => void;
}

/** Instant positioning for finger-following during drag. */
const DRAG_TRANSITION = { duration: 0 };
/** Spring for the settle animation (drag release → grid snap). */
const SETTLE_TRANSITION = { type: 'spring' as const, ...spring.interactive };

/**
 * Floating icon rendered during drag.
 * Uses position:absolute within the gesture area so it's not clipped by overflow:hidden.
 *
 * When `isSettling` is true, the overlay springs from its drag-release
 * position to the computed target grid cell, then fires `onSettleComplete`
 * so the caller can remove the overlay and reveal the placed icon.
 */
export const DragOverlay = memo(function DragOverlay({
  app,
  metrics,
  x,
  y,
  hideIconImages,
  isSettling = false,
  onSettleComplete,
}: DragOverlayProps) {
  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-50"
      animate={{
        x,
        y,
        scale: isSettling ? 1 : 1.1,
      }}
      transition={isSettling ? SETTLE_TRANSITION : DRAG_TRANSITION}
      onAnimationComplete={isSettling ? onSettleComplete : undefined}
      style={{
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
