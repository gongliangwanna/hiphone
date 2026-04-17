import {
  appStorageGet,
  appStorageSet,
  appStorageRemove,
  appStorageListByAppId,
  type AppKvRecord,
} from '../appStorage';
import { getCurrentAppId } from './context';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';

/**
 * @hiphone/storage — user-app-facing key-value storage.
 *
 * Two namespaces:
 *   - Per-owner:   set/get/remove/list — `{appId}:owner:{ownerId}:{key}`
 *   - Global:      globalSet/globalGet — `{appId}:global:{key}`
 *
 * ownerId:
 *   - 'me' when player is viewing their own phone (phoneOwnerId === null)
 *   - 'char-{id}' when player is viewing a character's phone
 *
 * IMPORTANT: appId and ownerId are captured synchronously at call-entry
 * before any await, because withUserAppContext is synchronous. After the
 * first await, the stack may have unwound — but we've already captured both.
 */

function currentOwnerId(): string {
  const id = usePhoneOwnerStore.getState().phoneOwnerId;
  return id === null ? 'me' : `char-${id}`;
}

const OWNER_PREFIX = (appId: string, ownerId: string) =>
  `${appId}:owner:${ownerId}:`;
const GLOBAL_PREFIX = (appId: string) => `${appId}:global:`;

export async function get(key: string): Promise<unknown> {
  const appId = getCurrentAppId(); // capture sync before any await
  const ownerId = currentOwnerId(); // capture sync before any await
  const fullKey = OWNER_PREFIX(appId, ownerId) + key;
  const record = await appStorageGet(appId, fullKey);
  return record?.value;
}

export async function set(key: string, value: unknown): Promise<void> {
  const appId = getCurrentAppId(); // capture sync before any await
  const ownerId = currentOwnerId(); // capture sync before any await
  const fullKey = OWNER_PREFIX(appId, ownerId) + key;
  const record: AppKvRecord = {
    appId,
    scope: 'owner',
    ownerId,
    userKey: key,
    value,
  };
  await appStorageSet(appId, fullKey, record);
}

export async function remove(key: string): Promise<void> {
  const appId = getCurrentAppId(); // capture sync before any await
  const ownerId = currentOwnerId(); // capture sync before any await
  const fullKey = OWNER_PREFIX(appId, ownerId) + key;
  await appStorageRemove(appId, fullKey);
}

export async function list(): Promise<string[]> {
  const appId = getCurrentAppId(); // capture sync before any await
  const ownerId = currentOwnerId(); // capture sync before any await
  const ownerPrefix = OWNER_PREFIX(appId, ownerId);
  const fullKeys = await appStorageListByAppId(appId);
  const out: string[] = [];
  for (const k of fullKeys) {
    if (k.startsWith(ownerPrefix)) out.push(k.slice(ownerPrefix.length));
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
