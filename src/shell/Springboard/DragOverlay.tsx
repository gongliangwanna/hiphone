import { memo } from 'react';
import type { AppInfo } from './apps.data';
import type { SpringboardMetrics } from '../Device/viewportProfile';

interface DragOverlayProps {
  app: AppInfo;
  metrics: SpringboardMetrics;
  x: number;
  y: number;
  hideIconImages?: boolean;
}

/**
 * Floating icon rendered during drag.
 * Uses position:absolute within the gesture area so it's not clipped by overflow:hidden.
 */
export const DragOverlay = memo(function DragOverlay({
  app,
  metrics,
  x,
  y,
  hideIconImages,
}: DragOverlayProps) {
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-50"
      style={{
        transform: `translate(${x}px, ${y}px) scale(1.1)`,
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
    </div>
  );
});
