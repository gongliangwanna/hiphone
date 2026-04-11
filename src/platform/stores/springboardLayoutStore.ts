import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apps as defaultApps, type AppInfo } from '@/shell/Springboard/apps.data';
import {
  GRID_COLS,
  GRID_ROWS,
  UNPLACED_SENTINEL,
  cascadeOverflow,
  clampOrigin,
  firstFit,
  tryMoveWidget,
} from './pagePacker';

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Widget types
// ---------------------------------------------------------------------------

export type WidgetSize = '2x2' | '4x2' | '4x4';
export type WidgetKind = 'clock' | 'date' | 'weather' | 'music' | 'photo';

export interface WidgetInstance {
  /** Stable unique instance id, generated on creation */
  id: string;
  kind: WidgetKind;
  size: WidgetSize;
  /**
   * Left-origin column on the 4-col grid. `-1` (`UNPLACED_SENTINEL`) means
   * the widget was added by a caller that doesn't know the final origin yet
   * (e.g. v1→v2 migration); the packer resolves it via `firstFit` on first
   * render and the shell writes the resolved origin back to the store.
   */
  col: number;
  /** Top-origin row on the 5-row grid. See `col` for sentinel semantics. */
  row: number;
}

/**
 * Number of grid cells (each = 1 app slot) a widget occupies.
 * 2x2 = 4, 4x2 = 8, 4x4 = 16. Used to enforce page capacity alongside apps.
 */
export const WIDGET_CELLS: Record<WidgetSize, number> = {
  '2x2': 4,
  '4x2': 8,
  '4x4': 16,
};

/** Grid column-span for each widget size (page is 4 cols wide). */
export const WIDGET_COL_SPAN: Record<WidgetSize, number> = {
  '2x2': 2,
  '4x2': 4,
  '4x4': 4,
};

/** Grid row-span for each widget size. */
export const WIDGET_ROW_SPAN: Record<WidgetSize, number> = {
  '2x2': 2,
  '4x2': 2,
  '4x4': 4,
};

interface SpringboardLayoutState {
  /**
   * Page-based app order. Each sub-array is one page of app IDs.
   * null = use default layout derived from apps.data.ts.
   */
  appOrder: string[][] | null;

  /**
   * Page-based widget placements. Each sub-array holds the widgets
   * living on that page (rendered before the apps on the same page).
   * null = no widgets placed yet.
   */
  pageWidgets: WidgetInstance[][] | null;

  /** Edit mode flag (not persisted) */
  isEditMode: boolean;

  /** Widget drawer visibility (not persisted) */
  isWidgetDrawerOpen: boolean;

  /**
   * Which springboard page the user is currently viewing.
   * Published by Springboard when its page changes; read by WidgetDrawer
   * to know which page a newly-added widget should land on.
   * Not persisted.
   */
  currentSpringboardPage: number;

  /**
   * Id of the most recently added app/widget. `IconGrid` keys its entrance
   * animation off this field: only the matching slot plays the scale/fade
   * intro; all other slots mount without an initial animation. The slot
   * clears this field itself via `clearRecentlyAdded` once the animation
   * completes, so cold starts from persisted state never replay the intro.
   * Not persisted.
   */
  recentlyAddedItemId: string | null;

  enterEditMode: () => void;
  exitEditMode: () => void;

  openWidgetDrawer: () => void;
  closeWidgetDrawer: () => void;
  setCurrentSpringboardPage: (page: number) => void;
  clearRecentlyAdded: () => void;

  /**
   * Move an app between pages/positions.
   * Creates the target page if it doesn't exist.
   */
  moveApp: (
    fromPage: number,
    fromLocal: number,
    toPage: number,
    toLocal: number,
  ) => void;

  /**
   * Add a widget to a page. Returns the created instance id, or null
   * if the target page has no room. The origin is chosen via row-major
   * `firstFit` on the target page's current widget occupancy.
   */
  addWidget: (page: number, kind: WidgetKind, size: WidgetSize) => string | null;

