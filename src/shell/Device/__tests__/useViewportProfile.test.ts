import { afterEach, describe, expect, it, vi } from 'vitest';
import { readViewportProfile } from '../useViewportProfile';

const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;
const originalVisualViewport = window.visualViewport;
const originalMatchMedia = window.matchMedia;

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: originalInnerWidth,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: originalInnerHeight,
  });
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    writable: true,
    value: originalVisualViewport,
  });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
  vi.restoreAllMocks();
});

describe('readViewportProfile', () => {
  it('prefers visual viewport dimensions for fullscreen devices', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: '(hover: none) and (pointer: coarse)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 844,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: {
        width: 390,
        height: 780,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });

    const profile = readViewportProfile();

    expect(profile.shellMode).toBe('fullscreen');
    expect(profile.width).toBe(390);
    expect(profile.height).toBe(780);
    expect(profile.sizeTier).toBe('regular');
  });

  it('falls back to inner viewport dimensions when visual viewport is unavailable', () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: true,
        media: '(hover: none) and (pointer: coarse)',
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });

    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 390,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      writable: true,
      value: 844,
    });
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const profile = readViewportProfile();

    expect(profile.shellMode).toBe('fullscreen');
    expect(profile.width).toBe(390);
    expect(profile.height).toBe(844);
  });
});
