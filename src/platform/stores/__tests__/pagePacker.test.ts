import { describe, it, expect } from 'vitest';
import {
  packPage,
  firstFit,
  canFit,
  clampOrigin,
  cascadeOverflow,
  freeCellCount,
  tryMoveWidget,
  GRID_COLS,
  GRID_ROWS,
  UNPLACED_SENTINEL,
  type PackerWidget,
} from '../pagePacker';

/**
 * Helper: make a fresh occupancy matrix for firstFit/canFit tests.
 */
function emptyOcc(): boolean[][] {
  return Array.from({ length: GRID_ROWS }, () =>
    Array<boolean>(GRID_COLS).fill(false),
  );
}

/** Helper: build a widget with sentinel origin unless specified. */
function w(
  id: string,
  size: PackerWidget['size'],
  col = UNPLACED_SENTINEL,
  row = UNPLACED_SENTINEL,
): PackerWidget {
  return { id, kind: 'clock', size, col, row };
}

/** Helper: generate N sequential app ids. */
function apps(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `app-${i}`);
}

describe('pagePacker — constants and helpers', () => {
  it('exports GRID_COLS=4 and GRID_ROWS=5 (20 cells)', () => {
    expect(GRID_COLS).toBe(4);
    expect(GRID_ROWS).toBe(5);
    expect(GRID_COLS * GRID_ROWS).toBe(20);
  });

  it('UNPLACED_SENTINEL is -1', () => {
    expect(UNPLACED_SENTINEL).toBe(-1);
  });
});

describe('pagePacker — canFit', () => {
  it('accepts a 2x2 fit at origin (0,0) on an empty grid', () => {
    expect(canFit(emptyOcc(), 0, 0, 2, 2)).toBe(true);
  });

  it('rejects out-of-bounds origins', () => {
    const occ = emptyOcc();
    expect(canFit(occ, -1, 0, 2, 2)).toBe(false);
    expect(canFit(occ, 0, -1, 2, 2)).toBe(false);
    expect(canFit(occ, 3, 0, 2, 2)).toBe(false); // 3+2=5 > 4 cols
    expect(canFit(occ, 0, 4, 2, 2)).toBe(false); // 4+2=6 > 5 rows
  });

  it('rejects when any cell in the rectangle is occupied', () => {
    const occ = emptyOcc();
    occ[1]![1] = true;
    expect(canFit(occ, 0, 0, 2, 2)).toBe(false);
    expect(canFit(occ, 0, 0, 2, 1)).toBe(true); // row 0 free
  });

  it('accepts the maximum 4x4 at origin (0,0) / (0,1)', () => {
    const occ = emptyOcc();
    expect(canFit(occ, 0, 0, 4, 4)).toBe(true);
    expect(canFit(occ, 0, 1, 4, 4)).toBe(true);
    expect(canFit(occ, 0, 2, 4, 4)).toBe(false); // 2+4=6 > 5
  });
});

describe('pagePacker — firstFit', () => {
  it('returns (0,0) on an empty grid for any size', () => {
    expect(firstFit('2x2', emptyOcc())).toEqual({ col: 0, row: 0 });
    expect(firstFit('4x2', emptyOcc())).toEqual({ col: 0, row: 0 });
    expect(firstFit('4x4', emptyOcc())).toEqual({ col: 0, row: 0 });
  });

  it('scans row-major and picks the first free origin', () => {
    const occ = emptyOcc();
    // Block (0,0) 2x2 corner
    for (let r = 0; r < 2; r += 1) {
      for (let c = 0; c < 2; c += 1) {
        occ[r]![c] = true;
      }
    }
    const fit = firstFit('2x2', occ);
    expect(fit).toEqual({ col: 2, row: 0 });
  });

  it('returns null when no origin fits', () => {
    const occ = emptyOcc();
    // Fill every cell
    for (let r = 0; r < GRID_ROWS; r += 1) {
      for (let c = 0; c < GRID_COLS; c += 1) {
        occ[r]![c] = true;
      }
    }
    expect(firstFit('2x2', occ)).toBeNull();
  });

  it('returns null for a 4x4 when both candidate origins are blocked', () => {
    const occ = emptyOcc();
    // 4x4 candidate origins are (0,0) and (0,1). Block a cell inside each
    // footprint so neither can fit.
    occ[0]![0] = true; // kills origin (0,0)
    occ[1]![0] = true; // kills origin (0,1) — (1,0) is inside the (0,1)..(3,4) rectangle
    expect(firstFit('4x4', occ)).toBeNull();
  });
});

