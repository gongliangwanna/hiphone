import { describe, it, expect, beforeEach } from 'vitest';
import {
  DOCK_CAPACITY,
  resolveDock,
  useSpringboardLayoutStore,
  resolveOrderedPages,
  resolveSlotPages,
  pageAppCapacity,
  WIDGET_CELLS,
  type WidgetInstance,
} from '../springboardLayoutStore';
import {
  apps,
  DEFAULT_DOCK_IDS,
  getAppsWithUserInstalled,
} from '@/shell/Springboard/apps.data';
import { useInstalledUserAppsStore } from '../installedUserAppsStore';

function resetStore() {
  useInstalledUserAppsStore.setState({ apps: [] });
  useSpringboardLayoutStore.setState({
    appOrder: null,
    pageWidgets: null,
    dockOrder: null,
    isEditMode: false,
    isWidgetDrawerOpen: false,
    recentlyAddedItemId: null,
  });
}

describe('springboardLayoutStore', () => {
  beforeEach(resetStore);

  describe('resolveOrderedPages', () => {
    it('returns default pages when appOrder is null', () => {
      const pages = resolveOrderedPages(null);
      expect(pages.length).toBe(Math.max(1, Math.ceil(apps.length / 20)));
      expect(pages[0]!.length).toBe(Math.min(20, apps.length));
      expect(pages[0]![0]!.id).toBe(apps[0]!.id);
    });

    it('resolves a custom page order', () => {
      const order = [[apps[2]!.id, apps[0]!.id], [apps[1]!.id]];
      const pages = resolveOrderedPages(order);
      expect(pages[0]![0]!.id).toBe(apps[2]!.id);
      expect(pages[0]![1]!.id).toBe(apps[0]!.id);
      expect(pages[1]![0]!.id).toBe(apps[1]!.id);
    });

    it('filters out IDs that no longer exist in the registry', () => {
      const order = [['nonexistent-app', apps[0]!.id]];
      const pages = resolveOrderedPages(order);
      expect(pages[0]![0]!.id).toBe(apps[0]!.id);
    });

    it('appends new apps not found in any page', () => {
      const order = [[apps[0]!.id]];
      const pages = resolveOrderedPages(order);
      // First page has app[0] + unseen apps up to the page capacity.
      expect(pages[0]!.length).toBe(Math.min(20, apps.length));
      // Remaining unseen apps are on subsequent pages
      const totalApps = pages.reduce((sum, p) => sum + p.length, 0);
      expect(totalApps).toBe(apps.length);
    });
  });

  describe('editMode', () => {
    it('starts with isEditMode false', () => {
      expect(useSpringboardLayoutStore.getState().isEditMode).toBe(false);
    });

    it('enters edit mode', () => {
      useSpringboardLayoutStore.getState().enterEditMode();
      expect(useSpringboardLayoutStore.getState().isEditMode).toBe(true);
    });

    it('exits edit mode and cleans up empty pages', () => {
      // Set up pages with an empty page
      useSpringboardLayoutStore.setState({
        appOrder: [[apps[0]!.id], [], [apps[1]!.id]],
        isEditMode: true,
      });
      useSpringboardLayoutStore.getState().exitEditMode();
      expect(useSpringboardLayoutStore.getState().isEditMode).toBe(false);
      // Empty page removed
      const order = useSpringboardLayoutStore.getState().appOrder!;
      expect(order.length).toBe(2);
      expect(order.every((p) => p.length > 0)).toBe(true);
    });
  });

  describe('moveApp', () => {
    it('moves an app within the same page', () => {
      const store = useSpringboardLayoutStore.getState();
      store.moveApp(0, 0, 0, 2);
      const order = useSpringboardLayoutStore.getState().appOrder!;
      // First app moved from position 0 to position 2
      expect(order[0]![0]).toBe(apps[1]!.id);
      expect(order[0]![1]).toBe(apps[2]!.id);
      expect(order[0]![2]).toBe(apps[0]!.id);
    });

    it('moves an app to a different existing page', () => {
      const initialOrder = [
        apps.slice(0, 5).map((a) => a.id),
        apps.slice(5).map((a) => a.id),
      ];
      useSpringboardLayoutStore.setState({ appOrder: initialOrder });
      const store = useSpringboardLayoutStore.getState();
      store.moveApp(0, 0, 1, 0);
      const order = useSpringboardLayoutStore.getState().appOrder!;
      // First app from page 0 is now first on page 1.
      expect(order[0]).toEqual(initialOrder[0]!.slice(1));
      expect(order[1]![0]).toBe(apps[0]!.id);
    });

    it('creates a new page when target page does not exist', () => {
      const store = useSpringboardLayoutStore.getState();
      store.moveApp(0, 0, 5, 0);
      const order = useSpringboardLayoutStore.getState().appOrder!;
      // Page 5 should now exist with the moved app
      expect(order[5]![0]).toBe(apps[0]!.id);
    });

    it('moves an installed user app onto newly created pages', () => {
      useInstalledUserAppsStore.setState({
        apps: [
          {
            id: 'user-drag-app',
            name: '用户 App',
            iconDataUrl: null,
            page: 1,
            perspectiveAware: false,
            version: '1.0.0',
            installedAt: 1_700_000_000_000,
            sizeBytes: 0,
          },
        ],
      });

      const store = useSpringboardLayoutStore.getState();
      const userAppIndex = apps.length;

      store.moveApp(0, userAppIndex, 1, 0);
      let order = useSpringboardLayoutStore.getState().appOrder!;
      expect(order[1]![0]).toBe('user-drag-app');

      store.moveApp(1, 0, 2, 0);
      order = useSpringboardLayoutStore.getState().appOrder!;
      expect(order[2]![0]).toBe('user-drag-app');
    });

    it('does nothing for invalid source', () => {
      const store = useSpringboardLayoutStore.getState();
      store.moveApp(99, 0, 0, 0);
      expect(useSpringboardLayoutStore.getState().appOrder).toBeNull();
    });

    it('cascades overflow when a page exceeds widget-adjusted capacity', () => {
      const store = useSpringboardLayoutStore.getState();
      useSpringboardLayoutStore.setState({
        appOrder: [apps.slice(0, 10).map((a) => a.id)],
        pageWidgets: [
          [{ id: 'big', kind: 'photo', size: '4x4', col: 0, row: 0, styleIndex: 0 }],
        ],
      });
      // Page 0 has a 4x4 widget, so only 4 app cells remain. Any move on
      // that page should cascade the overflow forward.
      store.moveApp(0, 0, 0, 2);
      const order = useSpringboardLayoutStore.getState().appOrder!;
      expect(order[0]!.length).toBeLessThanOrEqual(4);
      expect(order.flat()).toHaveLength(apps.length);
    });
  });

  describe('widgetDrawer', () => {
    it('starts closed', () => {
      expect(useSpringboardLayoutStore.getState().isWidgetDrawerOpen).toBe(false);
    });

    it('opens and closes', () => {
      useSpringboardLayoutStore.getState().openWidgetDrawer();
      expect(useSpringboardLayoutStore.getState().isWidgetDrawerOpen).toBe(true);
      useSpringboardLayoutStore.getState().closeWidgetDrawer();
      expect(useSpringboardLayoutStore.getState().isWidgetDrawerOpen).toBe(false);
    });

    it('closes when exiting edit mode', () => {
      useSpringboardLayoutStore.setState({
        isEditMode: true,
        isWidgetDrawerOpen: true,
      });
      useSpringboardLayoutStore.getState().exitEditMode();
      expect(useSpringboardLayoutStore.getState().isWidgetDrawerOpen).toBe(false);
    });
  });

  describe('resetLayout', () => {
    it('resets appOrder to null', () => {
      useSpringboardLayoutStore.getState().moveApp(0, 0, 0, 1);
      expect(useSpringboardLayoutStore.getState().appOrder).not.toBeNull();
      useSpringboardLayoutStore.getState().resetLayout();
      expect(useSpringboardLayoutStore.getState().appOrder).toBeNull();
    });

    it('resets pageWidgets to null', () => {
      useSpringboardLayoutStore.getState().addWidget(0, 'clock', '2x2');
      expect(useSpringboardLayoutStore.getState().pageWidgets).not.toBeNull();
      useSpringboardLayoutStore.getState().resetLayout();
      expect(useSpringboardLayoutStore.getState().pageWidgets).toBeNull();
    });
  });

  describe('widget slot model', () => {
    it('WIDGET_CELLS sums match spec', () => {
      expect(WIDGET_CELLS['2x2']).toBe(4);
      expect(WIDGET_CELLS['4x2']).toBe(8);
      expect(WIDGET_CELLS['4x4']).toBe(16);
    });

    it('pageAppCapacity respects widget occupancy', () => {
      expect(pageAppCapacity(undefined)).toBe(20);
      const w: WidgetInstance = { id: 'w1', kind: 'clock', size: '2x2', col: 0, row: 0, styleIndex: 0 };
      expect(pageAppCapacity([w])).toBe(16);
      const w2: WidgetInstance = { id: 'w2', kind: 'weather', size: '4x4', col: 0, row: 0, styleIndex: 0 };
      expect(pageAppCapacity([w, w2])).toBe(0);
    });
  });

  describe('addWidget', () => {
    it('adds a widget to a page and returns an instance id', () => {
      const id = useSpringboardLayoutStore.getState().addWidget(0, 'clock', '2x2');
      expect(id).not.toBeNull();
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw[0]!.length).toBe(1);
      expect(pw[0]![0]!.kind).toBe('clock');
      expect(pw[0]![0]!.size).toBe('2x2');
      expect(pw[0]![0]!.id).toBe(id);
    });

    it('creates intermediate pages when adding to a later page', () => {
      useSpringboardLayoutStore.getState().addWidget(2, 'weather', '4x2');
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw.length).toBeGreaterThanOrEqual(3);
      expect(pw[2]!.length).toBe(1);
    });

    it('refuses widgets that would exceed the page cell budget', () => {
      useSpringboardLayoutStore.getState().addWidget(0, 'photo', '4x4'); // 16 cells
      const ok = useSpringboardLayoutStore.getState().addWidget(0, 'weather', '4x2'); // 8 more = 24
      expect(ok).toBeNull();
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw[0]!.length).toBe(1);
    });
  });

  describe('removeWidget', () => {
    it('removes a widget by id', () => {
      const id = useSpringboardLayoutStore.getState().addWidget(0, 'music', '2x2')!;
      useSpringboardLayoutStore.getState().removeWidget(0, id);
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw[0]).toEqual([]);
    });

    it('is a no-op for unknown ids', () => {
      useSpringboardLayoutStore.getState().addWidget(0, 'clock', '2x2');
      const before = useSpringboardLayoutStore.getState().pageWidgets;
      useSpringboardLayoutStore.getState().removeWidget(0, 'nope');
      const after = useSpringboardLayoutStore.getState().pageWidgets;
      expect(after![0]!.length).toBe(before![0]!.length);
    });
  });

  describe('resolveSlotPages', () => {
    it('places widgets before apps on the same page', () => {
      const widgets: WidgetInstance[][] = [
        [{ id: 'w1', kind: 'clock', size: '2x2', col: 0, row: 0, styleIndex: 0 }],
      ];
      const slots = resolveSlotPages(null, widgets);
      expect(slots[0]![0]!.type).toBe('widget');
      expect(slots[0]![1]!.type).toBe('app');
    });

    it('reduces page app capacity by widget cells', () => {
      // One 4x4 widget on page 0 should leave 4 app slots on page 0
      const widgets: WidgetInstance[][] = [
        [{ id: 'w1', kind: 'photo', size: '4x4', col: 0, row: 0, styleIndex: 0 }],
      ];
      const slots = resolveSlotPages(null, widgets);
      const page0Apps = slots[0]!.filter((s) => s.type === 'app');
      expect(page0Apps.length).toBe(4);
    });

    it('resolveOrderedPages still returns app-only view', () => {
      const widgets: WidgetInstance[][] = [
        [{ id: 'w1', kind: 'clock', size: '2x2', col: 0, row: 0, styleIndex: 0 }],
      ];
      const pages = resolveOrderedPages(null, widgets);
      // A 2x2 widget leaves at most 16 app slots on page 0.
      expect(pages[0]!.length).toBe(Math.min(16, apps.length));
    });
  });

  describe('addWidget — origin + recentlyAddedItemId', () => {
    it('assigns a concrete origin via firstFit', () => {
      const id = useSpringboardLayoutStore
        .getState()
        .addWidget(0, 'clock', '2x2');
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(id).not.toBeNull();
      const w = pw[0]![0]!;
      expect(w.col).toBe(0);
      expect(w.row).toBe(0);
    });

    it('places the second widget after the first one (no overlap)', () => {
      const store = useSpringboardLayoutStore.getState();
      store.addWidget(0, 'clock', '2x2');
      store.addWidget(0, 'weather', '2x2');
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw[0]).toHaveLength(2);
      // First widget at (0,0); next 2x2 free origin is (2,0).
      expect(pw[0]![0]!.col).toBe(0);
      expect(pw[0]![0]!.row).toBe(0);
      expect(pw[0]![1]!.col).toBe(2);
      expect(pw[0]![1]!.row).toBe(0);
    });

    it('sets recentlyAddedItemId to the newly-created widget id', () => {
      const id = useSpringboardLayoutStore
        .getState()
        .addWidget(0, 'clock', '2x2');
      expect(id).not.toBeNull();
      expect(useSpringboardLayoutStore.getState().recentlyAddedItemId).toBe(id);
    });

    it('does not change recentlyAddedItemId on failure', () => {
      useSpringboardLayoutStore.setState({ recentlyAddedItemId: 'prev' });
      // Fill the page with a 4x4 then try a 4x2 (no geometric fit).
      useSpringboardLayoutStore.getState().addWidget(0, 'photo', '4x4');
      // After the 4x4 succeeds, recentlyAddedItemId points to the 4x4 id.
      const after4x4 = useSpringboardLayoutStore.getState().recentlyAddedItemId;
      expect(after4x4).not.toBe('prev');
      const failed = useSpringboardLayoutStore
        .getState()
        .addWidget(0, 'weather', '4x2');
      expect(failed).toBeNull();
      // Still pointing at the 4x4 — not cleared by the failure.
      expect(useSpringboardLayoutStore.getState().recentlyAddedItemId).toBe(
        after4x4,
      );
    });

    it('clearRecentlyAdded resets the field', () => {
      useSpringboardLayoutStore.getState().addWidget(0, 'clock', '2x2');
      expect(
        useSpringboardLayoutStore.getState().recentlyAddedItemId,
      ).not.toBeNull();
      useSpringboardLayoutStore.getState().clearRecentlyAdded();
      expect(useSpringboardLayoutStore.getState().recentlyAddedItemId).toBeNull();
    });
  });

  describe('moveWidget', () => {
    it('moves a widget to an empty origin on the same page', () => {
      const id = useSpringboardLayoutStore
        .getState()
        .addWidget(0, 'clock', '2x2')!;
      useSpringboardLayoutStore.getState().moveWidget(0, id, 0, 2, 2);
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw[0]![0]!.col).toBe(2);
      expect(pw[0]![0]!.row).toBe(2);
    });

    it('clamps an out-of-bounds origin to grid edges', () => {
      const id = useSpringboardLayoutStore
        .getState()
        .addWidget(0, 'clock', '2x2')!;
      useSpringboardLayoutStore.getState().moveWidget(0, id, 0, 99, 99);
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      // 2x2 max origin is (2, 3)
      expect(pw[0]![0]!.col).toBe(2);
      expect(pw[0]![0]!.row).toBe(3);
    });

    it('displaces a same-size collider via firstFit (natural swap)', () => {
      const store = useSpringboardLayoutStore.getState();
      const a = store.addWidget(0, 'clock', '2x2')!; // (0,0)
      const b = store.addWidget(0, 'weather', '2x2')!; // (2,0)
      // Move A to B's origin — B should displace to (0,0), the top-left free spot.
      store.moveWidget(0, a, 0, 2, 0);
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      const aw = pw[0]!.find((w) => w.id === a)!;
      const bw = pw[0]!.find((w) => w.id === b)!;
      expect(aw.col).toBe(2);
      expect(aw.row).toBe(0);
      expect(bw.col).toBe(0);
      expect(bw.row).toBe(0);
    });

    it('aborts when a different-size collider has no fit', () => {
      // Seed a page with known positions:
      //   • mover  2x2 at (0,0)
      //   • filler 2x2 at (2,0)   [surviving — occupies cols 2..3 of rows 0..1]
      //   • target 4x2 at (0,2)   [collides when mover moves onto rows 2..3]
      // Grid after setup: rows 0..1 full, rows 2..3 full, row 4 empty.
      // Moving `mover` to (0,2) triggers displacement of `target` (4x2).
      // firstFit search for a 4x2 origin when the occupancy holds:
      //   - `filler` (2x2 at (2,0))       → blocks (2,0)(3,0)(2,1)(3,1)
      //   - `mover`  (2x2 at new origin)  → blocks (0,2)(1,2)(0,3)(1,3)
      // Every candidate 4x2 origin (0,0)(0,1)(0,2)(0,3) overlaps one of
      // those rectangles — no fit → rule 4 aborts without touching state.
      useSpringboardLayoutStore.setState({
        pageWidgets: [
          [
            { id: 'mover', kind: 'clock', size: '2x2', col: 0, row: 0, styleIndex: 0 },
            { id: 'filler', kind: 'weather', size: '2x2', col: 2, row: 0, styleIndex: 0 },
            { id: 'target', kind: 'date', size: '4x2', col: 0, row: 2, styleIndex: 0 },
          ],
        ],
      });
      const before = useSpringboardLayoutStore
        .getState()
        .pageWidgets!.map((p) => p.map((w) => ({ ...w })));

      useSpringboardLayoutStore.getState().moveWidget(0, 'mover', 0, 0, 2);

      const after = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(after).toEqual(before);
    });

    it('supports cross-page moves and creates the target page', () => {
      const id = useSpringboardLayoutStore
        .getState()
        .addWidget(0, 'clock', '2x2')!;
      useSpringboardLayoutStore.getState().moveWidget(0, id, 2, 0, 0);
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      // cascade may grow pageWidgets to accommodate app overflow from the
      // default-layout fallback; only the widget placement matters here.
      expect(pw.length).toBeGreaterThanOrEqual(3);
      expect(pw[0]).toEqual([]);
      expect(pw[2]).toHaveLength(1);
      expect(pw[2]![0]!.id).toBe(id);
      expect(pw[2]![0]!.col).toBe(0);
      expect(pw[2]![0]!.row).toBe(0);
    });

    it('is a no-op when moving to the current origin', () => {
      const store = useSpringboardLayoutStore.getState();
      const id = store.addWidget(0, 'clock', '2x2')!;
      const before = useSpringboardLayoutStore.getState().pageWidgets;
      store.moveWidget(0, id, 0, 0, 0);
      const after = useSpringboardLayoutStore.getState().pageWidgets;
      expect(after).toEqual(before);
    });

    it('does nothing for an unknown widget id', () => {
      useSpringboardLayoutStore.getState().addWidget(0, 'clock', '2x2');
      const before = useSpringboardLayoutStore.getState().pageWidgets;
      useSpringboardLayoutStore
        .getState()
        .moveWidget(0, 'no-such-id', 0, 2, 2);
      const after = useSpringboardLayoutStore.getState().pageWidgets;
      expect(after).toEqual(before);
    });
  });

  describe('moveApp — widget cell budget (bug fix)', () => {
    it('respects widget cells when cascading overflow', () => {
      // Page 0 has a 4x4 widget (16 cells), so the capacity is 4 apps.
      // Before the fix, moveApp used the hard-coded PAGE_SIZE (20) and
      // left up to 20 apps on a page whose real capacity was 4. After the
      // fix, cascade should enforce the 4-app ceiling.
      useSpringboardLayoutStore.setState({
        appOrder: [apps.slice(0, 10).map((a) => a.id)],
        pageWidgets: [
          [{ id: 'big', kind: 'photo', size: '4x4', col: 0, row: 0, styleIndex: 0 }],
        ],
      });
      // Any move triggers the cascade path. Reorder two apps within page 0.
      useSpringboardLayoutStore.getState().moveApp(0, 0, 0, 1);
      const order = useSpringboardLayoutStore.getState().appOrder!;
      // Core assertion: page 0 respects the 4-app widget budget.
      expect(order[0]!.length).toBeLessThanOrEqual(4);
      // And the cascade overflowed to subsequent pages rather than silently
      // dropping anything.
      expect(order.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('persist v1→v2 migration', () => {
    it('stamps sentinel origin onto legacy widgets', async () => {
      // Simulate a v1 persisted state that lacks col/row.
      const v1State = {
        appOrder: [[apps[0]!.id]],
        pageWidgets: [
          [{ id: 'w1', kind: 'clock', size: '2x2' }],
        ],
      };
      // Write legacy JSON into localStorage with version 0
      localStorage.setItem(
        'hiPhone-springboard-layout',
        JSON.stringify({ state: v1State, version: 0 }),
      );
      // Force a re-hydrate to run the migrate function
      await useSpringboardLayoutStore.persist.rehydrate();
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw[0]![0]!.id).toBe('w1');
      expect(pw[0]![0]!.col).toBe(-1);
      expect(pw[0]![0]!.row).toBe(-1);
      // Clean up
      localStorage.removeItem('hiPhone-springboard-layout');
    });

    it('leaves v2 persisted state unchanged', async () => {
      const v2State = {
        appOrder: [[apps[0]!.id]],
        pageWidgets: [
          [{ id: 'w1', kind: 'clock', size: '2x2', col: 2, row: 3, styleIndex: 0 }],
        ],
      };
      localStorage.setItem(
        'hiPhone-springboard-layout',
        JSON.stringify({ state: v2State, version: 2 }),
      );
      await useSpringboardLayoutStore.persist.rehydrate();
      const pw = useSpringboardLayoutStore.getState().pageWidgets!;
      expect(pw[0]![0]!.col).toBe(2);
      expect(pw[0]![0]!.row).toBe(3);
      localStorage.removeItem('hiPhone-springboard-layout');
    });
  });

  // -------------------------------------------------------------------------
  // Dock state + mutations
  // -------------------------------------------------------------------------

  describe('resolveDock', () => {
    it('returns the catalog default when dockOrder is null', () => {
      expect(resolveDock(null)).toEqual(DEFAULT_DOCK_IDS);
    });

    it('returns the user dockOrder when set, capped at DOCK_CAPACITY', () => {
      const ids = ['a', 'b', 'c', 'd', 'e', 'f'];
      const out = resolveDock(ids);
      expect(out.length).toBe(DOCK_CAPACITY);
      expect(out).toEqual(['a', 'b', 'c', 'd']);
    });

    it('canonicalizes ids and dedupes', () => {
      // safari-dock → safari per appProfileStore alias map
      const out = resolveDock(['safari-dock', 'safari', 'music']);
      expect(out).toEqual(['safari', 'music']);
    });
  });

  describe('reorderDock', () => {
    it('moves an app within the dock', () => {
      // Seed dockOrder so we don't depend on default catalog content order
      useSpringboardLayoutStore.setState({
        dockOrder: ['settings', 'safari', 'music', 'xingyu'],
      });
      useSpringboardLayoutStore.getState().reorderDock(0, 2);
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual([
        'safari',
        'music',
        'settings',
        'xingyu',
      ]);
    });

    it('clamps toIndex into the post-removal range', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['a', 'b', 'c'],
      });
      useSpringboardLayoutStore.getState().reorderDock(0, 99);
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual([
        'b',
        'c',
        'a',
      ]);
    });

    it('is a no-op when fromIndex is out of range', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['a', 'b'],
      });
      useSpringboardLayoutStore.getState().reorderDock(5, 0);
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual(['a', 'b']);
    });
  });

  describe('moveAppToDock', () => {
    it('inserts a grid app into the dock when there is room', () => {
      useSpringboardLayoutStore.setState({
        // 3-slot dock leaves room for one more
        dockOrder: ['settings', 'safari', 'music'],
        appOrder: [[apps[0]!.id, apps[1]!.id]],
      });
      const ok = useSpringboardLayoutStore
        .getState()
        .moveAppToDock(apps[0]!.id, 1);
      expect(ok).toBe(true);
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual([
        'settings',
        apps[0]!.id,
        'safari',
        'music',
      ]);
      // Grid no longer contains the moved app
      expect(useSpringboardLayoutStore.getState().appOrder).toEqual([
        [apps[1]!.id],
      ]);
    });

    it('does not leave the moved app duplicated on the grid (appOrder=null path)', () => {
      // REGRESSION: when appOrder was null, resolveSlotPages used to fall
      // back to the static `defaultApps` list (filtered only by the
      // CATALOG default dock). Moving 'calendar' into the dock then left
      // it visible on both the grid and the dock until the user
      // reordered something to materialize appOrder.
      useSpringboardLayoutStore.setState({
        appOrder: null,
        // Free a dock slot so the move succeeds.
        dockOrder: ['settings', 'safari', 'music'],
      });
      const ok = useSpringboardLayoutStore
        .getState()
        .moveAppToDock('calendar', 0);
      expect(ok).toBe(true);

      // Grid resolution must NOT contain 'calendar' — the dock-aware
      // gridSource passed in must take precedence over `defaultApps`.
      const dockIds = ['safari', 'music', 'settings', 'calendar'];
      const grid = resolveOrderedPages(
        useSpringboardLayoutStore.getState().appOrder,
        null,
        // Mirror what Springboard.tsx passes — the dynamic dock-filtered list.
        // calendar must be filtered out by getAppsWithUserInstalled(dockIds).
        // (We can't import getAppsWithUserInstalled directly here without
        // re-running the module-init filter, so build the set inline.)
        apps.filter((a) => !dockIds.includes(a.id)),
      );
      const flatGridIds = grid.flatMap((page) => page.map((a) => a.id));
      expect(flatGridIds).not.toContain('calendar');
    });

    it('rejects when dock is at DOCK_CAPACITY and the app is new', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['settings', 'safari', 'music', 'xingyu'],
        appOrder: [[apps[0]!.id]],
      });
      const ok = useSpringboardLayoutStore
        .getState()
        .moveAppToDock(apps[0]!.id, 0);
      expect(ok).toBe(false);
      // Dock unchanged, grid unchanged
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual([
        'settings',
        'safari',
        'music',
        'xingyu',
      ]);
      expect(useSpringboardLayoutStore.getState().appOrder).toEqual([
        [apps[0]!.id],
      ]);
    });

    it('reorders within the dock when the app is already there', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['settings', 'safari', 'music', 'xingyu'],
      });
      const ok = useSpringboardLayoutStore
        .getState()
        .moveAppToDock('settings', 3);
      expect(ok).toBe(true);
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual([
        'safari',
        'music',
        'xingyu',
        'settings',
      ]);
    });

    it('canonicalizes the appId before storing', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['settings', 'music', 'xingyu'],
      });
      const ok = useSpringboardLayoutStore
        .getState()
        .moveAppToDock('safari-dock', 0);
      expect(ok).toBe(true);
      // 'safari-dock' canonicalized to 'safari'
      expect(useSpringboardLayoutStore.getState().dockOrder![0]).toBe('safari');
    });
  });

  describe('moveAppFromDock', () => {
    it('keeps the moved app visible on the grid when starting from a default layout', () => {
      // REGRESSION: dragging a default dock app (e.g. settings) out of the
      // dock when both appOrder and dockOrder are null caused the app to
      // disappear: resolveSlotPages must surface it on the grid using the
      // dock-aware `gridSource` (extraApps) the caller passes.
      useSpringboardLayoutStore.setState({
        appOrder: null,
        dockOrder: null,
      });
      useSpringboardLayoutStore
        .getState()
        .moveAppFromDock('settings', 0, 0);

      // Mirror what Springboard.tsx passes — the dynamic dock-filtered list.
      // After the move, dock no longer has 'settings' so it must appear in
      // the grid source.
      const newDockIds = useSpringboardLayoutStore
        .getState()
        .dockOrder!;
      expect(newDockIds).not.toContain('settings');

      // Use the REAL helper that Springboard.tsx uses. This catches the
      // root-cause: when getAppsWithUserInstalled doesn't source from the
      // dock entries, dock-only apps like 'settings' are missing from the
      // grid pool entirely and the moved app silently disappears.
      const gridSource = getAppsWithUserInstalled(newDockIds);
      const resolved = resolveOrderedPages(
        useSpringboardLayoutStore.getState().appOrder,
        null,
        gridSource,
      );
      const flatIds = resolved.flatMap((page) => page.map((a) => a.id));
      expect(flatIds).toContain('settings');
    });

    it('removes the app from the dock and inserts it onto the target page', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['settings', 'safari', 'music', 'xingyu'],
        appOrder: [[apps[0]!.id]],
      });
      useSpringboardLayoutStore
        .getState()
        .moveAppFromDock('settings', 0, 0);
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual([
        'safari',
        'music',
        'xingyu',
      ]);
      const order = useSpringboardLayoutStore.getState().appOrder!;
      expect(order[0]![0]).toBe('settings');
      expect(order[0]).toContain(apps[0]!.id);
    });

    it('is a no-op when the app is not in the dock', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['settings', 'safari', 'music', 'xingyu'],
        appOrder: [[apps[0]!.id]],
      });
      useSpringboardLayoutStore
        .getState()
        .moveAppFromDock(apps[0]!.id, 0, 0);
      expect(useSpringboardLayoutStore.getState().dockOrder).toEqual([
        'settings',
        'safari',
        'music',
        'xingyu',
      ]);
    });
  });

  describe('resetLayout', () => {
    it('clears dockOrder along with appOrder and pageWidgets', () => {
      useSpringboardLayoutStore.setState({
        dockOrder: ['a', 'b'],
        appOrder: [[apps[0]!.id]],
      });
      useSpringboardLayoutStore.getState().resetLayout();
      const s = useSpringboardLayoutStore.getState();
      expect(s.dockOrder).toBe(null);
      expect(s.appOrder).toBe(null);
      expect(s.pageWidgets).toBe(null);
    });
  });

  describe('migration v3 → v4 (introduce dockOrder)', () => {
    it('stamps dockOrder=null on legacy v3 persisted state', async () => {
      const v3State = {
        appOrder: [[apps[0]!.id]],
        pageWidgets: null,
      };
      localStorage.setItem(
        'hiPhone-springboard-layout',
        JSON.stringify({ state: v3State, version: 3 }),
      );
      await useSpringboardLayoutStore.persist.rehydrate();
      expect(useSpringboardLayoutStore.getState().dockOrder).toBe(null);
      localStorage.removeItem('hiPhone-springboard-layout');
    });
  });
});
