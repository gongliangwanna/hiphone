import { useEffect, useRef, useState, useCallback } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
} from 'motion/react';
import { computeVelocity, type VelocitySample } from '@/platform/gesture/velocity';
import { spring } from '@/platform/design-tokens/motion';
import { useAppRuntimeStore, useGestureIntent, type AppOrigin } from '@/platform/stores/appRuntimeStore';
import { AppScene } from '@/apps/AppScene';
import { getAppInfoById } from '@/shell/Springboard/apps.data';
import { useViewportProfile } from '@/shell/Device/useViewportProfile';
import { getDeviceCornerRadius } from '@/shell/Device/viewportProfile';

export const CARD_WIDTH_RATIO = 0.66;
export const CARD_GAP = 10;

/** px of movement before we decide direction. */
const LOCK_THRESHOLD = 8;

export function computeSpacerWidth(viewportWidth: number, cardWidth: number, gap: number): number {
  return Math.max(0, (viewportWidth - cardWidth) / 2 - gap);
}

export function shouldLockDismissGesture(
  deltaX: number,
  deltaY: number,
): boolean | null {
  const dx = Math.abs(deltaX);
  const dy = Math.abs(deltaY);
  if (dx < LOCK_THRESHOLD && dy < LOCK_THRESHOLD) return null;
  if (deltaY < 0 && dy >= dx * 0.7) return true;
  return false;
}

// ---------------------------------------------------------------------------
// AppSwitcher
// ---------------------------------------------------------------------------

