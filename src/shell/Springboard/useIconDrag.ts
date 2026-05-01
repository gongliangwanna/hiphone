import { useCallback, useEffect, useRef, useState } from 'react';
import { useMotionValue, animate as motionAnimate } from 'motion/react';
import type { AppInfo } from './apps.data';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import { spring } from '@/platform/design-tokens/motion';
import {
  clampOrigin,
  packPage,
  type PackerWidget,
} from '@/platform/stores/pagePacker';
import {
  DOCK_CAPACITY,
  useSpringboardLayoutStore,
  type WidgetInstance,
  type WidgetSize,
} from '@/platform/stores/springboardLayoutStore';

const COLS = 4;
const ROWS = 5;
const EDGE_ZONE = 40;
const AUTO_SCROLL_DELAY = 400;

/**
 * Sentinel page index meaning "this position lives in the Dock, not on a
 * grid page." Reusing `DragPosition` lets us thread dock drag state through
 * the existing app-drag pipeline without a parallel state shape.
 */
export const DOCK_PAGE = -1;

export interface DragPosition {
  page: number;
  localIndex: number;
}

/** Widget drop target resolved from the ghost's current top-left corner. */
export interface WidgetDropTarget {
  page: number;
  col: number;
  row: number;
}

interface WidgetDragMeta {
  widget: WidgetInstance;
  fromPage: number;
}

interface UseIconDragOptions {
  pages: AppInfo[][];
  /** Widgets per page. Used to resolve which widget was grabbed by id. */
  widgetPages?: WidgetInstance[][];
  /**
   * Apps currently in the Dock, in display order. Lets the drag pipeline
   * (a) resolve the dragged app when the source is the Dock, and (b)
   * compute drop-target slot indices when the pointer is over the Dock.
   */
  dockApps?: AppInfo[];
  metrics: SpringboardMetrics;
  viewportWidth: number;
  currentPage: number;
  totalPages: number;
  goToPage: (page: number) => void;
  /** Cancel any active page-swipe gesture (prevents conflict with icon drag) */
  cancelSwipe: () => void;
  gestureAreaRef: React.RefObject<HTMLDivElement | null>;
  onRequestExtraPage?: () => void;
}

/** Active dock drag preview consumed by `<Dock>` to reflow slots. */
export interface DockDragPreview {
  draggedApp: AppInfo;
  /** Source slot in the Dock at drag start, or `null` if dragging from grid. */
  fromIndex: number | null;
  /** Current target slot in the Dock, or `null` if hovering over the grid. */
  toIndex: number | null;
}

