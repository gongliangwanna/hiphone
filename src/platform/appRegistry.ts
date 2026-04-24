import type { ComponentType } from 'react';

export interface AppRegistryEntry {
  id: string;
  /** Human-readable display name (e.g. "设置", "可爱信"). Falls back to id in consumers when missing. */
  name: string;
  type: 'builtin' | 'user';
  component: ComponentType;
  /** True if the app natively handles "view another's phone" perspective switching. */
  perspectiveAware: boolean;
  /** True if the app has global/shared data (shown as-is when viewing another's phone). */
  globalData: boolean;
}

class AppRegistry {
  private entries = new Map<string, AppRegistryEntry>();

  register(entry: AppRegistryEntry): void {
    this.entries.set(entry.id, entry);
  }

  unregister(id: string): void {
    this.entries.delete(id);
  }

  get(id: string): AppRegistryEntry | undefined {
    return this.entries.get(id);
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  list(): AppRegistryEntry[] {
    return [...this.entries.values()];
  }
}

export const appRegistry = new AppRegistry();

/**
 * Resolve an app id to its human-readable display name. Falls back to the id
 * itself for apps that haven't been registered (e.g. stale references in
 * persisted state after uninstall).
 */
export function getAppDisplayName(id: string): string {
  return appRegistry.get(id)?.name ?? id;
}
