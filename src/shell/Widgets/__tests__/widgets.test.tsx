import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { WidgetSize, WidgetKind } from '@/platform/stores/springboardLayoutStore';
import { widgetCatalog, getWidgetComponent } from '../registry';
import { useMusicDataStore } from '@/apps/Music/musicDataStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { MusicWidget } from '../MusicWidget';

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
