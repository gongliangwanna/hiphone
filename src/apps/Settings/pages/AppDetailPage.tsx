import { useEffect, useMemo, useState } from 'react';
import { Check, ImagePlus, RotateCcw } from 'lucide-react';
import {
  getResolvedAppMetadata,
  type ResolvedAppMetadata,
} from '@/platform/appMetadataResolver';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import {
  calculateAppStorageUsage,
  type AppStorageUsage,
} from '@/platform/storage/calculateAppStorageUsage';
import { formatByteSize } from '@/platform/utils/formatters';
import { List, ListRow, ListSection } from '@/system';
import { useSettingsNavStore } from '../settingsNavStore';

interface AppDetailPageProps {
  params?: Record<string, string>;
}

function emptyUsage(appId: string): AppStorageUsage {
  return {
    appId,
    appBytes: 0,
    dataBytes: 0,
    totalBytes: 0,
  };
}

function formatKnownStorageSize(bytes: number): string {
  return bytes > 0 ? formatByteSize(bytes) : '0 B';
}

function formatAppPackageSize(
  app: ResolvedAppMetadata,
  bytes: number,
): string {
  if (bytes > 0) return formatByteSize(bytes);
  return app.kind === 'user' ? '0 B' : '内置';
}

function formatTotalStorageSize(
  app: ResolvedAppMetadata,
  usage: AppStorageUsage,
): string {
  if (usage.totalBytes > 0 && (app.kind === 'user' || usage.appBytes > 0)) {
    return formatByteSize(usage.totalBytes);
  }

  return app.kind === 'user' ? formatKnownStorageSize(usage.totalBytes) : '内置';
}