interface PointerState {
  pointerId: number;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

type DragKind = 'app' | 'widget';

/**
 * Map a point (relative to gesture area) to a page-local app drop index.
 *
 * Earlier versions computed `localIndex = row * COLS + col`, which silently
 * broke as soon as widgets occupied any cells: a 4×2 widget on rows 0-1
 * means app index 0 actually sits at `(col=0, row=2)`, but the old formula
 * mapped that to `localIndex=8` and the drop target was nonsense.
 *
 * The new implementation packs the page (excluding the dragged app) and walks
 * the resulting `appPlacements` row-major, returning the index of the first
 * placement at or after the hovered cell. Hovering over a widget cell yields
 * the next free app slot in row-major order; hovering past the last app
 * appends.
 *
 * Pass `appIds` with the dragged app already removed (matches `effectiveApps`
 * in `IconGrid` and `moveApp`'s post-removal target index contract).
 */
export function getDropTarget(
  x: number,
  y: number,
  page: number,
  widgets: PackerWidget[],
  appIds: string[],
  metrics: SpringboardMetrics,
  viewportWidth: number,
): DragPosition {
  const sidePadding = metrics.sidePadding;
  const cellW = (viewportWidth - sidePadding * 2) / COLS;
  const contentHeight = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
  const rowH = contentHeight + metrics.gridGapY;

  const col = Math.max(
    0,
    Math.min(Math.floor((x - sidePadding) / cellW), COLS - 1),
  );
  const row = Math.max(0, Math.min(Math.floor(y / rowH), ROWS - 1));

  const { appPlacements } = packPage(widgets, appIds);
  for (let i = 0; i < appPlacements.length; i += 1) {
    const p = appPlacements[i]!;
    if (p.row > row || (p.row === row && p.col >= col)) {
      return { page, localIndex: i };
    }
  }
  return { page, localIndex: appPlacements.length };
}

/**
 * Snap a widget ghost's top-left corner (in gesture-area coordinates) to
 * the grid origin it should drop at, clamped so the widget's footprint
 * never escapes the 4×5 grid.
 *
 * A half-cell bias means the user doesn't need to reach the exact cell
 * boundary for the origin to flip — moving the ghost by just over half a
 * cell snaps to the next slot.
 */
export function getWidgetDropTarget(
  x: number,
  y: number,
  size: WidgetSize,
  metrics: SpringboardMetrics,
  viewportWidth: number,
): { col: number; row: number } {
  const sidePadding = metrics.sidePadding;
  const cellW = (viewportWidth - sidePadding * 2) / COLS;
  const contentHeight = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
  const rowH = contentHeight + metrics.gridGapY;

  const col = Math.floor((x - sidePadding + cellW / 2) / cellW);
  const row = Math.floor((y + rowH / 2) / rowH);
  return clampOrigin(size, col, row);
}

export function useIconDrag({
  pages,
  widgetPages = [],
  dockApps = [],
  metrics,
  viewportWidth,
  currentPage,
  totalPages,
  goToPage,
  cancelSwipe,
  gestureAreaRef,
  onRequestExtraPage,
}: UseIconDragOptions) {
  const moveApp = useSpringboardLayoutStore((s) => s.moveApp);
  const moveWidget = useSpringboardLayoutStore((s) => s.moveWidget);
  const reorderDock = useSpringboardLayoutStore((s) => s.reorderDock);
  const moveAppToDock = useSpringboardLayoutStore((s) => s.moveAppToDock);
  const moveAppFromDock = useSpringboardLayoutStore((s) => s.moveAppFromDock);

  // Latest dockApps in a ref so onPointerMove can read without re-binding the
  // callback on every dock change.
  const dockAppsRef = useRef<AppInfo[]>(dockApps);
  dockAppsRef.current = dockApps;

  // Which kind of entity (if any) is currently being dragged. Synchronously
  // readable from pointer handlers so we avoid the React state update lag.
  const dragKindRef = useRef<DragKind | null>(null);

  // ---- App drag state -----------------------------------------------------
  const [dragPos, _setDragPos] = useState<DragPosition | null>(null);
  const [dropPos, _setDropPos] = useState<DragPosition | null>(null);
  const dragPosRef = useRef<DragPosition | null>(null);
  const dropPosRef = useRef<DragPosition | null>(null);
  const setDragPos = (v: DragPosition | null) => {
    dragPosRef.current = v;
    _setDragPos(v);
  };
  const setDropPos = (v: DragPosition | null) => {
    dropPosRef.current = v;
    _setDropPos(v);
  };

  // ---- Widget drag state --------------------------------------------------
  const [widgetDrag, _setWidgetDrag] = useState<WidgetDragMeta | null>(null);
  const [widgetDropPos, _setWidgetDropPos] = useState<WidgetDropTarget | null>(null);
  const widgetDragRef = useRef<WidgetDragMeta | null>(null);
  const widgetDropRef = useRef<WidgetDropTarget | null>(null);
  const setWidgetDrag = (v: WidgetDragMeta | null) => {
    widgetDragRef.current = v;
    _setWidgetDrag(v);
  };
  const setWidgetDropPos = (v: WidgetDropTarget | null) => {
    widgetDropRef.current = v;
    _setWidgetDropPos(v);
  };

  // Shared overlay coordinates (relative to gesture area). Using MotionValues
  // so position updates bypass React re-renders — the DragOverlay reads these
  // via style={{ x, y }} and the DOM updates directly.
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);
  const settleAnimsRef = useRef<Array<ReturnType<typeof motionAnimate>>>([]);

  const pointerRef = useRef<PointerState | null>(null);
  const autoScrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const totalPagesRef = useRef(totalPages);
  totalPagesRef.current = totalPages;

  const clearAutoScroll = useCallback(() => {
    if (autoScrollTimerRef.current !== null) {
      clearTimeout(autoScrollTimerRef.current);
      autoScrollTimerRef.current = null;
    }
  }, []);

  const resetAllState = useCallback(() => {
    pointerRef.current = null;
    dragKindRef.current = null;
    setDragPos(null);
    setDropPos(null);
    setWidgetDrag(null);
    setWidgetDropPos(null);
  }, []);

