import { useState } from 'react';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { uninstall } from '@/platform/userApp/installer';
import { InstalledAppRow } from './components/InstalledAppRow';
import { UninstallConfirm } from './components/UninstallConfirm';

type Dialog = { appId: string; appName: string } | null;

export function ManagePage() {
  const apps = useInstalledUserAppsStore((s) => s.apps);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const request = (id: string): void => {
    const app = apps.find((a) => a.id === id);
    if (!app) return;
    setError(null);
    setDialog({ appId: id, appName: app.name });
  };

  const doUninstall = async (): Promise<void> => {
    if (!dialog || pending) return;
    const { appId } = dialog;
    setPending(true);
    try {
      await uninstall(appId);
      setDialog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setDialog(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      data-testid="appstore-manage-page"
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        minHeight: 0,
      }}
    >
      {apps.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--spacing-6)',
            color: 'var(--color-secondaryLabel)',
            fontSize: 14,
            textAlign: 'center',
          }}
        >
          尚未安装用户 App。到"上传"页选一个 zip 开始。
        </div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {apps.map((app) => (
            <InstalledAppRow
              key={app.id}
              app={app}
              onRequestUninstall={request}
            />
          ))}
        </div>
      )}

      {error && (
        <div
          style={{
            margin: 'var(--spacing-3)',
            padding: 'var(--spacing-3)',
            borderRadius: 8,
            backgroundColor: 'rgba(255, 59, 48, 0.12)',
            color: 'var(--color-label)',
            fontSize: 14,
          }}
        >
          ❌ 卸载失败：{error}
        </div>
      )}

      {dialog && (
        <UninstallConfirm
          appName={dialog.appName}
          onConfirm={doUninstall}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}
