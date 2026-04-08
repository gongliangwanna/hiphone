/**
 * iOS rubber-band damping function.
 * Source: WebKit UIScrollView approximation.
 *
 * f(x) = (1 - 1/(x/c + 1)) * c
 * where c = containerSize * 0.55
 *
 * Properties:
 * - f(0) = 0
 * - f(x) → c as x → ∞ (asymptotic)
 * - monotonically increasing
 * - dimension is the same as x (pixels)
 */

/**
 * Apply rubber-band damping.
 * @param offset - raw displacement in px (positive or negative)
 * @param containerSize - the dimension of the scrollable container
 * @returns damped displacement in px
 */
export function rubberBand(offset: number, containerSize: number): number {
  if (offset === 0) return 0;

  const c = containerSize * 0.55;
  const absOffset = Math.abs(offset);
  const damped = (1 - 1 / (absOffset / c + 1)) * c;

  return offset > 0 ? damped : -damped;
}
