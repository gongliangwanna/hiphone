import { memo } from 'react';
import { motion, type MotionValue } from 'motion/react';
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
  /** MotionValue — position updates bypass React re-render. */
  x: MotionValue<number>;
  y: MotionValue<number>;
  /** True while the overlay is animating to the target grid cell. */
  isSettling?: boolean;
}

const COLS = 4;

/** Spring for the scale settle animation (drag release → grid snap). */
const SETTLE_TRANSITION = { type: 'spring' as const, ...spring.interactive };

/**
 * Floating widget ghost rendered during drag.
 *
 * Its footprint mirrors the widget's on-grid size (cellW × colSpan by
 * rowH × rowSpan) so the drop origin computed from the ghost's top-left
 * corner matches what the user sees under their finger.
 *
 * Position is driven by MotionValues — the hook animates them
 * imperatively (instant during drag, spring during settle).
 */
export const WidgetDragOverlay = memo(function WidgetDragOverlay({
  widget,
  metrics,
  viewportWidth,
  x,
  y,
  isSettling = false,
}: WidgetDragOverlayProps) {
  const Component = getWidgetComponent(widget.kind);
  if (!Component) return null;

  const cellW = (viewportWidth - metrics.sidePadding * 2) / COLS;
  const contentHeight = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;

  const cs = WIDGET_COL_SPAN[widget.size];
  const rs = WIDGET_ROW_SPAN[widget.size];

  return (
    <motion.div
      className="pointer-events-none absolute left-0 top-0 z-50"
      animate={{ scale: isSettling ? 1 : 1.03 }}
      transition={SETTLE_TRANSITION}
      style={{
        x,
        y,
        width: `${cellW * cs}px`,
        height: `${contentHeight * rs + metrics.gridGapY * (rs - 1)}px`,
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
