import { describe, it, expect } from 'vitest';
import { getDropTarget, getWidgetDropTarget } from '../useIconDrag';
import type { SpringboardMetrics } from '../../Device/viewportProfile';
import type { PackerWidget } from '@/platform/stores/pagePacker';

const metrics: SpringboardMetrics = {
  sidePadding: 22,
  iconSize: 60,
  cellWidth: 75,
  labelSize: 12,
  gridGapY: 20,
  dockPaddingY: 8,
  springboardTopPadding: 16,
};

const VIEWPORT_WIDTH = 430;

const idsOfLength = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `app-${i}`);

describe('getDropTarget', () => {
  it('maps top-left corner to local index 0', () => {
    const result = getDropTarget(
      metrics.sidePadding + 10,
      10,
      0,
      [],
      idsOfLength(20),
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result).toEqual({ page: 0, localIndex: 0 });
  });

  it('maps second column first row to local index 1', () => {
    const cellW = (VIEWPORT_WIDTH - metrics.sidePadding * 2) / 4;
    const result = getDropTarget(
      metrics.sidePadding + cellW + 10,
      10,
      0,
      [],
      idsOfLength(20),
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result).toEqual({ page: 0, localIndex: 1 });
  });

  it('maps first column second row to local index 4 with no widgets', () => {
    const contentH = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
    const rowH = contentH + metrics.gridGapY;
    const result = getDropTarget(
      metrics.sidePadding + 10,
      rowH + 10,
      0,
      [],
      idsOfLength(20),
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result).toEqual({ page: 0, localIndex: 4 });
  });

  it('clamps to app count when hovering past last app', () => {
    const result = getDropTarget(
      VIEWPORT_WIDTH + 100,
      9999,
      0,
      [],
      idsOfLength(20),
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result.localIndex).toBeLessThanOrEqual(20);
  });

  it('returns page index passed in', () => {
    const result = getDropTarget(
      metrics.sidePadding + 10,
      10,
      3,
      [],
      idsOfLength(5),
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result.page).toBe(3);
  });

  it('clamps negative coordinates to index 0', () => {
    const result = getDropTarget(
      -100,
      -100,
      0,
      [],
      idsOfLength(20),
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result).toEqual({ page: 0, localIndex: 0 });
  });

  it('allows drop on empty page at index 0', () => {
    const result = getDropTarget(
      metrics.sidePadding + 10,
      10,
      3,
      [],
      [],
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result).toEqual({ page: 3, localIndex: 0 });
  });

  describe('with widgets occupying cells', () => {
    // 4x2 widget on rows 0-1 → first 8 cells are widget; apps fill row 2+
    const banner: PackerWidget = {
      id: 'w-banner',
      kind: 'photo',
      size: '4x2',
      col: 0,
      row: 0,
    };

    const contentH = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
    const rowH = contentH + metrics.gridGapY;

    it('hovering at (col 0, row 2) maps to localIndex 0 (first app)', () => {
      // First app slot lives at row 2 (rows 0-1 are occupied by the banner).
      const result = getDropTarget(
        metrics.sidePadding + 10,
        rowH * 2 + 10,
        0,
        [banner],
        idsOfLength(8),
        metrics,
        VIEWPORT_WIDTH,
      );
      expect(result).toEqual({ page: 0, localIndex: 0 });
    });

    it('hovering at (col 1, row 2) maps to localIndex 1', () => {
      const cellW = (VIEWPORT_WIDTH - metrics.sidePadding * 2) / 4;
      const result = getDropTarget(
        metrics.sidePadding + cellW + 5,
        rowH * 2 + 10,
        0,
        [banner],
        idsOfLength(8),
        metrics,
        VIEWPORT_WIDTH,
      );
      expect(result.localIndex).toBe(1);
    });

    it('hovering on a widget cell falls forward to the next free app slot', () => {
      // (col 0, row 0) is inside the banner — the next app slot is row 2 col 0,
      // which is localIndex 0 in the post-removal apps list.
      const result = getDropTarget(
        metrics.sidePadding + 10,
        10,
        0,
        [banner],
        idsOfLength(8),
        metrics,
        VIEWPORT_WIDTH,
      );
      expect(result).toEqual({ page: 0, localIndex: 0 });
    });

    it('hovering past the last app appends', () => {
      const result = getDropTarget(
        VIEWPORT_WIDTH + 100,
        9999,
        0,
        [banner],
        idsOfLength(4),
        metrics,
        VIEWPORT_WIDTH,
      );
      expect(result.localIndex).toBe(4);
    });
  });
});

describe('getWidgetDropTarget', () => {
  const cellW = (VIEWPORT_WIDTH - metrics.sidePadding * 2) / 4;
  const contentH = 4 + metrics.iconSize + 4 + metrics.labelSize * 1.2 + 4;
  const rowH = contentH + metrics.gridGapY;

  it('snaps a 2x2 ghost at the top-left to origin (0, 0)', () => {
    const result = getWidgetDropTarget(
      metrics.sidePadding, // widget top-left x in gesture-area coords
      0,
      '2x2',
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result).toEqual({ col: 0, row: 0 });
  });

  it('clamps a 2x2 dragged past the right edge to max col (2)', () => {
    const result = getWidgetDropTarget(
      9999,
      0,
      '2x2',
      metrics,
      VIEWPORT_WIDTH,
    );
    // 2x2 occupies 2 cols so max origin col is 4 - 2 = 2
    expect(result.col).toBe(2);
    expect(result.row).toBe(0);
  });

  it('clamps a 4x4 dragged past the bottom to max row (1)', () => {
    const result = getWidgetDropTarget(
      metrics.sidePadding,
      9999,
      '4x4',
      metrics,
      VIEWPORT_WIDTH,
    );
    // 4x4 occupies 4 rows so max origin row is 5 - 4 = 1
    expect(result.col).toBe(0);
    expect(result.row).toBe(1);
  });

  it('clamps a 4x2 dragged to negative coords to origin (0, 0)', () => {
    const result = getWidgetDropTarget(
      -500,
      -500,
      '4x2',
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result).toEqual({ col: 0, row: 0 });
  });

  it('snaps to the next column once half-cell threshold is crossed', () => {
    // Place the ghost top-left at ~half a cell past the origin column
    const x = metrics.sidePadding + cellW * 0.5 + 1;
    const result = getWidgetDropTarget(x, 0, '2x2', metrics, VIEWPORT_WIDTH);
    expect(result.col).toBe(1);
    expect(result.row).toBe(0);
  });

  it('does not snap to the next column until half-cell threshold is crossed', () => {
    // Just under half a cell into the origin column
    const x = metrics.sidePadding + cellW * 0.5 - 1;
    const result = getWidgetDropTarget(x, 0, '2x2', metrics, VIEWPORT_WIDTH);
    expect(result.col).toBe(0);
    expect(result.row).toBe(0);
  });

  it('snaps to the next row once half-row threshold is crossed', () => {
    const y = rowH * 0.5 + 1;
    const result = getWidgetDropTarget(
      metrics.sidePadding,
      y,
      '2x2',
      metrics,
      VIEWPORT_WIDTH,
    );
    expect(result.row).toBe(1);
    expect(result.col).toBe(0);
  });

  it('accepts 4x2 at origin (0, 3) near the bottom', () => {
    const y = rowH * 3;
    const result = getWidgetDropTarget(
      metrics.sidePadding,
      y,
      '4x2',
      metrics,
      VIEWPORT_WIDTH,
    );
    // 4x2 row span = 2, so max row = 3. (0, 3) is valid.
    expect(result).toEqual({ col: 0, row: 3 });
  });
});
