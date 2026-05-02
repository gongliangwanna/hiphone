import { beforeEach, describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Springboard } from '../Springboard';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');

  return {
    ...actual,
    animate: vi.fn((value: { set: (target: number) => void }, target: number, options?: { onComplete?: () => void }) => {
      value.set(target);
      if (options?.onComplete) {
        setTimeout(() => options.onComplete?.(), 0);
      }
      return {
        stop: vi.fn(),
      };
    }),
  };
});

function expectActivePage(page: number) {
  expect(screen.getByTestId(`page-dot-${page}`)).toHaveStyle({ opacity: 1 });
}

function resetSpringboardState() {
  useInstalledUserAppsStore.setState({ apps: [] });
  useSpringboardLayoutStore.setState({
    appOrder: null,
    pageWidgets: null,
    dockOrder: null,
    isEditMode: false,
    isWidgetDrawerOpen: false,
    currentSpringboardPage: 0,
    recentlyAddedItemId: null,
  });
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({}),
  } as DOMRect;
}

function seedUserApps(count: number) {
  useInstalledUserAppsStore.setState({
    apps: Array.from({ length: count }, (_, i) => ({
      id: `test-user-app-${i}`,
      name: `测试 ${i}`,
      iconDataUrl: null,
      page: Math.floor(i / 20) + 1,
      perspectiveAware: false,
      version: '1.0.0',
      installedAt: 1_700_000_000_000 + i,
      sizeBytes: 0,
    })),
  });
}

function swipe(
  surface: HTMLElement,
  {
    startX,
    endX,
    moveX = endX,
    pointerId = 1,
    startTime = 10,
    moveTime = startTime + 100,
    endTime = moveTime + 10,
    withMove = true,
  }: {
    startX: number;
    endX: number;
    moveX?: number;
    pointerId?: number;
    startTime?: number;
    moveTime?: number;
    endTime?: number;
    withMove?: boolean;
  },
) {
  act(() => {
    fireEvent.pointerDown(surface, {
      clientX: startX,
      pointerId,
      timeStamp: startTime,
    });

    if (withMove) {
      fireEvent.pointerMove(surface, {
        clientX: moveX,
        pointerId,
        timeStamp: moveTime,
      });
    }

    fireEvent.pointerUp(surface, {
      clientX: endX,
      pointerId,
      timeStamp: endTime,
    });
  });
}

