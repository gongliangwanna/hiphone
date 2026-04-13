import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { IconGrid } from '../IconGrid';
import type { SpringboardMetrics } from '../../Device/viewportProfile';
import {
  useSpringboardLayoutStore,
  type WidgetInstance,
} from '@/platform/stores/springboardLayoutStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useMusicDataStore } from '@/apps/Music/musicDataStore';

/**
 * Regression tests for the long-press → edit-mode gesture on a widget slot.
 *
 * The user-visible bug this guards against:
 *   Long-pressing a placed MusicWidget would enter edit mode (good), but the
 *   synthesized click that follows pointerUp also launched the Music app
 *   (bad) — so long-press-to-edit on a music widget was effectively broken.
 *
 * Two defences now live in the code:
 *   1) `WidgetSlot` wires `onClickCapture={longPress.onClick}` in IconGrid.tsx
 *      so the capture-phase handler fires BEFORE any descendant onClick and
 *      short-circuits the click via `stopPropagation` + `preventDefault`.
 *   2) `MusicWidget.handleOpenMusicApp` reads `isEditMode` freshly from the
 *      Zustand store instead of a captured closure, so even if (1) ever
 *      misfires, it won't launch the Music app while the store says we're in
 *      edit mode.
 *
 * These tests cover both the happy path (a tap does open the app) and the
 * long-press path (entering edit mode + no app launch).
 */

const metrics: SpringboardMetrics = {
  sidePadding: 22,
  iconSize: 60,
  cellWidth: 75,
  labelSize: 12,
  gridGapY: 20,
  dockPaddingY: 8,
  springboardTopPadding: 16,
};

const widget: WidgetInstance = {
  id: 'w-music-longpress',
  kind: 'music',
  size: '2x2',
  col: 0,
  row: 0,
  styleIndex: 0,
};

function renderIconGridWithMusicWidget() {
  return render(
    <IconGrid
      apps={[]}
      widgets={[widget]}
      metrics={metrics}
      viewportWidth={430}
      pageIndex={0}
      onOpen={() => {}}
    />,
  );
}

describe('WidgetSlot long-press', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useSpringboardLayoutStore.setState({ isEditMode: false });
    useAppRuntimeStore.setState({ activeAppId: null, appOrigin: null });
    // Seed a song so MusicWidget renders its play button and has a real
    // onClick-to-open behaviour for the regression to bite.
    useMusicDataStore.setState({
      currentSongId: 'song-1',
      isPlaying: false,
      progress: 0,
      queue: ['song-1'],
      songMap: {
        'song-1': {
          id: 'song-1',
          title: 'Test Song',
          artist: 'Test Artist',
          album: 'Test Album',
          albumId: 'album-1',
          duration: 200,
          artworkUrl: '',
          previewUrl: '',
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('holding the widget slot for 600ms flips isEditMode', () => {
    const { container } = renderIconGridWithMusicWidget();
    const slot = container.querySelector<HTMLElement>(
      `[data-testid="widget-slot-${widget.id}"]`,
    );
    expect(slot).not.toBeNull();
    expect(useSpringboardLayoutStore.getState().isEditMode).toBe(false);

    fireEvent.pointerDown(slot!, {
      pointerId: 1,
      clientX: 40,
      clientY: 40,
      button: 0,
    });
    vi.advanceTimersByTime(601);

    expect(useSpringboardLayoutStore.getState().isEditMode).toBe(true);
  });

  it('a long-press followed by release does NOT launch the Music app', () => {
    const { container } = renderIconGridWithMusicWidget();
    const slot = container.querySelector<HTMLElement>(
      `[data-testid="widget-slot-${widget.id}"]`,
    );
    // Click the inner widget body (the WidgetShell's onClick is a
    // bubble-phase handler on a descendant of the slot) so the regression
    // path — click bubbling up into handleOpenMusicApp — is actually
    // exercised. Firing click on the slot itself would never reach the
    // inner shell handler regardless of the fix.
    const shell = container.querySelector<HTMLElement>(
      '[data-testid="widget-music"]',
    );
    expect(shell).not.toBeNull();

    fireEvent.pointerDown(slot!, {
      pointerId: 2,
      clientX: 40,
      clientY: 40,
      button: 0,
    });
    vi.advanceTimersByTime(601);

    // Release the pointer. Browsers synthesize a click after pointerUp;
    // fireEvent does not, so dispatch it explicitly — that is exactly the
    // click whose suppression we are testing.
    fireEvent.pointerUp(slot!, {
      pointerId: 2,
      clientX: 40,
      clientY: 40,
    });
    fireEvent.click(shell!, { clientX: 40, clientY: 40 });

    expect(useSpringboardLayoutStore.getState().isEditMode).toBe(true);
    expect(useAppRuntimeStore.getState().activeAppId).toBeNull();
  });

  it('a short tap (no long-press) still opens the Music app', () => {
    const { container } = renderIconGridWithMusicWidget();
    const slot = container.querySelector<HTMLElement>(
      `[data-testid="widget-slot-${widget.id}"]`,
    );
    const shell = container.querySelector<HTMLElement>(
      '[data-testid="widget-music"]',
    );

    fireEvent.pointerDown(slot!, {
      pointerId: 3,
      clientX: 40,
      clientY: 40,
      button: 0,
    });
    // Release before the 600ms timer fires — long-press does NOT trigger.
    vi.advanceTimersByTime(100);
    fireEvent.pointerUp(slot!, {
      pointerId: 3,
      clientX: 40,
      clientY: 40,
    });
    fireEvent.click(shell!, { clientX: 40, clientY: 40 });

    expect(useSpringboardLayoutStore.getState().isEditMode).toBe(false);
    expect(useAppRuntimeStore.getState().activeAppId).toBe('music');
  });
});
