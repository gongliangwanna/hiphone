import { memo, useMemo, type CSSProperties } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import type { AppOrigin } from '@/platform/stores/appRuntimeStore';
import {
  useSpringboardLayoutStore,
  type WidgetInstance,
} from '@/platform/stores/springboardLayoutStore';
import { getWidgetComponent } from '@/shell/Widgets/registry';
import {
  GRID_COLS,
  GRID_ROWS,
  packPage,
  tryMoveWidget,
} from '@/platform/stores/pagePacker';
import { spring } from '@/platform/design-tokens/motion';
import { useLongPress } from '@/platform/gesture/useLongPress';
import { PageIndexProvider } from '@/shell/Widgets/activePage';
import { X } from 'lucide-react';

/**
 * Snapshot of an active widget drag, shared with every IconGrid so each page
 * can decide whether to hide / insert / relocate the dragging widget in its
 * preview layout. See `Springboard.tsx` for the producer.
 */
export interface WidgetDragPreview {
  widget: WidgetInstance;
  fromPage: number;
  /** Current drop target (null during the very first frame of a drag). */
  target: { page: number; col: number; row: number } | null;
}

/**
 * Snapshot of an active app drag, shared symmetrically with `WidgetDragPreview`.
 * `IconGrid` uses it to compute an `effectiveApps` order so the row-major
 * packer (and Framer `layout` FLIP) reorder app icons in real time as the
 * user drags — apps "make way" the same way they did before C3 of M2.
 *
 * - **Source page**: drop the dragged app from `effectiveApps` (so other
 *   apps slide leftward into the gap).
 * - **Target page**: insert the dragged app at the drop index (so other apps
 *   slide rightward to make room).
 * - **Same source = target**: splice-out then splice-in for in-place reorder.
 * - **Other pages**: unchanged.
 */
export interface AppDragPreview {
  app: AppInfo;
  fromPage: number;
  /** The dragging app's index inside the source page's app list at drag start. */
  fromLocalIndex: number;
  /** Current drop target (null during the very first frame of a drag). */
  target: { page: number; localIndex: number } | null;
}

/** Entrance transition shared by newly-added widgets and apps. */
const ENTRANCE_TRANSITION = { type: 'spring' as const, ...spring.smooth };
/** Default slot transition — spring for layout FLIP, instant opacity.
 *  Only the `isEntering` path uses `ENTRANCE_TRANSITION` (spring opacity).
 *  Instant opacity prevents the "flash" on drag-end: the DragOverlay
 *  vanishes in the same frame the slot unhides, so a spring fade-in would
 *  show a brief transparent gap. */
const SLOT_TRANSITION = { ...ENTRANCE_TRANSITION, opacity: { duration: 0 } };

interface WidgetSlotProps {
  widget: WidgetInstance;
  colSpan: number;
  rowSpan: number;
  col: number;
  row: number;
  isEditMode: boolean;
  isEntering: boolean;
  isBeingDragged: boolean;
  pageIndex: number;
  onClearEntrance: () => void;
  onWidgetDragStart?: (pageIndex: number, widgetId: string, e: React.PointerEvent<HTMLElement>) => void;
  onRemoveWidget?: (pageIndex: number, widgetId: string) => void;
  enterEditMode: () => void;
}

/**
 * A single widget cell on the springboard grid.
 *
 * Pulled out as its own component so each slot owns its own `useLongPress`
 * hook — this avoids the "hooks in a loop" antipattern and lets gesture
 * state (timers, captured pointer ids) live per widget.
 *
 * Gesture behaviour mirrors `AppIcon`:
 *   - **Not in edit mode**: long-press (600ms) enters edit mode *and*
 *     initiates the drag in one gesture. Releasing before the timer just
 *     aborts; moving cancels too (via `useLongPress`'s move threshold).
 *   - **In edit mode**: pointerdown immediately begins the drag.
 *     `stopPropagation` keeps the page-swipe gesture from stealing it.
 */
