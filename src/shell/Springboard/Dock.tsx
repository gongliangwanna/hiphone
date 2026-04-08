import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';
import { Material } from '@/system/Material';

interface DockProps {
  apps: AppInfo[];
}

export function Dock({ apps }: DockProps) {
  return (
    <div className="px-4 pb-2 pt-1" data-testid="dock">
      <Material
        variant="thick"
        className="flex items-center justify-around rounded-[var(--radius-card)] px-2 py-2"
      >
        {apps.map((app) => (
          <AppIcon key={app.id} app={app} hideLabel />
        ))}
      </Material>
    </div>
  );
}