export function AppDetailPage({ params }: AppDetailPageProps) {
  const appId = params?.appId;
  const push = useSettingsNavStore((state) => state.push);
  const profiles = useAppProfileStore((state) => state.profiles);
  const setName = useAppProfileStore((state) => state.setName);
  const restoreDefault = useAppProfileStore((state) => state.restoreDefault);
  const installedApps = useInstalledUserAppsStore((state) => state.apps);
  const [nameInput, setNameInput] = useState('');
  const [usage, setUsage] = useState<AppStorageUsage | null>(null);

  const app = useMemo(
    () => (appId ? getResolvedAppMetadata(appId) : undefined),
    [appId, profiles, installedApps],
  );

  useEffect(() => {
    setNameInput(app?.displayName ?? '');
  }, [app?.id, app?.displayName]);

  useEffect(() => {
    if (!app) {
      setUsage(null);
      return;
    }

    let alive = true;
    setUsage(null);

    void calculateAppStorageUsage(app.id)
      .then((nextUsage) => {
        if (alive) setUsage(nextUsage);
      })
      .catch(() => {
        if (alive) setUsage(emptyUsage(app.id));
      });

    return () => {
      alive = false;
    };
  }, [app]);

  if (!app) {
    return <MissingAppState />;
  }

  const currentUsage = usage ?? emptyUsage(app.id);

  const syncInputToResolvedName = () => {
    const resolved = getResolvedAppMetadata(app.id);
    setNameInput(resolved?.displayName ?? app.originalName);
  };

  const handleSaveName = () => {
    setName(app.id, nameInput);
    syncInputToResolvedName();
  };

  const handleRestoreDefault = () => {
    restoreDefault(app.id);
    syncInputToResolvedName();
  };

  return (
    <div data-testid="app-detail-page" className="h-full min-h-0">
      <List>
        <AppHero
          app={app}
          onEditIcon={() =>
            push({ page: 'appIconEditor', params: { appId: app.id } })
          }
        />

        <ListSection title="名称">
          <div className="relative">
            <div
              className="flex w-full items-center gap-3 px-4"
              style={{ minHeight: 54 }}
            >
              <input
                aria-label="显示名称"
                data-testid="app-detail-name-input"
                value={nameInput}
                onChange={(event) => setNameInput(event.target.value)}
                className="min-w-0 flex-1 bg-transparent outline-none"
                style={{
                  color: 'var(--color-label)',
                  fontSize: 'var(--font-size-body)',
                }}
              />
              <button
                type="button"
                data-testid="app-detail-save-name"
                onClick={handleSaveName}
                className="flex flex-shrink-0 items-center gap-1.5"
                style={{
                  color: 'var(--color-systemBlue)',
                  fontSize: 'var(--font-size-callout)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}
              >
                <Check size={16} strokeWidth={2.4} />
                <span>保存名称</span>
              </button>
            </div>
          </div>
        </ListSection>

        <ListSection>
          <button
            type="button"
            data-testid="app-detail-restore-default"
            onClick={handleRestoreDefault}
            className="flex w-full items-center gap-3 px-4 text-left"
            style={{ minHeight: 50, color: 'var(--color-systemRed)' }}
          >
            <RotateCcw size={18} strokeWidth={2.2} />
            <span
              style={{
                fontSize: 'var(--font-size-body)',
                fontWeight: 'var(--font-weight-regular)',
              }}
            >
              恢复默认名称与图标
            </span>
          </button>
        </ListSection>

        <ListSection title="存储">
          <ListRow
            title="App 大小"
            detail={formatAppPackageSize(app, currentUsage.appBytes)}
          />
          <ListRow
            title="文稿与数据"
            detail={formatKnownStorageSize(currentUsage.dataBytes)}
          />
          <ListRow
            title="总占用"
            detail={formatTotalStorageSize(app, currentUsage)}
            isLast
          />
        </ListSection>
      </List>
    </div>
  );
}

function AppHero({
  app,
  onEditIcon,
}: {
  app: ResolvedAppMetadata;
  onEditIcon: () => void;
}) {
  return (
    <section className="mb-6 flex flex-col items-center px-4 pt-3 text-center">
      <div
        className="flex items-center justify-center overflow-hidden"
        style={{
          width: 92,
          height: 92,
          borderRadius: 20,
          backgroundColor: 'var(--color-systemGray5)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.14)',
        }}
      >
        {app.displayIcon ? (
          <img
            src={app.displayIcon}
            alt={`${app.displayName} 图标`}
            className="h-full w-full object-cover"
          />
        ) : (
          <span
            style={{
              color: 'var(--color-secondaryLabel)',
              fontSize: 34,
              fontWeight: 'var(--font-weight-semibold)',
            }}
          >
            {app.displayName.slice(0, 1)}
          </span>
        )}
      </div>
      <div
        className="mt-3 max-w-full truncate"
        style={{
          color: 'var(--color-label)',
          fontSize: 'var(--font-size-title3)',
          fontWeight: 'var(--font-weight-semibold)',
        }}
      >
        {app.displayName}
      </div>
      <button
        type="button"
        data-testid="app-detail-edit-icon"
        onClick={onEditIcon}
        className="mt-3 flex items-center gap-1.5 rounded-full px-4"
        style={{
          minHeight: 34,
          backgroundColor: 'rgba(0,122,255,0.12)',
          color: 'var(--color-systemBlue)',
          fontSize: 'var(--font-size-callout)',
          fontWeight: 'var(--font-weight-semibold)',
        }}
      >
        <ImagePlus size={16} strokeWidth={2.2} />
        <span>编辑图标</span>
      </button>
    </section>
  );
}

function MissingAppState() {
  return (
    <div
      data-testid="app-detail-empty"
      className="flex h-full items-center justify-center px-8 text-center"
    >
      <div>
        <div
          className="mx-auto mb-4 flex items-center justify-center"
          style={{
            width: 76,
            height: 76,
            borderRadius: 18,
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-tertiaryLabel)',
            fontSize: 32,
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          ?
        </div>
        <div
          style={{
            color: 'var(--color-label)',
            fontSize: 'var(--font-size-title3)',
            fontWeight: 'var(--font-weight-semibold)',
          }}
        >
          App 不存在
        </div>
      </div>
    </div>
  );
}
