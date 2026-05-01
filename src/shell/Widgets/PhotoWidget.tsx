import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { animate, motion, useMotionValue } from 'motion/react';
import { WidgetShell } from './WidgetShell';
import type { WidgetSize } from '@/platform/stores/springboardLayoutStore';
import type { Photo } from '@/apps/Photos/photosData';
import { usePhotosStore } from '@/apps/Photos/photosStore';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import {
  useAppRuntimeStore,
  clearAppKilled,
} from '@/platform/stores/appRuntimeStore';
import { spring } from '@/platform/design-tokens/motion';
import { rubberBand } from '@/platform/gesture/rubberBand';
import {
  computeVelocity,
  type VelocitySample,
} from '@/platform/gesture/velocity';
import { useIsPageActive } from './activePage';

interface PhotoWidgetProps {
  size: WidgetSize;
  variant?: 'placed' | 'drawer';
  previewWidth?: number;
}

/**
 * iOS Photos "Memories" widget — interactive (iOS 17+ style).
 *
 * ## Interactivity
 *
 * **Vertical** drag scrolls through a short, curated photo pool. A short tap
 * (no significant movement) opens the Photos app **and jumps straight into
 * PhotoViewer** on the currently-displayed photo, matching the iOS 17 "swipe
 * a memories widget" interaction. In edit mode or in the drawer preview,
 * every interaction is disabled so the surrounding WidgetSlot drag/long-press
 * handlers stay in charge.
 *
 * ## Gesture routing
 *
 * The springboard's `usePageSwipe` captures the pointer on pointerdown for
 * horizontal page panning, and the gesture surface declares
 * `touchAction: 'pan-y'` so the browser natively owns vertical scroll. We
 * need vertical drags on the photo widget to change photos, not to trigger
 * native scroll or bubble into the page swipe — so we:
 *
 *   1. set `touchAction: 'none'` on the viewport (browser won't steal the
 *      gesture),
 *   2. `stopPropagation` the pointerdown (preempts `usePageSwipe` before it
 *      captures),
 *   3. `setPointerCapture` on our own element so pointermove/up stay ours.
 *
 * Trade-off: the same as in the earlier horizontal version — because
 * pointerdown never bubbles to the parent `WidgetSlot`, the `useLongPress`
 * timer does NOT start on the photo widget surface. You cannot enter edit
 * mode by long-pressing the photo widget itself, but every other widget /
 * app icon / empty area on the page still supports it.
 *
 * ## Deep link to PhotoViewer
 *
 * Tap opens the app through the standard `openApp` icon→app morph, but the
 * current photo's id is pre-written into `usePhotosStore` before the mount
 * effect runs. The dance is `clearAppKilled → openPhoto → openApp` — see
 * `openPhotoInViewer` below for the full explanation.
 *
 * ## Performance
 *
 * We render N photo frames in a single column but only the active frame runs
 * the Ken Burns keyframe (via `data-active`). The rest stay still on the
 * GPU compositor layer. The widget pauses its CSS animation when the host
 * page is offscreen (`useIsPageActive`).
 */
