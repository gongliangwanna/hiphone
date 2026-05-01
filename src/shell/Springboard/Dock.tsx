import { memo, useMemo } from 'react';
import { motion } from 'motion/react';
import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';
import { Material } from '@/system/Material';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import type { AppOrigin } from '@/platform/stores/appRuntimeStore';
import { spring } from '@/platform/design-tokens/motion';
import { DOCK_PAGE, type DockDragPreview } from './useIconDrag';

interface DockProps {
  apps: AppInfo[];
  metrics: SpringboardMetrics;
  reduceTransparency?: boolean;
  hideIconImages?: boolean;
  isEditMode?: boolean;
  /**
   * Active drag preview. `<Dock>` splices the dragged app in/out of its
   * rendered slot list so the user sees a live insertion gap (target side)
   * or compression (source side). When `null`, renders the static order.
   */
  dragPreview?: DockDragPreview | null;
  /**
   * Begin a drag from a Dock slot. Forwarded to `<AppIcon>` via the
   * existing `onDragStart` prop, with `pageIndex = DOCK_PAGE` so the hook
   * routes the gesture through its dock-source path.
   */
  onDragStart?: (
    pageIndex: number,
    localIndex: number,
    e: React.PointerEvent<HTMLElement>,
  ) => void;
  onOpen: (id: string, origin: AppOrigin) => void;
}

/** Spring used by reflow / insertion-gap layout animation inside the Dock. */
const DOCK_LAYOUT_TRANSITION = { type: 'spring' as const, ...spring.smooth };

export const Dock = memo(function Dock({
  apps,
  metrics,
  reduceTransparency = false,
  hideIconImages,
  isEditMode = false,
  dragPreview = null,
  onDragStart,
  onOpen,
}: DockProps) {
  /**
   * Apps as they appear under the current drag preview.
   *  - `fromIndex !== null` (source = dock) → splice out at fromIndex
   *  - `toIndex !== null` (target = dock) → splice in at toIndex
   *  - both null when the drag came from the grid AND the pointer is on the
   *    grid → the dock renders unchanged.
   *
   * `draggedApp` is rendered with `visibility: hidden` while it's the drag
   * source so the floating overlay is the only visible copy. For grid →
   * dock, the inserted app is fully visible (it's the live preview).
   */
  const effectiveApps = useMemo<AppInfo[]>(() => {
    if (!dragPreview) return apps;
    const { draggedApp, fromIndex, toIndex } = dragPreview;
    const next = [...apps];
    if (fromIndex !== null && fromIndex >= 0 && fromIndex < next.length) {
      next.splice(fromIndex, 1);
    }
    if (toIndex !== null && toIndex >= 0) {
      const clamped = Math.max(0, Math.min(toIndex, next.length));
      // Only insert if the dragged app isn't already in the surviving list
      // (avoids double-render when fromIndex !== null && toIndex !== null).
      if (!next.some((a) => a.id === draggedApp.id)) {
        next.splice(clamped, 0, draggedApp);
      }
    }
    return next;
  }, [apps, dragPreview]);

  // Hide the slot for whichever app is currently being dragged — whether
  // it originated in the Dock (`fromIndex !== null`) OR it's an incoming
  // grid app being previewed at `toIndex`. The floating DragOverlay is
  // the only visible copy in either case; without this guard, grid → dock
  // drags showed a duplicate icon (a static one in the dock slot AND the
  // floating one following the finger).
  const draggingAppId = dragPreview ? dragPreview.draggedApp.id : null;

  return (
    <div
      style={{
        paddingInline: 'var(--shell-side-padding)',
        paddingTop: `${Math.max(4, Math.ceil(metrics.dockPaddingY / 2))}px`,
        paddingBottom: `${metrics.dockPaddingY}px`,
        // In edit mode, kill the browser's default touch panning on this
        // region so touch drags from the Dock icons aren't stolen as a
        // scroll gesture before our pointer handlers can claim them.
        touchAction: isEditMode ? 'none' : undefined,
      }}
      data-testid="dock"
    >
      <Material
        variant="thick"
        disableBackdrop={reduceTransparency}
        className="flex items-center justify-around rounded-[var(--radius-card)] px-2 py-2"
        data-testid="dock-material"
      >
        {effectiveApps.map((app, index) => {
          const isBeingDragged = app.id === draggingAppId;
          return (
            // Mirror IconGrid's pattern: keep `motion.div` clean for the
            // `layout="position"` FLIP animation and put the visibility
            // hide on an INNER plain `<div>`. Putting `visibility: hidden`
            // directly on the motion element does not consistently hide
            // it during a layout animation — duplicate icon was visible
            // mid-reflow. The motion.div also gets `pointer-events: none`
            // so the hidden slot can't intercept the drag pointer.
            <motion.div
              key={app.id}
              layout="position"
              transition={DOCK_LAYOUT_TRANSITION}
              style={
                isBeingDragged ? { pointerEvents: 'none' } : undefined
              }
            >
              <div
                style={
                  isBeingDragged ? { visibility: 'hidden' } : undefined
                }
              >
                <AppIcon
                  app={app}
                  hideLabel
                  metrics={metrics}
                  hideIconImages={hideIconImages}
                  pageIndex={DOCK_PAGE}
                  localIndex={index}
                  isEditMode={isEditMode}
                  onDragStart={onDragStart}
                  onOpen={onOpen}
                />
              </div>
            </motion.div>
          );
        })}
      </Material>
    </div>
  );
});
