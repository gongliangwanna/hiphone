import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClock } from '../useClock';

describe('useClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns time in HH:mm format', () => {
    vi.setSystemTime(new Date(2026, 3, 8, 8, 4, 0));
    const { result } = renderHook(() => useClock());
    expect(result.current).toBe('08:04');
  });

  it('pads single-digit hours and minutes', () => {
    vi.setSystemTime(new Date(2026, 3, 8, 9, 5, 0));
    const { result } = renderHook(() => useClock());
    expect(result.current).toBe('09:05');
  });

  it('updates every 10 seconds', () => {
    vi.setSystemTime(new Date(2026, 3, 8, 10, 0, 0));
    const { result } = renderHook(() => useClock());
    expect(result.current).toBe('10:00');

    vi.advanceTimersByTime(10_000);
    vi.setSystemTime(new Date(2026, 3, 8, 10, 0, 10));
    expect(result.current).toBe('10:00');
  });
});
