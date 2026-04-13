import { memo } from 'react';
import { motion } from 'motion/react';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import {
  WIDGET_COL_SPAN,
  WIDGET_ROW_SPAN,
  type WidgetInstance,
} from '@/platform/stores/springboardLayoutStore';
import { getWidgetComponent } from '@/shell/Widgets/registry';
import { spring } from '@/platform/design-tokens/motion';

interface WidgetDragOverlayProps {
  widget: WidgetInstance;
  metrics: SpringboardMetrics;
  viewportWidth: number;
  x: number;
  y: number;
  /** True while the overlay is animating to the target grid cell. */
  isSettling?: boolean;
  /** Fired when the settle spring animation completes. */
  onSettleComplete?: () => void;
}

const COLS = 4;

/** Instant positioning for finger-following during drag. */
const DRAG_TRANSITION = { duration: 0 };
/** Spring for the settle animation (drag release → grid snap). */
const SETTLE_TRANSITION = { type: 'spring' as const, ...spring.interactive };

/**
 * Floating widget ghost rendered during drag.
 *
 * Its footprint mirrors the widget's on-grid size (cellW × colSpan by
 * rowH × rowSpan) so the drop origin computed from the ghost's top-left
 * corner matches what the user sees under their finger.
 *
 * When `isSettling` is true, the overlay springs from its drag-release
 * position to the computed target grid cell, then fires `onSettleComplete`
 * so the caller can remove the overlay and reveal the placed widget.
 */
export const WidgetDragOverlay = memo(function WidgetDragOverlay({
  widget,
  metrics,
  viewportWidth,
  x,
  y,
  isSettling = false,
  onSettleComplete,
}: WidgetDragOverlayProps) {
  const Component = getWidgetComponent(widget.kind);
  if (!Component) return null;

  const cellW = (viewportWidth - metrics.sidePadding * 2) / COLS;
  const contentHeight = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
  const rowH = contentHeight + metrics.gridGapY;

  const cs = WIDGET_COL_SPAN[widget.size];
  const rs = WIDGET_ROW_SPAN[widget.size];

  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-50"
      animate={{
        x,
        y,
      }}
      transition={isSettling ? SETTLE_TRANSITION : DRAG_TRANSITION}
      onAnimationComplete={isSettling ? onSettleComplete : undefined}
      style={{
        width: `${cellW * cs}px`,
        height: `${rowH * rs}px`,
        padding: 4,
        boxSizing: 'border-box',
        willChange: 'transform',
        filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.4))',
      }}
      data-testid="widget-drag-overlay"
    >
      <Component size={widget.size} styleIndex={widget.styleIndex ?? 0} />
    </motion.div>
  );
});