  /** Remove a widget instance from a page. */
  removeWidget: (page: number, widgetId: string) => void;

  /**
   * Move a widget to a new origin on the same or a different page.
   *
   * The target origin is clamped to the grid bounds, then collisions with
   * any widgets already on the target page are resolved by displacing each
   * colliding widget to the first-fit origin computed after the move.
   * If any colliding widget cannot be re-placed, the whole operation is
   * aborted and the store stays unchanged (preview-friendly).
   *
   * After the widget layout changes, apps are re-cascaded across pages so
   * that any app that no longer fits its page flows forward.
   */
  moveWidget: (
    fromPage: number,
    widgetId: string,
    toPage: number,
    col: number,
    row: number,
  ) => void;

  /** Reset to default layout */
  resetLayout: () => void;
}

/** Map from app ID to AppInfo for fast lookup */
const appInfoMap = new Map<string, AppInfo>(
  defaultApps.map((a) => [a.id, a]),
);


/**
 * Resolve pages of AppInfo from page-based appOrder.
 *
 * **Legacy (app-only) callers** can call with a single argument; pages are
 * then packed with up to 20 apps each.
 * **Widget-aware callers** should pass `pageWidgets` so the function
 * respects each page's remaining capacity after widgets are placed.
 *
 * Filters out IDs that no longer exist in the app registry and appends any
 * new apps (not yet placed) to the tail of the layout.
 */
export function resolveOrderedPages(
  appOrder: string[][] | null,
  pageWidgets: WidgetInstance[][] | null = null,
): AppInfo[][] {
  const slotPages = resolveSlotPages(appOrder, pageWidgets);
  return slotPages.map((slots) =>
    slots.filter((s): s is AppSlot => s.type === 'app').map((s) => s.app),
  );
}

/** Remove empty trailing pages */
function cleanupPages(pages: string[][]): string[][] {
  const cleaned = pages.filter((p) => p.length > 0);
  return cleaned.length > 0 ? cleaned : [[]];
}

// ---------------------------------------------------------------------------
// Slot resolver (apps + widgets combined)
// ---------------------------------------------------------------------------

export interface AppSlot {
  type: 'app';
  app: AppInfo;
}

export interface WidgetSlot {
  type: 'widget';
  widget: WidgetInstance;
}

export type Slot = AppSlot | WidgetSlot;

/**
 * Cells consumed by a set of widgets on one page.
 */
function widgetCellCount(widgets: WidgetInstance[] | undefined): number {
  if (!widgets) return 0;
  return widgets.reduce((sum, w) => sum + WIDGET_CELLS[w.size], 0);
}

/**
 * Maximum number of apps that can coexist with the given widgets on a page.
 * Each app is 1 cell; PAGE_SIZE = 20 total cells.
 */
export function pageAppCapacity(widgets: WidgetInstance[] | undefined): number {
  return Math.max(0, PAGE_SIZE - widgetCellCount(widgets));
}

/**
 * Resolve pages into a unified Slot list (widgets first, then apps).
 *
 * DOM order matters for CSS `grid-auto-flow: row dense` — widgets go first
 * so that app icons can backfill the leftover cells. App ids missing from
 * the registry are filtered, and newly-added apps are appended to the last
 * page (respecting the remaining capacity after widgets).
 */