describe('Springboard', () => {
  beforeEach(resetSpringboardState);

  it('uses compact metrics for short mobile widths', () => {
    render(<Springboard sizeTier="compact" viewportWidth={360} />);

    const firstIcon = screen.getByTestId('app-icon-calendar');
    const iconMask = firstIcon.querySelector('div');
    const dock = screen.getByTestId('dock');

    expect(firstIcon).toHaveStyle({ width: '68px' });
    expect(iconMask).toHaveStyle({ width: '54px', height: '54px' });
    expect(dock).toHaveStyle({ paddingBottom: '6px' });
  });

  it('uses large metrics for wide mobile widths', () => {
    render(<Springboard sizeTier="large" viewportWidth={430} />);

    const firstIcon = screen.getByTestId('app-icon-calendar');
    const iconMask = firstIcon.querySelector('div');
    const dock = screen.getByTestId('dock');

    expect(firstIcon).toHaveStyle({ width: '78px' });
    expect(iconMask).toHaveStyle({ width: '64px', height: '64px' });
    expect(dock).toHaveStyle({ paddingBottom: '10px' });
  });

  it('renders newly-installed user apps without an unrelated layout change', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    expect(screen.queryByTestId('app-icon-test-live-install')).toBeNull();

    act(() => {
      useInstalledUserAppsStore.getState().add({
        id: 'test-live-install',
        name: '直装',
        iconDataUrl: null,
        page: 1,
        perspectiveAware: false,
        version: '1.0.0',
        installedAt: 1_700_000_000_000,
        sizeBytes: 0,
      });
    });

    expect(screen.getByTestId('app-icon-test-live-install')).toBeInTheDocument();
  });

  it('commits to the next page after a slow drag crosses distance threshold', () => {
    seedUserApps(30);
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    swipe(screen.getByTestId('springboard-gesture-surface'), {
      startX: 300,
      endX: 220,
      moveTime: 220,
      endTime: 240,
    });

    expectActivePage(1);
  });

  it('uses directional touch-action and disables dock blur while dragging', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    const surface = screen.getByTestId('springboard-gesture-surface');
    const dockMaterial = screen.getByTestId('dock-material');

    expect(surface).toHaveStyle({ touchAction: 'pan-y' });
    expect(dockMaterial.style.backdropFilter).toContain('blur(40px)');

    act(() => {
      fireEvent.pointerDown(surface, {
        clientX: 300,
        pointerId: 1,
        timeStamp: 10,
      });
    });

    expect(dockMaterial).toHaveStyle({ backdropFilter: 'none' });

    swipe(surface, {
      startX: 300,
      endX: 220,
      startTime: 20,
      moveTime: 220,
      endTime: 240,
    });

    expect(dockMaterial.style.backdropFilter).toContain('blur(40px)');
  });

  it('commits back to the previous page after a rightward swipe from page 1', () => {
    seedUserApps(30);
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    const surface = screen.getByTestId('springboard-gesture-surface');
    swipe(surface, {
      startX: 300,
      endX: 220,
      moveTime: 220,
      endTime: 240,
    });

    expectActivePage(1);

    swipe(surface, {
      startX: 140,
      endX: 220,
      moveTime: 420,
      endTime: 440,
    });

    expectActivePage(0);
  });

  it('stays on the first page after overscrolling past the leading edge', () => {
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    swipe(screen.getByTestId('springboard-gesture-surface'), {
      startX: 120,
      endX: 190,
      moveTime: 200,
      endTime: 220,
    });

    expectActivePage(0);
  });

  it('stays on the last page after overscrolling past the trailing edge', () => {
    seedUserApps(30);
    render(<Springboard sizeTier="regular" viewportWidth={390} />);

    const surface = screen.getByTestId('springboard-gesture-surface');
    swipe(surface, { startX: 300, endX: 220, moveTime: 200, endTime: 220 });
    swipe(surface, { startX: 300, endX: 220, moveTime: 450, endTime: 470 });

    expectActivePage(2);

    swipe(surface, {
      startX: 300,
      endX: 220,
      moveTime: 700,
      endTime: 720,
    });

    expectActivePage(2);
  });

  it('hit-tests the Dock when the user drags a grid app over it', () => {
    // REGRESSION: `updateDropTargetForPage` and `finishDrag` queried the
    // dock material via `area.querySelector` (gesture-surface scoped).
    // The Dock lives OUTSIDE the gesture surface in the DOM, so the lookup
    // returned null and grid → dock drops never registered. Fix uses
    // `document.querySelector`.
    vi.useFakeTimers();
    const previousSetPointerCapture = HTMLElement.prototype.setPointerCapture;
    HTMLElement.prototype.setPointerCapture = vi.fn();
    const getRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getMockRect(this: HTMLElement) {
        const testId = this.dataset.testid;
        if (testId === 'springboard-gesture-surface') {
          return rect(0, 0, 390, 700);
        }
        if (testId === 'dock-material') {
          return rect(20, 740, 350, 80);
        }
        if (testId === 'app-icon-calendar') {
          return rect(22, 24, 78, 96);
        }
        return rect(0, 0, 0, 0);
      });

    try {
      // Drop one of the four default dock apps so there's a free slot.
      useSpringboardLayoutStore.setState({
        isEditMode: true,
        dockOrder: ['settings', 'safari', 'music'],
      });
      render(<Springboard sizeTier="regular" viewportWidth={390} />);

      const surface = screen.getByTestId('springboard-gesture-surface');
      const gridIcon = screen.getByTestId('app-icon-calendar');

      act(() => {
        fireEvent.pointerDown(gridIcon, {
          clientX: 52,
          clientY: 54,
          pointerId: 9,
        });
        fireEvent.pointerMove(surface, {
          clientX: 195,
          clientY: 780,
          pointerId: 9,
        });
        fireEvent.pointerUp(surface, {
          clientX: 195,
          clientY: 780,
          pointerId: 9,
        });
        // Flush the settle animation's onComplete (mocked motion.animate
        // schedules it via setTimeout(0)). Without this the pending
        // moveAppToDock never runs.
        vi.runOnlyPendingTimers();
      });

      const dockOrder = useSpringboardLayoutStore.getState().dockOrder!;
      expect(dockOrder).toContain('calendar');
    } finally {
      getRectSpy.mockRestore();
      HTMLElement.prototype.setPointerCapture = previousSetPointerCapture;
      vi.useRealTimers();
    }
  });

  it('initiates a drag when the user grabs a Dock icon in edit mode', () => {
    // REGRESSION: previously `useIconDrag.onDragStart` searched for the icon
    // element via `area.querySelector` (gesture-surface scoped). The Dock
    // lives OUTSIDE the gesture surface, so the lookup returned null and
    // the drag silently aborted before any state was set. The fix uses
    // `document.querySelector` since canonical app ids are globally unique.
    const previousSetPointerCapture = HTMLElement.prototype.setPointerCapture;
    HTMLElement.prototype.setPointerCapture = vi.fn();
    const getRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getMockRect(this: HTMLElement) {
        const testId = this.dataset.testid;
        if (testId === 'springboard-gesture-surface') {
          return rect(0, 0, 390, 700);
        }
        if (testId === 'app-icon-settings') {
          return rect(40, 760, 60, 60);
        }
        return rect(0, 0, 0, 0);
      });

    try {
      useSpringboardLayoutStore.setState({ isEditMode: true });
      render(<Springboard sizeTier="regular" viewportWidth={390} />);

      const dockIcon = screen.getByTestId('app-icon-settings');

      act(() => {
        fireEvent.pointerDown(dockIcon, {
          clientX: 70,
          clientY: 790,
          pointerId: 11,
        });
      });

      // Drag state must be live after pointerdown — without the fix this
      // never happened for dock icons.
      expect(
        screen.queryByTestId('drag-overlay'),
      ).not.toBeNull();
    } finally {
      getRectSpy.mockRestore();
      HTMLElement.prototype.setPointerCapture = previousSetPointerCapture;
    }
  });

  it('commits an app to an auto-created page after edge autoscroll without another pointer move', () => {
    vi.useFakeTimers();
    const getRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(function getMockRect(this: HTMLElement) {
        const testId = this.dataset.testid;
        if (testId === 'springboard-gesture-surface') {
          return rect(0, 0, 390, 700);
        }
        if (testId === 'app-icon-calendar') {
          return rect(22, 24, 78, 96);
        }
        return rect(0, 0, 0, 0);
      });
    const previousSetPointerCapture = HTMLElement.prototype.setPointerCapture;
    HTMLElement.prototype.setPointerCapture = vi.fn();

    try {
      useSpringboardLayoutStore.setState({ isEditMode: true });
      render(<Springboard sizeTier="regular" viewportWidth={390} />);

      const icon = screen.getByTestId('app-icon-calendar');
      const surface = screen.getByTestId('springboard-gesture-surface');

      act(() => {
        fireEvent.pointerDown(icon, {
          clientX: 52,
          clientY: 54,
          pointerId: 7,
        });
        fireEvent.pointerMove(surface, {
          clientX: 385,
          clientY: 54,
          pointerId: 7,
        });
        vi.advanceTimersByTime(450);
      });

      expectActivePage(1);

      act(() => {
        fireEvent.pointerUp(surface, {
          clientX: 385,
          clientY: 54,
          pointerId: 7,
        });
        vi.runOnlyPendingTimers();
      });

      const order = useSpringboardLayoutStore.getState().appOrder;
      expect(order?.[1]?.[0]).toBe('calendar');
      expectActivePage(1);
      expect(screen.queryByTestId('page-dot-2')).toBeNull();
    } finally {
      getRectSpy.mockRestore();
      HTMLElement.prototype.setPointerCapture = previousSetPointerCapture;
      vi.useRealTimers();
    }
  });
});
