import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  AnimatePresence,
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

/** Gap between cards in px. */
const CARD_GAP = 14;
/** Card width as fraction of viewport width (iOS ≈ 68-72%). */
const CARD_WIDTH_RATIO = 0.70;

export function AppSwitcher() {
  const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
  const recentApps = useAppRuntimeStore((s) => s.recentApps);
  const switcherAppId = useAppRuntimeStore((s) => s.switcherAppId);
  const activateApp = useAppRuntimeStore((s) => s.activateApp);
  const activateAppFromCard = useAppRuntimeStore((s) => s.activateAppFromCard);
  const focusAppInSwitcher = useAppRuntimeStore((s) => s.focusAppInSwitcher);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const intent = useGestureIntent();
  const viewportProfile = useViewportProfile();
  const deviceCornerRadius = getDeviceCornerRadius(viewportProfile.sizeTier);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);
  const visible = intent === 'switcher-active';
  const selectedId = switcherAppId ?? activeAppId ?? recentApps[0]?.id ?? null;

  const vw = viewportProfile.width;
  const cardWidth = Math.round(vw * CARD_WIDTH_RATIO);
  // Side inset = enough to center any single card, including the first/last.
  // (viewportWidth - cardWidth) / 2 ensures even the edge cards can reach center.
  const sideInset = Math.round((vw - cardWidth) / 2);

  // Focus first card on mount
  useEffect(() => {
    if (!visible || recentApps.length === 0 || switcherAppId) return;
    focusAppInSwitcher(activeAppId ?? recentApps[0]?.id ?? null);
  }, [activeAppId, focusAppInSwitcher, recentApps, switcherAppId, visible]);

  // Scroll selected card into view on mount
  useEffect(() => {
    if (!visible || !selectedId) {
      hasScrolledRef.current = false;
      return;
    }
    if (hasScrolledRef.current) return;
    hasScrolledRef.current = true;

    const scroller = scrollRef.current;
    if (!scroller) return;

    // requestAnimationFrame to ensure DOM has laid out the cards
    requestAnimationFrame(() => {
      const target = scroller.querySelector<HTMLElement>(`[data-card-id="${selectedId}"]`);
      if (!target) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const currentScroll = scroller.scrollLeft;
      const targetCenter = targetRect.left - scrollerRect.left + currentScroll + targetRect.width / 2;
      const scrollerCenter = scrollerRect.width / 2;
      scroller.scrollLeft = targetCenter - scrollerCenter;
    });
  }, [visible, selectedId]);

  // Track nearest card during scroll
  const handleScroll = () => {
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

    if (nearestId && nearestId !== switcherAppId) {
      focusAppInSwitcher(nearestId);
    }
  };

  if (!visible || recentApps.length === 0) return null;

  return (
    <div
      className="absolute inset-0"
      style={{ zIndex: 16 }}
      data-testid="app-switcher"
      onClick={(e) => {
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
          scrollSnapType: 'x proximity',
          paddingTop: 'calc(var(--status-bar-height) + 14px)',
          paddingBottom: 'calc(var(--app-safe-bottom) + 18px)',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={handleScroll}
      >
        <div
          className="flex h-full items-center"
          style={{
            gap: CARD_GAP,
            paddingLeft: sideInset,
            paddingRight: sideInset,
          }}
        >
          <AnimatePresence initial={true}>
            {recentApps.map((task, index) => (
              <SwitcherCard
                key={task.id}
                appId={task.id}
                index={index}
                cardWidth={cardWidth}
                isActivating={task.id === activatingId}
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
                onFocus={() => focusAppInSwitcher(task.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface CardActivatePayload {
  rect: AppOrigin;
  viewport: { width: number; height: number };
}

interface SwitcherCardProps {
  appId: string;
  index: number;
  cardWidth: number;
  isActivating: boolean;
  isActivatingOther: boolean;
  deviceCornerRadius: number;
  onActivate: (payload: CardActivatePayload | null) => void;
  onFocus: () => void;
}

function SwitcherCard({
  appId,
  index,
  cardWidth,
  isActivating,
  isActivatingOther,
  deviceCornerRadius,
  onActivate,
  onFocus,
}: SwitcherCardProps) {
  const app = getAppInfoById(appId);
  const startCardDismiss = useAppRuntimeStore((s) => s.startCardDismiss);
  const updateCardDismiss = useAppRuntimeStore((s) => s.updateCardDismiss);
  const finishCardDismiss = useAppRuntimeStore((s) => s.finishCardDismiss);
  const draggedRef = useRef(false);
  const cardHeightRef = useRef(600);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const cardBodyRef = useRef<HTMLDivElement>(null);
  const isFirstRenderRef = useRef(true);
  const entranceDelay = isFirstRenderRef.current ? index * 0.035 : 0;
  useEffect(() => {
    isFirstRenderRef.current = false;
  }, []);

  const dragY = useMotionValue(0);
  const scaleFromDrag = useTransform(dragY, [-300, 0], [0.9, 1], { clamp: true });
  const opacityFromDrag = useTransform(dragY, [-260, -60, 0], [0, 1, 1], { clamp: true });

  useEffect(() => {
    return () => {
      animationRef.current?.stop();
    };
  }, []);

  const cardBodyRadius = deviceCornerRadius * (cardWidth / 390);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{
        opacity: isActivating ? 0 : isActivatingOther ? 0 : 1,
        scale: 1,
        y: 0,
      }}
      exit={{ opacity: 0, scale: 0.88, y: -30 }}
      transition={
        isActivatingOther
          ? { duration: 0.16, ease: 'easeOut' }
          : { type: 'spring', ...spring.smooth, delay: entranceDelay }
      }
      style={{
        flex: `0 0 ${cardWidth}px`,
        scrollSnapAlign: 'center',
        visibility: isActivating ? 'hidden' : 'visible',
        y: dragY,
        scale: scaleFromDrag,
        opacity: opacityFromDrag,
      }}
    >
      <button
        type="button"
        className="w-full text-left outline-none"
        onClick={(event) => {
          if (draggedRef.current) {
            draggedRef.current = false;
            return;
          }
          const deviceRoot = event.currentTarget.closest(
            '[data-testid="device-root"]',
          ) as HTMLElement | null;
          const cardRect = cardBodyRef.current?.getBoundingClientRect();
          const deviceRect = deviceRoot?.getBoundingClientRect();

          if (!cardRect || !deviceRect) {
            onActivate(null);
            return;
          }

          const payload: CardActivatePayload = {
            rect: {
              x: cardRect.left - deviceRect.left,
              y: cardRect.top - deviceRect.top,
              width: cardRect.width,
              height: cardRect.height,
            },
            viewport: {
              width: deviceRect.width,
              height: deviceRect.height,
            },
          };
          onActivate(payload);
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
            boxShadow: '0 16px 48px rgba(0,0,0,0.35), 0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          <DismissGestureSurface
            appId={appId}
            onDismissGestureStart={(startY, height) => {
              draggedRef.current = false;
              const effectiveHeight = Math.max(height, 200);
              cardHeightRef.current = effectiveHeight;
              animationRef.current?.stop();
              animationRef.current = null;
              dragY.set(0);
              startCardDismiss(appId, startY, effectiveHeight);
            }}
            onDismissGestureMove={(currentY, velocityY, deltaY) => {
              if (deltaY < 0) {
                draggedRef.current = true;
              }
              const rawUpward = Math.min(deltaY, 0);
              dragY.set(rawUpward);
              updateCardDismiss(currentY, velocityY);
            }}
            onDismissGestureEnd={(currentY, velocityY, deltaY) => {
              if (deltaY < 0) {
                draggedRef.current = true;
              }
              updateCardDismiss(currentY, velocityY);
              const result = finishCardDismiss();

              if (result.committed) {
                const target = -Math.max(window.innerHeight || 900, 900);
                animationRef.current = animate(dragY, target, {
                  type: 'spring',
                  ...spring.criticalDamped,
                  velocity: result.velocity * 1000,
                });
              } else {
                animationRef.current = animate(dragY, 0, {
                  type: 'spring',
                  ...spring.interactive,
                  velocity: result.velocity * 1000,
                });
              }
            }}
            onDismissGestureCancel={() => {
              animationRef.current = animate(dragY, 0, {
                type: 'spring',
                ...spring.interactive,
              });
            }}
          >
            <div className="pointer-events-none relative h-full w-full">
              <SwitcherAppContent appId={appId} cardWidth={cardWidth} />
            </div>
          </DismissGestureSurface>
        </div>
      </button>

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
            color: 'rgba(255, 255, 255, 0.9)',
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

function SwitcherAppContent({ appId, cardWidth }: { appId: string; cardWidth: number }) {
  const scale = cardWidth / 390;

  return (
    <div className="absolute inset-0 overflow-hidden">
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: '390px',
          height: '844px',
          transform: `scale(${scale})`,
        }}
      >
        <AppScene appId={appId} />
      </div>
    </div>
  );
}

interface DismissGestureSurfaceProps {
  appId: string;
  children: ReactNode;
  onDismissGestureStart: (startY: number, height: number) => void;
  onDismissGestureMove: (currentY: number, velocityY: number, deltaY: number) => void;
  onDismissGestureEnd: (currentY: number, velocityY: number, deltaY: number) => void;
  onDismissGestureCancel: () => void;
}

function DismissGestureSurface({
  appId,
  children,
  onDismissGestureStart,
  onDismissGestureMove,
  onDismissGestureEnd,
  onDismissGestureCancel,
}: DismissGestureSurfaceProps) {
  const pointerRef = useRef({
    active: false,
    pointerId: -1,
    startY: 0,
  });
  const samplesRef = useRef<VelocitySample[]>([]);

  return (
    <div
      className="h-full w-full"
      style={{ touchAction: 'pan-x' }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        pointerRef.current = {
          active: true,
          pointerId: event.pointerId,
          startY: event.clientY,
        };
        samplesRef.current = [{ time: performance.now(), x: 0, y: event.clientY }];
        onDismissGestureStart(event.clientY, rect.height);
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
        if (!pointerRef.current.active || pointerRef.current.pointerId !== event.pointerId) {
          return;
        }
        samplesRef.current.push({ time: performance.now(), x: 0, y: event.clientY });
        if (samplesRef.current.length > 8) {
          samplesRef.current = samplesRef.current.slice(-8);
        }
        const { vy } = computeVelocity(samplesRef.current);
        onDismissGestureMove(event.clientY, vy, event.clientY - pointerRef.current.startY);
      }}
      onPointerUp={(event: PointerEvent<HTMLDivElement>) => {
        if (!pointerRef.current.active || pointerRef.current.pointerId !== event.pointerId) {
          return;
        }
        pointerRef.current.active = false;
        samplesRef.current.push({ time: performance.now(), x: 0, y: event.clientY });
        const { vy } = computeVelocity(samplesRef.current);
        onDismissGestureEnd(event.clientY, vy, event.clientY - pointerRef.current.startY);
      }}
      onPointerCancel={() => {
        pointerRef.current.active = false;
        onDismissGestureCancel();
      }}
      onLostPointerCapture={() => {
        pointerRef.current.active = false;
        onDismissGestureCancel();
      }}
      data-testid={`switcher-card-surface-${appId}`}
    >
      {children}
    </div>
  );
}