describe('pagePacker — clampOrigin', () => {
  it('leaves in-bounds origins unchanged', () => {
    expect(clampOrigin('2x2', 1, 2)).toEqual({ col: 1, row: 2 });
  });

  it('clamps negative to zero', () => {
    expect(clampOrigin('2x2', -5, -3)).toEqual({ col: 0, row: 0 });
  });

  it('clamps past the right/bottom edge', () => {
    // 2x2 max origin is (2, 3)
    expect(clampOrigin('2x2', 10, 10)).toEqual({ col: 2, row: 3 });
    // 4x2 max origin is (0, 3)
    expect(clampOrigin('4x2', 2, 99)).toEqual({ col: 0, row: 3 });
    // 4x4 max origin is (0, 1)
    expect(clampOrigin('4x4', 5, 5)).toEqual({ col: 0, row: 1 });
  });
});

describe('pagePacker — freeCellCount', () => {
  it('returns 20 for an empty page', () => {
    expect(freeCellCount([])).toBe(20);
  });

  it('subtracts widget cells', () => {
    expect(freeCellCount([w('a', '2x2', 0, 0)])).toBe(16); // 20 - 4
    expect(freeCellCount([w('a', '4x2', 0, 0)])).toBe(12); // 20 - 8
    expect(freeCellCount([w('a', '4x4', 0, 0)])).toBe(4); // 20 - 16
  });

  it('sums multiple widgets and clamps at zero', () => {
    const ws = [w('a', '4x4', 0, 0), w('b', '4x2', 0, 4)]; // 16 + 8
    expect(freeCellCount(ws)).toBe(0);
  });
});

describe('pagePacker — packPage (apps only)', () => {
  it('returns empty placements for an empty page', () => {
    const result = packPage([], []);
    expect(result.widgetPlacements).toEqual([]);
    expect(result.appPlacements).toEqual([]);
    expect(result.overflowApps).toEqual([]);
  });

  it('places 20 apps row-major with no widgets', () => {
    const ids = apps(20);
    const result = packPage([], ids);
    expect(result.appPlacements).toHaveLength(20);
    expect(result.overflowApps).toEqual([]);
    // spot-check corners
    expect(result.appPlacements[0]).toEqual({ id: 'app-0', col: 0, row: 0 });
    expect(result.appPlacements[3]).toEqual({ id: 'app-3', col: 3, row: 0 });
    expect(result.appPlacements[4]).toEqual({ id: 'app-4', col: 0, row: 1 });
    expect(result.appPlacements[19]).toEqual({ id: 'app-19', col: 3, row: 4 });
  });

  it('reports overflow when too many apps are given', () => {
    const ids = apps(22);
    const result = packPage([], ids);
    expect(result.appPlacements).toHaveLength(20);
    expect(result.overflowApps).toEqual(['app-20', 'app-21']);
  });
});

