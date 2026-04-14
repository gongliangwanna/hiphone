import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { EntityStoreRegistry } from '../entityStoreRegistry';

interface TestState {
  items: string[];
  add: (item: string) => void;
}

function createTestStore(_persistName: string) {
  return create<TestState>()((set) => ({
    items: [],
    add: (item) => set((s) => ({ items: [...s.items, item] })),
  }));
}

describe('EntityStoreRegistry', () => {
  it('returns the same store for the same entity', () => {
    const registry = new EntityStoreRegistry(createTestStore, 'test-store');
    const store1 = registry.getStore(null);
    const store2 = registry.getStore(null);
    expect(store1).toBe(store2);
  });

  it('returns different stores for different entities', () => {
    const registry = new EntityStoreRegistry(createTestStore, 'test-store');
    const playerStore = registry.getStore(null);
    const aiStore = registry.getStore('soren');
    expect(playerStore).not.toBe(aiStore);
  });

  it('player store uses base key (no suffix)', () => {
    const keys: string[] = [];
    const factory = (key: string) => {
      keys.push(key);
      return createTestStore(key);
    };
    const registry = new EntityStoreRegistry(factory, 'hiPhone-notes');
    registry.getStore(null);
    expect(keys).toContain('hiPhone-notes');
  });

  it('AI store uses ::char-{id} suffix', () => {
    const keys: string[] = [];
    const factory = (key: string) => {
      keys.push(key);
      return createTestStore(key);
    };
    const registry = new EntityStoreRegistry(factory, 'hiPhone-notes');
    registry.getStore('soren');
    expect(keys).toContain('hiPhone-notes::char-soren');
  });

  it('stores are isolated from each other', () => {
    const registry = new EntityStoreRegistry(createTestStore, 'test-store');
    const playerStore = registry.getStore(null);
    const aiStore = registry.getStore('soren');

    playerStore.getState().add('player-item');
    aiStore.getState().add('ai-item');

    expect(playerStore.getState().items).toEqual(['player-item']);
    expect(aiStore.getState().items).toEqual(['ai-item']);
  });

  it('evict removes the cached store', () => {
    const registry = new EntityStoreRegistry(createTestStore, 'test-store');
    const store1 = registry.getStore('soren');
    store1.getState().add('item');

    registry.evict('soren');

    const store2 = registry.getStore('soren');
    expect(store2).not.toBe(store1);
    expect(store2.getState().items).toEqual([]); // fresh instance
  });
});
