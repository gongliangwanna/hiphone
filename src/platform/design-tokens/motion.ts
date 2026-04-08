/**
 * iOS spring motion presets.
 * These map to UISpringTimingParameters characteristics.
 *
 * CRITICAL: Components must import spring constants from this module.
 * Hard-coding stiffness/damping values in component files is disallowed.
 */

export const spring = {
  /** Icon press/release, quick snaps */
  snappy: { stiffness: 500, damping: 38, mass: 1 },
  /** Page transitions, sheet enter/exit */
  smooth: { stiffness: 280, damping: 28, mass: 1 },
  /** Lock screen unlock release — playful overshoot */
  bouncy: { stiffness: 220, damping: 18, mass: 1 },
  /** Finger-following snap-back (interactive drag release) */
  interactive: { stiffness: 400, damping: 40, mass: 1 },
} as const;

export const duration = {
  instant: 100,
  fast: 200,
  base: 300,
  slow: 450,
} as const;

/** Standard ease for non-physics transitions (opacity fade, etc.) */
export const ease = {
  standard: [0.4, 0, 0.2, 1] as [number, number, number, number],
} as const;
