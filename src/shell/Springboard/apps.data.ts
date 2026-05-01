import {
  DEFAULT_USER_APP_ICON,
  apps as catalogApps,
  dock as catalogDock,
  getCatalogAppInfoById,
  type AppInfo,
  type AppKind,
} from '@/platform/appCatalog';
import {
  canonicalizeAppId,
  useAppProfileStore,
} from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

export type { AppInfo, AppKind };

function withProfile(app: AppInfo): AppInfo {
  const canonicalId = canonicalizeAppId(app.id);
  const profile = useAppProfileStore.getState().getProfile(canonicalId);

  return {
    ...app,
    id: canonicalId,
    name: profile?.customName ?? app.name,
    icon: profile?.customIconDataUrl ?? app.icon,
  };
}

function removeAppsPresentInDock(
  appInfos: AppInfo[],
  dockIds: Iterable<string> = DEFAULT_DOCK_IDS,
): AppInfo[] {
  const blocklist = new Set<string>();
  for (const id of dockIds) blocklist.add(canonicalizeAppId(id));
  const seen = new Set<string>();
  const result: AppInfo[] = [];

  for (const app of appInfos) {
    const canonicalId = canonicalizeAppId(app.id);
    if (blocklist.has(canonicalId)) continue;
    if (seen.has(canonicalId)) continue;
    seen.add(canonicalId);
    result.push({ ...app, id: canonicalId });
  }

  return result;
}

/** Canonical ids of the catalog default dock entries. */
export const DEFAULT_DOCK_IDS: string[] = catalogDock.map((app) =>
  canonicalizeAppId(app.id),
);

/** All apps (grid only, no dock — using the catalog default dock). */
export const apps: AppInfo[] = removeAppsPresentInDock(catalogApps).map(
  withProfile,
);

/** Catalog default dock with profiles applied. */
export const dock: AppInfo[] = catalogDock.map(withProfile);

export function getAppInfoById(id: string): AppInfo | undefined {
  const app =
    getCatalogAppInfoById(id) ??
    getCatalogAppInfoById(canonicalizeAppId(id));
  return app ? withProfile(app) : undefined;
}

/**
 * Resolve a list of canonical dock ids into renderable `AppInfo`s, with
 * user profile (custom name / icon) applied. Unknown ids are dropped.
 */
export function getDockAppsFromIds(dockIds: string[]): AppInfo[] {
  const seen = new Set<string>();
  const out: AppInfo[] = [];
  for (const id of dockIds) {
    const canonical = canonicalizeAppId(id);
    if (seen.has(canonical)) continue;
    const info = getAppInfoById(canonical);
    if (!info) continue;
    seen.add(canonical);
    out.push({ ...info, id: canonical });
  }
  return out;
}

/**
 * All builtin apps (grid + dock entries) deduped by canonical id, with
 * profiles applied. Used by stores that need to look up any canonical id
 * regardless of whether it currently sits on the grid or in the dock.
 */
export function allBuiltinAppInfos(): AppInfo[] {
  const seen = new Set<string>();
  const out: AppInfo[] = [];
  for (const app of [...catalogApps, ...catalogDock]) {
    const canonical = canonicalizeAppId(app.id);
    if (seen.has(canonical)) continue;
    seen.add(canonical);
    out.push({ ...withProfile(app), id: canonical });
  }
  return out;
}

/** Available wallpapers */
export const wallpapers = [
  { id: 'ios-26-stock-01', src: '/resource/wallpapers/ios/ios-26-stock-01.jpg' },
  { id: 'ios-26-stock-02', src: '/resource/wallpapers/ios/ios-26-stock-02.jpg' },
  { id: 'ios-26-stock-03', src: '/resource/wallpapers/ios/ios-26-stock-03.jpg' },
  { id: 'ios-26-stock-04', src: '/resource/wallpapers/ios/ios-26-stock-04.jpg' },
  { id: 'ios-26-stock-05', src: '/resource/wallpapers/ios/ios-26-stock-05.jpg' },
  { id: 'ios-26-stock-06', src: '/resource/wallpapers/ios/ios-26-stock-06.jpg' },
  { id: 'ios-26-stock-07', src: '/resource/wallpapers/ios/ios-26-stock-07.jpg' },
];

/**
 * Combine builtin apps with installed user apps. Used by Springboard
 * instead of the static `apps` export so installs/uninstalls reflect
 * on the desktop without a page reload.
 *
 * Sources from BOTH `catalogApps` AND `catalogDock` so that dock-only
 * catalog entries (e.g. `settings`, `music`, `xingyu`) can also appear
 * on the grid once the user drags them out of the Dock. Without the
 * dock entries here, those apps would have no source row in the grid
 * pool and would silently vanish after a dock-out drag.
 */
export function getAppsWithUserInstalled(
  dockIds: Iterable<string> = DEFAULT_DOCK_IDS,
): AppInfo[] {
  const userApps = useInstalledUserAppsStore.getState().apps;
  const userInfos: AppInfo[] = userApps.map((u) => ({
    id: u.id,
    name: u.name,
    icon: u.iconDataUrl ?? DEFAULT_USER_APP_ICON,
    page: u.page,
    kind: 'user',
  }));
  return removeAppsPresentInDock(
    [...catalogApps, ...catalogDock, ...userInfos],
    dockIds,
  ).map(withProfile);
}
