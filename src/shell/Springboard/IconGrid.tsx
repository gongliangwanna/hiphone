import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';

interface IconGridProps {
  apps: AppInfo[];
}

/** 4 columns × 5 rows = 20 icons per page */
export function IconGrid({ apps }: IconGridProps) {
  return (
    <div
      className="grid grid-cols-4 gap-y-5 justify-items-center"
      data-testid="icon-grid"
    >
      {apps.map((app) => (
        <AppIcon key={app.id} app={app} />
      ))}
    </div>
  );
}
