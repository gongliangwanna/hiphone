import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import type { WidgetSize, WidgetKind } from '@/platform/stores/springboardLayoutStore';
import { widgetCatalog, getWidgetComponent } from '../registry';
import { useMusicDataStore } from '@/apps/Music/musicDataStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { MusicWidget } from '../MusicWidget';
import { PhotoWidget } from '../PhotoWidget';
import type { Photo } from '@/apps/Photos/photosData';
import { usePhotosStore } from '@/apps/Photos/photosStore';

// useWeatherData hits the network on mount. Short-circuit it.
vi.mock('@/apps/Weather/useWeatherData', () => ({
  useWeatherData: () => ({
    data: {
      location: '北京',
      current: {
        temperature: 18,
        apparentTemperature: 18,
        humidity: 0.5,
        weatherCode: 1,
        windSpeed: 0,
        windDirection: 0,
        windGusts: 0,
        pressure: 1010,
        uvIndex: 0,
        isDay: true,
        dewPoint: 0,
        visibility: 10,
      },
      hourly: [],
      daily: [
        {
          date: '2026-04-11',
          weatherCode: 1,
          tempMax: 22,
          tempMin: 12,
          sunrise: '',
          sunset: '',
          uvIndexMax: 0,
          precipProbabilityMax: 0,
        },
      ],
    },
    loading: false,
    error: null,
  }),
}));

const SIZES: WidgetSize[] = ['2x2', '4x2', '4x4'];
const KINDS: WidgetKind[] = ['clock', 'date', 'weather', 'music', 'photo'];

function makeTestPhotos(count: number): Photo[] {
  return Array.from({ length: count }, (_, i) => {
    const id = i + 1;
    return {
      id,
      thumbnail: `https://example.test/id/${id}/400/400`,
      fullSize: `https://example.test/id/${id}/1200/1200`,
      date: new Date(2026, 3, 11 - i),
      isFavorite: i % 3 === 0,
      fileName: `photo-${id}.jpg`,
    };
  });
}

describe('widget registry', () => {
  it('registers every kind with a component', () => {
    expect(widgetCatalog).toHaveLength(5);
    for (const kind of KINDS) {
      expect(getWidgetComponent(kind)).not.toBeNull();
    }
  });
});

describe('widget components render at every size', () => {
  beforeEach(() => {
    // RadomBetweenRenders stability: freeze Date.now for deterministic photo pick
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-11T10:00:00'));
  });

  for (const kind of KINDS) {
    for (const size of SIZES) {
      it(`${kind} / ${size}`, () => {
        const Component = getWidgetComponent(kind)!;
        render(<Component size={size} />);
        expect(screen.getByTestId(`widget-${kind}`)).toBeInTheDocument();
      });
    }
  }
});

// Performance contract: WidgetShell must NOT use backdrop-filter. The
// 50px chrome blur was the dominant cause of springboard swipe jank, and
// every concrete widget paints its own opaque background — there is
// nothing to blur through. See WidgetShell.tsx for the full rationale.
// This check applies to every placed widget, not just the clock, because
// each widget sits on the moving springboard track.
describe('WidgetShell perf invariants', () => {
  for (const kind of KINDS) {
    for (const size of SIZES) {
      it(`${kind} / ${size} uses no backdrop-filter`, () => {
        const Component = getWidgetComponent(kind)!;
        const { container } = render(<Component size={size} />);
        const all = container.querySelectorAll<HTMLElement>('*');
        for (const el of all) {
          const inline = el.getAttribute('style') ?? '';
          expect(inline.toLowerCase()).not.toContain('backdrop-filter');
        }
      });
    }
  }
});

