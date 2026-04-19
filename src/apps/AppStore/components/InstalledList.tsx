import { useMemo } from 'react';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';
import { InstalledAppRow } from './InstalledAppRow';

interface Props {
  apps: InstalledUserApp[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onLongPress: (id: string) => void;
  onDetail: (id: string) => void;
}

export function InstalledList({ apps, onOpen, onDelete, onLongPress, onDetail }: Props) {
  const sorted = useMemo(
    () => [...apps].sort((a, b) => b.installedAt - a.installedAt),
    [apps],
  );

  return (
    <div data-testid="appstore-installed-list" className="flex-1 overflow-y-auto">
      <div className="px-5 pt-3 pb-2 text-[13px] text-[var(--color-secondaryLabel)] uppercase tracking-wide">
        已装 {apps.length} 款
      </div>
      <div className="mx-4 mb-4 bg-[var(--color-systemBackground)] rounded-[14px] overflow-hidden">
        {sorted.map((app, index) => (
          <div key={app.id} className={index > 0 ? 'border-t border-[var(--color-separator)]' : ''}>
            <InstalledAppRow
              app={app}
              onOpen={onOpen}
              onDelete={onDelete}
              onLongPress={onLongPress}
              onDetail={onDetail}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
