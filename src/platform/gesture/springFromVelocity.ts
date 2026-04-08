/**
 * Convert gesture release velocity into spring animation initial conditions.
 * The spring target is determined by whether the gesture committed or cancelled.
 */

import type { Velocity } from './velocity';

export interface SpringConfig {
  stiffness: number;
  damping: number;
  mass: number;
  velocity: number;
  target: number;
}

/**
 * Create a spring config that starts from the current position
 * with the release velocity, targeting either the committed position or origin.
 *
 * @param currentPosition - current drag offset in px
 * @param velocity - release velocity from computeVelocity
 * @param committed - whether the gesture threshold was met
 * @param targetPosition - the committed end position (e.g., -containerHeight for unlock)
 * @param springPreset - base spring preset to use
 */
export function springFromVelocity(
  _currentPosition: number,
  velocity: Velocity,
  axis: 'x' | 'y',
  committed: boolean,
  targetPosition: number,
  springPreset: { stiffness: number; damping: number; mass: number },
): SpringConfig {
  const v = axis === 'x' ? velocity.vx : velocity.vy;

  return {
    stiffness: springPreset.stiffness,
    damping: springPreset.damping,
    mass: springPreset.mass,
    velocity: v * 1000, // convert px/ms → px/s for spring
    target: committed ? targetPosition : 0,
  };
}
