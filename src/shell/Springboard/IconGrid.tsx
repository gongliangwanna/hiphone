import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';
import type { SpringboardMetrics } from '../Device/viewportProfile';

interface IconGridProps {
  apps: AppInfo[];
  metrics: SpringboardMetrics;
}

/** 4 columns × 5 rows = 20 icons per page */
export function IconGrid({ apps, metrics }: IconGridProps) {
  return (
    <div
      className="grid grid-cols-4 justify-items-center"
      style={{ rowGap: `${metrics.gridGapY}px` }}
      data-testid="icon-grid"
    >
      {apps.map((app) => (
        <AppIcon key={app.id} app={app} metrics={metrics} />
      ))}
    </div>
  );
}