export function PhotoWidget({ size, variant, previewWidth }: PhotoWidgetProps) {
  const libraryPhotos = usePhotosStore((s) => s.photos);
  const photos = useMemo(
    () => pickPhotoPool(size, libraryPhotos),
    [libraryPhotos, size],
  );
  const isActive = useIsPageActive();
  const isEditMode = useSpringboardLayoutStore((s) => s.isEditMode);
  const openApp = useAppRuntimeStore((s) => s.openApp);

  const interactive = variant !== 'drawer' && !isEditMode && photos.length > 1;

  const shellRef = useRef<HTMLDivElement>(null);
  // Viewport height of the scrollable strip. 1 by default so the motion
  // value arithmetic stays safe before the first layout measurement.
  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportHeight, setViewportHeight] = useState(1);

  // Motion value for the strip's y-offset. The resting value is always
  // `-currentIndex * viewportHeight`. During a drag we write directly to it.
  const dragY = useMotionValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    if (currentIndexRef.current < photos.length) return;
    currentIndexRef.current = 0;
    setCurrentIndex(0);
    dragY.set(0);
  }, [dragY, photos.length]);

  // Gesture state. We use refs so the handlers don't re-create on every
  // render and so React state updates don't race the next pointer event.
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startTrackY: number;
    startTime: number;
    moved: boolean;
    samples: VelocitySample[];
  } | null>(null);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);

  // Keep dragY synced with the viewport height — when size/layout changes,
  // we need to re-anchor the strip to whatever the current index's rest pos
  // is, otherwise the photo ends up partially offscreen.
  useEffect(() => {
    if (dragStateRef.current) return; // mid-drag: leave it alone
    dragY.set(-currentIndex * viewportHeight);
  }, [viewportHeight, currentIndex, dragY]);

  // Measure the viewport height via ResizeObserver — the springboard runs
  // on different phone profiles so the widget box can be ~120-180px tall
  // depending on tier.
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => {
      const h = el.getBoundingClientRect().height;
      if (h > 0) setViewportHeight(h);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stopAnimation = useCallback(() => {
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  const settleTo = useCallback(
    (index: number, velocityPxPerMs: number) => {
      stopAnimation();
      currentIndexRef.current = index;
      setCurrentIndex(index);
      animationRef.current = animate(dragY, -index * viewportHeight, {
        type: 'spring',
        ...spring.interactive,
        velocity: velocityPxPerMs * 1000,
      });
    },
    [dragY, stopAnimation, viewportHeight],
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!interactive) return;
      // Only handle primary pointer — secondary touches (pinch-zoom etc)
      // can be ignored safely for a simple strip.
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      // Preempt `usePageSwipe` at the springboard root by stopping
      // propagation *before* it can see pointerdown and capture.
      e.stopPropagation();
      stopAnimation();
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // jsdom or older browsers may not support pointer capture; we
        // fall back to "best effort" — the gesture still works via the
        // normal React event path because we also keep handlers on this
        // same element.
      }
      dragStateRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startTrackY: dragY.get(),
        startTime:
          Number.isFinite(e.timeStamp) && e.timeStamp > 0
            ? e.timeStamp
            : performance.now(),
        moved: false,
        samples: [
          {
            time:
              Number.isFinite(e.timeStamp) && e.timeStamp > 0
                ? e.timeStamp
                : performance.now(),
            x: e.clientX,
            y: e.clientY,
          },
        ],
      };
    },
    [interactive, dragY, stopAnimation],
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const state = dragStateRef.current;
      if (!state) return;
      if (e.pointerId !== state.pointerId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.moved && Math.hypot(dx, dy) > 4) {
        state.moved = true;
      }

      const raw = state.startTrackY + dy;
      const minY = -(photos.length - 1) * viewportHeight;
      const maxY = 0;
      let next = raw;
      if (raw > maxY) {
        next = maxY + rubberBand(raw - maxY, viewportHeight);
      } else if (raw < minY) {
        next = minY + rubberBand(raw - minY, viewportHeight);
      }
      dragY.set(next);

      const t =
        Number.isFinite(e.timeStamp) && e.timeStamp > 0
          ? e.timeStamp
          : performance.now();
      state.samples.push({ time: t, x: e.clientX, y: e.clientY });
      // Cap samples so the velocity window stays bounded.
      if (state.samples.length > 16) state.samples.shift();
    },
    [dragY, photos.length, viewportHeight],
  );

  /**
   * Open the Photos app and deep-link straight into `PhotoViewer` on the
   * given photo id. The order matters:
   *
   *   1. `clearAppKilled('photos')` — stop the PhotosApp mount effect from
   *      calling `reset()`, which would wipe `viewingPhotoId` below.
   *   2. `usePhotosStore.getState().openPhoto(id)` — pre-populate the
   *      viewer state so the first PhotoViewer render sees the photo.
   *   3. `openApp('photos', origin)` — trigger the icon→app morph. The
   *      PhotosApp mounts, its `wasAppKilled` check returns false (we just
   *      cleared it), so the reset path is skipped and the viewer pops
   *      open on the correct photo.
   *
   * Doing the three in the wrong order causes a one-frame flash of the
   * library tab before the viewer appears, or (in the killed case) the
   * viewer never opens because the reset wipes the id.
   */
  const openPhotoInViewer = useCallback(
    (photoId: number) => {
      const el = shellRef.current;
      const rect = el?.getBoundingClientRect();
      const deviceRoot = el?.closest('[data-testid="device-root"]') as
        | HTMLElement
        | null;
      const deviceRect = deviceRoot?.getBoundingClientRect();
      const origin = rect
        ? {
            x: rect.left - (deviceRect?.left ?? 0),
            y: rect.top - (deviceRect?.top ?? 0),
            width: rect.width,
            height: rect.height,
          }
        : { x: 0, y: 0, width: 1, height: 1 };

      clearAppKilled('photos');
      usePhotosStore.getState().openPhoto(photoId);
      openApp('photos', origin);
    },
    [openApp],
  );

  const finishGesture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>, kind: 'up' | 'cancel') => {
      const state = dragStateRef.current;
      if (!state) return;
      if (e.pointerId !== state.pointerId) return;
      dragStateRef.current = null;

      try {
        e.currentTarget.releasePointerCapture(state.pointerId);
      } catch {
        // ignore
      }

      if (kind === 'cancel') {
        settleTo(currentIndexRef.current, 0);
        return;
      }

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const dt =
        (Number.isFinite(e.timeStamp) && e.timeStamp > 0
          ? e.timeStamp
          : performance.now()) - state.startTime;
      const { vy } = computeVelocity(state.samples);

      // Tap disambiguation: a short, low-movement gesture opens the Photos
      // app and deep-links to the current photo. Movement threshold checks
      // both axes so a diagonal wiggle still counts as a tap.
      const totalMove = Math.hypot(dx, dy);
      if (!state.moved && totalMove < 6 && dt < 350) {
        settleTo(currentIndexRef.current, 0);
        const currentPhoto = photos[currentIndexRef.current];
        if (currentPhoto) openPhotoInViewer(currentPhoto.id);
        return;
      }

      // Distance OR velocity commits to the neighbouring photo.
      const threshold = viewportHeight * 0.25;
      let nextIndex = currentIndexRef.current;
      if (dy < -threshold || vy < -0.35) {
        nextIndex = Math.min(photos.length - 1, currentIndexRef.current + 1);
      } else if (dy > threshold || vy > 0.35) {
        nextIndex = Math.max(0, currentIndexRef.current - 1);
      }
      settleTo(nextIndex, vy);
    },
    [openPhotoInViewer, photos, settleTo, viewportHeight],
  );

  const handlePointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => finishGesture(e, 'up'),
    [finishGesture],
  );
  const handlePointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => finishGesture(e, 'cancel'),
    [finishGesture],
  );

  // Clean up any in-flight animation on unmount.
  useEffect(() => () => stopAnimation(), [stopAnimation]);

  return (
    <WidgetShell
      ref={shellRef}
      size={size}
      variant={variant}
      previewWidth={previewWidth}
      testId="widget-photo"
    >
      <div
        ref={viewportRef}
        data-testid="widget-photo-viewport"
        className="relative h-full w-full"
        style={{
          backgroundColor: '#0a0a0a',
          overflow: 'hidden',
          // `touch-action: none` disables the browser's native vertical
          // pan on this element (the springboard's gesture surface uses
          // `pan-y` for its own horizontal page swipe, which we override
          // here so our vertical photo drag wins).
          touchAction: interactive ? 'none' : undefined,
          cursor: interactive ? 'grab' : undefined,
          // contain:paint keeps widget repaints from dirtying the rest of
          // the springboard, matching MusicWidget's strategy.
          contain: 'paint',
        }}
        onPointerDown={interactive ? handlePointerDown : undefined}
        onPointerMove={interactive ? handlePointerMove : undefined}
        onPointerUp={interactive ? handlePointerUp : undefined}
        onPointerCancel={interactive ? handlePointerCancel : undefined}
        onLostPointerCapture={interactive ? handlePointerCancel : undefined}
      >
        {photos.length === 0 ? (
          <div
            className="flex h-full w-full items-center justify-center"
            style={{ color: 'rgba(255,255,255,0.5)' }}
          >
            无照片
          </div>
        ) : (
          <motion.div
            className="flex flex-col w-full"
            style={{
              height: `${photos.length * 100}%`,
              y: dragY,
              willChange: 'transform',
            }}
          >
            {photos.map((photo, i) => (
              <PhotoFrame
                key={photo.id}
                photo={photo}
                isActive={i === currentIndex && isActive}
                size={size}
                heightPct={100 / photos.length}
              />
            ))}
          </motion.div>
        )}

        {/* Scoped Ken Burns keyframes. Only the frame with `data-active`
            runs the animation — the other frames stay at `transform: none`
            so we don't burn GPU cycles on photos the user can't see. */}
        <style>{`
          @keyframes widgetPhotoKenBurns {
            0%   { transform: scale(1.04) translate(0%, 0%); }
            100% { transform: scale(1.14) translate(-2%, -2%); }
          }
          [data-testid="widget-photo"] [data-photo-frame] img {
            animation: none;
          }
          [data-testid="widget-photo"] [data-photo-frame][data-active="true"] img {
            animation: widgetPhotoKenBurns 14s ease-in-out infinite alternate;
            will-change: transform;
          }
          @media (prefers-reduced-motion: reduce) {
            [data-testid="widget-photo"] [data-photo-frame] img {
              animation: none !important;
            }
          }
        `}</style>
      </div>
    </WidgetShell>
  );
}

