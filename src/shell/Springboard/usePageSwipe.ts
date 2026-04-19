import { useCallback, useEffect, useRef, useState } from 'react';
import { animate, useMotionValue } from 'motion/react';
import { spring } from '@/platform/design-tokens/motion';
import { rubberBand } from '@/platform/gesture/rubberBand';
import { getSwipeDirection } from '@/platform/gesture/thresholds';
import {
  computeVelocity,
  type VelocitySample,
} from '@/platform/gesture/velocity';

interface UsePageSwipeOptions {
  pageCount: number;
  viewportWidth: number;
}

type PointerReleaseKind = 'up' | 'cancel' | 'lost-capture';

/**
 * Maximum movement (px) for a gesture to be classified as a tap rather
 * than a swipe.  When a tap is detected, we dispatch a synthetic click to
 * the element under the pointer — necessary because `setPointerCapture`
 * redirects `mouseup` to the gesture surface, preventing the browser from
 * synthesizing `click` on the original target (AppIcon button).
 */
const TAP_THRESHOLD = 10;

interface DragState {
  startX: number;
  startTrackX: number;
}

function getEventTime(event: Pick<React.PointerEvent<HTMLElement>, 'timeStamp'>): number {
  return Number.isFinite(event.timeStamp) && event.timeStamp > 0
    ? event.timeStamp
    : performance.now();
}

function getPageTarget(page: number, viewportWidth: number): number {
  return -page * viewportWidth;
}

function getBounds(pageCount: number, viewportWidth: number) {
  return {
    minX: getPageTarget(Math.max(pageCount - 1, 0), viewportWidth),
    maxX: 0,
  };
}

export function usePageSwipe({
  pageCount,
  viewportWidth,
}: UsePageSwipeOptions) {
  const pageWidth = Math.max(viewportWidth, 1);
  const [currentPage, setCurrentPage] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const trackX = useMotionValue(0);

  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const isDraggingRef = useRef(false);
  const pointerIdRef = useRef<number | null>(null);
  const dragRef = useRef<DragState>({ startX: 0, startTrackX: 0 });
  const currentPageRef = useRef(0);
  const samplesRef = useRef<VelocitySample[]>([]);

  const stopAnimation = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const animateToPage = useCallback(
    (page: number, velocityX: number) => {
      stopAnimation();
      // iOS 分页是临界阻尼，零过冲。`spring.smooth` (ζ≈0.84) 会在提交换页时
      // 产生 ~0.8% overshoot，相当于 390px 页宽上 3px 的轻微回弹。
      animationRef.current = animate(trackX, getPageTarget(page, pageWidth), {
        type: 'spring',
        ...spring.interactive,
        velocity: velocityX * 1000,
      });
    },
    [pageWidth, stopAnimation, trackX],
  );

  const finishGesture = useCallback(
    (event: React.PointerEvent<HTMLElement>, kind: PointerReleaseKind) => {
      if (!isDraggingRef.current) return;
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return;
      }

      isDraggingRef.current = false;
      setIsDragging(false);
      pointerIdRef.current = null;

      const time = getEventTime(event);
      samplesRef.current.push({ time, x: event.clientX, y: 0 });

      const { vx } = computeVelocity(samplesRef.current);
      const dx = event.clientX - dragRef.current.startX;
      const page = currentPageRef.current;

      if (kind !== 'up') {
        animateToPage(page, vx);
        samplesRef.current = [];
        return;
      }

      // Tap detection: setPointerCapture redirects mouseup to the gesture
      // surface, so the browser synthesizes click on the surface instead of
      // the original target (e.g. AppIcon button).  When movement is small
      // enough to be a tap, dispatch a synthetic click to the element that
      // was actually under the pointer.
      if (Math.abs(dx) < TAP_THRESHOLD) {
        samplesRef.current = [];
        const el = document.elementFromPoint(event.clientX, event.clientY);
        if (el instanceof HTMLElement) {
          el.click();
        }
        return;
      }

      const direction = getSwipeDirection(dx, vx);
      const nextPage = Math.min(
        Math.max(page - direction, 0),
        Math.max(pageCount - 1, 0),
      );
      const committed = nextPage !== page;

      if (committed) {
        currentPageRef.current = nextPage;
        setCurrentPage(nextPage);
      }

      animateToPage(committed ? nextPage : page, vx);
      samplesRef.current = [];
    },
    [animateToPage, pageCount],
  );

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLElement>) => {
    stopAnimation();
    isDraggingRef.current = true;
    setIsDragging(true);
    pointerIdRef.current = event.pointerId;
    dragRef.current = {
      startX: event.clientX,
      startTrackX: trackX.get(),
    };
    samplesRef.current = [{ time: getEventTime(event), x: event.clientX, y: 0 }];
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [stopAnimation, trackX]);

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (!isDraggingRef.current) return;
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return;
      }

      const dx = event.clientX - dragRef.current.startX;
      const rawTrackX = dragRef.current.startTrackX + dx;
      const { minX, maxX } = getBounds(pageCount, pageWidth);

      let nextTrackX = rawTrackX;
      if (rawTrackX > maxX) {
        nextTrackX = maxX + rubberBand(rawTrackX - maxX, pageWidth);
      } else if (rawTrackX < minX) {
        nextTrackX = minX + rubberBand(rawTrackX - minX, pageWidth);
      }

      trackX.set(nextTrackX);
      samplesRef.current.push({ time: getEventTime(event), x: event.clientX, y: 0 });
    },
    [pageCount, pageWidth, trackX],
  );

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      finishGesture(event, 'up');
    },
    [finishGesture],
  );

  const handlePointerCancel = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      finishGesture(event, 'cancel');
    },
    [finishGesture],
  );

  const handleLostPointerCapture = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      finishGesture(event, 'lost-capture');
    },
    [finishGesture],
  );

  useEffect(() => {
    const nextPage = Math.min(currentPageRef.current, Math.max(pageCount - 1, 0));
    if (nextPage !== currentPageRef.current) {
      currentPageRef.current = nextPage;
      setCurrentPage(nextPage);
    }

    stopAnimation();
    trackX.set(getPageTarget(nextPage, pageWidth));
  }, [pageCount, pageWidth, stopAnimation, trackX]);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  /** Programmatically navigate to a page (used by auto-scroll during icon drag) */
  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.min(Math.max(page, 0), Math.max(pageCount - 1, 0));
      if (clamped === currentPageRef.current) return;
      currentPageRef.current = clamped;
      setCurrentPage(clamped);
      animateToPage(clamped, 0);
    },
    [pageCount, animateToPage],
  );

  /**
   * Cancel any in-progress page swipe gesture.
   * Used when icon drag starts during a long-press (both gestures share
   * the same pointer, but drag should win).
   */
  const cancelSwipe = useCallback(() => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);
    pointerIdRef.current = null;
    samplesRef.current = [];
    // Snap back to current page
    animateToPage(currentPageRef.current, 0);
  }, [animateToPage]);

  return {
    currentPage,
    isDragging,
    trackX,
    goToPage,
    cancelSwipe,
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
    onLostPointerCapture: handleLostPointerCapture,
  };
}
