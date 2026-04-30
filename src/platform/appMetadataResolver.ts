import { canonicalizeAppId, useAppProfileStore } from './stores/appProfileStore';
import {
  apps as builtinApps,
  dock,
  getAppsWithUserInstalled,
  type AppInfo,
  type AppKind,
} from '@/shell/Springboard/apps.data';

export type { AppKind };

export interface ResolvedAppMetadata {
  id: string;
  kind: AppKind;
  originalName: string;
  displayName: string;
  originalIcon: string | null;
  displayIcon: string | null;
  canRestoreProfile: boolean;
}

function inferKind(app: AppInfo): AppKind {
  if (app.kind) return app.kind;
  const builtin = builtinApps.find((candidate) => candidate.id === app.id);
  return builtin?.kind ?? 'user';
}

function toResolved(app: AppInfo): ResolvedAppMetadata {
  const id = canonicalizeAppId(app.id);
  const profile = useAppProfileStore.getState().getProfile(id);
  return {
    id,
    kind: inferKind(app),
    originalName: app.name,
    displayName: profile?.customName ?? app.name,
    originalIcon: app.icon ?? null,
    displayIcon: profile?.customIconDataUrl ?? app.icon ?? null,
    canRestoreProfile: !!profile,
  };
}

export function listResolvedAppMetadata(): ResolvedAppMetadata[] {
  const byId = new Map<string, ResolvedAppMetadata>();
  const all = [...getAppsWithUserInstalled(), ...dock];
  for (const app of all) {
    const id = canonicalizeAppId(app.id);
    if (!byId.has(id)) {
      byId.set(id, toResolved({ ...app, id }));
    }
  }
  return [...byId.values()];
}

export function getResolvedAppMetadata(
  appId: string,
): ResolvedAppMetadata | undefined {
  const canonicalId = canonicalizeAppId(appId);
  return listResolvedAppMetadata().find((app) => app.id === canonicalId);
}

export function resolveAppDisplayName(appId: string): string {
  return getResolvedAppMetadata(appId)?.displayName ?? canonicalizeAppId(appId);
}

export function resolveAppDisplayIcon(appId: string): string | null {
  return getResolvedAppMetadata(appId)?.displayIcon ?? null;
}
