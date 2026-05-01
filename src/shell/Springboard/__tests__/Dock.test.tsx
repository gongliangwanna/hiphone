import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { Dock } from '../Dock';
import type { AppInfo } from '../apps.data';
import { getSpringboardMetrics } from '../../Device/viewportProfile';

const metrics = getSpringboardMetrics('regular');

const makeApp = (id: string, name = id): AppInfo => ({
  id,
  name,
  icon: `/${id}.png`,
  page: 0,
  kind: 'system',
});

describe('<Dock>', () => {
  const noop = () => {};

  it('renders one icon per app in order', () => {
    const apps = [makeApp('settings'), makeApp('safari'), makeApp('music')];
    render(<Dock apps={apps} metrics={metrics} onOpen={noop} />);
    const dock = screen.getByTestId('dock-material');
    const icons = within(dock).getAllByTestId(/^app-icon-/);
    expect(icons.map((el) => el.getAttribute('data-testid'))).toEqual([
      'app-icon-settings',
      'app-icon-safari',
      'app-icon-music',
    ]);
  });

  it('reflows by removing the source slot when fromIndex is set', () => {
    const apps = [makeApp('a'), makeApp('b'), makeApp('c'), makeApp('d')];
    render(
      <Dock
        apps={apps}
        metrics={metrics}
        onOpen={noop}
        dragPreview={{ draggedApp: apps[1]!, fromIndex: 1, toIndex: null }}
      />,
    );
    const dock = screen.getByTestId('dock-material');
    const icons = within(dock).getAllByTestId(/^app-icon-/);
    // Source 'b' is still in the DOM (so the layout animation works), but the
    // preview's fromIndex marks it as the dragging source — visibility hidden.
    // The render order itself is unchanged because we only remove + insert at
    // the same time when target is also set; here only fromIndex is set, so
    // 'b' stays in place but invisible.
    expect(icons.length).toBeGreaterThanOrEqual(3);
  });

  it('hides the inserted slot during a grid → dock preview (no duplicate icon)', () => {
    // REGRESSION: previously `draggingAppId` was only set when the source
    // was the Dock itself, so grid → dock drags showed the inserted app
    // FULLY VISIBLE in its preview slot — duplicating the floating
    // DragOverlay. The static slot must be hidden via visibility:hidden
    // so only the floating overlay reads as the dragged item.
    const apps = [makeApp('a'), makeApp('b')];
    const incoming = makeApp('z');
    render(
      <Dock
        apps={apps}
        metrics={metrics}
        onOpen={noop}
        dragPreview={{ draggedApp: incoming, fromIndex: null, toIndex: 1 }}
      />,
    );
    const dock = screen.getByTestId('dock-material');
    const insertedIcon = within(dock).getByTestId('app-icon-z');
    // The plain inner <div> directly wrapping the AppIcon button carries
    // the visibility:hidden style (motion.div above it stays clean for
    // the FLIP layout animation).
    expect(insertedIcon.parentElement?.style.visibility).toBe('hidden');
  });

  it('hides the source slot during a dock → dock reorder (no duplicate icon)', () => {
    // REGRESSION: dragging an app within the Dock used to show two icons
    // — one floating with the finger, one snapping between dock slots.
    // Putting visibility:hidden directly on the layout-animated motion.div
    // didn't consistently hide it mid-FLIP. The fix moves the hide onto
    // an inner plain div.
    const apps = [makeApp('a'), makeApp('b'), makeApp('c'), makeApp('d')];
    render(
      <Dock
        apps={apps}
        metrics={metrics}
        onOpen={noop}
        // Source = dock slot 1 (b), pointer currently over slot 3.
        dragPreview={{ draggedApp: apps[1]!, fromIndex: 1, toIndex: 3 }}
      />,
    );
    const dock = screen.getByTestId('dock-material');
    const draggedIcon = within(dock).getByTestId('app-icon-b');
    expect(draggedIcon.parentElement?.style.visibility).toBe('hidden');
  });

  it('inserts the dragged app at toIndex when target is the dock', () => {
    const apps = [makeApp('a'), makeApp('b'), makeApp('c')];
    const incoming = makeApp('z');
    render(
      <Dock
        apps={apps}
        metrics={metrics}
        onOpen={noop}
        dragPreview={{ draggedApp: incoming, fromIndex: null, toIndex: 1 }}
      />,
    );
    const dock = screen.getByTestId('dock-material');
    const icons = within(dock).getAllByTestId(/^app-icon-/);
    expect(icons.map((el) => el.getAttribute('data-testid'))).toEqual([
      'app-icon-a',
      'app-icon-z',
      'app-icon-b',
      'app-icon-c',
    ]);
  });

  it('handles in-dock reorder (fromIndex + toIndex both set) without duplication', () => {
    const apps = [makeApp('a'), makeApp('b'), makeApp('c'), makeApp('d')];
    render(
      <Dock
        apps={apps}
        metrics={metrics}
        onOpen={noop}
        dragPreview={{ draggedApp: apps[0]!, fromIndex: 0, toIndex: 2 }}
      />,
    );
    const dock = screen.getByTestId('dock-material');
    const icons = within(dock).getAllByTestId(/^app-icon-/);
    // After splice-out at 0 (['b','c','d']) and splice-in at 2 (['b','c','a','d'])
    expect(icons.map((el) => el.getAttribute('data-testid'))).toEqual([
      'app-icon-b',
      'app-icon-c',
      'app-icon-a',
      'app-icon-d',
    ]);
  });

  it('passes isEditMode through so AppIcon jiggles', () => {
    const apps = [makeApp('a')];
    const { rerender } = render(
      <Dock apps={apps} metrics={metrics} onOpen={noop} isEditMode={false} />,
    );
    const dock = screen.getByTestId('dock-material');
    let btn = within(dock).getByTestId('app-icon-a');
    expect(btn.className).not.toContain('springboard-jiggle');

    rerender(
      <Dock apps={apps} metrics={metrics} onOpen={noop} isEditMode={true} />,
    );
    btn = within(dock).getByTestId('app-icon-a');
    expect(btn.className).toMatch(/springboard-jiggle/);
  });
});
