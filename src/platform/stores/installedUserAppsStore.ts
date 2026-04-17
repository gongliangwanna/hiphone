import { create } from 'zustand';

export interface InstalledUserApp {
  id: string;
  name: string;
  /** Data URL constructed at install from icon.png; null = use platform default icon. */
  iconDataUrl: string | null;
  page: number;
  perspectiveAware: boolean;
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