export function AppSwitcher() {
  const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
  const recentApps = useAppRuntimeStore((s) => s.recentApps);
  const switcherAppId = useAppRuntimeStore((s) => s.switcherAppId);
  const activateApp = useAppRuntimeStore((s) => s.activateApp);
  const activateAppFromCard = useAppRuntimeStore((s) => s.activateAppFromCard);
  const focusAppInSwitcher = useAppRuntimeStore((s) => s.focusAppInSwitcher);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [flyingAwayId, setFlyingAwayId] = useState<string | null>(null);
  const [exitAnimating, setExitAnimating] = useState(false);
  const intent = useGestureIntent();
  const viewportProfile = useViewportProfile();
  const deviceCornerRadius = getDeviceCornerRadius(viewportProfile.sizeTier);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const visible = intent === 'switcher-active';

  // Keep the switcher mounted briefly after activation so cards can fade out
  // while AppHost's morph animation (z-index 18) expands on top.
  useEffect(() => {
    if (!visible && activatingId) {
      setExitAnimating(true);
      const timer = setTimeout(() => {
        setExitAnimating(false);
        setActivatingId(null);
      }, 300);
      return () => clearTimeout(timer);
    }
    if (visible) {
      setExitAnimating(false);
    }
  }, [visible, activatingId]);

  const selectedId = switcherAppId ?? activeAppId ?? recentApps[0]?.id ?? null;

  const vw = viewportProfile.width;
  const cardWidth = Math.round(vw * CARD_WIDTH_RATIO);
  const spacerWidth = computeSpacerWidth(vw, cardWidth, CARD_GAP);

  useEffect(() => {
    if (!visible || recentApps.length === 0 || switcherAppId) return;
    focusAppInSwitcher(activeAppId ?? recentApps[0]?.id ?? null);
  }, [activeAppId, focusAppInSwitcher, recentApps, switcherAppId, visible]);

  useEffect(() => {
    if (!visible || !selectedId) {
      hasScrolledRef.current = false;
      return;
    }
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;

    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const target = scroller.querySelector<HTMLElement>(`[data-card-id="${selectedId}"]`);
      if (!target) return;
      const scrollerW = scroller.getBoundingClientRect().width;
      const targetRect = target.getBoundingClientRect();
      const scrollerRect = scroller.getBoundingClientRect();
      const targetCenter = targetRect.left - scrollerRect.left + scroller.scrollLeft + targetRect.width / 2;
      scroller.scrollLeft = targetCenter - scrollerW / 2;
    });
  }, [visible, selectedId]);

  const handleScroll = useCallback(() => {
    // Skip scroll-based focus changes while a card is being dismissed;
    // the collapse animation shifts content which fires spurious scroll events.
    if (flyingAwayId) return;

    const scroller = scrollRef.current;
    if (!scroller) return;
    const cards = Array.from(scroller.querySelectorAll<HTMLElement>('[data-switcher-card="true"]'));
    if (cards.length === 0) return;

    const scrollerRect = scroller.getBoundingClientRect();
    const centerX = scrollerRect.left + scrollerRect.width / 2;
    let nearestId: string | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const card of cards) {
      const rect = card.getBoundingClientRect();
      const cardCenter = rect.left + rect.width / 2;
      const distance = Math.abs(cardCenter - centerX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = card.dataset.cardId ?? null;
      }
    }

    if (nearestId && nearestId !== useAppRuntimeStore.getState().switcherAppId) {
      focusAppInSwitcher(nearestId);
    }
  }, [focusAppInSwitcher, flyingAwayId]);

  const handleDismissComplete = useCallback((appId: string) => {
    useAppRuntimeStore.getState().removeApp(appId);
    // Re-enable scroll-snap after browser processes the DOM removal,
    // otherwise snap fires on stale layout and causes a visual jump.
    requestAnimationFrame(() => setFlyingAwayId(null));
  }, []);

  if ((!visible && !exitAnimating) || recentApps.length === 0) return null;

  return (
    <div
      className="absolute inset-0"
      style={{
        zIndex: 16,
        pointerEvents: exitAnimating ? 'none' : undefined,
        opacity: exitAnimating ? 0 : 1,
        transition: exitAnimating ? 'opacity 250ms ease-out' : undefined,
      }}
      data-testid="app-switcher"
      onClick={(e) => {
        if (exitAnimating) return;
        if (e.target === e.currentTarget) {
          useAppRuntimeStore.getState().goHome();
        }
      }}
    >
      <div
        ref={scrollRef}
        className="h-full overflow-x-auto overflow-y-hidden"
        data-testid="app-switcher-strip"
        style={{
          scrollSnapType: flyingAwayId ? 'none' : 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={handleScroll}
      >
        <div className="flex h-full items-center" data-testid="app-switcher-track">
          {recentApps.map((task, i) => (
            <SwitcherCard
              key={task.id}
              appId={task.id}
              cardWidth={cardWidth}
              marginLeft={i === 0 ? spacerWidth + CARD_GAP : CARD_GAP}
              isFlyingAway={task.id === flyingAwayId}
              isActivatingOther={activatingId !== null && task.id !== activatingId}
              deviceCornerRadius={deviceCornerRadius}
              onActivate={(payload) => {
                setActivatingId(task.id);
                if (payload) {
                  activateAppFromCard(task.id, payload.rect, payload.viewport);
                } else {
                  activateApp(task.id, 'switcher');
                }
              }}
              onDismissCommit={(appId) => setFlyingAwayId(appId)}
              onDismissComplete={handleDismissComplete}
              onFocus={() => focusAppInSwitcher(task.id)}
            />
          ))}

          <div
            style={{ flexShrink: 0, width: spacerWidth + CARD_GAP, minHeight: 1 }}
            aria-hidden
          >
            <div style={{ width: 1, height: 1 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SwitcherCard
// ---------------------------------------------------------------------------

interface CardActivatePayload {
  rect: AppOrigin;
  viewport: { width: number; height: number };
}

interface SwitcherCardProps {
  appId: string;
  cardWidth: number;
  marginLeft: number;
  isFlyingAway: boolean;
  isActivatingOther: boolean;
  deviceCornerRadius: number;
  onActivate: (payload: CardActivatePayload | null) => void;
  onDismissCommit: (appId: string) => void;
  onDismissComplete: (appId: string) => void;
  onFocus: () => void;
}

function SwitcherCard({
  appId,
  cardWidth,
  marginLeft,
  isFlyingAway,
  isActivatingOther,
  deviceCornerRadius,
  onActivate,
  onDismissCommit,
  onDismissComplete,
  onFocus,
}: SwitcherCardProps) {
  const app = getAppInfoById(appId);
  const startCardDismiss = useAppRuntimeStore((s) => s.startCardDismiss);
  const updateCardDismiss = useAppRuntimeStore((s) => s.updateCardDismiss);
  const finishCardDismiss = useAppRuntimeStore((s) => s.finishCardDismiss);
  const draggedRef = useRef(false);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const cardBodyRef = useRef<HTMLDivElement>(null);
  const dismissRef = useRef<DismissState>({ phase: 'idle', startY: 0 });

  const dragY = useMotionValue(0);
  // Scale feedback: only active during drag, not during fly-away.
  const scaleFromDrag = useTransform(dragY, [-300, 0], [0.92, 1], { clamp: true });

  // Motion values for smooth gap-collapse after fly-away
  const wrapperWidth = useMotionValue(cardWidth);
  const wrapperMargin = useMotionValue(marginLeft);
  const collapseAnimsRef = useRef<Array<ReturnType<typeof animate>>>([]);

  useEffect(() => () => {
    animationRef.current?.stop();
    for (const a of collapseAnimsRef.current) a.stop();
  }, []);

  // Keep wrapper dimensions in sync when not flying away
  useEffect(() => {
    if (!isFlyingAway) {
      wrapperWidth.jump(cardWidth);
      wrapperMargin.jump(marginLeft);
    }
  }, [cardWidth, marginLeft, isFlyingAway, wrapperWidth, wrapperMargin]);

  // After fly-away starts, smoothly collapse the gap so neighboring cards slide
  // together instead of snapping when the card is removed from DOM.
  // Uses criticalDamped spring (no overshoot) and easeOut to prevent the
  // remaining cards from sliding past their target and snapping back.
  useEffect(() => {
    if (!isFlyingAway) return;
    // Short delay so the card visually clears before the gap starts closing
    const marginTarget = Math.max(0, marginLeft - CARD_GAP);
    const timer = setTimeout(() => {
      collapseAnimsRef.current = [
        animate(wrapperWidth, 0, {
          duration: 0.3,
          ease: [0.32, 0.72, 0, 1],
          onComplete: () => onDismissComplete(appId),
        }),
        animate(wrapperMargin, marginTarget, {
          duration: 0.3,
          ease: [0.32, 0.72, 0, 1],
        }),
      ];
    }, 120);
    return () => {
      clearTimeout(timer);
      for (const a of collapseAnimsRef.current) a.stop();
      collapseAnimsRef.current = [];
    };
  }, [isFlyingAway, appId, onDismissComplete, wrapperWidth, wrapperMargin]);

  const cardBodyRadius = deviceCornerRadius * (cardWidth / 390);

  // --- Touch-based dismiss gesture ---
  // We use native touch events (not pointer events) because:
  // 1. We can call preventDefault() to stop the scroll container from scrolling
  //    once we decide the gesture is vertical.
  // 2. Pointer events + touch-action: pan-x causes the browser to fire
  //    pointercancel as soon as it starts a horizontal pan, which kills
  //    our vertical gesture mid-flight.
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    dismissRef.current = { phase: 'pending', startX: t.clientX, startY: t.clientY };
    draggedRef.current = false;
    animationRef.current?.stop();
    animationRef.current = null;
  }, []);

  // Attach touchmove as a native listener with { passive: false } so that
  // preventDefault() actually works. React registers touch handlers as passive
  // by default, which causes "Unable to preventDefault inside passive event
  // listener" warnings and lets the scroll container hijack the dismiss gesture.
  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (e.touches.length !== 1) return;
    const t = e.touches[0]!;
    const d = dismissRef.current;

    if (d.phase === 'pending') {
      const dx = t.clientX - (d.startX ?? 0);
      const dy = t.clientY - d.startY;
      // Prevent scroll when movement leans vertical — protects the dismiss
      // gesture from being hijacked by the horizontal scroll container.
      if (Math.abs(dy) >= Math.abs(dx)) {
        e.preventDefault();
      }
      const result = shouldLockDismissGesture(dx, dy);
      if (result == null) return; // Not enough movement yet
      if (result) {
        d.phase = 'locked';
        e.preventDefault();
        dragY.set(0);
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        startCardDismiss(appId, d.startY, Math.max(rect.height, 200));
      } else {
        d.phase = 'idle'; // horizontal — let scroll handle it
        return;
      }
    }

    if (d.phase !== 'locked') return;

    // MUST preventDefault every move to keep the gesture locked to us.
    e.preventDefault();
    draggedRef.current = true;
    const deltaY = t.clientY - d.startY;
    dragY.set(Math.min(deltaY, 0));
    // Velocity samples
    if (!d.samples) d.samples = [];
    d.samples.push({ time: performance.now(), x: 0, y: t.clientY });
    if (d.samples.length > 8) d.samples = d.samples.slice(-8);
    const { vy } = computeVelocity(d.samples);
    updateCardDismiss(t.clientY, vy);
  }, [appId, dragY, startCardDismiss, updateCardDismiss]);

  useEffect(() => {
    const el = cardBodyRef.current;
    if (!el) return;
    el.addEventListener('touchmove', handleTouchMove, { passive: false });
    return () => el.removeEventListener('touchmove', handleTouchMove);
  }, [handleTouchMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const d = dismissRef.current;
    if (d.phase !== 'locked') {
      d.phase = 'idle';
      return;
    }
    d.phase = 'idle';

    const t = e.changedTouches[0]!;
    if (d.samples) {
      d.samples.push({ time: performance.now(), x: 0, y: t.clientY });
    }
    const { vy } = computeVelocity(d.samples ?? []);
    updateCardDismiss(t.clientY, vy);
    const result = finishCardDismiss();

    if (result.committed) {
      onDismissCommit(appId);
      const target = -(window.innerHeight || 900);
      animationRef.current = animate(dragY, target, {
        type: 'spring',
        ...spring.criticalDamped,
        velocity: result.velocity * 1000,
        restDelta: 100,
        restSpeed: 200,
        // DOM removal is handled by the gap-collapse effect (onDismissComplete),
        // not the fly-away animation. This ensures neighboring cards slide
        // smoothly instead of snapping when the card is removed.
      });
    } else {
      animationRef.current = animate(dragY, 0, {
        type: 'spring', ...spring.interactive,
        velocity: result.velocity * 1000,
      });
    }
  }, [appId, dragY, updateCardDismiss, finishCardDismiss, onDismissCommit, onDismissComplete]);

  const handleTouchCancel = useCallback(() => {
    if (dismissRef.current.phase === 'locked') {
      animationRef.current = animate(dragY, 0, {
        type: 'spring', ...spring.interactive,
      });
    }
    dismissRef.current.phase = 'idle';
  }, [dragY]);

  return (
    <motion.div
      style={{
        flexShrink: 0,
        width: wrapperWidth,
        marginLeft: wrapperMargin,
        scrollSnapAlign: isFlyingAway ? undefined : 'center',
        y: dragY,
        // Only apply scale during active drag, not during fly-away.
        scale: isFlyingAway ? 1 : scaleFromDrag,
        // Activating card stays visible — AppHost (z-18) covers it.
        // Other cards fade out via the parent container's opacity transition.
        opacity: isActivatingOther ? 0 : 1,
        // Prevent overflowing content during gap collapse
        overflow: isFlyingAway ? 'hidden' : undefined,
      }}
      transition={{ duration: isActivatingOther ? 0.16 : 0 }}
    >
      <div
        role="button"
        tabIndex={0}
        className="w-full text-left outline-none"
        onClick={(event) => {
          if (draggedRef.current || isFlyingAway) {
            draggedRef.current = false;
            return;
          }
          const deviceRoot = event.currentTarget.closest(
            '[data-testid="device-root"]',
          ) as HTMLElement | null;
          const cardRect = cardBodyRef.current?.getBoundingClientRect();
          const deviceRect = deviceRoot?.getBoundingClientRect();
          if (!cardRect || !deviceRect) { onActivate(null); return; }
          onActivate({
            rect: {
              x: cardRect.left - deviceRect.left,
              y: cardRect.top - deviceRect.top,
              width: cardRect.width,
              height: cardRect.height,
            },
            viewport: { width: deviceRect.width, height: deviceRect.height },
          });
        }}
        onPointerDown={onFocus}
        data-card-id={appId}
        data-switcher-card="true"
        data-testid={`switcher-card-${appId}`}
      >
        <div
          ref={cardBodyRef}
          className="overflow-hidden bg-black"
          style={{
            aspectRatio: '9 / 19.5',
            borderRadius: cardBodyRadius,
            position: 'relative',
            boxShadow: '0 18px 50px rgba(0,0,0,0.35), 0 4px 14px rgba(0,0,0,0.18)',
          }}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
        >
          <div
            className="pointer-events-none relative h-full w-full"
            data-testid={`switcher-card-surface-${appId}`}
          >
            <SwitcherAppContent appId={appId} cardWidth={cardWidth} />
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        {app?.icon ? (
          <img
            src={app.icon}
            alt={app.name}
            className="h-5 w-5 rounded-[5px] object-cover"
            draggable={false}
          />
        ) : null}
        <span
          style={{
            color: 'rgba(255,255,255,0.9)',
            fontSize: '13px',
            fontWeight: 500,
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        >
          {app?.name ?? appId}
        </span>
      </div>
    </motion.div>
  );
}

interface DismissState {
  phase: 'idle' | 'pending' | 'locked';
  startX?: number;
  startY: number;
  samples?: VelocitySample[];
}

// ---------------------------------------------------------------------------

function SwitcherAppContent({ appId, cardWidth }: { appId: string; cardWidth: number }) {
  const scale = cardWidth / 390;
  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{ width: 390, height: 844, transform: `scale(${scale})` }}
      >
        <AppScene appId={appId} />
      </div>
    </div>
  );
}
