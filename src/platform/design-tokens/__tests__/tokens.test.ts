import { describe, it, expect } from 'vitest';
import { tokens, concentric } from '../tokens';

describe('tokens', () => {
  it('has typography with all 11 text roles', () => {
    const roles = Object.keys(tokens.typography);
    expect(roles).toContain('largeTitle');
    expect(roles).toContain('title1');
    expect(roles).toContain('title2');
    expect(roles).toContain('title3');
    expect(roles).toContain('headline');
    expect(roles).toContain('body');
    expect(roles).toContain('callout');
    expect(roles).toContain('subhead');
    expect(roles).toContain('footnote');
    expect(roles).toContain('caption1');
    expect(roles).toContain('caption2');
  });

  it('typography roles have fontSize and fontWeight', () => {
    for (const role of Object.values(tokens.typography)) {
      expect(role).toHaveProperty('fontSize');
      expect(role).toHaveProperty('fontWeight');
      expect(typeof role.fontSize).toBe('number');
    }
  });

  it('has spacing on 4pt grid', () => {
    expect(tokens.spacing[1]).toBe(4);
    expect(tokens.spacing[4]).toBe(16);
    expect(tokens.spacing[8]).toBe(32);
  });

  it('has hitTargetMin of 44px', () => {
    expect(tokens.spacing.hitTargetMin).toBe(44);
  });

  it('has radius with concentric values', () => {
    expect(tokens.radius.device).toBe(54);
    expect(tokens.radius.card).toBe(22);
    expect(tokens.radius.group).toBe(16);
    expect(tokens.radius.button).toBe(12);
    expect(tokens.radius.chip).toBe(10);
    expect(tokens.radius.icon).toBe(18);
  });

  it('has system colors for light mode', () => {
    expect(tokens.colors.label).toBeTruthy();
    expect(tokens.colors.systemBackground).toBeTruthy();
    expect(tokens.colors.systemBlue).toBeTruthy();
  });
});

describe('concentric', () => {
  it('subtracts padding from outer radius', () => {
    expect(concentric(22, 4)).toBe(18);
    expect(concentric(54, 10)).toBe(44);
  });

  it('clamps to 0 minimum', () => {
    expect(concentric(4, 10)).toBe(0);
  });
});
