import {
  DEFAULT_USER_APP_ICON,
  apps as catalogApps,
  dock as catalogDock,
  getCatalogAppInfoById,
  type AppInfo,
  type AppKind,
} from '@/platform/appCatalog';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

export type { AppInfo, AppKind };

/** All apps (grid only, no dock) */
export const apps: AppInfo[] = [...catalogApps];

/** Dock apps */
export const dock: AppInfo[] = [...catalogDock];

export function getAppInfoById(id: string): AppInfo | undefined {
  return getCatalogAppInfoById(id);
}

/** Available wallpapers */
export const wallpapers = [
  { id: 'ios-26-stock-01', src: '/resource/wallpapers/ios/ios-26-stock-01.png' },
  { id: 'ios-26-stock-02', src: '/resource/wallpapers/ios/ios-26-stock-02.png' },
  { id: 'ios-26-stock-03', src: '/resource/wallpapers/ios/ios-26-stock-03.png' },
  { id: 'ios-26-stock-04', src: '/resource/wallpapers/ios/ios-26-stock-04.png' },
  { id: 'ios-26-stock-05', src: '/resource/wallpapers/ios/ios-26-stock-05.png' },
  { id: 'ios-26-stock-06', src: '/resource/wallpapers/ios/ios-26-stock-06.png' },
  { id: 'ios-26-stock-07', src: '/resource/wallpapers/ios/ios-26-stock-07.png' },
];

/**
 * Combine builtin apps with installed user apps. Used by Springboard
 * instead of the static `apps` export so installs/uninstalls reflect
 * on the desktop without a page reload.
 */
export function getAppsWithUserInstalled(): AppInfo[] {
  const userApps = useInstalledUserAppsStore.getState().apps;
  const userInfos: AppInfo[] = userApps.map((u) => ({
    id: u.id,
    name: u.name,
    icon: u.iconDataUrl ?? DEFAULT_USER_APP_ICON,
    page: u.page,
    kind: 'user',
  }));
  return [...apps, ...userInfos];
}
