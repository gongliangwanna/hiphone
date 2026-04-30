import { FAKE_USER_APP_ID, FAKE_USER_APP_NAME } from '@/platform/userApp/fakeUserApp';

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

export const DEFAULT_USER_APP_ICON = `${SYSTEM_ICON_BASE}/tips.jpg`;

/** Implemented iOS-style system apps — page 0 */
export const systemApps: AppInfo[] = [
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

const devPreinstalledApps: AppInfo[] = import.meta.env.DEV
  ? [
      {
        id: FAKE_USER_APP_ID,
        name: FAKE_USER_APP_NAME,
        icon: `${SYSTEM_ICON_BASE}/tips.jpg`,
        page: 1,
        kind: 'preinstalled',
      },
    ]
  : [];

/** Implemented non-system apps — page 1 */
export const preinstalledApps: AppInfo[] = [
  { id: 'gomoku', name: '五子棋', icon: `${CN_ICON_BASE}/gomoku.svg`, page: 1, kind: 'preinstalled' },
  { id: 'ai-app-builder', name: 'AI 工坊', icon: `${SYSTEM_ICON_BASE}/shortcuts.jpg`, page: 1, kind: 'preinstalled' },
  ...devPreinstalledApps,
];

/** Dock apps — only implemented entries */
export const dockApps: AppInfo[] = [
  { id: 'settings', name: '设置', icon: `${SYSTEM_ICON_BASE}/settings.jpg`, page: 0, kind: 'system', isDock: true },
  { id: 'safari-dock', name: 'Safari', icon: `${SYSTEM_ICON_BASE}/safari.jpg`, page: 0, kind: 'system', isDock: true },
  { id: 'music', name: '音乐', icon: `${SYSTEM_ICON_BASE}/music.jpg`, page: 0, kind: 'system', isDock: true },
  { id: 'xingyu', name: '可爱信', icon: `${CN_ICON_BASE}/xingyu.svg`, page: 0, kind: 'preinstalled', isDock: true },
];

/** All builtin apps in the home-screen grid, excluding Dock-only entries. */
export const apps: AppInfo[] = [...systemApps, ...preinstalledApps];

/** Dock entries. */
export const dock: AppInfo[] = dockApps;

export const allCatalogApps: AppInfo[] = [...apps, ...dock];

export function getCatalogAppInfoById(id: string): AppInfo | undefined {
  return allCatalogApps.find((app) => app.id === id);
}
