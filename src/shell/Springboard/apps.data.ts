import { FAKE_USER_APP_ID, FAKE_USER_APP_NAME } from '@/platform/userApp/fakeUserApp';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

export type AppKind = 'system' | 'preinstalled' | 'user';

export interface AppInfo {
  id: string;
  name: string;
  icon: string;
  page: number;
  kind?: AppKind;
  isDock?: boolean;
}

const SYSTEM_ICON_BASE = '/resource/icons/ios-system';
const CN_ICON_BASE = '/resource/icons/popular-cn';

/** Implemented iOS-style system apps — page 0 */
const systemApps: AppInfo[] = [
  { id: 'calendar', name: '日历', icon: `${SYSTEM_ICON_BASE}/calendar.jpg`, page: 0, kind: 'system' },
  { id: 'photos', name: '照片', icon: `${SYSTEM_ICON_BASE}/photos.jpg`, page: 0, kind: 'system' },
  { id: 'camera', name: '相机', icon: `${SYSTEM_ICON_BASE}/camera.jpg`, page: 0, kind: 'system' },
  { id: 'weather', name: '天气', icon: `${SYSTEM_ICON_BASE}/weather.jpg`, page: 0, kind: 'system' },
  { id: 'maps', name: '地图', icon: `${SYSTEM_ICON_BASE}/maps.jpg`, page: 0, kind: 'system' },
  { id: 'notes', name: '备忘录', icon: `${SYSTEM_ICON_BASE}/notes.jpg`, page: 0, kind: 'system' },
  { id: 'app-store', name: 'App Store', icon: `${SYSTEM_ICON_BASE}/itunes-store.jpg`, page: 0, kind: 'system' },
  { id: 'safari', name: 'Safari', icon: `${SYSTEM_ICON_BASE}/safari.jpg`, page: 0, kind: 'system' },
  { id: 'translate', name: '翻译', icon: `${SYSTEM_ICON_BASE}/translate.jpg`, page: 0, kind: 'system' },
];

/** Implemented non-system apps — page 1 */
const cnApps: AppInfo[] = [
  { id: 'gomoku', name: '五子棋', icon: `${CN_ICON_BASE}/gomoku.svg`, page: 1, kind: 'preinstalled' },
  { id: 'ai-app-builder', name: 'AI 工坊', icon: `${SYSTEM_ICON_BASE}/shortcuts.jpg`, page: 1, kind: 'preinstalled' },
];

// [DEV] Fake user app icon — for M1 pipeline verification. In production
// builds, import.meta.env.DEV is false and Vite's dead-code elimination
// drops this entry entirely. Constants imported from fakeUserApp.ts so the
// id/name cannot drift between the two files.
if (import.meta.env.DEV) {
  cnApps.push({
    id: FAKE_USER_APP_ID,
    name: FAKE_USER_APP_NAME,
    icon: `${SYSTEM_ICON_BASE}/tips.jpg`,
    page: 1,
    kind: 'preinstalled',
  });
}

/** Dock apps — only implemented entries */
const dockApps: AppInfo[] = [
  { id: 'settings', name: '设置', icon: `${SYSTEM_ICON_BASE}/settings.jpg`, page: 0, kind: 'system', isDock: true },
  { id: 'safari-dock', name: 'Safari', icon: `${SYSTEM_ICON_BASE}/safari.jpg`, page: 0, kind: 'system', isDock: true },
  { id: 'music', name: '音乐', icon: `${SYSTEM_ICON_BASE}/music.jpg`, page: 0, kind: 'system', isDock: true },
  { id: 'xingyu', name: '可爱信', icon: `${CN_ICON_BASE}/xingyu.svg`, page: 0, kind: 'system', isDock: true },
];

/** All apps (grid only, no dock) */
export const apps: AppInfo[] = [...systemApps, ...cnApps];

/** Dock apps */
export const dock: AppInfo[] = dockApps;

const allAppEntries: AppInfo[] = [...apps, ...dock];

export function getAppInfoById(id: string): AppInfo | undefined {
  return allAppEntries.find((app) => app.id === id);
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

const DEFAULT_USER_APP_ICON = `${SYSTEM_ICON_BASE}/tips.jpg`;

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
