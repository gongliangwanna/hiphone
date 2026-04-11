/**
 * Springboard page packer — pure functions.
 *
 * Walks a page's widgets and apps and assigns each one an explicit
 * `(col, row)` origin on the 4-col × 5-row grid. Used by `IconGrid` for
 * deterministic rendering and by `useIconDrag` for drop-target math.
 *
 * ## Contract
 *
 * - Widgets respect their stored `col/row` unless an override is provided
 *   (used during drag preview) or the origin is the sentinel `-1` (freshly
 *   added or migrated from v1 persisted state → go through `firstFit`).
 * - App ids are placed row-major into whatever cells the widgets leave free,
 *   in the order they appear in the input array. Apps that no longer fit on
 *   the current page are reported as `overflowApps` so the caller can
 *   cascade them to the next page.
 * - Widget-vs-widget collision is a caller bug: the packer processes widgets
 *   in input order and silently skips any whose footprint overlaps an already
 *   placed widget (they are NOT reported). The store's `moveWidget` is
 *   responsible for resolving collisions before calling `packPage`.
 *
 * All functions in this module are pure and side-effect-free.
 */

import {
  WIDGET_COL_SPAN,
  WIDGET_ROW_SPAN,
  type WidgetKind,
  type WidgetSize,
} from './springboardLayoutStore';

export const GRID_COLS = 4;
export const GRID_ROWS = 5;
/** A freshly-added widget's col/row before its final origin is known. */
export const UNPLACED_SENTINEL = -1;

/**
 * Widget shape the packer operates on. A minimal superset of
 * `WidgetInstance` with an explicit grid origin. Once the store migrates to
 * v2 (C2), `WidgetInstance` will itself satisfy this interface.
 */
export interface PackerWidget {
  id: string;
  kind: WidgetKind;
  size: WidgetSize;
  col: number;
  row: number;
}

export interface WidgetPlacement {
  id: string;
  kind: WidgetKind;
  size: WidgetSize;
  col: number;
  row: number;
  colSpan: number;
  rowSpan: number;
}

export interface AppPlacement {
  id: string;
  col: number;
  row: number;
}

export interface PackResult {
  widgetPlacements: WidgetPlacement[];
  appPlacements: AppPlacement[];
  /** App ids that didn't fit on this page; caller should cascade to next page. */
  overflowApps: string[];
}

type Occupancy = boolean[][];

function emptyOccupancy(): Occupancy {
  return Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(false));
}

/**
 * True iff every cell in the rectangle anchored at `(col, row)` with the
 * given size is free AND the rectangle fits inside the grid.
 */
export function canFit(
  occ: Occupancy,
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
): boolean {
  if (col < 0 || row < 0) return false;
  if (col + colSpan > GRID_COLS || row + rowSpan > GRID_ROWS) return false;
  for (let dr = 0; dr < rowSpan; dr += 1) {
    for (let dc = 0; dc < colSpan; dc += 1) {
      if (occ[row + dr]![col + dc]) return false;
    }
  }
  return true;
}

function mark(
  occ: Occupancy,
  col: number,
  row: number,
  colSpan: number,
  rowSpan: number,
): void {
  for (let dr = 0; dr < rowSpan; dr += 1) {
    for (let dc = 0; dc < colSpan; dc += 1) {
      occ[row + dr]![col + dc] = true;
    }
  }
}

/**
 * Find the first row-major origin where a widget of the given size fits.
 * Returns `null` if no such origin exists on the current occupancy.
 */
export function firstFit(
  size: WidgetSize,
  occ: Occupancy,
): { col: number; row: number } | null {
  const cs = WIDGET_COL_SPAN[size];
  const rs = WIDGET_ROW_SPAN[size];
  for (let r = 0; r + rs <= GRID_ROWS; r += 1) {
    for (let c = 0; c + cs <= GRID_COLS; c += 1) {
      if (canFit(occ, c, r, cs, rs)) return { col: c, row: r };
    }
  }
  return null;
}

/**
 * Clamp an origin so the widget's footprint stays inside the grid.
 * Does NOT check collisions — only bounds.
 */
export function clampOrigin(
  size: WidgetSize,
  col: number,
  row: number,
): { col: number; row: number } {
  const cs = WIDGET_COL_SPAN[size];
  const rs = WIDGET_ROW_SPAN[size];
  const maxCol = GRID_COLS - cs;
  const maxRow = GRID_ROWS - rs;
  return {
    col: Math.max(0, Math.min(col, maxCol)),
    row: Math.max(0, Math.min(row, maxRow)),
  };
}

