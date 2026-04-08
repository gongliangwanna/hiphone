/**
 * Velocity solver using a sliding window approach.
 * Given a sequence of (timestamp, x, y) samples, computes the velocity.
 */

export interface VelocitySample {
  time: number; // ms (performance.now or Date.now)
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

/**
 * Compute velocity from a sliding window of samples.
 * Uses the oldest and newest samples in the window for a simple linear estimate.
 * Filters out samples older than `maxAge` ms.
 */
export function computeVelocity(
  samples: VelocitySample[],
  maxAge: number = 100,
): Velocity {
  if (samples.length < 2) return { vx: 0, vy: 0 };

  const lastSample = samples[samples.length - 1]!;
  const now = lastSample.time;
  const recent = samples.filter((s) => now - s.time <= maxAge);

  if (recent.length < 2) return { vx: 0, vy: 0 };

  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const dt = last.time - first.time;

  if (dt === 0) return { vx: 0, vy: 0 };

  return {
    vx: (last.x - first.x) / dt,
    vy: (last.y - first.y) / dt,
  };
}
