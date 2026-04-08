import type { PointerEvent as ReactPointerEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { animate } from 'motion/react';
import { rubberBand } from '@/platform/gesture/rubberBand';
import { usePageSwipe } from '../usePageSwipe';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');

  return {
    ...actual,
    animate: vi.fn((value: { set: (target: number) => void }, target: number) => {
      value.set(target);
      return {
        stop: vi.fn(),
      };
    }),
  };
});

function createPointerEvent(
  currentTarget: HTMLDivElement,
  clientX: number,
  timeStamp: number,
  pointerId: number = 1,
): ReactPointerEvent<HTMLDivElement> {
  return {
    clientX,
    currentTarget,
    pointerId,
    timeStamp,
  } as ReactPointerEvent<HTMLDivElement>;
}

function dragToNextPage(
  result: { current: ReturnType<typeof usePageSwipe> },
  target: HTMLDivElement,
  {
    startX = 300,
    endX = 220,
    startTime = 10,
    moveTime = 180,
    endTime = 200,
  }: {
    startX?: number;
    endX?: number;
    startTime?: number;
    moveTime?: number;
    endTime?: number;
  } = {},
) {
  act(() => {
    result.current.onPointerDown(createPointerEvent(target, startX, startTime));
    result.current.onPointerMove(createPointerEvent(target, endX, moveTime));
    result.current.onPointerUp(createPointerEvent(target, endX, endTime));
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe('usePageSwipe', () => {
  it('commits to the next page after crossing the distance threshold', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    dragToNextPage(result, target);

    expect(result.current.currentPage).toBe(1);
    expect(result.current.trackX.get()).toBe(-390);
  });

  it('allows a short fast flick to commit the next page', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent(target, 300, 10));
      result.current.onPointerMove(createPointerEvent(target, 290, 20));
      result.current.onPointerUp(createPointerEvent(target, 270, 40));
    });

    expect(result.current.currentPage).toBe(1);
    expect(result.current.trackX.get()).toBe(-390);
  });

  it('rubber-bands and rebounds when overscrolling past the first page', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent(target, 120, 10));
      result.current.onPointerMove(createPointerEvent(target, 180, 160));
    });

    expect(result.current.trackX.get()).toBeCloseTo(rubberBand(60, 390), 4);

    act(() => {
      result.current.onPointerUp(createPointerEvent(target, 180, 180));
    });

    expect(result.current.currentPage).toBe(0);
    expect(result.current.trackX.get()).toBeCloseTo(0, 6);
  });

  it('rubber-bands and rebounds when overscrolling past the last page', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    dragToNextPage(result, target);
    dragToNextPage(result, target, { startTime: 240, moveTime: 360, endTime: 380 });

    act(() => {
      result.current.onPointerDown(createPointerEvent(target, 300, 420));
      result.current.onPointerMove(createPointerEvent(target, 240, 540));
    });

    expect(result.current.trackX.get()).toBeCloseTo(-780 + rubberBand(-60, 390), 4);

    act(() => {
      result.current.onPointerUp(createPointerEvent(target, 240, 560));
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.trackX.get()).toBe(-780);
  });

  it('returns to the current page when the drag does not reach any threshold', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent(target, 300, 10));
      result.current.onPointerMove(createPointerEvent(target, 283, 220));
      result.current.onPointerUp(createPointerEvent(target, 280, 250));
    });

    expect(result.current.currentPage).toBe(0);
    expect(result.current.trackX.get()).toBeCloseTo(0, 6);
  });

  it('stops the previous animation when a new drag starts', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    dragToNextPage(result, target);
    const animateResults = vi.mocked(animate).mock.results;
    const previousAnimation = animateResults[animateResults.length - 1]?.value;

    act(() => {
      result.current.onPointerDown(createPointerEvent(target, 320, 240));
    });

    expect(previousAnimation).toBeDefined();
    expect(previousAnimation?.stop).toHaveBeenCalledTimes(1);
  });

  it('snaps back safely on lost pointer capture', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent(target, 300, 10));
      result.current.onPointerMove(createPointerEvent(target, 220, 160));
      result.current.onLostPointerCapture(createPointerEvent(target, 220, 180));
    });

    expect(result.current.currentPage).toBe(0);
    expect(result.current.trackX.get()).toBeCloseTo(0, 6);
  });

  it('snaps back safely on pointer cancel', () => {
    const target = document.createElement('div');
    const { result } = renderHook(() => usePageSwipe({ pageCount: 3, viewportWidth: 390 }));

    act(() => {
      result.current.onPointerDown(createPointerEvent(target, 300, 10));
      result.current.onPointerMove(createPointerEvent(target, 220, 160));
      result.current.onPointerCancel(createPointerEvent(target, 220, 180));
    });

    expect(result.current.currentPage).toBe(0);
    expect(result.current.trackX.get()).toBeCloseTo(0, 6);
  });
});
