export const PERF_DEBUG_STORAGE_KEY = 'hiphone:perf-debug';

export interface PerfDebugPrefs {
  enabled: boolean;
  disableWallpaper: boolean;
  disableDesktopFilter: boolean;
  reduceTransparency: boolean;
  hideIconImages: boolean;
}

export interface FrameStats {
  sampleCount: number;
  fps: number;
  avgFrameMs: number;
  worstFrameMs: number;
  slowFrames24: number;
  slowFrames40: number;
}

export const defaultPerfDebugPrefs: PerfDebugPrefs = {
  enabled: false,
  disableWallpaper: false,
  disableDesktopFilter: false,
  reduceTransparency: false,
  hideIconImages: false,
};

function isTruthy(value: string | null) {
  return value === '1' || value === 'true' || value === 'on';
}

function isFalsy(value: string | null) {
  return value === '0' || value === 'false' || value === 'off';
}

export function parsePerfDebugStorage(raw: string | null): Partial<PerfDebugPrefs> | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : undefined,
      disableWallpaper:
        typeof parsed.disableWallpaper === 'boolean' ? parsed.disableWallpaper : undefined,
      disableDesktopFilter:
        typeof parsed.disableDesktopFilter === 'boolean'
          ? parsed.disableDesktopFilter
          : undefined,
      reduceTransparency:
        typeof parsed.reduceTransparency === 'boolean' ? parsed.reduceTransparency : undefined,
      hideIconImages:
        typeof parsed.hideIconImages === 'boolean' ? parsed.hideIconImages : undefined,
    };
  } catch {
    return null;
  }
}

export function serializePerfDebugStorage(prefs: PerfDebugPrefs) {
  return JSON.stringify(prefs);
}

export function resolvePerfDebugPrefs(
  search: string,
  persisted: Partial<PerfDebugPrefs> | null,
): PerfDebugPrefs {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const perf = params.get('perf');

  return {
    ...defaultPerfDebugPrefs,
    ...persisted,
    enabled: isTruthy(perf) ? true : isFalsy(perf) ? false : persisted?.enabled ?? false,
  };
}

export function summarizeFrameDeltas(deltas: number[]): FrameStats {
  if (deltas.length === 0) {
    return {
      sampleCount: 0,
      fps: 0,
      avgFrameMs: 0,
      worstFrameMs: 0,
      slowFrames24: 0,
      slowFrames40: 0,
    };
  }

  const total = deltas.reduce((sum, delta) => sum + delta, 0);
  const avgFrameMs = total / deltas.length;
  const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;

  return {
    sampleCount: deltas.length,
    fps: Math.round(fps * 10) / 10,
    avgFrameMs: Math.round(avgFrameMs * 10) / 10,
    worstFrameMs: Math.round(Math.max(...deltas) * 10) / 10,
    slowFrames24: deltas.filter((delta) => delta >= 24).length,
    slowFrames40: deltas.filter((delta) => delta >= 40).length,
  };
}