  // ---- Settle animation (shared by app + widget drag) -------------------------
  // When a drag ends, we animate the overlay to the target grid cell before
  // hiding it, so the icon / widget doesn't teleport.
  const [isSettling, setIsSettling] = useState(false);
  const pendingMoveRef = useRef<(() => void) | null>(null);

  // ---- Overlay linger (prevents flash on settle → grid-slot swap) -----------
  // After the settle animation completes, the DragOverlay and the grid slot
  // swap visibility in the same frame. On some browsers/devices there's a
  // 1-frame paint gap — the overlay is gone before the grid slot's first
  // paint completes. To fix this we keep a static snapshot of the overlay
  // for one extra paint frame so it covers the grid slot while it renders
  // underneath. The snapshot is at z-50, same as the real overlay.
  const overlayLingerRef = useRef<{ icon: string; x: number; y: number; size: number } | null>(null);
  const [overlayLingering, setOverlayLingering] = useState(false);

  useEffect(() => {
    if (!overlayLingering) return;
    const id = requestAnimationFrame(() => {
      setOverlayLingering(false);
      overlayLingerRef.current = null;
    });
    return () => cancelAnimationFrame(id);
  }, [overlayLingering]);

  const onSettleComplete = useCallback(() => {
    // Stop any lingering settle springs.
    for (const a of settleAnimsRef.current) a.stop();
    settleAnimsRef.current = [];

    // Snapshot the overlay's appearance before clearing state. Source can
    // be either a grid page or the Dock — look up accordingly.
    const app = dragPos
      ? dragPos.page === DOCK_PAGE
        ? dockApps[dragPos.localIndex] ?? null
        : pages[dragPos.page]?.[dragPos.localIndex] ?? null
      : null;
    if (app) {
      overlayLingerRef.current = {
        icon: app.icon,
        x: dragX.get(),
        y: dragY.get(),
        size: metrics.iconSize,
      };
    }

    pendingMoveRef.current?.();
    pendingMoveRef.current = null;
    setIsSettling(false);
    resetAllState();
    // Activate linger — same React batch, so the snapshot overlay renders
    // in the same frame that the main overlay unmounts.
    setOverlayLingering(true);
  }, [resetAllState, dragPos, pages, dockApps, dragX, dragY, metrics.iconSize]);

  // Ref for the settle callback — the imperative motionAnimate onComplete
  // closure captures this ref, so it always calls the latest version.
  const settleCallbackRef = useRef(onSettleComplete);
  settleCallbackRef.current = onSettleComplete;

