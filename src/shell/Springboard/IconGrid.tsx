import { memo } from 'react';
import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import type { AppOrigin } from '@/platform/stores/appRuntimeStore';

interface IconGridProps {
  apps: AppInfo[];
  metrics: SpringboardMetrics;
  hideIconImages?: boolean;
  onOpen: (id: string, origin: AppOrigin) => void;
}

/** 4 columns × 5 rows = 20 icons per page */
export const IconGrid = memo(function IconGrid({ apps, metrics, hideIconImages, onOpen }: IconGridProps) {
  return (
    <div
      className="grid grid-cols-4 justify-items-center"
      style={{ rowGap: `${metrics.gridGapY}px` }}
      data-testid="icon-grid"
    >
      {apps.map((app) => (
        <AppIcon key={app.id} app={app} metrics={metrics} hideIconImages={hideIconImages} onOpen={onOpen} />
      ))}
    </div>
  );
});