export interface PackOptions {
  /** Per-widget origin overrides, used for drag preview. */
  overrides?: Record<string, { col: number; row: number }>;
}

/**
 * Pack a single springboard page.
 *
 * Widgets are placed in input order, respecting their stored origin (or
 * override, or first-fit if sentinel). Apps are then placed row-major into
 * whatever cells remain. Apps that don't fit overflow.
 *
 * Overlapping widgets (either from data corruption or a naive caller) are
 * silently dropped from the result to keep the grid consistent — the store
 * layer is expected to reject such moves before calling `packPage`.
 */
export function packPage(
  widgets: PackerWidget[],
  apps: string[],
  options: PackOptions = {},
): PackResult {
  const occ = emptyOccupancy();
  const widgetPlacements: WidgetPlacement[] = [];

  for (const w of widgets) {
    const cs = WIDGET_COL_SPAN[w.size];
    const rs = WIDGET_ROW_SPAN[w.size];

    const override = options.overrides?.[w.id];
    let col: number;
    let row: number;

    if (override) {
      col = override.col;
      row = override.row;
    } else if (w.col === UNPLACED_SENTINEL || w.row === UNPLACED_SENTINEL) {
      const fit = firstFit(w.size, occ);
      if (!fit) continue; // no room — drop from this page
      col = fit.col;
      row = fit.row;
    } else {
      col = w.col;
      row = w.row;
    }

    if (!canFit(occ, col, row, cs, rs)) {
      // Collision with a previously-placed widget; the caller violated the
      // contract. Drop it from the pack result rather than corrupting state.
      continue;
    }

    mark(occ, col, row, cs, rs);
    widgetPlacements.push({
      id: w.id,
      kind: w.kind,
      size: w.size,
      col,
      row,
      colSpan: cs,
      rowSpan: rs,
    });
  }

  const appPlacements: AppPlacement[] = [];
  const overflowApps: string[] = [];
  let cursor = 0;
  for (const id of apps) {
    // Advance the row-major cursor until we hit a free cell
    let placed = false;
    while (cursor < GRID_COLS * GRID_ROWS) {
      const r = Math.floor(cursor / GRID_COLS);
      const c = cursor % GRID_COLS;
      cursor += 1;
      if (!occ[r]![c]) {
        occ[r]![c] = true;
        appPlacements.push({ id, col: c, row: r });
        placed = true;
        break;
      }
    }
    if (!placed) overflowApps.push(id);
  }

  return { widgetPlacements, appPlacements, overflowApps };
}

/**
 * Number of free cells remaining on a page after widgets claim their space.
 * Useful for capacity checks in the store.
 */
export function freeCellCount(widgets: PackerWidget[]): number {
  let used = 0;
  for (const w of widgets) {
    used += WIDGET_COL_SPAN[w.size] * WIDGET_ROW_SPAN[w.size];
  }
  return Math.max(0, GRID_COLS * GRID_ROWS - used);
}

/**
 * Cascade app overflow across pages.
 *
 * Given a list of pages (widgets + apps per page), pack each page in order;
 * any overflow from page N is pushed to the front of page N+1 and the
 * packing re-runs. New empty pages are created as needed at the tail.
 *
 * Returns a new `appOrder` array (same length or longer than the input).
 * Widget arrays are unchanged — cascade only affects apps.
 */
export function cascadeOverflow(
  pageWidgets: PackerWidget[][],
  pageApps: string[][],
): string[][] {
  // Operate on a copy
  const widgets: PackerWidget[][] = pageWidgets.map((p) => p.slice());
  const apps: string[][] = pageApps.map((p) => p.slice());
  // Ensure both arrays are the same length
  while (widgets.length < apps.length) widgets.push([]);
  while (apps.length < widgets.length) apps.push([]);

  for (let p = 0; p < apps.length; p += 1) {
    const result = packPage(widgets[p]!, apps[p]!);
    if (result.overflowApps.length === 0) continue;

    // Keep only the apps that fit on this page
    apps[p] = result.appPlacements.map((a) => a.id);

    // Push overflow to next page (create one if needed)
    if (p + 1 >= apps.length) {
      apps.push([]);
      widgets.push([]);
    }
    apps[p + 1] = [...result.overflowApps, ...apps[p + 1]!];
  }

  // Trim trailing empty pages (preserve at least one)
  while (
    apps.length > 1 &&
    apps[apps.length - 1]!.length === 0 &&
    widgets[widgets.length - 1]!.length === 0
  ) {
    apps.pop();
    widgets.pop();
  }

  return apps;
}

