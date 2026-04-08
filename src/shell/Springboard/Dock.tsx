import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';
import { Material } from '@/system/Material';
import type { SpringboardMetrics } from '../Device/viewportProfile';

interface DockProps {
  apps: AppInfo[];
  metrics: SpringboardMetrics;
}

export function Dock({ apps, metrics }: DockProps) {
  return (
    <div
      style={{
        paddingInline: 'var(--shell-side-padding)',
        paddingTop: `${Math.max(4, Math.ceil(metrics.dockPaddingY / 2))}px`,
        paddingBottom: `${metrics.dockPaddingY}px`,
      }}
      data-testid="dock"
    >
      <Material
        variant="thick"
        className="flex items-center justify-around rounded-[var(--radius-card)] px-2 py-2"
      >
        {apps.map((app) => (
          <AppIcon key={app.id} app={app} hideLabel metrics={metrics} />
        ))}
      </Material>
    </div>
  );
}
