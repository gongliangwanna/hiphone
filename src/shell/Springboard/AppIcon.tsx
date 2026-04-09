import { useRef } from 'react';
import { motion } from 'motion/react';
import type { AppInfo } from './apps.data';
import { getSpringboardMetrics, type SpringboardMetrics } from '../Device/viewportProfile';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { usePerfDebugStore } from '@/platform/stores/perfDebugStore';
import { spring } from '@/platform/design-tokens/motion';

interface AppIconProps {
  app: AppInfo;
  hideLabel?: boolean;
  metrics?: SpringboardMetrics;
}

function getPlaceholderColor(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) | 0;
  }

  return `hsl(${Math.abs(hash) % 360} 62% 56%)`;
}

export function AppIcon({ app, hideLabel, metrics = getSpringboardMetrics('regular') }: AppIconProps) {
  const iconRef = useRef<HTMLDivElement>(null);
  const openApp = useAppRuntimeStore((s) => s.openApp);
  const hideIconImages = usePerfDebugStore((s) => s.hideIconImages);

  const handleClick = () => {
    const el = iconRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    openApp(app.id, { x: rect.left, y: rect.top, width: rect.width, height: rect.height });
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
      <div
        ref={iconRef}
        className="overflow-hidden"
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
      </div>

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
}