  const onDragStart = useCallback(
    (pageIndex: number, localIndex: number, e: React.PointerEvent<HTMLElement>) => {
      const area = gestureAreaRef.current;
      if (!area) return;

      // Cancel any active page swipe (prevents conflict on first long-press)
      cancelSwipe();

      const areaRect = area.getBoundingClientRect();

      // Find icon element by data-testid (e.currentTarget may be null from
      // long-press timer). Source can be either a grid page or the Dock —
      // the latter uses the `DOCK_PAGE` sentinel and `dockApps` for lookup.
      // CRITICAL: search via `document` (not `area`) because the Dock lives
      // OUTSIDE the gesture surface in the DOM. Using `area.querySelector`
      // here was returning null for dock icons, silently aborting the drag.
      // App ids are canonical and globally unique (AGENTS.md inv 9), so
      // `document.querySelector` is safe.
      const appId =
        pageIndex === DOCK_PAGE
          ? dockApps[localIndex]?.id
          : pages[pageIndex]?.[localIndex]?.id;
      const iconEl =
        (appId
          ? document.querySelector<HTMLElement>(
              `[data-testid="app-icon-${appId}"]`,
            )
          : null) ?? (e.currentTarget as HTMLElement | null);
      if (!iconEl) return;

      const iconRect = iconEl.getBoundingClientRect();

      pointerRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - iconRect.left,
        offsetY: e.clientY - iconRect.top,
      };
      dragKindRef.current = 'app';

      dragX.set(iconRect.left - areaRect.left);
      dragY.set(iconRect.top - areaRect.top);
      setDragPos({ page: pageIndex, localIndex });
      setDropPos({ page: pageIndex, localIndex });

      try {
        area.setPointerCapture(e.pointerId);
      } catch {
        // pointerId may be stale from long-press timer
      }
    },
    [gestureAreaRef, cancelSwipe, pages, dockApps],
  );

  const onWidgetDragStart = useCallback(
    (
      pageIndex: number,
      widgetId: string,
      e: React.PointerEvent<HTMLElement>,
    ) => {
      const area = gestureAreaRef.current;
      if (!area) return;

      const widget = widgetPages[pageIndex]?.find((w) => w.id === widgetId);
      if (!widget) return;

      cancelSwipe();

      const areaRect = area.getBoundingClientRect();

      // Prefer the slot DOM by testid so we get the exact on-screen rect,
      // but fall back to currentTarget for cases where the slot isn't in
      // the query tree (e.g. stale long-press timers).
      const shellEl =
        area.querySelector<HTMLElement>(`[data-testid="widget-slot-${widgetId}"]`) ??
        (e.currentTarget as HTMLElement | null);
      if (!shellEl) return;

      const shellRect = shellEl.getBoundingClientRect();

      pointerRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - shellRect.left,
        offsetY: e.clientY - shellRect.top,
      };
      dragKindRef.current = 'widget';

      dragX.set(shellRect.left - areaRect.left);
      dragY.set(shellRect.top - areaRect.top);
      setWidgetDrag({ widget, fromPage: pageIndex });
      setWidgetDropPos({ page: pageIndex, col: widget.col, row: widget.row });

      try {
        area.setPointerCapture(e.pointerId);
      } catch {
        // pointerId may be stale from long-press timer
      }
    },
    [gestureAreaRef, cancelSwipe, widgetPages],
  );

  const updateDropTargetForPage = useCallback(
    (page: number) => {
      const kind = dragKindRef.current;

      if (kind === 'app' && dragPosRef.current) {
        // Pointer center in gesture-area coords (the dock rect lives in
        // viewport coords, so we adjust below).
        const centerX = dragX.get() + metrics.iconSize / 2;
        const centerY = dragY.get() + metrics.iconSize / 2;

        // ---- Dock drop detection ------------------------------------------
        // Widgets can never enter the dock; the kind === 'app' guard above
        // covers that. For app drags, check if the pointer is inside the
        // dock material rect (queried by testid — cheap, single getBCR per
        // pointermove, and always reflects the live position even if the
        // dock content reflows mid-drag). Source = grid hits the capacity
        // cap; source = dock always reorders within.
        // CRITICAL: query via `document` (not `area`) — the Dock lives
        // OUTSIDE the gesture surface, so an `area`-scoped query returns
        // null and grid-into-dock drops silently fail to register.
        const area = gestureAreaRef.current;
        const dockEl = document.querySelector<HTMLElement>(
          '[data-testid="dock-material"]',
        );
        if (area && dockEl) {
          const areaRect = area.getBoundingClientRect();
          const dockRect = dockEl.getBoundingClientRect();
          // Translate dock rect into gesture-area coordinates.
          const dockLeft = dockRect.left - areaRect.left;
          const dockTop = dockRect.top - areaRect.top;
          const dockRight = dockLeft + dockRect.width;
          const dockBottom = dockTop + dockRect.height;

          if (
            centerX >= dockLeft &&
            centerX <= dockRight &&
            centerY >= dockTop &&
            centerY <= dockBottom
          ) {
            const sourceIsDock = dragPosRef.current.page === DOCK_PAGE;
            const dockLen = dockAppsRef.current.length;
            // Visual slot count: source-from-dock means the source slot is
            // hidden, so the dock visually shows one fewer slot.
            const visualCount = sourceIsDock
              ? Math.max(0, dockLen - 1)
              : dockLen;
            // Reject grid → full dock. Falls through to grid drop logic.
            const wouldExceedCap =
              !sourceIsDock && dockLen >= DOCK_CAPACITY;

            if (!wouldExceedCap) {
              // Insertion gap count = visualCount + 1 (gaps between/around).
              const insertSlots = visualCount + 1;
              const slotWidth = dockRect.width / Math.max(1, insertSlots);
              const raw = (centerX - dockLeft) / slotWidth;
              const slotIndex = Math.max(
                0,
                Math.min(visualCount, Math.floor(raw)),
              );

              const prev = dropPosRef.current;
              if (
                !prev ||
                prev.page !== DOCK_PAGE ||
                prev.localIndex !== slotIndex
              ) {
                setDropPos({ page: DOCK_PAGE, localIndex: slotIndex });
              }
              return;
            }
          }
        }

        // ---- Grid drop (existing path) -----------------------------------
        // Compute app drop target from icon center. We feed `getDropTarget`
        // the page's widgets so it can pack and find the actual cell-to-
        // localIndex mapping (widgets carve holes in the row-major fill).
        const pageApps = pages[page] ?? [];
        const pageWidgetsHere = widgetPages[page] ?? [];

        // Match `effectiveApps` in IconGrid and the post-removal contract of
        // `moveApp`: when the source page is the same as the hovered page,
        // the dragged app must be excluded from the layout used to compute
        // drop indices.
        const dragOriginatesHere = dragPosRef.current.page === page;
        const appIds = dragOriginatesHere
          ? pageApps
              .filter((_, i) => i !== dragPosRef.current!.localIndex)
              .map((a) => a.id)
          : pageApps.map((a) => a.id);

        const target = getDropTarget(
          centerX,
          centerY,
          page,
          pageWidgetsHere,
          appIds,
          metrics,
          viewportWidth,
        );
        const prev = dropPosRef.current;
        if (!prev || prev.page !== target.page || prev.localIndex !== target.localIndex) {
          setDropPos(target);
        }
      } else if (kind === 'widget' && widgetDragRef.current) {
        // Widget drop origin is computed from the ghost's top-left corner.
        const target = getWidgetDropTarget(
          dragX.get(),
          dragY.get(),
          widgetDragRef.current.widget.size,
          metrics,
          viewportWidth,
        );
        const prev = widgetDropRef.current;
        if (!prev || prev.page !== page || prev.col !== target.col || prev.row !== target.row) {
          setWidgetDropPos({ page, col: target.col, row: target.row });
        }
      }
    },
    [
      dragX,
      dragY,
      metrics,
      pages,
      viewportWidth,
      widgetPages,
      gestureAreaRef,
    ],
  );

  // Auto-scroll changes the active page even when the finger is stationary.
  // Recompute the drop target on that page transition; otherwise releasing
  // immediately after a new page appears commits to the stale page.
  useEffect(() => {
    if (!pointerRef.current || dragKindRef.current === null) return;
    updateDropTargetForPage(currentPage);
  }, [currentPage, updateDropTargetForPage]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const ptr = pointerRef.current;
      if (!ptr || e.pointerId !== ptr.pointerId) return;
      const kind = dragKindRef.current;
      if (kind === null) return;

      const area = gestureAreaRef.current;
      if (!area) return;
      const areaRect = area.getBoundingClientRect();

      const newX = e.clientX - areaRect.left - ptr.offsetX;
      const newY = e.clientY - areaRect.top - ptr.offsetY;
      dragX.set(newX);
      dragY.set(newY);

      const cp = currentPageRef.current;
      updateDropTargetForPage(cp);

      // Edge detection for auto-scroll (shared for both kinds)
      const relativeX = e.clientX - areaRect.left;
      const isAtLeftEdge = relativeX < EDGE_ZONE && cp > 0;
      const isAtRightEdge = relativeX > viewportWidth - EDGE_ZONE;
      const canGoRight = cp < totalPagesRef.current - 1;

      if (isAtLeftEdge) {
        if (autoScrollTimerRef.current === null) {
          autoScrollTimerRef.current = setTimeout(() => {
            autoScrollTimerRef.current = null;
            goToPage(currentPageRef.current - 1);
          }, AUTO_SCROLL_DELAY);
        }
      } else if (isAtRightEdge && canGoRight) {
        if (autoScrollTimerRef.current === null) {
          autoScrollTimerRef.current = setTimeout(() => {
            autoScrollTimerRef.current = null;
            goToPage(currentPageRef.current + 1);
          }, AUTO_SCROLL_DELAY);
        }
      } else if (isAtRightEdge && !canGoRight) {
        if (autoScrollTimerRef.current === null) {
          autoScrollTimerRef.current = setTimeout(() => {
            autoScrollTimerRef.current = null;
            onRequestExtraPage?.();
          }, AUTO_SCROLL_DELAY);
        }
      } else {
        clearAutoScroll();
      }
    },
    [
      gestureAreaRef,
      viewportWidth,
      goToPage,
      clearAutoScroll,
      onRequestExtraPage,
      updateDropTargetForPage,
    ],
  );

  const finishDrag = useCallback(() => {
    clearAutoScroll();
    const kind = dragKindRef.current;

    // Shared geometry used by both app and widget settle paths
    const sidePadding = metrics.sidePadding;
    const colWidth = (viewportWidth - sidePadding * 2) / COLS;
    const contentHeight =
      4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
    const rowH = contentHeight + metrics.gridGapY;

    if (kind === 'app') {
      const drag = dragPosRef.current;
      const drop = dropPosRef.current;
      if (drag && drop) {
        const sameSpot =
          drag.page === drop.page && drag.localIndex === drop.localIndex;

        // Resolve the dragged app from either the source grid page or the
        // Dock (sentinel page = DOCK_PAGE).
        const draggedApp =
          drag.page === DOCK_PAGE
            ? dockApps[drag.localIndex]
            : pages[drag.page]?.[drag.localIndex];

        // Decide the store mutation based on (source kind, target kind).
        if (!sameSpot && draggedApp) {
          if (drag.page === DOCK_PAGE && drop.page === DOCK_PAGE) {
            pendingMoveRef.current = () =>
              reorderDock(drag.localIndex, drop.localIndex);
          } else if (drag.page === DOCK_PAGE && drop.page !== DOCK_PAGE) {
            const appId = draggedApp.id;
            pendingMoveRef.current = () =>
              moveAppFromDock(appId, drop.page, drop.localIndex);
          } else if (drag.page !== DOCK_PAGE && drop.page === DOCK_PAGE) {
            const appId = draggedApp.id;
            pendingMoveRef.current = () =>
              moveAppToDock(appId, drop.localIndex);
          } else {
            pendingMoveRef.current = () =>
              moveApp(drag.page, drag.localIndex, drop.page, drop.localIndex);
          }
        }

        // Compute settle target rect. Two cases:
        // 1. Drop on the grid → reuse the existing packer-based math.
        // 2. Drop in the Dock → measure the dock material rect + slot.
        let targetX: number | null = null;
        let targetY: number | null = null;

        if (drop.page === DOCK_PAGE) {
          // Query via `document` (not `area`) — the Dock lives outside the
          // gesture surface in the DOM. See updateDropTargetForPage.
          const area = gestureAreaRef.current;
          const dockEl = document.querySelector<HTMLElement>(
            '[data-testid="dock-material"]',
          );
          if (area && dockEl) {
            const areaRect = area.getBoundingClientRect();
            const dockRect = dockEl.getBoundingClientRect();
            const dockLeft = dockRect.left - areaRect.left;
            const dockTop = dockRect.top - areaRect.top;
            const sourceIsDock = drag.page === DOCK_PAGE;
            const dockLen = dockApps.length;
            // Visual count after removal = dockLen - 1 if source is dock and
            // wasn't already at the drop slot; for grid → dock it's dockLen.
            // For positioning the settled icon we use the post-commit slot
            // count: dock will have nextLen items.
            const nextLen = sourceIsDock ? dockLen : dockLen + 1;
            const slotWidth = dockRect.width / Math.max(1, nextLen);
            const finalIndex = Math.max(
              0,
              Math.min(nextLen - 1, drop.localIndex),
            );
            targetX =
              dockLeft +
              finalIndex * slotWidth +
              (slotWidth - metrics.iconSize) / 2;
            // Icon vertical position inside dock: dockPaddingY/2 (top
            // padding) + 4px (button paddingTop) — mirrors `<Dock>` style.
            targetY = dockTop + Math.max(4, Math.ceil(metrics.dockPaddingY / 2)) + 8;
          }
        } else {
          const targetApps = pages[drop.page] ?? [];
          const targetWidgets = widgetPages[drop.page] ?? [];
          const effectiveIds = targetApps.map((a) => a.id);
          if (drag.page === drop.page) {
            effectiveIds.splice(drag.localIndex, 1);
          }
          effectiveIds.splice(drop.localIndex, 0, draggedApp?.id ?? '');
          const { appPlacements } = packPage(targetWidgets, effectiveIds);
          const tp = appPlacements.find((p) => p.id === draggedApp?.id);
          if (tp) {
            targetX = sidePadding + tp.col * colWidth + (colWidth - metrics.iconSize) / 2;
            targetY = metrics.springboardTopPadding + tp.row * rowH + 4;
          }
        }

        if (targetX !== null && targetY !== null) {
          // Stop accepting pointer moves but keep dragPos/dropPos alive
          // so the source slot stays hidden during the settle animation.
          pointerRef.current = null;
          dragKindRef.current = null;

          const settleSpring = { type: 'spring' as const, ...spring.interactive };
          for (const a of settleAnimsRef.current) a.stop();
          settleAnimsRef.current = [
            motionAnimate(dragX, targetX, {
              ...settleSpring,
              onComplete: () => settleCallbackRef.current(),
            }),
            motionAnimate(dragY, targetY, settleSpring),
          ];
          setIsSettling(true);
        } else {
          // Couldn't compute target — commit immediately
          pendingMoveRef.current?.();
          pendingMoveRef.current = null;
          resetAllState();
        }
      } else {
        resetAllState();
      }
    } else if (kind === 'widget') {
      const meta = widgetDragRef.current;
      const drop = widgetDropRef.current;
      if (meta && drop) {
        const same =
          drop.page === meta.fromPage &&
          drop.col === meta.widget.col &&
          drop.row === meta.widget.row;

        if (same) {
          // Dropped at original position — no move, no settle animation needed.
          resetAllState();
        } else {
          // Defer moveWidget until the settle animation completes
          pendingMoveRef.current = () =>
            moveWidget(meta.fromPage, meta.widget.id, drop.page, drop.col, drop.row);

          // Stop accepting pointer moves but keep widgetDrag/widgetDropPos
          // alive so the grid slot stays hidden during the settle animation.
          pointerRef.current = null;
          dragKindRef.current = null;

          const targetX = sidePadding + drop.col * colWidth;
          const targetY = metrics.springboardTopPadding + drop.row * rowH;
          const settleSpring = { type: 'spring' as const, ...spring.interactive };
          for (const a of settleAnimsRef.current) a.stop();
          settleAnimsRef.current = [
            motionAnimate(dragX, targetX, {
              ...settleSpring,
              onComplete: () => settleCallbackRef.current(),
            }),
            motionAnimate(dragY, targetY, settleSpring),
          ];
          setIsSettling(true);
        }
      } else {
        resetAllState();
      }
    } else {
      resetAllState();
    }
  }, [
    moveApp,
    moveWidget,
    moveAppToDock,
    moveAppFromDock,
    reorderDock,
    clearAutoScroll,
    resetAllState,
    metrics,
    viewportWidth,
    pages,
    widgetPages,
    dockApps,
    gestureAreaRef,
    dragX,
    dragY,
  ]);

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const ptr = pointerRef.current;
      if (!ptr || e.pointerId !== ptr.pointerId) return;
      finishDrag();
    },
    [finishDrag],
  );

  const onPointerCancel = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      const ptr = pointerRef.current;
      if (!ptr || e.pointerId !== ptr.pointerId) return;
      clearAutoScroll();
      for (const a of settleAnimsRef.current) a.stop();
      settleAnimsRef.current = [];
      resetAllState();
    },
    [clearAutoScroll, resetAllState],
  );

  // Clean up settle animations on unmount.
  useEffect(() => () => {
    for (const a of settleAnimsRef.current) a.stop();
  }, []);

  // Expose state for rendering (state, not ref — React needs the re-render).
  // Resolve the dragged app from grid OR dock so the overlay can render
  // either source uniformly.
  const dragApp = dragPos
    ? dragPos.page === DOCK_PAGE
      ? dockApps[dragPos.localIndex] ?? null
      : pages[dragPos.page]?.[dragPos.localIndex] ?? null
    : null;

  // Build the Dock's reflow preview from the active drag state. `<Dock>`
  // uses this to splice the dragged app in/out of its rendered slot list,
  // mirroring how `IconGrid.effectiveApps` reflows the home grid.
  const dockDragPreview: DockDragPreview | null = dragApp
    ? {
        draggedApp: dragApp,
        fromIndex: dragPos!.page === DOCK_PAGE ? dragPos!.localIndex : null,
        toIndex: dropPos?.page === DOCK_PAGE ? dropPos.localIndex : null,
      }
    : null;

  return {
    // Shared overlay coordinates (MotionValues — no re-render on position change)
    dragX,
    dragY,
    // App drag
    dragPos,
    dropPos,
    dragApp,
    onDragStart,
    // Dock drag preview (consumed by `<Dock>` for slot reflow)
    dockDragPreview,
    // Widget drag
    widgetDrag,
    widgetDropPos,
    onWidgetDragStart,
    // Settle animation (position driven by imperative motionAnimate)
    isSettling,
    // Overlay linger (static snapshot shown for 1 frame after settle)
    overlayLingering,
    overlayLingerData: overlayLingerRef.current,
    // Shared pointer handlers (Springboard routes them here)
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
