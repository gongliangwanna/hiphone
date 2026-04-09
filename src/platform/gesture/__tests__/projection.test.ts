import { describe, expect, it } from 'vitest';
import {
  DECELERATION_RATE_FAST,
  DECELERATION_RATE_NORMAL,
  project,
} from '../projection';

describe('projection', () => {
  it('returns the current position when velocity is zero', () => {
    expect(project(0, 0)).toBe(0);
    expect(project(-120, 0)).toBe(-120);
    expect(project(200, 0)).toBe(200);
  });

  it('applies the normal deceleration factor (≈499)', () => {
    // factor = 0.998 / 0.002 = 499
    expect(project(0, -1)).toBeCloseTo(-499, 5);
    expect(project(-50, -0.2)).toBeCloseTo(-50 + -0.2 * 499, 5);
    expect(project(100, 0.5)).toBeCloseTo(100 + 0.5 * 499, 5);
  });

  it('applies the fast deceleration factor (≈99) when requested', () => {
    // factor = 0.99 / 0.01 = 99
    expect(project(0, -1, DECELERATION_RATE_FAST)).toBeCloseTo(-99, 5);
    expect(project(-10, -0.5, DECELERATION_RATE_FAST)).toBeCloseTo(-10 + -0.5 * 99, 5);
  });

  it('respects the sign of velocity', () => {
    // Upward (negative) flick from near-top → projects further up (more negative)
    const upward = project(-20, -1.2);
    expect(upward).toBeLessThan(-20);

    // Downward (positive) flick → projects further down (more positive)
    const downward = project(20, 1.2);
    expect(downward).toBeGreaterThan(20);
  });

  it('is linear in both position and velocity', () => {
    // Projection is a pure linear combination, so doubling velocity doubles
    // the travel component; halving the position halves the position term.
    const a = project(100, -1);
    const b = project(100, -2);
    expect(b - 100).toBeCloseTo((a - 100) * 2, 5);

    const c = project(50, -1);
    expect(c - 50).toBeCloseTo(a - 100, 5);
  });

  it('exposes the canonical deceleration rate constants', () => {
    expect(DECELERATION_RATE_NORMAL).toBeCloseTo(0.998, 5);
    expect(DECELERATION_RATE_FAST).toBeCloseTo(0.99, 5);
  });

  it('matches the iOS heuristic for typical dismiss flicks', () => {
    // Pulled card up 120px, released at 1.5 px/ms upward.
    // Projected = -120 + (-1.5 * 499) = -868.5 → well past card height (~600px).
    // This should "obviously commit" a dismiss for a 600px-tall card.
    const projected = project(-120, -1.5);
    expect(projected).toBeLessThan(-600);
  });

  it('matches the iOS heuristic for a slow nudge (no commit)', () => {
    // Dragged -30px, released at -0.05 px/ms.
    // Projected = -30 + (-0.05 * 499) = -54.95 → nowhere near card height.
    const projected = project(-30, -0.05);
    expect(projected).toBeGreaterThan(-100);
  });
});