describe('pagePacker — packPage (widgets)', () => {
  it('honors stored col/row for a non-sentinel widget', () => {
    const result = packPage([w('widget-1', '2x2', 2, 1)], []);
    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.widgetPlacements[0]).toMatchObject({
      id: 'widget-1',
      col: 2,
      row: 1,
      colSpan: 2,
      rowSpan: 2,
    });
  });

  it('runs firstFit when the widget has a sentinel origin', () => {
    const result = packPage([w('widget-1', '4x4')], []);
    expect(result.widgetPlacements[0]).toMatchObject({
      col: 0,
      row: 0,
      colSpan: 4,
      rowSpan: 4,
    });
  });

  it('places 1×(4x4) + apps → widget at (0,0), apps fill row 4 only', () => {
    // 4x4 eats rows 0..3; only row 4 (4 cells) remains for apps.
    const ids = apps(10);
    const result = packPage([w('big', '4x4', 0, 0)], ids);
    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.appPlacements).toHaveLength(4);
    expect(result.overflowApps).toEqual(['app-4', 'app-5', 'app-6', 'app-7', 'app-8', 'app-9']);
    // First app lands at (0, 4)
    expect(result.appPlacements[0]).toEqual({ id: 'app-0', col: 0, row: 4 });
    expect(result.appPlacements[3]).toEqual({ id: 'app-3', col: 3, row: 4 });
  });

  it('packs 2×(4x2) correctly — rows 0..1 and 2..3 are widgets, row 4 is apps', () => {
    const widgets = [w('a', '4x2', 0, 0), w('b', '4x2', 0, 2)];
    const ids = apps(4);
    const result = packPage(widgets, ids);
    expect(result.widgetPlacements).toHaveLength(2);
    expect(result.appPlacements).toHaveLength(4);
    expect(result.appPlacements.map((p) => p.row)).toEqual([4, 4, 4, 4]);
    expect(result.overflowApps).toEqual([]);
  });

  it('fills around a 2x2 widget in the corner', () => {
    // 2x2 at (0,0) leaves an L-shape: row 0 cells (2,0)(3,0), row 1 cells (2,1)(3,1),
    // then rows 2..4 all free.
    const ids = apps(16); // 20 - 4 = 16
    const result = packPage([w('tiny', '2x2', 0, 0)], ids);
    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.appPlacements).toHaveLength(16);
    expect(result.overflowApps).toEqual([]);
    // first app should land at (2,0)
    expect(result.appPlacements[0]).toEqual({ id: 'app-0', col: 2, row: 0 });
    expect(result.appPlacements[1]).toEqual({ id: 'app-1', col: 3, row: 0 });
    expect(result.appPlacements[2]).toEqual({ id: 'app-2', col: 2, row: 1 });
    expect(result.appPlacements[3]).toEqual({ id: 'app-3', col: 3, row: 1 });
    // row 2 starts filling from col 0
    expect(result.appPlacements[4]).toEqual({ id: 'app-4', col: 0, row: 2 });
  });

  it('silently drops widgets whose footprint overlaps a previously-placed widget', () => {
    // Both widgets claim (0,0) as origin — input order wins, second is dropped.
    const widgets = [w('a', '2x2', 0, 0), w('b', '2x2', 0, 0)];
    const result = packPage(widgets, []);
    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.widgetPlacements[0]!.id).toBe('a');
  });

  it('drops a widget whose stored origin is out of bounds', () => {
    // 2x2 at col=3 overflows (3+2=5 > 4)
    const result = packPage([w('bad', '2x2', 3, 0)], []);
    expect(result.widgetPlacements).toEqual([]);
  });

  it('applies overrides (drag preview) in priority over stored origin', () => {
    const widgets = [w('a', '2x2', 0, 0)];
    const result = packPage(widgets, [], {
      overrides: { a: { col: 2, row: 3 } },
    });
    expect(result.widgetPlacements[0]).toMatchObject({ col: 2, row: 3 });
  });

  it('overrides take precedence even over the sentinel branch', () => {
    const widgets = [w('a', '2x2')]; // sentinel origin
    const result = packPage(widgets, [], {
      overrides: { a: { col: 2, row: 2 } },
    });
    expect(result.widgetPlacements[0]).toMatchObject({ col: 2, row: 2 });
  });

  it('sentinel widgets fall back to firstFit around already-placed widgets', () => {
    const widgets = [
      w('fixed', '2x2', 0, 0), // occupies (0,0)..(1,1)
      w('flex', '2x2'), // sentinel → should land at (2,0)
    ];
    const result = packPage(widgets, []);
    expect(result.widgetPlacements).toHaveLength(2);
    expect(result.widgetPlacements[1]).toMatchObject({
      id: 'flex',
      col: 2,
      row: 0,
    });
  });

  it('drops a sentinel widget that cannot be placed anywhere', () => {
    const widgets = [
      w('a', '4x4', 0, 0), // claims rows 0..3
      w('b', '4x4'), // no room for a second 4x4
    ];
    const result = packPage(widgets, []);
    expect(result.widgetPlacements).toHaveLength(1);
    expect(result.widgetPlacements[0]!.id).toBe('a');
  });
});