function WidgetSlot({
  widget,
  colSpan,
  rowSpan,
  col,
  row,
  isEditMode,
  isEntering,
  isBeingDragged,
  pageIndex,
  onClearEntrance,
  onWidgetDragStart,
  onRemoveWidget,
  enterEditMode,
}: WidgetSlotProps) {
  const Component = getWidgetComponent(widget.kind);

  // Long-press only matters outside edit mode: entering edit mode is the
  // only side-effect that needs to fire before the drag. Inside edit mode
  // the pointerdown is immediate.
  const longPress = useLongPress(
    (e) => {
      enterEditMode();
      onWidgetDragStart?.(pageIndex, widget.id, e);
    },
    { delay: 600 },
  );

  if (!Component) return null;

  const handleEditPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    // Prevent the page-swipe gesture from hijacking the drag.
    e.stopPropagation();
    onWidgetDragStart?.(pageIndex, widget.id, e);
  };

  const style: CSSProperties = {
    gridColumnStart: col + 1,
    gridColumnEnd: `span ${colSpan}`,
    gridRowStart: row + 1,
    gridRowEnd: `span ${rowSpan}`,
    width: '100%',
    height: '100%',
    justifySelf: 'stretch',
    padding: 4,
    boxSizing: 'border-box',
    // Suppress pointer interaction while the floating overlay owns the drag.
    pointerEvents: isBeingDragged ? 'none' : undefined,
    // `touch-action: none` keeps iOS Safari from intercepting as page pan.
    touchAction: isEditMode ? 'none' : undefined,
  };

  return (
    <motion.div
      layout="position"
      initial={isEntering ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={isEntering ? ENTRANCE_TRANSITION : SLOT_TRANSITION}
      onLayoutAnimationComplete={isEntering ? onClearEntrance : undefined}
      className={`relative ${
        isEditMode
          ? (pageIndex + col + row) % 2 === 0
            ? 'springboard-jiggle'
            : 'springboard-jiggle-alt'
          : ''
      }`}
      style={style}
      onPointerDown={isEditMode ? handleEditPointerDown : longPress.onPointerDown}
      onPointerUp={isEditMode ? undefined : longPress.onPointerUp}
      onPointerCancel={isEditMode ? undefined : longPress.onPointerCancel}
      onClickCapture={longPress.onClick}
      data-testid={`widget-slot-${widget.id}`}
    >
      {/* Keep content always mounted — hide via wrapper visibility during
          drag so WidgetDragOverlay is the only visible copy. */}
      <div className="h-full" style={isBeingDragged ? { visibility: 'hidden' } : undefined}>
        <Component
          size={widget.size}
          styleIndex={widget.styleIndex ?? 0}
        />

        {isEditMode && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onRemoveWidget?.(pageIndex, widget.id)}
            className="absolute flex items-center justify-center"
            style={{
              top: -6,
              left: -6,
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: 'rgba(40,40,42,0.95)',
              border: '1px solid rgba(255,255,255,0.25)',
              color: 'white',
              zIndex: 2,
              cursor: 'pointer',
            }}
            data-testid={`widget-remove-${widget.id}`}
            aria-label="移除小组件"
          >
            <X size={14} strokeWidth={3} />
          </button>
        )}
      </div>
    </motion.div>
  );
}

interface IconGridProps {
  apps: AppInfo[];
  /** Widgets placed on this page (rendered before apps in DOM order). */
  widgets?: WidgetInstance[];
  metrics: SpringboardMetrics;
  viewportWidth: number;
  hideIconImages?: boolean;
  isEditMode?: boolean;
  /** Which page this grid represents */
  pageIndex: number;
  /**
   * Active app drag snapshot. When set, this grid computes an
   * `effectiveApps` order with the dragged app inserted at its drop target,
   * so the row-major packer reflows other apps live (Framer `layout` FLIP).
   * Null when no app drag is active.
   */
  appDragPreview?: AppDragPreview | null;
  /**
   * Active widget drag snapshot (source page + current drop target).
   * - Source page: hide the widget / relocate it to the preview origin so
   *   apps reflow around its new spot.
   * - Target page (cross-page): insert the widget at the preview origin.
   * - All other pages: no-op.
   * The store's `moveWidget` collision algebra is reused via `tryMoveWidget`
   * so the preview matches exactly what pointer-up will commit.
   */
  widgetDragPreview?: WidgetDragPreview | null;
  onDragStart?: (pageIndex: number, localIndex: number, e: React.PointerEvent<HTMLElement>) => void;
  /**
   * Begin a widget drag (called by the long-press gesture inside a widget
   * slot). Only wired in edit mode; IconGrid forwards its own `pageIndex`.
   */
  onWidgetDragStart?: (pageIndex: number, widgetId: string, e: React.PointerEvent<HTMLElement>) => void;
  onOpen: (id: string, origin: AppOrigin) => void;
  /** Remove a widget from this page (only called in edit mode). */
  onRemoveWidget?: (pageIndex: number, widgetId: string) => void;
}

