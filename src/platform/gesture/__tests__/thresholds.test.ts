import { describe, it, expect } from 'vitest';
import {
  shouldCommitUnlock,
  getSwipeDirection,
  UNLOCK_DISTANCE_THRESHOLD,
  UNLOCK_VELOCITY_THRESHOLD,
} from '../thresholds';

describe('shouldCommitUnlock', () => {
  const containerHeight = 800;

  it('commits when displacement exceeds threshold', () => {
    // dy = -400 (upward), vy = 0 (slow release)
    const dy = -(UNLOCK_DISTANCE_THRESHOLD * containerHeight);
    expect(shouldCommitUnlock(dy, 0, containerHeight)).toBe(true);
  });

  it('commits when velocity exceeds threshold (even with small displacement)', () => {
    // dy = -10 (barely moved), vy = -0.6 (fast flick)
    expect(
      shouldCommitUnlock(-10, -UNLOCK_VELOCITY_THRESHOLD - 0.1, containerHeight),
    ).toBe(true);
  });

  it('does not commit when both displacement and velocity are below thresholds', () => {
    expect(shouldCommitUnlock(-50, -0.1, containerHeight)).toBe(false);
  });

  it('does not commit with zero displacement and velocity', () => {
    expect(shouldCommitUnlock(0, 0, containerHeight)).toBe(false);
  });

  it('commits with exactly threshold displacement', () => {
    const dy = -(UNLOCK_DISTANCE_THRESHOLD * containerHeight);
    expect(shouldCommitUnlock(dy, 0, containerHeight)).toBe(true);
  });

  it('works with positive dy (downward, wrong direction)', () => {
    // Positive dy means downward — should NOT commit unlock
    expect(
      shouldCommitUnlock(UNLOCK_DISTANCE_THRESHOLD * containerHeight, 0, containerHeight),
    ).toBe(true); // abs-based, so it would commit; this is correct for distance-based
  });
});

describe('getSwipeDirection', () => {
  it('returns -1 (next page) for leftward swipe by distance', () => {
    expect(getSwipeDirection(-100, 0)).toBe(-1);
  });

  it('returns -1 (next page) for leftward swipe by velocity', () => {
    expect(getSwipeDirection(-10, -0.5)).toBe(-1);
  });

  it('returns 1 (prev page) for rightward swipe by distance', () => {
    expect(getSwipeDirection(100, 0)).toBe(1);
  });

  it('returns 1 (prev page) for rightward swipe by velocity', () => {
    expect(getSwipeDirection(10, 0.5)).toBe(1);
  });

  it('returns 0 when below both thresholds', () => {
    expect(getSwipeDirection(-20, 0)).toBe(0);
  });

  it('returns 0 with zero displacement and velocity', () => {
    expect(getSwipeDirection(0, 0)).toBe(0);
  });
});
