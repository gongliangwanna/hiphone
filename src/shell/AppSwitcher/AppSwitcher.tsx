import { useEffect, useRef, useState, useCallback, type PointerEvent, type ReactNode } from 'react';
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
const DIRECTION_LOCK_THRESHOLD = 8;
const DISMISS_DIRECTION_LOCK_RATIO = 1.15;

/**
 * Compute the extra margin for the first/last card so it can be centered.
 *
 * Layout: [marginLeft_first][card][ml][card]...[card][marginRight_last]
 *
 * First card: marginLeft = spacer + gap. Card center at (spacer+gap) + cw/2.
 * For center: (spacer+gap) + cw/2 = vw/2 => spacer = vw/2 - cw/2 - gap.
 *
 * Last card: marginRight = spacer + gap (same value).
 * Total width = (spacer+gap) + n*cw + (n-1)*gap + (spacer+gap)
 * maxScroll = total - vw. Required = lastCenter - vw/2.
 * They are equal by construction.
 */
export function computeSpacerWidth(viewportWidth: number, cardWidth: number, gap: number): number {
  return Math.max(0, (viewportWidth - cardWidth) / 2 - gap);
}

export function shouldLockDismissGesture(
  deltaX: number,
  deltaY: number,
  threshold: number = DIRECTION_LOCK_THRESHOLD,
  verticalRatio: number = DISMISS_DIRECTION_LOCK_RATIO,
): boolean | null {
  const dx = Math.abs(deltaX);
  const dy = Math.abs(deltaY);
  if (dx < threshold && dy < threshold) return null;
  if (deltaY >= 0) return false;
  return dy >= Math.max(threshold, dx * verticalRatio);
}

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
  }, [focusAppInSwitcher]);

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
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
        }}
        onScroll={handleScroll}
      >
        {/* WebKit ignores trailing empty divs AND margin-right on the last
            flex child for scrollWidth. The only reliable way to extend scroll
            extent is a trailing element with real rendered content. We use a
            1×1 transparent div as the trailing spacer. */}
        <div className="flex h-full items-center" data-testid="app-switcher-track">
          {recentApps.map((task, i) => (
            <SwitcherCard
              key={task.id}
              appId={task.id}
              cardWidth={cardWidth}
              marginLeft={i === 0 ? spacerWidth + CARD_GAP : CARD_GAP}
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

          {/* Trailing spacer — must have real content (1×1 div) so WebKit
              includes it in scrollWidth. Empty divs get ignored. */}
          <div
            style={{
              flexShrink: 0,
              width: spacerWidth + CARD_GAP,
              minHeight: 1,
            }}
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

interface CardActivatePayload {
  rect: AppOrigin;
  viewport: { width: number; height: number };
}

interface SwitcherCardProps {
  appId: string;
  cardWidth: number;
  marginLeft: number;
  isActivating: boolean;
  isActivatingOther: boolean;
  deviceCornerRadius: number;
  onActivate: (payload: CardActivatePayload | null) => void;
  onFocus: () => void;
}

function SwitcherCard({
  appId,
  cardWidth,
  marginLeft,
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
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const cardBodyRef = useRef<HTMLDivElement>(null);

  const dragY = useMotionValue(0);
  const scaleFromDrag = useTransform(dragY, [-300, 0], [0.92, 1], { clamp: true });

  useEffect(() => () => { animationRef.current?.stop(); }, []);

  const cardBodyRadius = deviceCornerRadius * (cardWidth / 390);

  return (
    <motion.div
      style={{
        flexShrink: 0,
        width: cardWidth,
        marginLeft,
        scrollSnapAlign: 'center',
        visibility: isActivating ? 'hidden' : 'visible',
        y: dragY,
        scale: scaleFromDrag,
        opacity: isActivating ? 0 : isActivatingOther ? 0 : 1,
      }}
      transition={{ duration: isActivatingOther ? 0.16 : 0 }}
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
        >
          <DismissGestureSurface
            appId={appId}
            onDismissStart={(startY, height) => {
              draggedRef.current = false;
              animationRef.current?.stop();
              animationRef.current = null;
              dragY.set(0);
              startCardDismiss(appId, startY, Math.max(height, 200));
            }}
            onDismissMove={(deltaY, currentY, velocityY) => {
              draggedRef.current = true;
              dragY.set(Math.min(deltaY, 0));
              updateCardDismiss(currentY, velocityY);
            }}
            onDismissEnd={(currentY, velocityY) => {
              updateCardDismiss(currentY, velocityY);
              const result = finishCardDismiss();
              if (result.committed) {
                animationRef.current = animate(dragY, -(window.innerHeight || 900), {
                  type: 'spring', ...spring.criticalDamped,
                  velocity: result.velocity * 1000,
                });
              } else {
                animationRef.current = animate(dragY, 0, {
                  type: 'spring', ...spring.interactive,
                  velocity: result.velocity * 1000,
                });
              }
            }}
            onDismissCancel={() => {
              animationRef.current = animate(dragY, 0, {
                type: 'spring', ...spring.interactive,
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

// ---------------------------------------------------------------------------

interface DismissGestureSurfaceProps {
  appId: string;
  children: ReactNode;
  onDismissStart: (startY: number, height: number) => void;
  onDismissMove: (deltaY: number, currentY: number, velocityY: number) => void;
  onDismissEnd: (currentY: number, velocityY: number) => void;
  onDismissCancel: () => void;
}

function DismissGestureSurface({
  appId,
  children,
  onDismissStart,
  onDismissMove,
  onDismissEnd,
  onDismissCancel,
}: DismissGestureSurfaceProps) {
  const stateRef = useRef<'idle' | 'pending' | 'locked'>('idle');
  const pointerRef = useRef({ pointerId: -1, startX: 0, startY: 0 });
  const samplesRef = useRef<VelocitySample[]>([]);

  return (
    <div
      className="h-full w-full"
      style={{ touchAction: 'pan-x' }}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        stateRef.current = 'pending';
        pointerRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY };
        samplesRef.current = [{ time: performance.now(), x: 0, y: e.clientY }];
      }}
      onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
        const p = pointerRef.current;
        if (p.pointerId !== e.pointerId) return;

        if (stateRef.current === 'pending') {
          const result = shouldLockDismissGesture(e.clientX - p.startX, e.clientY - p.startY);
          if (result == null) return;
          if (result) {
            stateRef.current = 'locked';
            e.currentTarget.setPointerCapture(e.pointerId);
            const rect = e.currentTarget.getBoundingClientRect();
            onDismissStart(p.startY, rect.height);
          } else {
            stateRef.current = 'idle';
            return;
          }
        }

        if (stateRef.current !== 'locked') return;
        samplesRef.current.push({ time: performance.now(), x: 0, y: e.clientY });
        if (samplesRef.current.length > 8) samplesRef.current = samplesRef.current.slice(-8);
        const { vy } = computeVelocity(samplesRef.current);
        onDismissMove(e.clientY - p.startY, e.clientY, vy);
      }}
      onPointerUp={(e: PointerEvent<HTMLDivElement>) => {
        const p = pointerRef.current;
        if (p.pointerId !== e.pointerId) return;
        const wasLocked = stateRef.current === 'locked';
        stateRef.current = 'idle';
        if (!wasLocked) return;
        samplesRef.current.push({ time: performance.now(), x: 0, y: e.clientY });
        const { vy } = computeVelocity(samplesRef.current);
        onDismissEnd(e.clientY, vy);
      }}
      onPointerCancel={() => {
        const wasLocked = stateRef.current === 'locked';
        stateRef.current = 'idle';
        if (wasLocked) onDismissCancel();
      }}
      onLostPointerCapture={() => {
        const wasLocked = stateRef.current === 'locked';
        stateRef.current = 'idle';
        if (wasLocked) onDismissCancel();
      }}
      data-testid={`switcher-card-surface-${appId}`}
    >
      {children}
    </div>
  );
}
