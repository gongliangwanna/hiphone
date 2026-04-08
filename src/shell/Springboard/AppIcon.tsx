import type { AppInfo } from './apps.data';
import { getSpringboardMetrics, type SpringboardMetrics } from '../Device/viewportProfile';

interface AppIconProps {
  app: AppInfo;
  hideLabel?: boolean;
  metrics?: SpringboardMetrics;
}

export function AppIcon({ app, hideLabel, metrics = getSpringboardMetrics('regular') }: AppIconProps) {
  return (
    <button
      className="flex flex-col items-center gap-1 active:scale-92"
      style={{
        width: `${metrics.cellWidth}px`,
        paddingTop: 4,
        paddingBottom: 4,
        transition: 'transform 0.1s ease',
      }}
      data-testid={`app-icon-${app.id}`}
    >
      {/* Icon image with iOS mask */}
      <div
        className="overflow-hidden"
        style={{
          width: `${metrics.iconSize}px`,
          height: `${metrics.iconSize}px`,
          borderRadius: 'var(--radius-icon)',
        }}
      >
        <img
          src={app.icon}
          alt={app.name}
          className="h-full w-full object-cover"
          draggable={false}
        />
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
    </button>
  );
}
