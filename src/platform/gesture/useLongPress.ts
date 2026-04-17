import { useCallback, useEffect, useRef } from 'react';

const DEFAULT_DELAY = 600;
const MOVE_THRESHOLD = 10; // px

/**
 * Long-press detection hook.
 *
 * Listens on `window` for pointer-move so that `setPointerCapture`
 * on a parent element cannot suppress the movement check.
 *
 * Also dynamically registers a global `pointerup`/`pointercancel`
 * listener while the timer is active, ensuring cancel even when a
 * parent element has captured the pointer (setPointerCapture
 * redirects element-level pointerup but not window-level listeners).
 *
 * - Fires `callback` after `delay` ms of holding without moving > threshold.
 * - Moving > 10px cancels the long-press.
 * - Releasing before the timer cancels it.
 * - After long-press fires, the subsequent click is suppressed.
 */
export function useLongPress(
  callback: (e: React.PointerEvent<HTMLElement>) => void,
  options?: { delay?: number },
) {
  const delay = options?.delay ?? DEFAULT_DELAY;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const eventRef = useRef<React.PointerEvent<HTMLElement> | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  /** Dynamic global pointerup/pointercancel handler, registered only while
   *  the timer is active. At most one instance exists at a time. */
  const globalUpRef = useRef<((e: PointerEvent) => void) | null>(null);

  const removeGlobalUp = useCallback(() => {
    if (globalUpRef.current) {
      window.removeEventListener('pointerup', globalUpRef.current);
      window.removeEventListener('pointercancel', globalUpRef.current);
      globalUpRef.current = null;
    }
  }, []);

  const cancel = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
    pointerIdRef.current = null;
    removeGlobalUp();
  }, [removeGlobalUp]);

  // Global pointer-move listener — works even when pointer is captured elsewhere
  useEffect(() => {
    const handleGlobalMove = (e: PointerEvent) => {
      if (pointerIdRef.current === null || e.pointerId !== pointerIdRef.current) return;
      if (!startPosRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      if (dx * dx + dy * dy > MOVE_THRESHOLD * MOVE_THRESHOLD) {
        cancel();
      }
    };
    window.addEventListener('pointermove', handleGlobalMove);
    return () => window.removeEventListener('pointermove', handleGlobalMove);
  }, [cancel]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLElement>) => {
      // Clean up any lingering global listener from a previous press.
      removeGlobalUp();

      firedRef.current = false;
      startPosRef.current = { x: e.clientX, y: e.clientY };
      pointerIdRef.current = e.pointerId;
      eventRef.current = e;

      // Dynamic global pointerup/pointercancel — ensures cancel even when a
      // parent steals pointer capture. Only alive while the timer is pending,
      // so at most 2 listeners exist (pointerup + pointercancel) at any time.
      const pid = e.pointerId;
      const handler = (ue: PointerEvent) => {
        if (ue.pointerId !== pid) return;
        cancel();
      };
      globalUpRef.current = handler;
      window.addEventListener('pointerup', handler);
      window.addEventListener('pointercancel', handler);

      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        if (eventRef.current) callback(eventRef.current);
        pointerIdRef.current = null;
        removeGlobalUp();
      }, delay);
    },
    [callback, delay, cancel, removeGlobalUp],
  );

  const onPointerUp = useCallback(() => {
    cancel();
  }, [cancel]);

  const onPointerCancel = useCallback(() => {
    cancel();
  }, [cancel]);

  /** Attach to onClick — suppresses click if long-press fired */
  const onClick = useCallback((e: React.MouseEvent) => {
    if (firedRef.current) {
      e.preventDefault();
      e.stopPropagation();
      firedRef.current = false;
    }
  }, []);

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel,
    onClick,
    /** Imperatively cancel a pending long-press timer. Call this when the
     *  element-level onPointerUp cannot be relied upon (e.g. a parent steals
     *  pointer capture via setPointerCapture). */
    cancel,
    firedRef,
  };
}
