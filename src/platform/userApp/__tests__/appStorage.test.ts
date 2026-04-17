import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  appStorageGet,
  appStorageSet,
  appStorageRemove,
  appStorageListByAppId,
  appStorageDeleteAllByAppId,
} from '../appStorage';
import { getDB, APP_KV_STORE } from '@/platform/storage/idbStorage';

async function clearKv(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(APP_KV_STORE, 'readwrite');
    tx.objectStore(APP_KV_STORE).clear();
    tx.oncomplete = () => resolve();
  });
}

describe('appStorage', () => {
  beforeEach(() => clearKv());

  it('set then get returns the value', async () => {
    await appStorageSet('todo', 'todo:items', {
      appId: 'todo',
      scope: 'app',
      ownerId: '',
      userKey: 'items',
      value: [1, 2, 3],
    });
    const got = await appStorageGet('todo', 'todo:items');
    expect(got).toEqual({
      appId: 'todo',
      scope: 'app',
      ownerId: '',
      userKey: 'items',
      value: [1, 2, 3],
    });
  });

  it('get returns undefined for missing key', async () => {
    expect(await appStorageGet('todo', 'todo:missing')).toBeUndefined();
  });

  it('remove deletes the value', async () => {
    await appStorageSet('todo', 'todo:x', {
      appId: 'todo', scope: 'app', ownerId: '', userKey: 'x', value: 1,
    });
    await appStorageRemove('todo', 'todo:x');
    expect(await appStorageGet('todo', 'todo:x')).toBeUndefined();
  });

  it('listByAppId returns all full keys for an appId', async () => {
    await appStorageSet('a', 'a:k1', { appId: 'a', scope: 'app', ownerId: '', userKey: 'k1', value: 1 });
    await appStorageSet('a', 'a:k2', { appId: 'a', scope: 'app', ownerId: '', userKey: 'k2', value: 2 });
    await appStorageSet('b', 'b:k1', { appId: 'b', scope: 'app', ownerId: '', userKey: 'k1', value: 3 });

    const keys = await appStorageListByAppId('a');
    expect(keys.sort()).toEqual(['a:k1', 'a:k2']);
  });

  it('deleteAllByAppId clears all rows for an appId only', async () => {
    await appStorageSet('a', 'a:k1', { appId: 'a', scope: 'app', ownerId: '', userKey: 'k1', value: 1 });
    await appStorageSet('b', 'b:k1', { appId: 'b', scope: 'app', ownerId: '', userKey: 'k1', value: 2 });

    await appStorageDeleteAllByAppId('a');

    expect(await appStorageGet('a', 'a:k1')).toBeUndefined();
    expect(await appStorageGet('b', 'b:k1')).toBeDefined();
  });
});
