import { describe, expect, it } from 'vitest';
import {
  parsePerfDebugStorage,
  PERF_DEBUG_STORAGE_KEY,
  resolvePerfDebugPrefs,
  serializePerfDebugStorage,
  summarizeFrameDeltas,
} from '../diagnostics';

describe('perf diagnostics helpers', () => {
  it('parses persisted debug flags and query overrides enabled state', () => {
    const persisted = parsePerfDebugStorage(
      JSON.stringify({
        enabled: false,
        disableWallpaper: true,
        disableDesktopFilter: true,
        reduceTransparency: false,
        hideIconImages: true,
      }),
    );

    expect(PERF_DEBUG_STORAGE_KEY).toBe('hiphone:perf-debug');
    expect(
      resolvePerfDebugPrefs('?perf=1', persisted),
    ).toEqual({
      enabled: true,
      disableWallpaper: true,
      disableDesktopFilter: true,
      reduceTransparency: false,
      hideIconImages: true,
    });

    expect(
      resolvePerfDebugPrefs('?perf=0', persisted),
    ).toEqual({
      enabled: false,
      disableWallpaper: true,
      disableDesktopFilter: true,
      reduceTransparency: false,
      hideIconImages: true,
    });
  });

  it('serializes and parses debug prefs safely', () => {
    const raw = serializePerfDebugStorage({
      enabled: true,
      disableWallpaper: false,
      disableDesktopFilter: true,
      reduceTransparency: true,
      hideIconImages: true,
    });

    expect(parsePerfDebugStorage(raw)).toEqual({
      enabled: true,
      disableWallpaper: false,
      disableDesktopFilter: true,
      reduceTransparency: true,
      hideIconImages: true,
    });
    expect(parsePerfDebugStorage('oops')).toBeNull();
  });

  it('summarizes frame deltas into fps and slow-frame buckets', () => {
    expect(summarizeFrameDeltas([16, 17, 33, 48])).toEqual({
      sampleCount: 4,
      fps: 35.1,
      avgFrameMs: 28.5,
      worstFrameMs: 48,
      slowFrames24: 2,
      slowFrames40: 1,
    });
  });
});
