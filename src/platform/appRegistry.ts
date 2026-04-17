import type { ComponentType } from 'react';

export interface AppRegistryEntry {
  id: string;
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
