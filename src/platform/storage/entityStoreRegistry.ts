import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * Registry that manages per-entity Zustand store instances.
 *
 * Each entity (player or AI character) gets its own store instance,
 * backed by a namespaced IDB key. The player's data keeps the original
 * key (backward compatible), while AI characters use a `::char-{id}` suffix.
 *
 * Usage:
 * ```ts
 * const notesRegistry = new EntityStoreRegistry(createNotesStore, 'hiPhone-notes');
 * const store = notesRegistry.getStore(phoneOwnerId); // null = player
 * ```
 */
export class EntityStoreRegistry<T> {
  private stores = new Map<string, UseBoundStore<StoreApi<T>>>();

  constructor(
    private factory: (persistName: string) => UseBoundStore<StoreApi<T>>,
    private baseName: string,
  ) {}

  /** Resolve the IDB persist key for a given entity. */
  private resolveKey(entityId: string | null): string {
    return entityId ? `${this.baseName}::char-${entityId}` : this.baseName;
  }

  /** Get or lazily create the store for the given entity. */
  getStore(entityId: string | null): UseBoundStore<StoreApi<T>> {
    const key = this.resolveKey(entityId);
    let store = this.stores.get(key);
    if (!store) {
      store = this.factory(key);
      this.stores.set(key, store);
    }
    return store;
  }

  /** Evict a cached store to free memory. */
  evict(entityId: string): void {
    const key = this.resolveKey(entityId);
    this.stores.delete(key);
  }
}
