import { memo } from 'react';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import {
  WIDGET_COL_SPAN,
  WIDGET_ROW_SPAN,
  type WidgetInstance,
} from '@/platform/stores/springboardLayoutStore';
import { getWidgetComponent } from '@/shell/Widgets/registry';

interface WidgetDragOverlayProps {
  widget: WidgetInstance;
  metrics: SpringboardMetrics;
  viewportWidth: number;
  x: number;
  y: number;
}

const COLS = 4;

/**
 * Floating widget ghost rendered during drag.
 *
 * Its footprint mirrors the widget's on-grid size (cellW × colSpan by
 * rowH × rowSpan) so the drop origin computed from the ghost's top-left
 * corner matches what the user sees under their finger.
 */
export const WidgetDragOverlay = memo(function WidgetDragOverlay({
  widget,
  metrics,
  viewportWidth,
  x,
  y,
}: WidgetDragOverlayProps) {
  const Component = getWidgetComponent(widget.kind);
  if (!Component) return null;

  const cellW = (viewportWidth - metrics.sidePadding * 2) / COLS;
  const contentHeight = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
  const rowH = contentHeight + metrics.gridGapY;

  const cs = WIDGET_COL_SPAN[widget.size];
  const rs = WIDGET_ROW_SPAN[widget.size];

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{
        transform: `translate(${x}px, ${y}px) scale(1.05)`,
        width: `${cellW * cs}px`,
        height: `${rowH * rs}px`,
        padding: 4,
        boxSizing: 'border-box',
        willChange: 'transform',
        filter: 'drop-shadow(0 12px 32px rgba(0,0,0,0.4))',
      }}
      data-testid="widget-drag-overlay"
    >
      <Component size={widget.size} />
    </div>
  );
});
