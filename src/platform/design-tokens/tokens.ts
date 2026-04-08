/**
 * Type-safe design token mapping.
 * Single source of truth is tokens.css (CSS variables).
 * This module mirrors those values for TS consumption (components, animations, tests).
 */

export const tokens = {
  typography: {
    largeTitle: { fontSize: 34, fontWeight: 700, letterSpacing: 0.37 },
    title1: { fontSize: 28, fontWeight: 700, letterSpacing: 0.36 },
    title2: { fontSize: 22, fontWeight: 700, letterSpacing: 0.35 },
    title3: { fontSize: 20, fontWeight: 600, letterSpacing: 0.38 },
    headline: { fontSize: 17, fontWeight: 600, letterSpacing: -0.41 },
    body: { fontSize: 17, fontWeight: 400, letterSpacing: -0.41 },
    callout: { fontSize: 16, fontWeight: 400, letterSpacing: -0.32 },
    subhead: { fontSize: 15, fontWeight: 400, letterSpacing: -0.24 },
    footnote: { fontSize: 13, fontWeight: 400, letterSpacing: -0.08 },
    caption1: { fontSize: 12, fontWeight: 400, letterSpacing: 0 },
    caption2: { fontSize: 11, fontWeight: 400, letterSpacing: 0.07 },
  },

  spacing: {
    1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24,
    8: 32, 10: 40, 12: 48, 16: 64,
    hitTargetMin: 44,
  },

  radius: {
    device: 54,
    card: 22,
    group: 16,
    button: 12,
    chip: 10,
    icon: 18,
    homeIndicator: 3,
  },

  colors: {
    label: '#000000',
    secondaryLabel: 'rgba(60, 60, 67, 0.6)',
    tertiaryLabel: 'rgba(60, 60, 67, 0.3)',
    separator: 'rgba(60, 60, 67, 0.29)',
    systemBackground: '#ffffff',
    secondarySystemBackground: 'rgba(242, 242, 247, 1)',
    tertiarySystemBackground: 'rgba(255, 255, 255, 1)',
    systemFill: 'rgba(120, 120, 128, 0.2)',

    systemBlue: 'rgba(0, 122, 255, 1)',
    systemGreen: 'rgba(52, 199, 89, 1)',
    systemIndigo: 'rgba(88, 86, 214, 1)',
    systemOrange: 'rgba(255, 149, 0, 1)',
    systemPink: 'rgba(255, 45, 85, 1)',
    systemPurple: 'rgba(175, 82, 222, 1)',
    systemRed: 'rgba(255, 59, 48, 1)',
    systemTeal: 'rgba(90, 200, 250, 1)',
    systemYellow: 'rgba(255, 204, 0, 1)',
  },
} as const;

/** Concentric radius helper: inner = outer - padding, clamped to 0 */
export function concentric(outer: number, padding: number): number {
  return Math.max(0, outer - padding);
}
