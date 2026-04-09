export type ShellMode = 'simulator' | 'fullscreen';
export type SizeTier = 'compact' | 'regular' | 'large';

export interface ViewportProfile {
  shellMode: ShellMode;
  sizeTier: SizeTier;
  width: number;
  height: number;
  isPortrait: boolean;
}

export interface ViewportEnvironment {
  viewportWidth: number;
  viewportHeight: number;
  coarsePointer: boolean;
}

export interface SpringboardMetrics {
  sidePadding: number;
  iconSize: number;
  cellWidth: number;
  labelSize: number;
  gridGapY: number;
  dockPaddingY: number;
  springboardTopPadding: number;
}

/**
 * Physical display corner radius (in pt) of the matching iPhone class.
 * Values are the continuous-corner radii from Apple's hardware:
 *   - compact  ≈ iPhone 13 mini / XR / 11   → 41.5 pt
 *   - regular  ≈ iPhone 14 / 15 / 16        → 47.33 pt
 *   - large    ≈ iPhone 14 Pro Max / 15 Pro → 55.0 pt
 *
 * The switcher card rounds to this radius (because the card *is* a
 * scaled-down image of the screen), and the AppHost morph/exit transitions
 * land on this radius when showing the scene at card size. Hardcoding 30
 * here is wrong — a card that's more square-cornered than the device reads
 * as "cheap", and a card that's more round-cornered reads as toy-like.
 */
export const DEVICE_CORNER_RADIUS_BY_SIZE_TIER: Record<SizeTier, number> = {
  compact: 41.5,
  regular: 47.33,
  large: 55,
};

export function getDeviceCornerRadius(sizeTier: SizeTier): number {
  return DEVICE_CORNER_RADIUS_BY_SIZE_TIER[sizeTier];
}

export const DEVICE_FRAME_WIDTH = 430;
export const DEVICE_FRAME_HEIGHT = 932;
const DEVICE_ASPECT_RATIO = DEVICE_FRAME_WIDTH / DEVICE_FRAME_HEIGHT;

export const springboardMetricsBySizeTier: Record<SizeTier, SpringboardMetrics> = {
  compact: {
    sidePadding: 16,
    iconSize: 54,
    cellWidth: 68,
    labelSize: 11,
    gridGapY: 12,
    dockPaddingY: 6,
    springboardTopPadding: 10,
  },
  regular: {
    sidePadding: 22,
    iconSize: 60,
    cellWidth: 75,
    labelSize: 12,
    gridGapY: 20,
    dockPaddingY: 8,
    springboardTopPadding: 16,
  },
  large: {
    sidePadding: 24,
    iconSize: 64,
    cellWidth: 78,
    labelSize: 12,
    gridGapY: 22,
    dockPaddingY: 10,
    springboardTopPadding: 18,
  },
};

export function resolveViewportProfile(env: ViewportEnvironment): ViewportProfile {
  const viewportWidth = Math.max(0, env.viewportWidth);
  const viewportHeight = Math.max(0, env.viewportHeight);
  const isPortrait = viewportHeight >= viewportWidth;
  const isPhoneSizedViewport =
    isPortrait &&
    viewportWidth <= DEVICE_FRAME_WIDTH &&
    viewportHeight >= 640;
  const isFullscreen = isPhoneSizedViewport;

  const width = isFullscreen
    ? viewportWidth
    : Math.min(DEVICE_FRAME_WIDTH, viewportWidth, viewportHeight * DEVICE_ASPECT_RATIO);
  const height = isFullscreen ? viewportHeight : width / DEVICE_ASPECT_RATIO;

  return {
    shellMode: isFullscreen ? 'fullscreen' : 'simulator',
    sizeTier: resolveSizeTier(width, height),
    width,
    height,
    isPortrait,
  };
}

export function resolveSizeTier(width: number, height: number): SizeTier {
  if (width <= 375 || height < 760) {
    return 'compact';
  }

  if (width >= 412 && height >= 900) {
    return 'large';
  }

  return 'regular';
}

export function getSpringboardMetrics(sizeTier: SizeTier): SpringboardMetrics {
  return springboardMetricsBySizeTier[sizeTier];
}
