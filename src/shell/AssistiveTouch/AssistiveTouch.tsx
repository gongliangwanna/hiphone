import { useRef, useEffect, useCallback, type PointerEvent } from 'react';
import { AnimatePresence, motion, animate, useMotionValue } from 'motion/react';
import { spring } from '@/platform/design-tokens/motion';
import { useAssistiveTouchStore } from '@/platform/stores/assistiveTouchStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useSystemStore } from '@/platform/stores/systemStore';

const BALL_SIZE = 56;
const EDGE_MARGIN = 8;
const TAP_THRESHOLD = 8;
const IDLE_TIMEOUT = 3000;
const IDLE_OPACITY = 0.5;
const ACTIVE_OPACITY = 1;
const MENU_SIZE = 180;
const MENU_ITEM_SIZE = 72;

export function AssistiveTouch() {
  const isLocked = useSystemStore((s) => s.isLocked);
  const activeAppId = useAppRuntimeStore((s) => s.activeAppId);
  const presentationMode = useAppRuntimeStore((s) => s.presentationMode);
  const exitAppToHome = useAppRuntimeStore((s) => s.exitAppToHome);
  const openSwitcher = useAppRuntimeStore((s) => s.openSwitcher);
  const anchorEdge = useAssistiveTouchStore((s) => s.anchorEdge);
  const anchorY = useAssistiveTouchStore((s) => s.anchorY);
  const isMenuOpen = useAssistiveTouchStore((s) => s.isMenuOpen);
  const toggleMenu = useAssistiveTouchStore((s) => s.toggleMenu);
  const closeMenu = useAssistiveTouchStore((s) => s.closeMenu);
  const setAnchor = useAssistiveTouchStore((s) => s.setAnchor);

  const visible = !isLocked && (Boolean(activeAppId) || presentationMode === 'switcher');

  const containerRef = useRef<HTMLDivElement>(null);
  const ballX = useMotionValue(0);
  const ballY = useMotionValue(0);
  const ballOpacity = useMotionValue(ACTIVE_OPACITY);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snapAnimRef = useRef<Array<ReturnType<typeof animate>>>([]);
  // Guard: when true, the effect that syncs position from store is suppressed.
  // This prevents the "teleport" bug where setAnchor triggers an effect that
  // instantly jumps ballX/ballY to the target before the spring finishes.
  const isSnappingRef = useRef(false);

  const pointerRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startBallX: 0,
    startBallY: 0,
    totalDisplacement: 0,
  });

  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    animate(ballOpacity, ACTIVE_OPACITY, { duration: 0.15 });
    idleTimerRef.current = setTimeout(() => {
      if (!useAssistiveTouchStore.getState().isMenuOpen) {
        animate(ballOpacity, IDLE_OPACITY, { duration: 0.6 });
      }
    }, IDLE_TIMEOUT);
  }, [ballOpacity]);

  const computePosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    const maxX = rect.width - BALL_SIZE - EDGE_MARGIN;
    const maxY = rect.height - BALL_SIZE - EDGE_MARGIN;
    const x = anchorEdge === 'right' ? maxX : EDGE_MARGIN;
    const y = EDGE_MARGIN + anchorY * (maxY - EDGE_MARGIN);
    return { x, y };
  }, [anchorEdge, anchorY]);

  // Sync motion values from store only on mount / visibility change.
  // During snap animations, isSnappingRef suppresses this to avoid teleporting.
  useEffect(() => {
    if (!visible || isSnappingRef.current) return;
    const pos = computePosition();
    ballX.set(pos.x);
    ballY.set(pos.y);
    resetIdleTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, anchorEdge, anchorY]);

  useEffect(() => {
    closeMenu();
  }, [activeAppId, closeMenu]);

  const snapToEdge = useCallback((currentX: number, currentY: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const centerX = currentX + BALL_SIZE / 2;
    const maxX = rect.width - BALL_SIZE - EDGE_MARGIN;
    const maxY = rect.height - BALL_SIZE - EDGE_MARGIN;
    const minY = EDGE_MARGIN;

    const targetEdge: 'left' | 'right' = centerX < rect.width / 2 ? 'left' : 'right';
    const targetX = targetEdge === 'right' ? maxX : EDGE_MARGIN;
    const targetY = Math.max(minY, Math.min(maxY, currentY));
    const normalizedY = maxY > minY ? (targetY - minY) / (maxY - minY) : 0.5;

    for (const anim of snapAnimRef.current) anim.stop();

    // Suppress the store-sync effect while the spring is in flight.
    isSnappingRef.current = true;

    const onComplete = () => {
      isSnappingRef.current = false;
    };

    snapAnimRef.current = [
      animate(ballX, targetX, {
        type: 'spring',
        ...spring.interactive,
        onComplete,
      }),
      animate(ballY, targetY, { type: 'spring', ...spring.interactive }),
    ];

    // Persist the anchor in the store (the effect won't teleport because
    // isSnappingRef is true).
    setAnchor(targetEdge, normalizedY);
  }, [ballX, ballY, setAnchor]);

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    for (const anim of snapAnimRef.current) anim.stop();
    snapAnimRef.current = [];
    isSnappingRef.current = false;

    pointerRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startBallX: ballX.get(),
      startBallY: ballY.get(),
      totalDisplacement: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    resetIdleTimer();
  };

  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointerRef.current;
    if (!p.active || p.pointerId !== e.pointerId) return;

    const dx = e.clientX - p.startX;
    const dy = e.clientY - p.startY;
    p.totalDisplacement = Math.sqrt(dx * dx + dy * dy);

    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const maxX = rect.width - BALL_SIZE - EDGE_MARGIN;
    const maxY = rect.height - BALL_SIZE - EDGE_MARGIN;

    const newX = Math.max(EDGE_MARGIN, Math.min(maxX, p.startBallX + dx));
    const newY = Math.max(EDGE_MARGIN, Math.min(maxY, p.startBallY + dy));
    ballX.set(newX);
    ballY.set(newY);
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const p = pointerRef.current;
    if (!p.active || p.pointerId !== e.pointerId) return;
    p.active = false;

    if (p.totalDisplacement < TAP_THRESHOLD) {
      toggleMenu();
    } else {
      closeMenu();
      snapToEdge(ballX.get(), ballY.get());
    }
    resetIdleTimer();
  };

  const handlePointerCancel = () => {
    pointerRef.current.active = false;
    snapToEdge(ballX.get(), ballY.get());
  };

  const handleHomeAction = () => {
    closeMenu();
    exitAppToHome();
  };

  const handleSwitcherAction = () => {
    closeMenu();
    openSwitcher();
  };

  const handleBackdropClick = () => {
    closeMenu();
  };

  // Menu position: use current ballX/ballY motion values for accurate placement
  const menuPosition = (() => {
    const pos = computePosition();
    const isRight = anchorEdge === 'right';
    const x = isRight ? pos.x - MENU_SIZE - 8 : pos.x + BALL_SIZE + 8;
    const y = pos.y + BALL_SIZE / 2 - MENU_SIZE / 2;
    return { x, y };
  })();

  const transformOrigin = anchorEdge === 'right' ? 'right center' : 'left center';

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 25 }}
      data-testid="assistive-touch-container"
    >
      {isMenuOpen && (
        <div
          className="pointer-events-auto absolute inset-0"
          onClick={handleBackdropClick}
          data-testid="assistive-touch-backdrop"
        />
      )}

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            key="assistive-touch-menu"
            className="pointer-events-auto absolute"
            style={{
              left: menuPosition.x,
              top: menuPosition.y,
              transformOrigin,
            }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', ...spring.snappy }}
            data-testid="assistive-touch-menu"
          >
            <div
              className="flex flex-wrap items-center justify-center gap-3 p-4"
              style={{
                width: MENU_SIZE,
                height: MENU_SIZE,
                borderRadius: 22,
                backgroundColor: 'rgba(36, 36, 38, 0.88)',
                boxShadow: '0 8px 40px rgba(0, 0, 0, 0.45), inset 0 0 0 0.5px rgba(255, 255, 255, 0.08)',
              }}
            >
              <MenuButton
                icon={<HomeIcon />}
                label="主屏幕"
                onClick={handleHomeAction}
                testId="at-action-home"
              />
              <MenuButton
                icon={<SwitcherIcon />}
                label="多任务"
                onClick={handleSwitcherAction}
                testId="at-action-switcher"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="pointer-events-auto absolute cursor-grab touch-none active:cursor-grabbing"
        style={{
          width: BALL_SIZE,
          height: BALL_SIZE,
          x: ballX,
          y: ballY,
          opacity: ballOpacity,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handlePointerCancel}
        data-testid="assistive-touch-ball"
      >
        <div
          className="flex h-full w-full items-center justify-center"
          style={{
            borderRadius: '50%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.35), inset 0 0 0 0.5px rgba(255, 255, 255, 0.15)',
          }}
        >
          <AssistiveTouchIcon />
        </div>
      </motion.div>
    </div>
  );
}

