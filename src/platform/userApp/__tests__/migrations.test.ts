import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { migrateS3ToS4Owner } from '../migrations';
import {
  appStorageSet,
  appStorageGet,
  type AppKvRecord,
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

function s3AppRec(appId: string, userKey: string, value: unknown): AppKvRecord {
  return { appId, scope: 'app', ownerId: '', userKey, value };
}
function s3GlobalRec(appId: string, userKey: string, value: unknown): AppKvRecord {
  return { appId, scope: 'global', ownerId: '', userKey, value };
}

describe('migrateS3ToS4Owner', () => {
  beforeEach(() => clearKv());

  it('migrates {appId}:{key} → {appId}:owner:me:{key}', async () => {
    await appStorageSet('todo', 'todo:items', s3AppRec('todo', 'items', [1, 2]));

    await migrateS3ToS4Owner();

    expect(await appStorageGet('todo', 'todo:items')).toBeUndefined();
    const migrated = await appStorageGet('todo', 'todo:owner:me:items');
    expect(migrated).toEqual({
      appId: 'todo',
      scope: 'owner',
      ownerId: 'me',
      userKey: 'items',
      value: [1, 2],
    });
  });

  it('migrates {appId}:__global__:{key} → {appId}:global:{key}', async () => {
    await appStorageSet('todo', 'todo:__global__:theme', s3GlobalRec('todo', 'theme', 'dark'));

    await migrateS3ToS4Owner();

    expect(await appStorageGet('todo', 'todo:__global__:theme')).toBeUndefined();
    const migrated = await appStorageGet('todo', 'todo:global:theme');
    expect(migrated).toEqual({
      appId: 'todo',
      scope: 'global',
      ownerId: '',
      userKey: 'theme',
      value: 'dark',
    });
  });

  it('is idempotent (S4-format data left alone)', async () => {
    const alreadyMigrated: AppKvRecord = {
      appId: 'todo', scope: 'owner', ownerId: 'me', userKey: 'items', value: ['existing'],
    };
    await appStorageSet('todo', 'todo:owner:me:items', alreadyMigrated);

    await migrateS3ToS4Owner();

    expect(await appStorageGet('todo', 'todo:owner:me:items')).toEqual(alreadyMigrated);
  });

  it('skips keys from unrelated store rows (no appId in value)', async () => {
    // Simulate an orphan with legal S4 shape but different appId:
    const other: AppKvRecord = {
      appId: 'other', scope: 'owner', ownerId: 'char-1', userKey: 'data', value: 1,
    };
    await appStorageSet('other', 'other:owner:char-1:data', other);

    await migrateS3ToS4Owner();

    expect(await appStorageGet('other', 'other:owner:char-1:data')).toEqual(other);
  });
});