/**
 * Try to move a widget (identified by `widgetId`, already present in `widgets`)
 * to a new origin on the same page. Returns a new widgets array with the move
 * applied and any collisions resolved via first-fit displacement, or `null`
 * if displacement is impossible.
 *
 * Shared between the store's `moveWidget` action (commit at drop time) and
 * the `IconGrid` drag preview (live layout reflow during drag). Mirrors the
 * rules enumerated in the M2 plan:
 *
 *   1. Clamp the requested origin to grid bounds.
 *   2. No collision → place directly.
 *   3. Collision → displace each colliding widget via firstFit on an
 *      occupancy containing the surviving widgets + the moving widget at
 *      its clamped origin. Order by id for determinism.
 *   4. Any displacement failure → return `null` (caller keeps the previous
 *      layout).
 *
 * Pure / side-effect-free: the input `widgets` array is not mutated; a new
 * array is returned on success. Widget ordering in the output is
 * `[...surviving, moving, ...displaced]` so callers can rely on it for
 * React keying if they wish.
 */
export function tryMoveWidget<W extends PackerWidget>(
  widgets: W[],
  widgetId: string,
  col: number,
  row: number,
): W[] | null {
  const movingIdx = widgets.findIndex((w) => w.id === widgetId);
  if (movingIdx === -1) return null;
  const moving = widgets[movingIdx]!;
  const others = widgets.filter((_, i) => i !== movingIdx);

  // Rule 1: clamp to grid bounds (guarantees moving.footprint ⊆ grid).
  const clamped = clampOrigin(moving.size, col, row);
  const mcs = WIDGET_COL_SPAN[moving.size];
  const mrs = WIDGET_ROW_SPAN[moving.size];

  const overlapsMoving = (w: W): boolean => {
    // Widgets with a sentinel origin aren't on the grid yet.
    if (w.col === UNPLACED_SENTINEL || w.row === UNPLACED_SENTINEL) return false;
    const cs = WIDGET_COL_SPAN[w.size];
    const rs = WIDGET_ROW_SPAN[w.size];
    return (
      clamped.col < w.col + cs &&
      clamped.col + mcs > w.col &&
      clamped.row < w.row + rs &&
      clamped.row + mrs > w.row
    );
  };

  const colliding = others.filter(overlapsMoving);
  const surviving = others.filter((w) => !overlapsMoving(w));

  // Rule 2: no collision → direct placement.
  if (colliding.length === 0) {
    return [...surviving, { ...moving, col: clamped.col, row: clamped.row }];
  }

  // Rule 3: displace each collider via firstFit. Build occupancy from the
  // survivors + the moving widget at its new origin.
  const occ: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array<boolean>(GRID_COLS).fill(false),
  );
  const markRect = (c: number, r: number, cs: number, rs: number): void => {
    for (let dr = 0; dr < rs; dr += 1) {
      for (let dc = 0; dc < cs; dc += 1) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr >= 0 && rr < GRID_ROWS && cc >= 0 && cc < GRID_COLS) {
          occ[rr]![cc] = true;
        }
      }
    }
  };
  for (const w of surviving) {
    if (w.col === UNPLACED_SENTINEL || w.row === UNPLACED_SENTINEL) continue;
    markRect(w.col, w.row, WIDGET_COL_SPAN[w.size], WIDGET_ROW_SPAN[w.size]);
  }
  markRect(clamped.col, clamped.row, mcs, mrs);

  const sorted = [...colliding].sort((a, b) => a.id.localeCompare(b.id));
  const displaced: W[] = [];
  for (const c of sorted) {
    const fit = firstFit(c.size, occ);
    // Rule 4: any failure → null, caller keeps the old layout.
    if (!fit) return null;
    displaced.push({ ...c, col: fit.col, row: fit.row });
    markRect(fit.col, fit.row, WIDGET_COL_SPAN[c.size], WIDGET_ROW_SPAN[c.size]);
  }

  return [
    ...surviving,
    { ...moving, col: clamped.col, row: clamped.row },
    ...displaced,
  ];
}