// ---- Frame --------------------------------------------------------------

const PhotoFrame = memo(function PhotoFrame({
  photo,
  isActive,
  size,
  heightPct,
}: {
  photo: Photo;
  isActive: boolean;
  size: WidgetSize;
  heightPct: number;
}) {
  const caption = useMemo(() => formatCaption(photo.date), [photo.date]);
  return (
    <div
      data-photo-frame=""
      data-active={isActive ? 'true' : 'false'}
      style={{
        width: '100%',
        height: `${heightPct}%`,
        flexShrink: 0,
        position: 'relative',
      }}
    >
      <img
        src={photo.fullSize}
        alt=""
        draggable={false}
        decoding="async"
        loading="lazy"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transformOrigin: 'center center',
          // Pause the Ken Burns keyframe on offscreen pages — driven by
          // the `data-active` selector in the <style> block above.
          animationPlayState: isActive ? 'running' : 'paused',
          // backface:hidden + translateZ keeps the decoded bitmap on its
          // own compositor layer so horizontal dragging doesn't trip
          // re-rasterization.
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0"
        style={{
          padding: size === '2x2' ? '10px 12px 12px' : '14px 16px 18px',
          background:
            'linear-gradient(to top, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 55%, rgba(0,0,0,0) 100%)',
          color: 'white',
          pointerEvents: 'none',
        }}
      >
        <div
          style={{
            fontSize: size === '2x2' ? 9 : 10,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.78)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          回忆
        </div>
        <div
          data-testid="widget-photo-caption"
          style={{
            marginTop: 2,
            fontSize: size === '2x2' ? 12 : size === '4x2' ? 14 : 16,
            fontWeight: 600,
            color: 'white',
            letterSpacing: '-0.01em',
          }}
        >
          {caption}
        </div>
      </div>
    </div>
  );
});

// ---- Helpers ------------------------------------------------------------

/**
 * Pick a small, stable pool of photos for the widget. The pool rotates by
 * day so the widget refreshes daily without thrashing on every render.
 */
function pickPhotoPool(size: WidgetSize, photos: Photo[]): Photo[] {
  if (photos.length === 0) return [];
  const capacity = size === '2x2' ? 6 : size === '4x2' ? 8 : 10;
  const poolSize = Math.min(capacity, photos.length);
  const day = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const offset = day % photos.length;
  const pool: Photo[] = [];
  for (let i = 0; i < poolSize; i++) {
    pool.push(photos[(offset + i) % photos.length]!);
  }
  return pool;
}

function formatCaption(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
}
