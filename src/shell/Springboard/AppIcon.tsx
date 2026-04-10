import { useRef, useEffect, memo } from 'react';
import { motion, useAnimationControls } from 'motion/react';
import type { AppInfo } from './apps.data';
import { getSpringboardMetrics, type SpringboardMetrics } from '../Device/viewportProfile';
import { spring } from '@/platform/design-tokens/motion';
import { useAppRuntimeStore, type AppOrigin } from '@/platform/stores/appRuntimeStore';

interface AppIconProps {
  app: AppInfo;
  hideLabel?: boolean;
  metrics?: SpringboardMetrics;
  hideIconImages?: boolean;
  onOpen: (id: string, origin: AppOrigin) => void;
}

function getPlaceholderColor(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return `hsl(${Math.abs(hash) % 360} 62% 56%)`;
}

export const AppIcon = memo(function AppIcon({ app, hideLabel, metrics = getSpringboardMetrics('regular'), hideIconImages, onOpen }: AppIconProps) {
  const iconRef = useRef<HTMLDivElement>(null);
  const iconControls = useAnimationControls();
  const dismissedAppId = useAppRuntimeStore((s) => s.dismissedAppId);
  const dismissReason = useAppRuntimeStore((s) => s.dismissReason);
  const isLandingTarget = dismissedAppId === app.id && dismissReason === 'home';

  useEffect(() => {
    if (isLandingTarget) {
      // Delay until the morph visually arrives at the icon, then:
      // instant upward displacement (impact), spring back to rest.
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

  const handleClick = () => {
    const el = iconRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const deviceRoot = el.closest('[data-testid="device-root"]') as HTMLElement | null;
    const deviceRect = deviceRoot?.getBoundingClientRect();
    onOpen(app.id, {
      x: rect.left - (deviceRect?.left ?? 0),
      y: rect.top - (deviceRect?.top ?? 0),
      width: rect.width,
      height: rect.height,
    });
  };

  return (
    <motion.button
      className="flex flex-col items-center gap-1"
      style={{
        width: `${metrics.cellWidth}px`,
        paddingTop: 4,
        paddingBottom: 4,
      }}
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', ...spring.snappy }}
      onClick={handleClick}
      data-testid={`app-icon-${app.id}`}
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
            style={{ backgroundColor: getPlaceholderColor(app.id) }}
            data-testid={`app-icon-placeholder-${app.id}`}
            aria-label={`${app.name} 占位图标`}
          />
        ) : (
          <img
            src={app.icon}
            alt={app.name}
            className="h-full w-full object-cover"
            draggable={false}
          />
        )}
      </motion.div>

      {/* Label — hidden when hideLabel is true (used in Dock) */}
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
          {app.name}
        </span>
      )}
    </motion.button>
  );
});
