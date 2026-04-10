import { memo } from 'react';
import type { AppInfo } from './apps.data';
import { AppIcon } from './AppIcon';
import { Material } from '@/system/Material';
import type { SpringboardMetrics } from '../Device/viewportProfile';
import type { AppOrigin } from '@/platform/stores/appRuntimeStore';

interface DockProps {
  apps: AppInfo[];
  metrics: SpringboardMetrics;
  reduceTransparency?: boolean;
  hideIconImages?: boolean;
  onOpen: (id: string, origin: AppOrigin) => void;
}

export const Dock = memo(function Dock({ apps, metrics, reduceTransparency = false, hideIconImages, onOpen }: DockProps) {
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
        disableBackdrop={reduceTransparency}
        className="flex items-center justify-around rounded-[var(--radius-card)] px-2 py-2"
        data-testid="dock-material"
      >
        {apps.map((app) => (
          <AppIcon key={app.id} app={app} hideLabel metrics={metrics} hideIconImages={hideIconImages} onOpen={onOpen} />
        ))}
      </Material>
    </div>
  );
});
