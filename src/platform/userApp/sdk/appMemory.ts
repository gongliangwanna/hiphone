import { useEffect, useRef, useState } from 'react';
import { getCurrentAppId } from './context';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

/**
 * Per-app in-memory values that survive background (component unmount)
 * but reset on kill (monotonic kill nonce bump in appRuntimeStore).
 *
 * Storage shape: Map<appId, AppMemorySlot>. Not persisted to IDB —
 * user-visible persistence should go through @hiphone/storage instead.
 */

interface AppMemorySlot {
  /** Kill nonce that was active when this memory was last (re-)initialized. */
  killNonceAtInit: number;
  values: Map<string, unknown>;
}

const memoryStore = new Map<string, AppMemorySlot>();

function getOrResetAppMemory(appId: string, currentKillNonce: number): Map<string, unknown> {
  const slot = memoryStore.get(appId);
  if (!slot || slot.killNonceAtInit < currentKillNonce) {
    // First access OR app was killed since the memory was last initialized —
    // create a fresh slot anchored to the current kill nonce.
    const fresh: AppMemorySlot = {
      killNonceAtInit: currentKillNonce,
      values: new Map(),
    };
    memoryStore.set(appId, fresh);
    return fresh.values;
  }
  return slot.values;
}

/**
 * React hook: behaves like useState but the value survives component
 * unmount (e.g. when user returns to home screen) and only resets when
 * the app is killed (swiped away in app switcher).
 */
export function useAppMemory<T>(key: string, initial: T): [T, (val: T) => void] {
  const appId = getCurrentAppId();
  const killNonce = useAppRuntimeStore(
    (s) => s.appEvents[appId]?.kill ?? 0,
  );

  // Resolve the memory map — may be a fresh empty map if the app was killed
  // since the last time this hook ran (including across re-mounts).
  const mem = getOrResetAppMemory(appId, killNonce);

  // Initialize the key if not present
  if (!mem.has(key)) {
    mem.set(key, initial);
  }

  const [value, setValueState] = useState<T>(mem.get(key) as T);

  // Track the kill nonce seen at last render so we can detect live kills
  // (kill happening while the component is mounted).
  const lastKillSeen = useRef(killNonce);

  useEffect(() => {
    if (killNonce > lastKillSeen.current) {
      // Kill happened while mounted — clear memory and update state.
      const freshMem = getOrResetAppMemory(appId, killNonce);
      freshMem.set(key, initial);
      setValueState(initial);
      lastKillSeen.current = killNonce;
    }
  }, [killNonce, initial, mem, key, appId]);

  const setValue = (val: T) => {
    mem.set(key, val);
    setValueState(val);
  };

  return [value, setValue];
}

/** Test helper: clear memory for one app. */
export function _resetAppMemoryForApp(appId: string): void {
  memoryStore.delete(appId);
}
