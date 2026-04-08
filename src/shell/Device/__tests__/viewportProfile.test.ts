import { describe, it, expect } from 'vitest';
import { getSpringboardMetrics, resolveViewportProfile } from '../viewportProfile';

describe('viewportProfile', () => {
  it('classifies desktop viewport as simulator shell', () => {
    const profile = resolveViewportProfile({
      viewportWidth: 1440,
      viewportHeight: 900,
      coarsePointer: false,
    });

    expect(profile.shellMode).toBe('simulator');
    expect(profile.sizeTier).toBe('large');
    expect(profile.height).toBe(900);
    expect(profile.width).toBeCloseTo(415.2, 1);
  });

  it('classifies 354x667 as fullscreen compact', () => {
    const profile = resolveViewportProfile({
      viewportWidth: 354,
      viewportHeight: 667,
      coarsePointer: false,
    });

    expect(profile).toMatchObject({
      shellMode: 'fullscreen',
      sizeTier: 'compact',
      width: 354,
      height: 667,
      isPortrait: true,
    });
  });

  it('classifies 360x800 as fullscreen compact', () => {
    const profile = resolveViewportProfile({
      viewportWidth: 360,
      viewportHeight: 800,
      coarsePointer: true,
    });

    expect(profile).toMatchObject({
      shellMode: 'fullscreen',
      sizeTier: 'compact',
      width: 360,
      height: 800,
      isPortrait: true,
    });
  });

  it('classifies 375x812 as fullscreen compact', () => {
    const profile = resolveViewportProfile({
      viewportWidth: 375,
      viewportHeight: 812,
      coarsePointer: true,
    });

    expect(profile.shellMode).toBe('fullscreen');
    expect(profile.sizeTier).toBe('compact');
  });

  it('classifies 390x844 as fullscreen regular', () => {
    const profile = resolveViewportProfile({
      viewportWidth: 390,
      viewportHeight: 844,
      coarsePointer: true,
    });

    expect(profile.shellMode).toBe('fullscreen');
    expect(profile.sizeTier).toBe('regular');
  });

  it('classifies 412x915 as fullscreen large', () => {
    const profile = resolveViewportProfile({
      viewportWidth: 412,
      viewportHeight: 915,
      coarsePointer: true,
    });

    expect(profile.shellMode).toBe('fullscreen');
    expect(profile.sizeTier).toBe('large');
  });

  it('classifies 430x932 as fullscreen large', () => {
    const profile = resolveViewportProfile({
      viewportWidth: 430,
      viewportHeight: 932,
      coarsePointer: true,
    });

    expect(profile.shellMode).toBe('fullscreen');
    expect(profile.sizeTier).toBe('large');
  });

  it('returns the configured springboard metrics for each size tier', () => {
    expect(getSpringboardMetrics('compact')).toMatchObject({
      sidePadding: 16,
      iconSize: 54,
      cellWidth: 68,
      labelSize: 11,
      gridGapY: 12,
      dockPaddingY: 6,
    });
    expect(getSpringboardMetrics('regular')).toMatchObject({
      sidePadding: 22,
      iconSize: 60,
      cellWidth: 75,
      labelSize: 12,
      gridGapY: 20,
      dockPaddingY: 8,
    });
    expect(getSpringboardMetrics('large')).toMatchObject({
      sidePadding: 24,
      iconSize: 64,
      cellWidth: 78,
      labelSize: 12,
      gridGapY: 22,
      dockPaddingY: 10,
    });
  });
});
