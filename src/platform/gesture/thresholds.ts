/**
 * Gesture threshold constants and decision functions.
 */

/** Minimum displacement (px) to commit unlock */
export const UNLOCK_DISTANCE_THRESHOLD = 0.4; // fraction of container height

/** Minimum velocity (px/ms) to commit unlock via fast flick */
export const UNLOCK_VELOCITY_THRESHOLD = 0.5; // px/ms

/** Minimum displacement (px) for page swipe */
export const PAGE_SWIPE_DISTANCE = 50; // px

/** Minimum velocity (px/ms) for page swipe via fast flick */
export const PAGE_SWIPE_VELOCITY = 0.3; // px/ms

/**
 * Determine whether an unlock gesture should commit.
 * @param dy - vertical displacement in px (negative = upward)
 * @param vy - vertical velocity in px/ms (negative = upward)
 * @param containerHeight - height of the gesture area
 */
export function shouldCommitUnlock(
  dy: number,
  vy: number,
  containerHeight: number,
): boolean {
  // dy is negative for upward swipe (unlock direction)
  const displacement = Math.abs(dy);
  const speed = Math.abs(vy);

  const distanceMet = displacement >= UNLOCK_DISTANCE_THRESHOLD * containerHeight;
  const velocityMet = speed >= UNLOCK_VELOCITY_THRESHOLD;

  return distanceMet || velocityMet;
}

/**
 * Determine swipe direction for page navigation.
 * Returns -1 for next page (swipe left), 1 for prev page (swipe right), 0 for no change.
 */
export function getSwipeDirection(
  dx: number,
  vx: number,
): -1 | 0 | 1 {
  const displacement = Math.abs(dx);
  const speed = Math.abs(vx);

  if (displacement >= PAGE_SWIPE_DISTANCE || speed >= PAGE_SWIPE_VELOCITY) {
    return dx < 0 ? -1 : 1;
  }

  return 0;
}