// Regression guard for "music widget layout breaks in the drawer" — the
// drawer preview must render the widget at its design-target cell size
// (170px) and CSS-scale it down to whatever previewWidth the drawer
// passes. Without this, MusicWidget's fixed pixel children (58/90/140
// album tiles + 34px control rows) overflow the smaller preview frame.
describe('WidgetShell drawer preview scales design-size children', () => {
  const DESIGN_CELL = 170;
  const PREVIEW_CELL = 140;
  const expected: Record<WidgetSize, { w: number; h: number }> = {
    '2x2': { w: DESIGN_CELL, h: DESIGN_CELL },
    '4x2': { w: DESIGN_CELL * 2 + 12, h: DESIGN_CELL },
    '4x4': { w: DESIGN_CELL * 2 + 12, h: DESIGN_CELL * 2 + 12 },
  };

  for (const kind of KINDS) {
    for (const size of SIZES) {
      it(`${kind} / ${size} renders inner at design cell then scales to preview`, () => {
        const Component = getWidgetComponent(kind)!;
        const { container } = render(
          <Component size={size} variant="drawer" previewWidth={PREVIEW_CELL} />,
        );
        const shell = container.querySelector<HTMLElement>(`[data-testid="widget-${kind}"]`);
        expect(shell).not.toBeNull();
        // Outer box matches previewWidth-based dims (gallery layout slot).
        const outerWidthPx = Math.round(
          size === '2x2' ? PREVIEW_CELL : PREVIEW_CELL * 2 + 12,
        );
        const outerHeightPx = Math.round(
          size === '4x4' ? PREVIEW_CELL * 2 + 12 : PREVIEW_CELL,
        );
        expect(shell!.style.width).toBe(`${outerWidthPx}px`);
        expect(shell!.style.height).toBe(`${outerHeightPx}px`);

        // The scaled inner chrome box (first element child of the shell)
        // renders at design-cell dimensions and carries a `scale(...)`
        // transform that maps it back to the outer preview size.
        const scaled = shell!.firstElementChild as HTMLElement | null;
        expect(scaled).not.toBeNull();
        expect(scaled!.style.width).toBe(`${expected[size].w}px`);
        expect(scaled!.style.height).toBe(`${expected[size].h}px`);
        expect(scaled!.style.transform).toContain(`scale(${PREVIEW_CELL / DESIGN_CELL}`);
        expect(scaled!.style.transformOrigin).toBe('top left');
      });
    }
  }
});

describe('MusicWidget interactivity', () => {
  beforeEach(() => {
    // Seed the store with a song so the play/pause / skip controls render.
    useMusicDataStore.setState({
      currentSongId: 'song-1',
      isPlaying: false,
      progress: 0,
      queue: ['song-1', 'song-2'],
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
        'song-2': {
          id: 'song-2',
          title: 'Second',
          artist: 'Test Artist',
          album: 'Test Album',
          albumId: 'album-1',
          duration: 200,
          artworkUrl: '',
          previewUrl: '',
        },
      },
    });
    useSpringboardLayoutStore.setState({ isEditMode: false });
  });

  for (const size of SIZES) {
    it(`${size}: tapping the play button toggles playback`, () => {
      expect(useMusicDataStore.getState().isPlaying).toBe(false);
      render(<MusicWidget size={size} />);
      fireEvent.click(screen.getByTestId('widget-music-play'));
      expect(useMusicDataStore.getState().isPlaying).toBe(true);
    });
  }

  it('4x2: skip-next advances to the next queued song', () => {
    render(<MusicWidget size="4x2" />);
    fireEvent.click(screen.getByTestId('widget-music-next'));
    expect(useMusicDataStore.getState().currentSongId).toBe('song-2');
  });

  it('in edit mode, the play button does not toggle playback', () => {
    useSpringboardLayoutStore.setState({ isEditMode: true });
    render(<MusicWidget size="2x2" />);
    fireEvent.click(screen.getByTestId('widget-music-play'));
    expect(useMusicDataStore.getState().isPlaying).toBe(false);
  });

  // Regression guard for Bug 2 ("tapping a widget button pops up a bottom
  // drawer"). Tapping a control button must NOT bubble into WidgetShell's
  // onClick and therefore must NOT call `openApp`. Otherwise the user sees
  // the Music app launch animation every time they try to skip a track.
  for (const size of SIZES) {
    it(`${size}: tapping the play button does not launch the Music app`, () => {
      useAppRuntimeStore.setState({ activeAppId: null, appOrigin: null });
      render(<MusicWidget size={size} />);
      fireEvent.click(screen.getByTestId('widget-music-play'));
      expect(useAppRuntimeStore.getState().activeAppId).toBeNull();
    });
  }

  it('tapping a non-button area of the widget launches the Music app', () => {
    useAppRuntimeStore.setState({ activeAppId: null, appOrigin: null });
    render(<MusicWidget size="4x4" />);
    fireEvent.click(screen.getByTestId('widget-music'));
    expect(useAppRuntimeStore.getState().activeAppId).toBe('music');
  });
});