export function resolveSlotPages(
  appOrder: string[][] | null,
  pageWidgets: WidgetInstance[][] | null,
): Slot[][] {
  // First, compute app-only pages. Widgets reduce the app capacity of
  // each page, so we need to slice carefully instead of hard-coding PAGE_SIZE.
  const widgetsByPage: WidgetInstance[][] = pageWidgets ?? [];
  const capacityFor = (pageIdx: number): number =>
    pageAppCapacity(widgetsByPage[pageIdx]);

  // Build raw app id pages
  let rawAppPages: string[][];
  if (appOrder === null) {
    rawAppPages = [];
    let i = 0;
    let p = 0;
    while (i < defaultApps.length) {
      const cap = capacityFor(p);
      if (cap > 0) {
        rawAppPages.push(defaultApps.slice(i, i + cap).map((a) => a.id));
        i += cap;
      } else {
        rawAppPages.push([]);
      }
      p += 1;
    }
    if (rawAppPages.length === 0) rawAppPages = [[]];
  } else {
    // Keep user's page structure but filter to valid ids
    rawAppPages = appOrder.map((page) => page.filter((id) => appInfoMap.has(id)));
  }

  // Dedup app ids across pages (earlier pages win)
  const seen = new Set<string>();
  const dedupedAppPages: string[][] = rawAppPages.map((page) => {
    const out: string[] = [];
    for (const id of page) {
      if (!seen.has(id)) {
        out.push(id);
        seen.add(id);
      }
    }
    return out;
  });

  // Append new apps (not yet placed) into pages that still have capacity
  const unseen: string[] = [];
  for (const app of defaultApps) {
    if (!seen.has(app.id)) unseen.push(app.id);
  }
  for (let p = 0; p < dedupedAppPages.length && unseen.length > 0; p++) {
    const cap = capacityFor(p);
    const free = Math.max(0, cap - dedupedAppPages[p]!.length);
    if (free > 0) {
      dedupedAppPages[p]!.push(...unseen.splice(0, free));
    }
  }
  while (unseen.length > 0) {
    const pageIdx = dedupedAppPages.length;
    const cap = capacityFor(pageIdx);
    const take = cap > 0 ? unseen.splice(0, cap) : [];
    dedupedAppPages.push(take);
    if (cap <= 0 && unseen.length === 0) break;
  }

  // Determine total pages (max of widget pages and app pages)
  const totalPages = Math.max(
    widgetsByPage.length,
    dedupedAppPages.length,
    1,
  );

  // Compose final Slot[][] (widgets first, apps after)
  const result: Slot[][] = [];
  for (let p = 0; p < totalPages; p++) {
    const slots: Slot[] = [];
    const pageWidgetsList = widgetsByPage[p] ?? [];
    for (const w of pageWidgetsList) {
      slots.push({ type: 'widget', widget: w });
    }
    const appIds = dedupedAppPages[p] ?? [];
    for (const id of appIds) {
      const info = appInfoMap.get(id);
      if (info) slots.push({ type: 'app', app: info });
    }
    result.push(slots);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Unique widget instance id generator
// ---------------------------------------------------------------------------
let widgetInstanceCounter = 0;
function nextWidgetId(kind: WidgetKind): string {
  widgetInstanceCounter += 1;
  return `w-${kind}-${Date.now().toString(36)}-${widgetInstanceCounter}`;
}

export const useSpringboardLayoutStore = create<SpringboardLayoutState>()(
  persist(
    (set, get) => ({
      appOrder: null,
      pageWidgets: null,
      isEditMode: false,
      isWidgetDrawerOpen: false,
      currentSpringboardPage: 0,
      recentlyAddedItemId: null,

      enterEditMode: () => set({ isEditMode: true }),

      exitEditMode: () => {
        const { appOrder } = get();
        // Clean up empty pages on exit + always close the widget drawer
        if (appOrder) {
          set({
            isEditMode: false,
            isWidgetDrawerOpen: false,
            appOrder: cleanupPages(appOrder),
          });
        } else {
          set({ isEditMode: false, isWidgetDrawerOpen: false });
        }
      },

      openWidgetDrawer: () => set({ isWidgetDrawerOpen: true }),
      closeWidgetDrawer: () => set({ isWidgetDrawerOpen: false }),

      setCurrentSpringboardPage: (page) => {
        if (get().currentSpringboardPage === page) return;
        set({ currentSpringboardPage: page });
      },

      clearRecentlyAdded: () => {
        if (get().recentlyAddedItemId === null) return;
        set({ recentlyAddedItemId: null });
      },

      moveApp: (fromPage, fromLocal, toPage, toLocal) => {
        // Resolve to the displayed layout (matches what the user sees on screen).
        // Raw appOrder may have fewer items per page because resolveOrderedPages
        // appends unseen apps — we must operate on the resolved version. Pass
        // pageWidgets so per-page app capacity respects widget cell budgets.
        const { appOrder, pageWidgets } = get();
        const resolved = resolveOrderedPages(appOrder, pageWidgets);
        const current = resolved.map((page) => page.map((a) => a.id));

        const sourcePage = current[fromPage];
        if (!sourcePage || fromLocal < 0 || fromLocal >= sourcePage.length) return;

        const appId = sourcePage[fromLocal]!;
        const next = current.map((p) => [...p]);

        // Remove from source
        next[fromPage]!.splice(fromLocal, 1);

        // Ensure target page exists
        while (next.length <= toPage) {
          next.push([]);
        }

        // Clamp toLocal to valid range
        const targetPage = next[toPage]!;
        const clampedLocal = Math.max(0, Math.min(toLocal, targetPage.length));

        // Insert at target
        targetPage.splice(clampedLocal, 0, appId);

        // Cascade overflow using the packer — respects each page's widget
        // cell budget instead of blindly capping at PAGE_SIZE.
        const widgetsForCascade = (pageWidgets ?? []).map((p) => p.slice());
        while (widgetsForCascade.length < next.length) widgetsForCascade.push([]);
        const cascaded = cascadeOverflow(widgetsForCascade, next);

        set({ appOrder: cascaded });
      },

      addWidget: (page, kind, size) => {
        const { pageWidgets, appOrder } = get();
        const current = pageWidgets ? pageWidgets.map((p) => [...p]) : [];
        while (current.length <= page) current.push([]);

        // Quick cell-budget check (widgets only) before doing geometric search.
        const targetWidgets = current[page]!;
        const newCellCount = widgetCellCount(targetWidgets) + WIDGET_CELLS[size];
        if (newCellCount > PAGE_SIZE) return null;

        // Find a free origin via row-major first-fit on the page's current
        // widget occupancy. This is the geometric authority — the above budget
        // check is just an early-out.
        const occ = buildWidgetOccupancy(targetWidgets);
        const fit = firstFit(size, occ);
        if (!fit) return null;

        const instance: WidgetInstance = {
          id: nextWidgetId(kind),
          kind,
          size,
          col: fit.col,
          row: fit.row,
        };
        current[page] = [...targetWidgets, instance];

        // Re-cascade apps so anything pushed off by the new widget flows to
        // subsequent pages. Uses the currently-displayed app order as input
        // so that default-layout fallbacks are respected.
        const resolvedApps = resolveOrderedPages(appOrder, current).map((p) =>
          p.map((a) => a.id),
        );
        while (resolvedApps.length < current.length) resolvedApps.push([]);
        const cascaded = cascadeOverflow(current, resolvedApps);

        set({
          pageWidgets: current,
          appOrder: cascaded,
          recentlyAddedItemId: instance.id,
        });
        return instance.id;
      },

      removeWidget: (page, widgetId) => {
        const { pageWidgets } = get();
        if (!pageWidgets || !pageWidgets[page]) return;
        const next = pageWidgets.map((p) => [...p]);
        next[page] = next[page]!.filter((w) => w.id !== widgetId);
        set({ pageWidgets: next });
      },

      moveWidget: (fromPage, widgetId, toPage, col, row) => {
        const state = get();
        if (!state.pageWidgets) return;

        // Copy pages and ensure both endpoints exist.
        const next = state.pageWidgets.map((p) => p.slice());
        while (next.length <= Math.max(fromPage, toPage)) next.push([]);

        const source = next[fromPage]!;
        const movingIdx = source.findIndex((w) => w.id === widgetId);
        if (movingIdx === -1) return;

        const original = source[movingIdx]!;

        // Short-circuit no-op: same page, same clamped origin → nothing to do.
        const clamped = clampOrigin(original.size, col, row);
        if (
          fromPage === toPage &&
          clamped.col === original.col &&
          clamped.row === original.row
        ) {
          return;
        }

        // Delegate the collision algebra to the pure helper in pagePacker.
        // Same-page: feed the source page directly. Cross-page: splice out of
        // source first, then splice into the target at the requested origin
        // so `tryMoveWidget` resolves any collisions with the target's
        // existing widgets.
        let resolved: WidgetInstance[] | null;
        if (fromPage === toPage) {
          resolved = tryMoveWidget(source, widgetId, col, row);
          if (!resolved) return;
          next[toPage] = resolved;
        } else {
          source.splice(movingIdx, 1);
          const targetWidgets = next[toPage]!;
          const inserted: WidgetInstance[] = [
            ...targetWidgets,
            { ...original, col: clamped.col, row: clamped.row },
          ];
          resolved = tryMoveWidget(inserted, widgetId, col, row);
          if (!resolved) return;
          next[toPage] = resolved;
        }

        // Widgets changed → apps may need to cascade. Re-resolve through
        // resolveOrderedPages so the displayed app ids stay stable, then let
        // the packer redistribute any overflow.
        const resolvedApps = resolveOrderedPages(state.appOrder, next).map((p) =>
          p.map((a) => a.id),
        );
        while (resolvedApps.length < next.length) resolvedApps.push([]);
        const cascaded = cascadeOverflow(next, resolvedApps);
        while (next.length < cascaded.length) next.push([]);

        set({ pageWidgets: next, appOrder: cascaded });
      },

      resetLayout: () =>
        set({
          appOrder: null,
          pageWidgets: null,
          recentlyAddedItemId: null,
        }),
    }),
    {
      name: 'hiPhone-springboard-layout',
      version: 2,
      partialize: (state) => ({
        appOrder: state.appOrder,
        pageWidgets: state.pageWidgets,
      }),
      migrate: (persistedState, version) => {
        // v1 (or any implicit earlier version) did not carry col/row on
        // widgets. Stamp the sentinel origin so the first render-time packer
        // pass runs firstFit and writes the resolved origin back to the store.
        if (version < 2) {
          const state = (persistedState ?? {}) as {
            appOrder?: string[][] | null;
            pageWidgets?: Array<Array<Partial<WidgetInstance>>> | null;
          };
          if (state.pageWidgets && Array.isArray(state.pageWidgets)) {
            state.pageWidgets = state.pageWidgets.map((page) =>
              (Array.isArray(page) ? page : []).map((w) => ({
                id: typeof w?.id === 'string' ? w.id : nextWidgetId('clock'),
                kind: (w?.kind ?? 'clock') as WidgetKind,
                size: (w?.size ?? '2x2') as WidgetSize,
                col:
                  typeof w?.col === 'number' ? w.col : UNPLACED_SENTINEL,
                row:
                  typeof w?.row === 'number' ? w.row : UNPLACED_SENTINEL,
              })),
            );
          }
          return state;
        }
        return persistedState;
      },
    },
  ),
);

/**
 * Build a `GRID_ROWS × GRID_COLS` boolean occupancy matrix marking every cell
 * covered by the given widgets. Widgets with a sentinel origin are skipped so
 * that migration paths can ask "where can a fresh widget go?" without the
 * sentinel polluting the grid.
 */
function buildWidgetOccupancy(widgets: WidgetInstance[]): boolean[][] {
  const occ: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array<boolean>(GRID_COLS).fill(false),
  );
  for (const w of widgets) {
    if (w.col === UNPLACED_SENTINEL || w.row === UNPLACED_SENTINEL) continue;
    const cs = WIDGET_COL_SPAN[w.size];
    const rs = WIDGET_ROW_SPAN[w.size];
    for (let dr = 0; dr < rs; dr += 1) {
      for (let dc = 0; dc < cs; dc += 1) {
        const r = w.row + dr;
        const c = w.col + dc;
        if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
          occ[r]![c] = true;
        }
      }
    }
  }
  return occ;
}
