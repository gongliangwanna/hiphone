import { describe, expect, it } from 'vitest';
import {
  formatPerfSnapshotForClipboard,
  parsePerfDebugStorage,
  PERF_DEBUG_STORAGE_KEY,
  resolvePerfDebugPrefs,
  serializePerfDebugStorage,
  summarizeActiveLayers,
  summarizeFrameDeltas,
  summarizeResourceEntries,
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

  it('sorts resources by size and keeps the most informative label', () => {
    expect(
      summarizeResourceEntries([
        {
          name: 'http://localhost/resource/icons/ios-system/settings.jpg',
          initiatorType: 'img',
          transferSize: 1024,
          duration: 12.34,
        },
        {
          name: 'http://localhost/resource/wallpapers/ios/ios-26-stock-03.png',
          initiatorType: 'img',
          decodedBodySize: 4096,
          duration: 21.2,
        },
        {
          name: 'http://localhost/src/main.tsx',
          initiatorType: 'script',
          transferSize: 2048,
          duration: 8,
        },
      ]),
    ).toEqual([
      {
        label: 'ios/ios-26-stock-03.png',
        initiatorType: 'img',
        sizeBytes: 4096,
        durationMs: 21.2,
      },
      {
        label: 'src/main.tsx',
        initiatorType: 'script',
        sizeBytes: 2048,
        durationMs: 8,
      },
      {
        label: 'ios-system/settings.jpg',
        initiatorType: 'img',
        sizeBytes: 1024,
        durationMs: 12.3,
      },
    ]);
  });

  it('counts active layers by name', () => {
    expect(
      summarizeActiveLayers(['wallpaper', 'material:thick', 'wallpaper', 'toast']),
    ).toEqual([
      { name: 'wallpaper', count: 2 },
      { name: 'material:thick', count: 1 },
      { name: 'toast', count: 1 },
    ]);
  });

  it('formats a clipboard-friendly performance snapshot', () => {
    expect(
      formatPerfSnapshotForClipboard(
        {
          frames: {
            sampleCount: 60,
            fps: 58.4,
            avgFrameMs: 17.1,
            worstFrameMs: 42.8,
            slowFrames24: 4,
            slowFrames40: 1,
          },
          longTaskCount: 2,
          longestLongTaskMs: 88.4,
          activeLayers: [
            { name: 'wallpaper', count: 1 },
            { name: 'material:thick', count: 1 },
          ],
          activeBackdropCount: 1,
          viewportWidth: 390,
          viewportHeight: 844,
          dpr: 3,
          hardwareConcurrency: 6,
          deviceMemory: 8,
          topResources: [
            {
              label: 'ios/ios-26-stock-03.png',
              initiatorType: 'img',
              sizeBytes: 4096,
              durationMs: 20.1,
            },
          ],
        },
        {
          disableWallpaper: false,
          disableDesktopFilter: true,
          reduceTransparency: false,
          hideIconImages: true,
        },
      ),
    ).toContain('[Frame] fps=58.4, avg=17.1ms, worst=42.8ms, slow24=4, slow40=1');
    expect(
      formatPerfSnapshotForClipboard(
        {
          frames: {
            sampleCount: 60,
            fps: 58.4,
            avgFrameMs: 17.1,
            worstFrameMs: 42.8,
            slowFrames24: 4,
            slowFrames40: 1,
          },
          longTaskCount: 2,
          longestLongTaskMs: 88.4,
          activeLayers: [],
          activeBackdropCount: 0,
          viewportWidth: 390,
          viewportHeight: 844,
          dpr: 3,
          hardwareConcurrency: 6,
          deviceMemory: 8,
          topResources: [],
        },
        {
          disableWallpaper: false,
          disableDesktopFilter: true,
          reduceTransparency: false,
          hideIconImages: true,
        },
      ),
    ).toContain('- hideIconImages=true');
  });
});
