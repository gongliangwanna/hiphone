import { describe, it, expect } from 'vitest';
import { computeVelocity, type VelocitySample } from '../velocity';

describe('computeVelocity', () => {
  it('returns zero velocity with fewer than 2 samples', () => {
    expect(computeVelocity([{ time: 0, x: 0, y: 0 }])).toEqual({
      vx: 0,
      vy: 0,
    });
  });

  it('returns zero velocity with empty array', () => {
    expect(computeVelocity([])).toEqual({ vx: 0, vy: 0 });
  });

  it('computes correct velocity from two samples', () => {
    const samples: VelocitySample[] = [
      { time: 0, x: 0, y: 0 },
      { time: 100, x: 100, y: 50 },
    ];
    const v = computeVelocity(samples);
    expect(v.vx).toBeCloseTo(1.0, 2); // 100px / 100ms = 1 px/ms
    expect(v.vy).toBeCloseTo(0.5, 2); // 50px / 100ms = 0.5 px/ms
  });

  it('computes negative velocity for leftward motion', () => {
    const samples: VelocitySample[] = [
      { time: 0, x: 200, y: 0 },
      { time: 100, x: 100, y: 0 },
    ];
    const v = computeVelocity(samples);
    expect(v.vx).toBeCloseTo(-1.0, 2);
    expect(v.vy).toBeCloseTo(0, 2);
  });

  it('ignores samples older than maxAge', () => {
    const samples: VelocitySample[] = [
      { time: 0, x: 0, y: 0 }, // too old
      { time: 150, x: 500, y: 500 }, // too old
      { time: 190, x: 100, y: 50 },
      { time: 200, x: 200, y: 100 },
    ];
    const v = computeVelocity(samples, 20); // maxAge=20ms
    // Only last two samples used: dx=100, dy=50, dt=10
    expect(v.vx).toBeCloseTo(10, 1);
    expect(v.vy).toBeCloseTo(5, 1);
  });

  it('returns zero when dt is zero (same timestamp)', () => {
    const samples: VelocitySample[] = [
      { time: 100, x: 0, y: 0 },
      { time: 100, x: 100, y: 100 },
    ];
    const v = computeVelocity(samples);
    expect(v).toEqual({ vx: 0, vy: 0 });
  });

  it('handles multi-sample trajectory', () => {
    const samples: VelocitySample[] = [
      { time: 0, x: 0, y: 0 },
      { time: 50, x: 50, y: 25 },
      { time: 100, x: 100, y: 50 },
      { time: 150, x: 150, y: 75 },
    ];
    const v = computeVelocity(samples);
    // first=0,0 last=150,75 dt=150
    expect(v.vx).toBeCloseTo(1.0, 2);
    expect(v.vy).toBeCloseTo(0.5, 2);
  });
});
