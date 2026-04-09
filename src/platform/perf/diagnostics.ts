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

export interface ResourceEntryLike {
  name: string;
  initiatorType?: string;
  transferSize?: number;
  decodedBodySize?: number;
  duration?: number;
}

export interface RankedResource {
  label: string;
  initiatorType: string;
  sizeBytes: number;
  durationMs: number;
}

export interface LayerCount {
  name: string;
  count: number;
}

export interface ClipboardPerfSnapshot {
  frames: FrameStats;
  longTaskCount: number;
  longestLongTaskMs: number;
  activeLayers: LayerCount[];
  activeBackdropCount: number;
  viewportWidth: number;
  viewportHeight: number;
  dpr: number;
  hardwareConcurrency: number | null;
  deviceMemory: number | null;
  topResources: RankedResource[];
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

function getResourceBytes(entry: ResourceEntryLike) {
  return Math.max(entry.transferSize ?? 0, entry.decodedBodySize ?? 0);
}

function formatResourceLabel(name: string) {
  try {
    const url = new URL(name, 'http://localhost');
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.slice(-2).join('/');
  } catch {
    const segments = name.split('/').filter(Boolean);
    return segments.slice(-2).join('/');
  }
}

export function summarizeResourceEntries(
  entries: ResourceEntryLike[],
  limit = 4,
): RankedResource[] {
  return entries
    .filter((entry) => {
      const type = entry.initiatorType ?? 'other';
      return ['img', 'css', 'script', 'fetch'].includes(type);
    })
    .map((entry) => ({
      label: formatResourceLabel(entry.name),
      initiatorType: entry.initiatorType ?? 'other',
      sizeBytes: getResourceBytes(entry),
      durationMs: Math.round((entry.duration ?? 0) * 10) / 10,
    }))
    .sort((left, right) => {
      if (right.sizeBytes !== left.sizeBytes) {
        return right.sizeBytes - left.sizeBytes;
      }
      return right.durationMs - left.durationMs;
    })
    .slice(0, limit);
}

export function summarizeActiveLayers(names: string[]): LayerCount[] {
  const counts = new Map<string, number>();

  for (const name of names) {
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.name.localeCompare(right.name);
    });
}

export function formatPerfSnapshotForClipboard(
  snapshot: ClipboardPerfSnapshot,
  prefs: Pick<
    PerfDebugPrefs,
    'disableWallpaper' | 'disableDesktopFilter' | 'reduceTransparency' | 'hideIconImages'
  >,
) {
  const activeLayers =
    snapshot.activeLayers.length > 0
      ? snapshot.activeLayers.map((layer) => `${layer.name} × ${layer.count}`).join(', ')
      : 'none';

  const topResources =
    snapshot.topResources.length > 0
      ? snapshot.topResources
          .map(
            (resource) =>
              `- ${resource.label} | ${resource.initiatorType} | ${Math.round(resource.sizeBytes / 102.4) / 10}KB | ${resource.durationMs}ms`,
          )
          .join('\n')
      : '- none';

  return [
    'hiPhone Performance Snapshot',
    '',
    `[Frame] fps=${snapshot.frames.fps}, avg=${snapshot.frames.avgFrameMs}ms, worst=${snapshot.frames.worstFrameMs}ms, slow24=${snapshot.frames.slowFrames24}, slow40=${snapshot.frames.slowFrames40}`,
    `[MainThread] longTasks=${snapshot.longTaskCount}, longest=${snapshot.longestLongTaskMs}ms`,
    `[Environment] viewport=${snapshot.viewportWidth}x${snapshot.viewportHeight}, dpr=${snapshot.dpr}, cores=${snapshot.hardwareConcurrency ?? '-'}, memory=${snapshot.deviceMemory ?? '-'}`,
    `[Layers] backdrops=${snapshot.activeBackdropCount}, active=${activeLayers}`,
    '[Isolation]',
    `- disableWallpaper=${prefs.disableWallpaper}`,
    `- disableDesktopFilter=${prefs.disableDesktopFilter}`,
    `- reduceTransparency=${prefs.reduceTransparency}`,
    `- hideIconImages=${prefs.hideIconImages}`,
    '[TopResources]',
    topResources,
  ].join('\n');
}
