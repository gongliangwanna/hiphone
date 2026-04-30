import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import {
  listResolvedAppMetadata,
  type AppKind,
  type ResolvedAppMetadata,
} from '@/platform/appMetadataResolver';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import {
  calculateAllAppStorageUsage,
  type AppStorageUsage,
} from '@/platform/storage/calculateAppStorageUsage';
import { formatByteSize } from '@/platform/utils/formatters';
import { List, ListSection } from '@/system';
import { useSettingsNavStore } from '../settingsNavStore';

const KIND_LABEL: Record<AppKind, string> = {
  system: '系统 App',
  preinstalled: '预装 App',
  user: '用户安装 App',
};

const KIND_ORDER: AppKind[] = ['system', 'preinstalled', 'user'];

export function AppSettingsPage() {
  const push = useSettingsNavStore((state) => state.push);
  const installedApps = useInstalledUserAppsStore((state) => state.apps);
  const profiles = useAppProfileStore((state) => state.profiles);
  const [query, setQuery] = useState('');
  const [usageById, setUsageById] = useState<Record<string, AppStorageUsage>>({});

  const apps = useMemo(
    () => listResolvedAppMetadata(),
    [installedApps, profiles],
  );
  const appIdsKey = useMemo(() => apps.map((app) => app.id).join('|'), [apps]);

  useEffect(() => {
    let alive = true;
    const appIds = apps.map((app) => app.id);

    void calculateAllAppStorageUsage(appIds)
      .then((usage) => {
        if (alive) setUsageById(usage);
      })
      .catch(() => {
        if (alive) setUsageById({});
      });

    return () => {
      alive = false;
    };
  }, [apps, appIdsKey]);

  const filteredApps = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return apps;

    return apps.filter((app) =>
      [app.displayName, app.originalName, app.id].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [apps, query]);

  const groups = KIND_ORDER.map((kind) => ({
    kind,
    apps: filteredApps.filter((app) => app.kind === kind),
  })).filter((group) => group.apps.length > 0);

  return (
    <div data-testid="app-settings-page" className="h-full min-h-0">
      <List>
        <div
          className="mb-4 flex items-center gap-2 px-3"
          style={{
            height: 36,
            borderRadius: 10,
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-secondaryLabel)',
          }}
        >
          <Search size={16} strokeWidth={2} />
          <input
            data-testid="app-settings-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索"
            className="min-w-0 flex-1 bg-transparent outline-none"
            style={{
              color: 'var(--color-label)',
              fontSize: 15,
            }}
          />
        </div>

        {groups.map((group) => (
          <ListSection key={group.kind} title={KIND_LABEL[group.kind]}>
            {group.apps.map((app, index) => (
              <AppSettingsRow
                key={app.id}
                app={app}
                usage={usageById[app.id]}
                isLast={index === group.apps.length - 1}
                onClick={() =>
                  push({ page: 'appDetail', params: { appId: app.id } })
                }
              />
            ))}
          </ListSection>
        ))}
      </List>
    </div>
  );
}

interface AppSettingsRowProps {
  app: ResolvedAppMetadata;
  usage?: AppStorageUsage;
  isLast: boolean;
  onClick: () => void;
}

function AppSettingsRow({
  app,
  usage,
  isLast,
  onClick,
}: AppSettingsRowProps) {
  return (
    <div className="relative">
      <button
        type="button"
        data-testid={`app-settings-row-${app.id}`}
        onClick={onClick}
        className="flex w-full items-center justify-between gap-3 pl-4 pr-4"
        style={{
          minHeight: 58,
          cursor: 'pointer',
        }}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div
            className="flex flex-shrink-0 items-center justify-center overflow-hidden"
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              backgroundColor: 'var(--color-systemGray5)',
            }}
          >
            {app.displayIcon ? (
              <img
                src={app.displayIcon}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span
                style={{
                  color: 'var(--color-secondaryLabel)',
                  fontSize: 16,
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                {app.displayName.slice(0, 1)}
              </span>
            )}
          </div>
          <span
            className="min-w-0 flex-1 truncate text-left"
            style={{
              color: 'var(--color-label)',
              fontSize: 'var(--font-size-body)',
            }}
          >
            {app.displayName}
          </span>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          <span
            className="max-w-[96px] truncate text-right"
            style={{
              color: 'var(--color-secondaryLabel)',
              fontSize: 'var(--font-size-body)',
            }}
          >
            {formatByteSize(usage?.totalBytes ?? 0)}
          </span>
          <svg
            width="8"
            height="13"
            viewBox="0 0 8 13"
            fill="none"
            style={{ opacity: 0.3 }}
          >
            <path
              d="M1 1L6.5 6.5L1 12"
              stroke="var(--color-label)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>

      {!isLast && (
        <div
          className="absolute bottom-0 right-0"
          style={{
            left: 64,
            height: '0.5px',
            backgroundColor: 'var(--color-separator)',
          }}
        />
      )}
    </div>
  );
}