/**
 * Page grid renderer for the springboard.
 *
 * Runs the pure `packPage` packer against this page's widgets + apps to
 * resolve every slot's explicit `(col, row)` origin on the 4-col × 5-row
 * grid. Each slot is then placed with `gridColumnStart` / `gridRowStart`
 * so there's no reliance on `grid-auto-flow: dense` — the layout is fully
 * deterministic and matches what the drag system computes from pointer
 * coordinates.
 *
 * Shift animations during drag are handled by Framer Motion's `layout`
 * prop (added in C4). This component intentionally does not compute
 * per-slot transform overrides; the dragged item is hidden via
 * `visibility: hidden` and the surviving slots FLIP to their new spots.
 */
export const IconGrid = memo(function IconGrid({
  apps,
  widgets = [],
  metrics,
  viewportWidth: _viewportWidth,
  hideIconImages,
  isEditMode = false,
  pageIndex,
  appDragPreview = null,
  widgetDragPreview = null,
  onDragStart,
  onWidgetDragStart,
  onOpen,
  onRemoveWidget,
}: IconGridProps) {
  const contentHeight = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;

  // Subscribe to the "just added" id so the matching slot plays the entrance
  // animation exactly once. `clearRecentlyAdded` is fired from the slot's
  // onAnimationComplete so re-renders after the animation don't replay it.
  const recentlyAddedItemId = useSpringboardLayoutStore(
    (s) => s.recentlyAddedItemId,
  );
  const clearRecentlyAdded = useSpringboardLayoutStore(
    (s) => s.clearRecentlyAdded,
  );
  const enterEditMode = useSpringboardLayoutStore((s) => s.enterEditMode);

  /**
   * Widgets as they appear under the current drag preview. Equivalent to
   * `widgets` when no drag is active. During a widget drag:
   *
   *   - Source-and-target page (same-page drag) → `tryMoveWidget` relocates
   *     the dragging widget and shifts any colliders. Apps reflow via
   *     `packPage` below.
   *   - Source page in a cross-page drag → the widget is filtered out so
   *     its cells free up on this page.
   *   - Target page in a cross-page drag → the widget is inserted at the
   *     preview origin and collisions resolved.
   *
   * If `tryMoveWidget` returns `null` (impossible displacement), we fall
   * back to the unmodified widgets so the layout stays sensible — the store
   * will also reject the move at pointer-up, keeping the two in sync.
   */
  const effectiveWidgets = useMemo<WidgetInstance[]>(() => {
    if (!widgetDragPreview) return widgets;
    const { widget, fromPage, target } = widgetDragPreview;
    const isSource = fromPage === pageIndex;
    const isTarget = target !== null && target.page === pageIndex;

    if (isSource && isTarget) {
      const result = tryMoveWidget(widgets, widget.id, target.col, target.row);
      return (result as WidgetInstance[] | null) ?? widgets;
    }
    if (isSource) {
      return widgets.filter((w) => w.id !== widget.id);
    }
    if (isTarget) {
      const inserted: WidgetInstance[] = [
        ...widgets,
        { ...widget, col: target.col, row: target.row },
      ];
      const result = tryMoveWidget(inserted, widget.id, target.col, target.row);
      return (result as WidgetInstance[] | null) ?? widgets;
    }
    return widgets;
  }, [widgets, widgetDragPreview, pageIndex]);

  // Id of the widget whose slot should be rendered but hidden (the floating
  // `WidgetDragOverlay` owns the visible representation).
  const draggingWidgetId = widgetDragPreview?.widget.id ?? null;

  /**
   * Apps as they appear under the current drag preview. Mirrors
   * `effectiveWidgets`. The row-major packer renders this order, so any
   * app whose grid cell changes is FLIP-animated by Framer's `layout` prop.
   *
   *   - same source = target page (in-page reorder) → splice-out + splice-in
   *   - source page only (cross-page drag) → splice-out, neighbors slide in
   *   - target page only (cross-page drag) → splice-in, neighbors slide out
   *   - other pages → unchanged reference (no re-pack)
   */
  const effectiveApps = useMemo<AppInfo[]>(() => {
    if (!appDragPreview) return apps;
    const { app: dragged, fromPage, fromLocalIndex, target } = appDragPreview;
    const isSource = fromPage === pageIndex;
    const isTarget = target !== null && target.page === pageIndex;

    if (isSource && isTarget) {
      // Same-page reorder: remove from source, then insert at target index
      // (clamped after the removal — this matches `moveApp` in the store).
      const next = [...apps];
      next.splice(fromLocalIndex, 1);
      const insertAt = Math.max(0, Math.min(target.localIndex, next.length));
      next.splice(insertAt, 0, dragged);
      return next;
    }
    if (isSource) {
      const next = [...apps];
      next.splice(fromLocalIndex, 1);
      return next;
    }
    if (isTarget) {
      const next = [...apps];
      const insertAt = Math.max(0, Math.min(target.localIndex, next.length));
      next.splice(insertAt, 0, dragged);
      return next;
    }
    return apps;
  }, [apps, appDragPreview, pageIndex]);

  // Id of the app whose slot should be rendered but hidden (DragOverlay owns
  // the visible representation). Identifying by id, not by index, lets us
  // safely render the dragged app at its NEW position in `effectiveApps`.
  const draggingAppId = appDragPreview?.app.id ?? null;

  // Run the packer once per change in inputs. The packer is pure and fast
  // (O(cells × items) per page), so memoizing it keeps re-renders cheap.
  const placements = useMemo(
    () => packPage(effectiveWidgets, effectiveApps.map((a) => a.id)),
    [effectiveWidgets, effectiveApps],
  );

  // Look up app metadata by id — cheaper than threading index math.
  const appById = useMemo(() => {
    const map = new Map<string, AppInfo>();
    for (const a of effectiveApps) map.set(a.id, a);
    return map;
  }, [effectiveApps]);

  return (
    <PageIndexProvider pageIndex={pageIndex}>
    <div
      className="grid justify-items-center"
      style={{
        gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
        gridTemplateRows: `repeat(${GRID_ROWS}, ${contentHeight}px)`,
        rowGap: `${metrics.gridGapY}px`,
        alignItems: 'start',
        // Belt-and-braces with the per-page `contain` in Springboard.tsx —
        // also keeps Framer `layout` FLIP measurements local to this grid
        // and prevents widget tick paints from leaking outward.
        contain: 'layout paint',
      }}
      data-testid="icon-grid"
    >
      {/*
        `initial={false}` keeps all already-present slots from playing the
        entrance animation on cold start (persistence restore). Only slots
        whose id matches `recentlyAddedItemId` opt back into an `initial` by
        reading it from the store below.
      */}
      <AnimatePresence initial={false}>
        {placements.widgetPlacements.map((p) => {
          // Read from `effectiveWidgets` so cross-page drag inserts resolve.
          const widget = effectiveWidgets.find((w) => w.id === p.id);
          if (!widget) return null;
          return (
            <WidgetSlot
              key={widget.id}
              widget={widget}
              col={p.col}
              row={p.row}
              colSpan={p.colSpan}
              rowSpan={p.rowSpan}
              isEditMode={isEditMode}
              isEntering={widget.id === recentlyAddedItemId}
              isBeingDragged={widget.id === draggingWidgetId}
              pageIndex={pageIndex}
              onClearEntrance={clearRecentlyAdded}
              onWidgetDragStart={onWidgetDragStart}
              onRemoveWidget={onRemoveWidget}
              enterEditMode={enterEditMode}
            />
          );
        })}

        {placements.appPlacements.map((p, localIndex) => {
          const app = appById.get(p.id);
          if (!app) return null;
          // Identify by id, not by index — the dragged app may have moved to
          // a different `localIndex` inside `effectiveApps`, but it's still
          // the same instance and must stay hidden until pointer-up.
          const isBeingDragged = app.id === draggingAppId;
          const isEntering = app.id === recentlyAddedItemId;

          return (
            <motion.div
              key={app.id}
              layout="position"
              initial={isEntering ? { scale: 0.6, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={isEntering ? ENTRANCE_TRANSITION : SLOT_TRANSITION}
              onLayoutAnimationComplete={
                isEntering ? clearRecentlyAdded : undefined
              }
              style={{
                gridColumnStart: p.col + 1,
                gridRowStart: p.row + 1,
                pointerEvents: isBeingDragged ? 'none' : undefined,
              }}
            >
              {/*
                Keep AppIcon always mounted so the slot never changes
                dimensions — this gives the dragged slot the exact same
                render path as neighbouring slots (no mount/unmount, no
                FLIP size delta, no paint-frame gap). During drag the
                DragOverlay owns the visual; this wrapper just hides the
                grid copy via `visibility: hidden`.
              */}
              <div style={isBeingDragged ? { visibility: 'hidden' } : undefined}>
                <AppIcon
                  app={app}
                  metrics={metrics}
                  hideIconImages={hideIconImages}
                  pageIndex={pageIndex}
                  localIndex={localIndex}
                  isEditMode={isEditMode}
                  onDragStart={onDragStart}
                  onOpen={onOpen}
                />
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
    </PageIndexProvider>
  );
});
