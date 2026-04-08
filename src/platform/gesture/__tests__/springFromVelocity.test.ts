import { describe, it, expect } from 'vitest';
import { springFromVelocity } from '../springFromVelocity';
import { spring } from '@/platform/design-tokens/motion';

describe('springFromVelocity', () => {
  it('targets 0 when not committed (snap back)', () => {
    const config = springFromVelocity(
      100,
      { vx: 0, vy: 0 },
      'y',
      false,
      -800,
      spring.smooth,
    );
    expect(config.target).toBe(0);
  });

  it('targets specified position when committed', () => {
    const config = springFromVelocity(
      -300,
      { vx: 0, vy: -1.0 },
      'y',
      true,
      -800,
      spring.bouncy,
    );
    expect(config.target).toBe(-800);
  });

  it('uses vy for y-axis and converts to px/s', () => {
    const config = springFromVelocity(
      0,
      { vx: 0, vy: -0.5 },
      'y',
      true,
      -800,
      spring.smooth,
    );
    expect(config.velocity).toBe(-500); // -0.5 px/ms * 1000 = -500 px/s
  });

  it('uses vx for x-axis', () => {
    const config = springFromVelocity(
      0,
      { vx: 0.8, vy: 0 },
      'x',
      true,
      -393,
      spring.smooth,
    );
    expect(config.velocity).toBe(800); // 0.8 * 1000
  });

  it('preserves spring preset values', () => {
    const config = springFromVelocity(
      0,
      { vx: 0, vy: 0 },
      'y',
      false,
      0,
      spring.snappy,
    );
    expect(config.stiffness).toBe(spring.snappy.stiffness);
    expect(config.damping).toBe(spring.snappy.damping);
    expect(config.mass).toBe(spring.snappy.mass);
  });
});