// ---------------------------------------------------------------------------
// PhotoWidget interactivity
//
// The widget owns its vertical pointer gesture: pointerdown stops
// propagation to preempt `usePageSwipe`, then pointermove shifts a vertical
// strip, then pointerup either commits to a neighbour photo or — if the
// delta is tiny — deep-links into `PhotoViewer` on the current photo.
//
// In jsdom `getBoundingClientRect` returns 0/0, so the widget keeps
// `viewportHeight = 1`. That actually makes the tests simpler: the commit
// threshold (`viewportHeight * 0.25`) becomes 0.25, so even a 50px swipe
// clearly exceeds it and deterministically flips to the next index.
// ---------------------------------------------------------------------------
describe('PhotoWidget interactivity', () => {
  let seededPhotos: Photo[];

  beforeEach(() => {
    useSpringboardLayoutStore.setState({ isEditMode: false });
    useAppRuntimeStore.setState({ activeAppId: null, appOrigin: null });
    seededPhotos = makeTestPhotos(12);
    usePhotosStore.setState({
      photos: seededPhotos,
      activeTab: 'library',
      viewingPhotoId: null,
      isDismissing: false,
    });
    // Deterministic photo pool rotation — freeze "today" so pickPhotoPool
    // lands on the same first photo across runs.
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-11T10:00:00'));
  });

  // Utility: find the caption DOM node for a given photo index (0 = first
  // frame in the strip, regardless of which frame is visually active).
  function getFrameCaption(
    container: HTMLElement,
    index: number,
  ): string | null {
    const frames = container.querySelectorAll<HTMLDivElement>(
      '[data-photo-frame]',
    );
    const frame = frames[index];
    if (!frame) return null;
    const caption = within(frame).queryByTestId('widget-photo-caption');
    return caption?.textContent ?? null;
  }

  // Utility: return whichever frame currently reports data-active=true.
  function getActiveFrameIndex(container: HTMLElement): number {
    const frames = container.querySelectorAll<HTMLDivElement>(
      '[data-photo-frame]',
    );
    for (let i = 0; i < frames.length; i++) {
      if (frames[i]!.getAttribute('data-active') === 'true') return i;
    }
    return -1;
  }

  it('renders the expected pool size for each widget size', () => {
    const { container, rerender } = render(<PhotoWidget size="2x2" />);
    expect(
      container.querySelectorAll('[data-photo-frame]').length,
    ).toBeGreaterThanOrEqual(2);
    rerender(<PhotoWidget size="4x4" />);
    expect(
      container.querySelectorAll('[data-photo-frame]').length,
    ).toBeGreaterThanOrEqual(2);
    // Pool should never exceed the current photo library.
    const frames = container.querySelectorAll('[data-photo-frame]').length;
    expect(frames).toBeLessThanOrEqual(seededPhotos.length);
  });

  it('renders an empty placeholder when the library has no photos', () => {
    usePhotosStore.setState({ photos: [] });
    render(<PhotoWidget size="4x2" />);
    expect(screen.getByText('无照片')).toBeInTheDocument();
  });

  it('a vertical up-swipe commits to the next photo', () => {
    const { container } = render(<PhotoWidget size="4x2" />);
    const viewport = screen.getByTestId('widget-photo-viewport');
    expect(viewport).toBeTruthy();

    // Baseline: frame 0 is active.
    expect(getActiveFrameIndex(container)).toBe(0);

    // Simulate a decisive upward swipe: down at y=200, move to y=140,
    // release at y=140. 60px of vertical movement, well past the
    // (viewportHeight * 0.25 = 0.25px) commit threshold.
    fireEvent.pointerDown(viewport, {
      pointerId: 1,
      clientX: 50,
      clientY: 200,
      button: 0,
      pointerType: 'touch',
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 1,
      clientX: 50,
      clientY: 160,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 1,
      clientX: 50,
      clientY: 140,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 1,
      clientX: 50,
      clientY: 140,
    });

    expect(getActiveFrameIndex(container)).toBe(1);

    // Caption on the active frame must come from the second photo in the
    // pool, not the first — this is a stronger assertion than dot index
    // since it proves the correct frame is lit.
    const firstCaption = getFrameCaption(container, 0);
    const secondCaption = getFrameCaption(container, 1);
    expect(firstCaption).not.toBeNull();
    expect(secondCaption).not.toBeNull();
    expect(firstCaption).not.toBe(secondCaption);
  });

  it('a up-then-down swipe lands back on the original photo', () => {
    const { container } = render(<PhotoWidget size="4x2" />);
    const viewport = screen.getByTestId('widget-photo-viewport');

    // Swipe up → next
    fireEvent.pointerDown(viewport, {
      pointerId: 2,
      clientX: 50,
      clientY: 200,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 2,
      clientX: 50,
      clientY: 140,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 2,
      clientX: 50,
      clientY: 140,
    });
    expect(getActiveFrameIndex(container)).toBe(1);

    // Swipe down → prev
    fireEvent.pointerDown(viewport, {
      pointerId: 3,
      clientX: 50,
      clientY: 100,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 3,
      clientX: 50,
      clientY: 160,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 3,
      clientX: 50,
      clientY: 160,
    });
    expect(getActiveFrameIndex(container)).toBe(0);
  });

  it('a tap opens the Photos app and deep-links into PhotoViewer on the current photo', () => {
    render(<PhotoWidget size="4x4" />);
    const viewport = screen.getByTestId('widget-photo-viewport');

    fireEvent.pointerDown(viewport, {
      pointerId: 4,
      clientX: 50,
      clientY: 50,
      button: 0,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 4,
      clientX: 50,
      clientY: 50,
    });

    // App runtime flipped to photos.
    expect(useAppRuntimeStore.getState().activeAppId).toBe('photos');
    // And the viewer state was pre-populated so PhotoViewer opens onto
    // the photo that was active in the widget when the user tapped.
    expect(usePhotosStore.getState().viewingPhotoId).not.toBeNull();
  });

  it('tap after a swipe deep-links into the newly-visible photo', () => {
    const { container } = render(<PhotoWidget size="4x2" />);
    const viewport = screen.getByTestId('widget-photo-viewport');

    // Swipe to frame 1 first.
    fireEvent.pointerDown(viewport, {
      pointerId: 10,
      clientX: 50,
      clientY: 200,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 10,
      clientX: 50,
      clientY: 140,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 10,
      clientX: 50,
      clientY: 140,
    });
    expect(getActiveFrameIndex(container)).toBe(1);

    // Tap — should jump into PhotoViewer on whichever photo is at index 1,
    // not the one at index 0.
    fireEvent.pointerDown(viewport, {
      pointerId: 11,
      clientX: 50,
      clientY: 50,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 11,
      clientX: 50,
      clientY: 50,
    });

    const viewingId = usePhotosStore.getState().viewingPhotoId;
    expect(viewingId).not.toBeNull();
    // The photo at frame index 1 in the current pool — we can read it
    // from the DOM since each frame carries its own img src uniquely
    // derived from the photo id.
    const frames = container.querySelectorAll<HTMLDivElement>('[data-photo-frame]');
    const secondFrame = frames[1]!;
    const secondImg = secondFrame.querySelector('img');
    const firstFrame = frames[0]!;
    const firstImg = firstFrame.querySelector('img');
    expect(secondImg?.src).toBeTruthy();
    expect(secondImg?.src).not.toBe(firstImg?.src);
    // viewingId should correspond to the 2nd frame, i.e. != the 1st.
    // We can't derive the id from the src directly, but we can assert
    // that calling openPhoto(firstFrameId) would have yielded a different
    // viewingId — cheap proxy: viewingId must match the seeded pool at an
    // index that is NOT 0 relative to the pool's first entry.
    const poolFirstId = Number(
      firstImg?.src.match(/\/id\/(\d+)\//)?.[1] ?? -1,
    );
    expect(viewingId).not.toBe(poolFirstId);
  });

  it('a swipe does NOT open the Photos app (movement disqualifies the tap path)', () => {
    render(<PhotoWidget size="4x2" />);
    const viewport = screen.getByTestId('widget-photo-viewport');

    fireEvent.pointerDown(viewport, {
      pointerId: 5,
      clientX: 50,
      clientY: 200,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 5,
      clientX: 50,
      clientY: 120,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 5,
      clientX: 50,
      clientY: 120,
    });

    expect(useAppRuntimeStore.getState().activeAppId).toBeNull();
    expect(usePhotosStore.getState().viewingPhotoId).toBeNull();
  });

  it('edit mode disables swipe and taps', () => {
    useSpringboardLayoutStore.setState({ isEditMode: true });
    const { container } = render(<PhotoWidget size="4x2" />);
    const viewport = screen.getByTestId('widget-photo-viewport');

    fireEvent.pointerDown(viewport, {
      pointerId: 6,
      clientX: 50,
      clientY: 200,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 6,
      clientX: 50,
      clientY: 140,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 6,
      clientX: 50,
      clientY: 140,
    });

    // Neither the index nor the Photos app launched.
    expect(getActiveFrameIndex(container)).toBe(0);
    expect(useAppRuntimeStore.getState().activeAppId).toBeNull();
    expect(usePhotosStore.getState().viewingPhotoId).toBeNull();
  });

  it('drawer variant is static', () => {
    const { container } = render(
      <PhotoWidget size="4x2" variant="drawer" previewWidth={150} />,
    );
    const viewport = screen.getByTestId('widget-photo-viewport');

    fireEvent.pointerDown(viewport, {
      pointerId: 7,
      clientX: 50,
      clientY: 200,
    });
    fireEvent.pointerMove(viewport, {
      pointerId: 7,
      clientX: 50,
      clientY: 140,
    });
    fireEvent.pointerUp(viewport, {
      pointerId: 7,
      clientX: 50,
      clientY: 140,
    });

    expect(getActiveFrameIndex(container)).toBe(0);
    expect(useAppRuntimeStore.getState().activeAppId).toBeNull();
  });
});
