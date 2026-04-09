import { AppScreen, Material, NavBar } from '@/system';
import { getAppInfoById } from '@/shell/Springboard/apps.data';

interface DemoAppProps {
  appId: string;
}

export function DemoApp({ appId }: DemoAppProps) {
  const app = getAppInfoById(appId);
  const appName = app?.name ?? 'App';

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <div className="flex h-full min-h-0 flex-col" data-testid={`demo-app-${appId}`}>
        <NavBar title={appName} variant="largeTitle" />

        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{
            paddingInline: 'var(--spacing-4)',
            paddingTop: 'var(--spacing-4)',
            paddingBottom: 'var(--app-safe-bottom)',
            gap: 'var(--spacing-4)',
          }}
        >
          <Material
            variant="chrome"
            className="overflow-hidden rounded-[var(--radius-card)]"
            style={{ padding: 'var(--spacing-5)' }}
          >
            <div className="flex items-center gap-4">
              {app?.icon ? (
                <img
                  src={app.icon}
                  alt={appName}
                  className="h-16 w-16 rounded-[18px] object-cover"
                  draggable={false}
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div
                  style={{
                    fontSize: 'var(--font-size-title3)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-label)',
                  }}
                >
                  {appName}
                </div>
                <p
                  className="mt-1"
                  style={{
                    marginBottom: 0,
                    color: 'var(--color-secondaryLabel)',
                    fontSize: 'var(--font-size-body)',
                    lineHeight: 1.45,
                  }}
                >
                  此 App 目前用于演示 iOS 风格的系统生命周期、退出和多任务切换。
                </p>
              </div>
            </div>
          </Material>

          <Material
            variant="regular"
            className="rounded-[var(--radius-card)]"
            style={{ padding: 'var(--spacing-5)' }}
          >
            <div
              style={{
                fontSize: 'var(--font-size-headline)',
                fontWeight: 'var(--font-weight-semibold)',
                color: 'var(--color-label)',
              }}
            >
              系统集成占位
            </div>
            <p
              className="mt-2"
              style={{
                marginBottom: 0,
                color: 'var(--color-secondaryLabel)',
                fontSize: 'var(--font-size-body)',
                lineHeight: 1.5,
              }}
            >
              这里保留了完整 App 宿主、状态栏安全区和底部系统手势，便于后续继续把真实页面接进来。
            </p>
          </Material>
        </div>
      </div>
    </AppScreen>
  );
}
