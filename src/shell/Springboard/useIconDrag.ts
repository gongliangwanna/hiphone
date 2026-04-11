import { useCallback, useRef, useState } from 'react';
import type { AppInfo } from './apps.data';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import {
  clampOrigin,
  packPage,
  type PackerWidget,
} from '@/platform/stores/pagePacker';
import {
  useSpringboardLayoutStore,
  type WidgetInstance,
  type WidgetSize,
} from '@/platform/stores/springboardLayoutStore';

const COLS = 4;
const ROWS = 5;
const EDGE_ZONE = 40;
const AUTO_SCROLL_DELAY = 400;

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

  // Shared overlay coordinates (relative to gesture area). Only one entity
  // can be dragged at a time, so we reuse a single (x, y) pair.
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

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

  const onDragStart = useCallback(
    (pageIndex: number, localIndex: number, e: React.PointerEvent<HTMLElement>) => {
      const area = gestureAreaRef.current;
      if (!area) return;

      // Cancel any active page swipe (prevents conflict on first long-press)
      cancelSwipe();

      const areaRect = area.getBoundingClientRect();

      // Find icon element by data-testid (e.currentTarget may be null from long-press timer)
      const appId = pages[pageIndex]?.[localIndex]?.id;
      const iconEl = appId
        ? area.querySelector<HTMLElement>(`[data-testid="app-icon-${appId}"]`)
        : e.currentTarget;
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

      setDragX(iconRect.left - areaRect.left);
      setDragY(iconRect.top - areaRect.top);
      setDragPos({ page: pageIndex, localIndex });
      setDropPos({ page: pageIndex, localIndex });

      try {
        area.setPointerCapture(e.pointerId);
      } catch {
        // pointerId may be stale from long-press timer
      }
    },
    [gestureAreaRef, cancelSwipe, pages],
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

      setDragX(shellRect.left - areaRect.left);
      setDragY(shellRect.top - areaRect.top);
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
      setDragX(newX);
      setDragY(newY);

      const cp = currentPageRef.current;

      if (kind === 'app' && dragPosRef.current) {
        // Compute app drop target from icon center. We feed `getDropTarget`
        // the page's widgets so it can pack and find the actual cell-to-
        // localIndex mapping (widgets carve holes in the row-major fill).
        const centerX = newX + metrics.iconSize / 2;
        const centerY = newY + metrics.iconSize / 2;
        const pageApps = pages[cp] ?? [];
        const pageWidgetsHere = widgetPages[cp] ?? [];

        // Match `effectiveApps` in IconGrid and the post-removal contract of
        // `moveApp`: when the source page is the same as the hovered page,
        // the dragged app must be excluded from the layout used to compute
        // drop indices.
        const dragOriginatesHere = dragPosRef.current.page === cp;
        const appIds = dragOriginatesHere
          ? pageApps
              .filter((_, i) => i !== dragPosRef.current!.localIndex)
              .map((a) => a.id)
          : pageApps.map((a) => a.id);

        const target = getDropTarget(
          centerX,
          centerY,
          cp,
          pageWidgetsHere,
          appIds,
          metrics,
          viewportWidth,
        );
        setDropPos(target);
      } else if (kind === 'widget' && widgetDragRef.current) {
        // Widget drop origin is computed from the ghost's top-left corner.
        const target = getWidgetDropTarget(
          newX,
          newY,
          widgetDragRef.current.widget.size,
          metrics,
          viewportWidth,
        );
        setWidgetDropPos({ page: cp, col: target.col, row: target.row });
      }

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
      metrics,
      viewportWidth,
      pages,
      widgetPages,
      goToPage,
      clearAutoScroll,
      onRequestExtraPage,
    ],
  );

  const finishDrag = useCallback(() => {
    clearAutoScroll();
    const kind = dragKindRef.current;

    if (kind === 'app') {
      const drag = dragPosRef.current;
      const drop = dropPosRef.current;
      if (drag && drop) {
        const sameSpot = drag.page === drop.page && drag.localIndex === drop.localIndex;
        if (!sameSpot) {
          moveApp(drag.page, drag.localIndex, drop.page, drop.localIndex);
        }
      }
    } else if (kind === 'widget') {
      const meta = widgetDragRef.current;
      const drop = widgetDropRef.current;
      if (meta && drop) {
        const same =
          drop.page === meta.fromPage &&
          drop.col === meta.widget.col &&
          drop.row === meta.widget.row;
        if (!same) {
          moveWidget(meta.fromPage, meta.widget.id, drop.page, drop.col, drop.row);
        }
      }
    }

    resetAllState();
  }, [moveApp, moveWidget, clearAutoScroll, resetAllState]);

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
      resetAllState();
    },
    [clearAutoScroll, resetAllState],
  );

  // Expose state for rendering (state, not ref — React needs the re-render)
  const dragApp = dragPos ? pages[dragPos.page]?.[dragPos.localIndex] ?? null : null;

  return {
    // Shared overlay coordinates
    dragX,
    dragY,
    // App drag
    dragPos,
    dropPos,
    dragApp,
    onDragStart,
    // Widget drag
    widgetDrag,
    widgetDropPos,
    onWidgetDragStart,
    // Shared pointer handlers (Springboard routes them here)
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
