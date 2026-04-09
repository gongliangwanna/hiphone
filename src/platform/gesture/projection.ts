/**
 * iOS scroll-physics projection.
 *
 * When a user releases a flick, iOS does **not** look at raw distance and
 * raw velocity as two independent thresholds. Instead it *projects* where
 * the gesture would come to rest if nothing else acted on it, and uses that
 * projected rest position as the single decision variable.
 *
 * Formula (Olivier Gutknecht, WWDC18 "Designing Fluid Interfaces"):
 *
 *   projectedRestPosition = position + velocity * decelerationRate / (1 - decelerationRate)
 *
 * With the normal scroll-view deceleration rate `0.998`, the right-hand term
 * simplifies to `velocity * 499` (for velocity in units/ms) or equivalently
 * `velocity * 0.499` (for velocity in units/s). We express velocity in px/ms
 * throughout the codebase, matching `computeVelocity` in `velocity.ts`.
 *
 * Reference values (matching UIScrollView):
 *   - decelerationRate.normal = 0.998  (→ factor 499)
 *   - decelerationRate.fast   = 0.99   (→ factor 99, used for paging)
 */

/** UIScrollViewDecelerationRate.normal equivalent. */
export const DECELERATION_RATE_NORMAL = 0.998;

/** UIScrollViewDecelerationRate.fast equivalent. Used for page-based scrolls. */
export const DECELERATION_RATE_FAST = 0.99;

/**
 * Project the rest position of a gesture given its current position and
 * release velocity.
 *
 * @param position current offset in px (whatever axis the caller uses)
 * @param velocity release velocity in px/ms (sign follows `position`)
 * @param decelerationRate UIScrollView deceleration rate, default normal
 * @returns the px position the gesture would settle at if released
 *
 * Examples:
 *   project(-120, -1.5)            → -120 + (-1.5 * 499)   ≈ -868.5
 *   project(0, 0)                  → 0
 *   project(-50, -0.2)             → -50 + (-0.2 * 499)    ≈ -149.8
 *   project(-50, -0.2, 0.99)       → -50 + (-0.2 * 99)     ≈ -69.8
 */
export function project(
  position: number,
  velocity: number,
  decelerationRate: number = DECELERATION_RATE_NORMAL,
): number {
  // velocity is px/ms; multiply by 1000 so we're working in px/s,
  // then apply the classic decelerationRate/(1 - decelerationRate) factor.
  // Combined factor: 1000 * decelerationRate / (1 - decelerationRate).
  // For decelerationRate = 0.998 → factor ≈ 499000 / 1000 = 499 per px/ms.
  const factor = decelerationRate / (1 - decelerationRate); // 499 for normal, 99 for fast
  return position + velocity * factor;
}
