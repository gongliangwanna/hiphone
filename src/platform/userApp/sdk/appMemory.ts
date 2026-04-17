import { useEffect, useRef, useState } from 'react';
import { getCurrentAppId } from './context';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

/**
 * Per-app in-memory values that survive background (component unmount)
 * but reset on kill (monotonic kill nonce bump in appRuntimeStore).
 *
 * Storage shape: Map<appId, Map<userKey, value>>. Not persisted to IDB —
 * user-visible persistence should go through @hiphone/storage instead.
 */
const memoryStore = new Map<string, Map<string, unknown>>();

function getAppMemory(appId: string): Map<string, unknown> {
  let m = memoryStore.get(appId);
  if (!m) {
    m = new Map();
    memoryStore.set(appId, m);
  }
  return m;
}

/**
 * React hook: behaves like useState but the value survives component
 * unmount (e.g. when user returns to home screen) and only resets when
 * the app is killed (swiped away in app switcher).
 */
export function useAppMemory<T>(key: string, initial: T): [T, (val: T) => void] {
  const appId = getCurrentAppId();
  const mem = getAppMemory(appId);

  // Initialize the key if first time
  if (!mem.has(key)) {
    mem.set(key, initial);
  }

  const [value, setValueState] = useState<T>(mem.get(key) as T);

  // Subscribe to kill nonce — when it bumps, reset local memory to initial
  // and force re-render.
  const killNonce = useAppRuntimeStore(
    (s) => s.appEvents[appId]?.kill ?? 0,
  );
  const lastKillSeen = useRef(killNonce);

  useEffect(() => {
    if (killNonce > lastKillSeen.current) {
      mem.clear();
      setValueState(initial);
      lastKillSeen.current = killNonce;
    }
  }, [killNonce, initial, mem]);

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
