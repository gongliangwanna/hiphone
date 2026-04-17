import {
  appStorageGet,
  appStorageSet,
  appStorageRemove,
  appStorageListByAppId,
  type AppKvRecord,
} from '../appStorage';
import { getCurrentAppId } from './context';

/**
 * @hiphone/storage — user-app-facing key-value storage.
 *
 * M2 S3: flat namespace per app (`{appId}:{key}` for per-app,
 * `{appId}:__global__:{key}` for cross-context global). S4 will
 * add owner dimension between app and user key.
 *
 * IMPORTANT: appId is captured synchronously at call-entry before any
 * await, because withUserAppContext is synchronous. After the first
 * await, the stack may have unwound — but we've already captured appId.
 */

const APP_PREFIX = (appId: string) => `${appId}:`;
const GLOBAL_PREFIX = (appId: string) => `${appId}:__global__:`;

export async function get(key: string): Promise<unknown> {
  const appId = getCurrentAppId(); // capture sync before any await
  const fullKey = APP_PREFIX(appId) + key;
  const record = await appStorageGet(appId, fullKey);
  return record?.value;
}

export async function set(key: string, value: unknown): Promise<void> {
  const appId = getCurrentAppId(); // capture sync before any await
  const fullKey = APP_PREFIX(appId) + key;
  const record: AppKvRecord = {
    appId,
    scope: 'app',
    ownerId: '',
    userKey: key,
    value,
  };
  await appStorageSet(appId, fullKey, record);
}

export async function remove(key: string): Promise<void> {
  const appId = getCurrentAppId(); // capture sync before any await
  const fullKey = APP_PREFIX(appId) + key;
  await appStorageRemove(appId, fullKey);
}

export async function list(): Promise<string[]> {
  const appId = getCurrentAppId(); // capture sync before any await
  const fullKeys = await appStorageListByAppId(appId);
  const appPrefix = APP_PREFIX(appId);
  const globalPrefix = GLOBAL_PREFIX(appId);
  const out: string[] = [];
  for (const k of fullKeys) {
    if (k.startsWith(globalPrefix)) continue; // global keys excluded from per-app list()
    if (k.startsWith(appPrefix)) out.push(k.slice(appPrefix.length));
  }
  return out;
}

export async function globalGet(key: string): Promise<unknown> {
  const appId = getCurrentAppId(); // capture sync before any await
  const fullKey = GLOBAL_PREFIX(appId) + key;
  const record = await appStorageGet(appId, fullKey);
  return record?.value;
}

export async function globalSet(key: string, value: unknown): Promise<void> {
  const appId = getCurrentAppId(); // capture sync before any await
  const fullKey = GLOBAL_PREFIX(appId) + key;
  const record: AppKvRecord = {
    appId,
    scope: 'global',
    ownerId: '',
    userKey: key,
    value,
  };
  await appStorageSet(appId, fullKey, record);
}