describe('pagePacker — cascadeOverflow', () => {
  it('is a no-op when every page fits', () => {
    const result = cascadeOverflow([[]], [apps(10)]);
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(10);
  });

  it('cascades 4x4 + 20 apps: 4 apps stay, 16 overflow to page 2', () => {
    // 20-cell page with a 4x4 widget only has room for 4 apps.
    const ids = apps(20);
    const result = cascadeOverflow([[w('big', '4x4', 0, 0)]], [ids]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(4);
    expect(result[0]).toEqual(['app-0', 'app-1', 'app-2', 'app-3']);
    expect(result[1]).toHaveLength(16);
    expect(result[1]![0]).toBe('app-4');
    expect(result[1]![15]).toBe('app-19');
  });

  it('creates multiple new pages when overflow is very large', () => {
    // Single page with 40 apps → needs 2 pages minimum.
    const result = cascadeOverflow([[]], [apps(40)]);
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(20);
    expect(result[1]).toHaveLength(20);
  });

  it('chains overflow across multiple pages (4x4 on each of 2 starting pages)', () => {
    // Page 0: 4x4 widget + 10 apps (4 fit, 6 overflow to page 1)
    // Page 1: 4x4 widget + 0 apps but receives 6 apps from page 0 (4 fit, 2 overflow)
    // Result: page 2 holds the final 2 apps.
    const ids0 = apps(10);
    const result = cascadeOverflow(
      [[w('big0', '4x4', 0, 0)], [w('big1', '4x4', 0, 0)]],
      [ids0, []],
    );
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(4); // 4 of ids0 fit
    expect(result[1]).toHaveLength(4); // 4 of the overflow fit
    expect(result[2]).toHaveLength(2); // last 2 cascade to new page
    expect(result[2]).toEqual(['app-8', 'app-9']);
  });

  it('preserves relative app order during cascade', () => {
    // 25 apps on page 0 → 20 fit, 5 overflow to new page 1, retaining order.
    const ids = apps(25);
    const result = cascadeOverflow([[]], [ids]);
    expect(result[0]).toEqual(apps(20));
    expect(result[1]).toEqual(['app-20', 'app-21', 'app-22', 'app-23', 'app-24']);
  });

  it('trims trailing empty pages but keeps at least one page', () => {
    const result = cascadeOverflow([[], []], [[], []]);
    // Both pages empty → trim down to one page
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual([]);
  });

  it('does not trim a trailing page that holds widgets', () => {
    const result = cascadeOverflow([[], [w('a', '2x2', 0, 0)]], [['x'], []]);
    // Page 1 has a widget, so it must not be trimmed even though it has no apps.
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual(['x']);
    expect(result[1]).toEqual([]);
  });
});

describe('tryMoveWidget', () => {
  it('returns null when widgetId is not in the array', () => {
    const ws = [w('a', '2x2', 0, 0)];
    expect(tryMoveWidget(ws, 'ghost', 2, 2)).toBeNull();
  });

  it('moves a widget with no collisions', () => {
    const ws = [w('a', '2x2', 0, 0)];
    const result = tryMoveWidget(ws, 'a', 2, 3);
    expect(result).not.toBeNull();
    expect(result!).toHaveLength(1);
    expect(result![0]).toMatchObject({ id: 'a', col: 2, row: 3 });
    // Input must not be mutated.
    expect(ws[0]).toMatchObject({ col: 0, row: 0 });
  });

  it('clamps a move that would exit the grid on the right edge', () => {
    const ws = [w('a', '2x2', 0, 0)];
    // Request col=99 → clamped to 4 - 2 = 2.
    const result = tryMoveWidget(ws, 'a', 99, 0);
    expect(result![0]).toMatchObject({ col: 2, row: 0 });
  });

  it('clamps a move that would exit the grid on the bottom edge', () => {
    const ws = [w('a', '4x4', 0, 0)];
    // 4x4 has rowSpan 4 → max row = 5 - 4 = 1.
    const result = tryMoveWidget(ws, 'a', 0, 99);
    expect(result![0]).toMatchObject({ col: 0, row: 1 });
  });

  it('swaps two same-size widgets when the target collides with the other', () => {
    // 'a' at (0,0) and 'b' at (2,0), both 2x2. Move 'a' onto (2,0) → 'b' is
    // displaced via firstFit, which (with 'a' at (2,0)) returns (0,0).
    const ws = [w('a', '2x2', 0, 0), w('b', '2x2', 2, 0)];
    const result = tryMoveWidget(ws, 'a', 2, 0);
    expect(result).not.toBeNull();
    const byId = new Map(result!.map((r) => [r.id, r]));
    expect(byId.get('a')).toMatchObject({ col: 2, row: 0 });
    expect(byId.get('b')).toMatchObject({ col: 0, row: 0 });
  });

  it('displaces a smaller widget via firstFit when a larger one lands on it', () => {
    // 'big' is 4x2 at (0,0), 'small' is 2x2 at (0,2). Move 'big' to (0,2)
    // (which overlaps 'small'). firstFit for small-surviving occupancy =
    // [big at (0,2)] → small lands at (0,0).
    const ws = [w('big', '4x2', 0, 0), w('small', '2x2', 0, 2)];
    const result = tryMoveWidget(ws, 'big', 0, 2);
    expect(result).not.toBeNull();
    const byId = new Map(result!.map((r) => [r.id, r]));
    expect(byId.get('big')).toMatchObject({ col: 0, row: 2 });
    expect(byId.get('small')).toMatchObject({ col: 0, row: 0 });
  });

  it('returns null when a collider cannot be re-placed anywhere', () => {
    // Page is full of 4x4 + 4x1... we only have 4x4 sizes so: set up a
    // scenario where moving 'a' (4x4) displaces 'b' (4x4) with nowhere to go.
    // 'a' at (0,0), 'b' at (0,1) would overlap. Moving 'b' anywhere else:
    // a 4x4 needs 4 rows. With 'a' at (0,0) (rows 0..3), the only available
    // row origin is 1 but a 4x4 at row 1 needs rows 1..4 which conflict with
    // 'a' (0..3). Hence firstFit for 'b' fails → null.
    const ws = [w('a', '4x4', 0, 0), w('b', '4x4', 0, 1)];
    const result = tryMoveWidget(ws, 'a', 0, 1);
    // After clamping, a 4x4 at row 1 uses rows 1..4. 'b' is at rows 1..4
    // but can't go anywhere else because row 0 would need 4 rows that
    // overlap 'a'. Result: null.
    expect(result).toBeNull();
  });

  it('no-op move returns the same origin for the moving widget', () => {
    const ws = [w('a', '2x2', 0, 0)];
    const result = tryMoveWidget(ws, 'a', 0, 0);
    expect(result).not.toBeNull();
    expect(result![0]).toMatchObject({ col: 0, row: 0 });
  });

  it('ignores widgets with sentinel origins when checking for collisions', () => {
    const ws = [
      w('a', '2x2', 0, 0),
      // 'pending' is unplaced; must not prevent 'a' from moving.
      w('pending', '2x2', UNPLACED_SENTINEL, UNPLACED_SENTINEL),
    ];
    const result = tryMoveWidget(ws, 'a', 2, 0);
    expect(result).not.toBeNull();
    // 'pending' still in the result, unchanged.
    const pending = result!.find((x) => x.id === 'pending');
    expect(pending).toBeDefined();
    expect(pending!.col).toBe(UNPLACED_SENTINEL);
  });
});
