import { useRef, useEffect, useMemo, memo } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import type { AppInfo } from './apps.data';
import { getSpringboardMetrics, type SpringboardMetrics } from '../Device/viewportProfile';
import { spring } from '@/platform/design-tokens/motion';
import { useAppRuntimeStore, type AppOrigin } from '@/platform/stores/appRuntimeStore';
import { useLongPress } from '@/platform/gesture/useLongPress';
import { useSpringboardLayoutStore } from '@/platform/stores/springboardLayoutStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import {
  canonicalizeAppId,
  useAppProfileStore,
} from '@/platform/stores/appProfileStore';
import {
  getResolvedAppMetadata,
} from '@/platform/appMetadataResolver';
import './jiggle.css';

interface AppIconProps {
  app: AppInfo;
  hideLabel?: boolean;
  metrics?: SpringboardMetrics;
  hideIconImages?: boolean;
  pageIndex?: number;
  localIndex?: number;
  isEditMode?: boolean;
  onDragStart?: (pageIndex: number, localIndex: number, e: React.PointerEvent<HTMLElement>) => void;
  onOpen: (id: string, origin: AppOrigin) => void;
}

function getPlaceholderColor(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return `hsl(${Math.abs(hash) % 360} 62% 56%)`;
}

export const AppIcon = memo(function AppIcon({
  app,
  hideLabel,
  metrics = getSpringboardMetrics('regular'),
  hideIconImages,
  pageIndex,
  localIndex,
  isEditMode = false,
  onDragStart,
  onOpen,
}: AppIconProps) {
  const iconRef = useRef<HTMLDivElement>(null);
  const iconControls = useAnimationControls();
  const profiles = useAppProfileStore((s) => s.profiles);
  const installedApps = useInstalledUserAppsStore((s) => s.apps);
  const dismissedAppId = useAppRuntimeStore((s) => s.dismissedAppId);
  const dismissReason = useAppRuntimeStore((s) => s.dismissReason);
  const enterEditMode = useSpringboardLayoutStore((s) => s.enterEditMode);
  const canonicalAppId = canonicalizeAppId(app.id);
  const resolvedApp = useMemo(
    () => getResolvedAppMetadata(canonicalAppId),
    [canonicalAppId, profiles, installedApps],
  );
  const displayName = useMemo(
    () => resolvedApp?.displayName ?? app.name,
    [app.name, resolvedApp],
  );
  const displayIcon = useMemo(
    () => resolvedApp?.displayIcon ?? app.icon,
    [app.icon, resolvedApp],
  );
  const isLandingTarget =
    dismissedAppId === canonicalAppId && dismissReason === 'home';

  // Random jiggle delay per icon (stable across re-renders) — desyncs the
  // start phase so neighbours don't move in lock-step.
  const jiggleDelay = useMemo(() => `${Math.random() * 0.2}s`, []);
  // Alternate keyframe direction by index parity for extra visual variety.
  const jiggleClass = isEditMode
    ? ((pageIndex ?? 0) + (localIndex ?? 0)) % 2 === 0
      ? 'springboard-jiggle'
      : 'springboard-jiggle-alt'
    : '';

  useEffect(() => {
    if (isLandingTarget) {
      const timer = setTimeout(() => {
        iconControls.set({ y: -3.5, scaleX: 1.03, scaleY: 0.97 });
        iconControls.start({
          y: 0,
          scaleX: 1,
          scaleY: 1,
          transition: { type: 'spring', stiffness: 300, damping: 10, mass: 0.8 },
        });
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [isLandingTarget, iconControls]);

  // Long-press to enter edit mode (only when NOT already in edit mode)
  const longPress = useLongPress(
    (e) => {
      enterEditMode();
      if (pageIndex !== undefined && localIndex !== undefined && onDragStart) {
        onDragStart(pageIndex, localIndex, e);
      }
    },
    { delay: 600 },
  );

  const handleClick = () => {
    // In edit mode, don't open apps
    if (isEditMode) return;
    // Cancel any pending long-press timer. The parent gesture surface captures
    // the pointer (setPointerCapture), so the element-level onPointerUp never
    // fires on PC/Android. The click event is NOT affected by pointer capture,
    // so cancelling here is reliable across all platforms.
    longPress.cancel();
    const el = iconRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const deviceRoot = el.closest('[data-testid="device-root"]') as HTMLElement | null;
    const deviceRect = deviceRoot?.getBoundingClientRect();
    onOpen(canonicalAppId, {
      x: rect.left - (deviceRect?.left ?? 0),
      y: rect.top - (deviceRect?.top ?? 0),
      width: rect.width,
      height: rect.height,
    });
  };

  // In edit mode, icon pointer events initiate drag (stop propagation to prevent page swipe)
  const handleEditPointerDown = (e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
    if (pageIndex !== undefined && localIndex !== undefined && onDragStart) {
      onDragStart(pageIndex, localIndex, e);
    }
  };

  return (
    <motion.button
      className={`flex flex-col items-center gap-1 ${jiggleClass}`}
      style={{
        width: `${metrics.cellWidth}px`,
        paddingTop: 4,
        paddingBottom: 4,
        animationDelay: isEditMode ? jiggleDelay : undefined,
      }}
      whileTap={isEditMode ? undefined : { scale: 0.92 }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={isEditMode ? undefined : handleClick}
      onPointerDown={isEditMode ? handleEditPointerDown : longPress.onPointerDown}
      onPointerUp={isEditMode ? undefined : longPress.onPointerUp}
      onPointerCancel={isEditMode ? undefined : longPress.onPointerCancel}
      data-testid={`app-icon-${canonicalAppId}`}
    >
      {/* Icon image with iOS mask */}
      <motion.div
        ref={iconRef}
        className="overflow-hidden"
        animate={iconControls}
        style={{
          width: `${metrics.iconSize}px`,
          height: `${metrics.iconSize}px`,
          borderRadius: 'var(--radius-icon)',
        }}
      >
        {hideIconImages ? (
          <div
            className="h-full w-full"
            style={{ backgroundColor: getPlaceholderColor(canonicalAppId) }}
            data-testid={`app-icon-placeholder-${canonicalAppId}`}
            aria-label={`${displayName} 占位图标`}
          />
        ) : (
          <img
            src={displayIcon}
            alt={displayName}
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
      </motion.div>

      {!hideLabel && (
        <span
          className="w-full truncate text-center"
          style={{
            fontSize: `${metrics.labelSize}px`,
            color: 'white',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            lineHeight: 1.2,
          }}
        >
          {displayName}
        </span>
      )}
    </motion.button>
  );
});
