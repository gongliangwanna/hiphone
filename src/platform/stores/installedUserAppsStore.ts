import { create } from 'zustand';
import type { SimpleToolInfo } from '@/platform/userApp/manifest';

export interface InstalledUserApp {
  id: string;
  name: string;
  /** Data URL constructed at install from icon.png; null = use platform default icon. */
  iconDataUrl: string | null;
  page: number;
  perspectiveAware: boolean;
  /** From manifest.version (required by manifest schema). */
  version: string;
  /** Unix ms when the app was installed (Date.now() at install time). */
  installedAt: number;
  /** Sum of compiled bundle byte lengths (UTF-8); 0 for legacy records. */
  sizeBytes: number;
  /** Free-text developer / author name from manifest.author. */
  author?: string;
  /** Short app description from manifest.description. */
  description?: string;
  /** Release notes from manifest.changelog (preserves newlines). */
  changelog?: string;
  /** Static tool catalog from manifest.aiTools. Used by Settings → AI 工具
   *  to show toggles for installed-but-not-yet-mounted apps (whose
   *  registerTools call hasn't fired yet). Source of truth at runtime
   *  is still toolRegistry; this is a static fallback. */
  aiTools?: SimpleToolInfo[];
}

interface InstalledUserAppsState {
  apps: InstalledUserApp[];
  add(app: InstalledUserApp): void;
  remove(id: string): void;
  replaceAll(apps: InstalledUserApp[]): void;
}

/**
 * In-memory registry of installed user apps.
 *
 * Not persisted via Zustand (the IDB `app-meta` store is the source of
 * truth). `loadInstalledApps()` rebuilds this store on startup from
 * `app-meta`. Springboard subscribes so icons re-render on install /
 * uninstall without a page reload.
 */
export const useInstalledUserAppsStore = create<InstalledUserAppsState>((set) => ({
  apps: [],
  add: (app) =>
    set((state) => ({
      apps: [...state.apps.filter((a) => a.id !== app.id), app],
    })),
  remove: (id) =>
    set((state) => ({
      apps: state.apps.filter((a) => a.id !== id),
    })),
  replaceAll: (apps) => set({ apps }),
}));
