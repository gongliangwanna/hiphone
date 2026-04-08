import type { AppInfo } from './apps.data';

interface AppIconProps {
  app: AppInfo;
  hideLabel?: boolean;
}

export function AppIcon({ app, hideLabel }: AppIconProps) {
  return (
    <button
      className="flex flex-col items-center gap-1 active:scale-92"
      style={{ width: 75, paddingTop: 4, paddingBottom: 4, transition: 'transform 0.1s ease' }}
      data-testid={`app-icon-${app.id}`}
    >
      {/* Icon image with iOS mask */}
      <div
        className="overflow-hidden"
        style={{ width: 60, height: 60, borderRadius: 'var(--radius-icon)' }}
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
            fontSize: 'var(--font-size-caption1)',
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
