import { describe, it, expect } from 'vitest';
import { rubberBand } from '../rubberBand';

describe('rubberBand', () => {
  const containerSize = 800;

  it('returns 0 when offset is 0', () => {
    expect(rubberBand(0, containerSize)).toBe(0);
  });

  it('is positive for positive offset', () => {
    expect(rubberBand(100, containerSize)).toBeGreaterThan(0);
  });

  it('is negative for negative offset', () => {
    expect(rubberBand(-100, containerSize)).toBeLessThan(0);
  });

  it('output is always less than absolute input', () => {
    expect(Math.abs(rubberBand(100, containerSize))).toBeLessThan(100);
    expect(Math.abs(rubberBand(500, containerSize))).toBeLessThan(500);
    expect(Math.abs(rubberBand(1000, containerSize))).toBeLessThan(1000);
  });

  it('asymptotically approaches c = containerSize * 0.55', () => {
    const c = containerSize * 0.55; // 440
    const result = rubberBand(1_000_000, containerSize);
    expect(result).toBeCloseTo(c, -1); // within 10px of asymptote
  });

  it('is monotonically increasing for positive inputs', () => {
    const r1 = rubberBand(50, containerSize);
    const r2 = rubberBand(100, containerSize);
    const r3 = rubberBand(200, containerSize);
    expect(r1).toBeLessThan(r2);
    expect(r2).toBeLessThan(r3);
  });

  it('is symmetric for positive and negative', () => {
    expect(rubberBand(100, containerSize)).toBeCloseTo(
      -rubberBand(-100, containerSize),
      10,
    );
  });

  it('matches formula: f(x) = (1 - 1/(x/c + 1)) * c', () => {
    const x = 200;
    const c = containerSize * 0.55;
    const expected = (1 - 1 / (x / c + 1)) * c;
    expect(rubberBand(x, containerSize)).toBeCloseTo(expected, 10);
  });
});