/** iOS AssistiveTouch icon — a circle with 4 directional arrows pointing inward */
function AssistiveTouchIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      {/* Outer circle */}
      <circle cx="14" cy="14" r="12" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="none" />
      {/* Center dot */}
      <circle cx="14" cy="14" r="3.5" fill="rgba(255,255,255,0.85)" />
      {/* 4 directional ticks — top, right, bottom, left */}
      <line x1="14" y1="5" x2="14" y2="8.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="23" y1="14" x2="19.5" y2="14" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="14" y1="23" x2="14" y2="19.5" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="14" x2="8.5" y2="14" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

interface MenuButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  testId: string;
}

function MenuButton({ icon, label, onClick, testId }: MenuButtonProps) {
  return (
    <button
      type="button"
      className="flex flex-col items-center justify-center gap-1.5"
      style={{ width: MENU_ITEM_SIZE, height: MENU_ITEM_SIZE }}
      onClick={onClick}
      data-testid={testId}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.15)' }}
      >
        {icon}
      </div>
      <span
        className="text-[11px] font-medium"
        style={{ color: 'rgba(255, 255, 255, 0.85)' }}
      >
        {label}
      </span>
    </button>
  );
}

/** SF Symbol style home icon — rounded house outline */
function HomeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1V10.5z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

/** SF Symbol style switcher icon — two overlapping rectangles */
function SwitcherIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="9" height="16" rx="2" stroke="white" strokeWidth="1.8" fill="none" />
      <rect x="13" y="4" width="9" height="16" rx="2" stroke="white" strokeWidth="1.8" fill="none" />
    </svg>
  );
}
