/**
 * iOS spring motion presets.
 * These map to UISpringTimingParameters characteristics.
 *
 * CRITICAL: Components must import spring constants from this module.
 * Hard-coding stiffness/damping values in component files is disallowed.
 *
 * ## How to choose a preset
 *
 * - **snappy**:       icon press/release, button taps, quick reveals
 * - **smooth**:       sheet/page transitions that should still feel lively
 * - **bouncy**:       lock screen / playful reveals where overshoot is the point
 * - **interactive**:  finger-following snap-back (user just released a drag)
 * - **criticalDamped**: "leaving scene" animations where overshoot is wrong —
 *   card fly-away, app exit, any time the destination is off-screen and the
 *   user should see a single decisive motion with no wobble. Dampingfraction
 *   is ≈ 1.0 so the spring settles monotonically.
 *
 * ## Spring math reference (SwiftUI → motion)
 *
 * SwiftUI `.spring(response:dampingFraction:)` maps to:
 *   stiffness = (2π / response)²
 *   damping   = 4π * dampingFraction / response
 *
 * For the SwiftUI default (`response: 0.55`, `dampingFraction: 0.825`):
 *   stiffness ≈ 130.5, damping ≈ 18.85
 * which is close to our `smooth` preset; `smooth` is intentionally a bit
 * stiffer so the fog sheet / CC transitions don't feel sluggish on desktop.
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
  /**
   * Critically-damped spring for "leaving scene" animations. Damping ratio
   * ≈ 1.0 means it converges to the target without overshoot, which is
   * what iOS uses for swipe-to-dismiss fly-aways and app exits. For
   * stiffness = 320 and mass = 1, critical damping = 2√(stiffness*mass)
   * ≈ 35.8; we use 36 to stay just on the over-damped side and make sure
   * there is zero visible bounce.
   */
  criticalDamped: { stiffness: 320, damping: 36, mass: 1 },
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
