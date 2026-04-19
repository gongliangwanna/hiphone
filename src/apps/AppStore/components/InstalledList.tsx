import { useMemo } from 'react';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';
import { InstalledAppRow } from './InstalledAppRow';

interface Props {
  apps: InstalledUserApp[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function InstalledList({ apps, onOpen, onDelete, onLongPress }: Props) {
  const sorted = useMemo(
    () => [...apps].sort((a, b) => b.installedAt - a.installedAt),
    [apps],
  );

  return (
    <div data-testid="appstore-installed-list" className="flex-1 overflow-y-auto">
      <div className="px-4 pt-3 pb-2 text-[13px] text-[var(--color-secondaryLabel)] uppercase tracking-wide">
        已装 {apps.length} 个 App
      </div>
      {sorted.map((app) => (
        <InstalledAppRow
          key={app.id}
          app={app}
          onOpen={onOpen}
          onDelete={onDelete}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
