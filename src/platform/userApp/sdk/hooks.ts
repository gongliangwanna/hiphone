import { useEffect, useRef } from 'react';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { getCurrentAppId } from './context';

export { useAppMemory } from './appMemory';

/**
 * Fire `callback` once when the app first mounts and then again whenever
 * the launch nonce bumps (e.g. kill → re-open).
 */
export function useOnLaunch(callback: () => void): void {
  useNonceEffect('launch', callback, { fireOnMount: true });
}

/**
 * Fire `callback` when app returns from background (resume nonce bumps).
 * Does NOT fire on initial mount (first mount is launch).
 */
export function useOnResume(callback: () => void): void {
  useNonceEffect('resume', callback, { fireOnMount: false });
}

/**
 * Fire `callback` when app goes to background (user returned to home).
 */
export function useOnBackground(callback: () => void): void {
  useNonceEffect('background', callback, { fireOnMount: false });
}

/**
 * Fire `callback` when app is killed (swiped away in app switcher).
 * Note: component is typically unmounted at this point; useful mainly
 * for persisted logging / analytics.
 */
export function useOnKill(callback: () => void): void {
  useNonceEffect('kill', callback, { fireOnMount: false });
}

/**
 * Deep-link parameters passed by a caller via @hiphone/nav.open (M3+).
 * Returns `null` when no params have been set for this app.
 */
export function useOpenParams(): Record<string, unknown> | null {
  const appId = getCurrentAppId();
  return useAppRuntimeStore((s) => s.openParams[appId] ?? null);
}

/**
 * Coarse lifecycle state. M2 returns 'active' for now (kill / resume
 * state transitions are handled by the event hooks instead).
 */
export function useAppState(): 'launching' | 'active' | 'resuming' {
  return 'active';
}

// ─────────────────────────────────────────────────────────

function useNonceEffect(
  event: 'launch' | 'resume' | 'background' | 'kill',
  callback: () => void,
  options: { fireOnMount: boolean },
): void {
  const appId = getCurrentAppId();
  const nonce = useAppRuntimeStore((s) => s.appEvents[appId]?.[event] ?? 0);
  const seenRef = useRef<number | null>(null);
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (seenRef.current === null) {
      // First invocation of the effect. Fire only if option says so.
      seenRef.current = nonce;
      if (options.fireOnMount) cbRef.current();
      return;
    }
    if (nonce > seenRef.current) {
      seenRef.current = nonce;
      cbRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);
}
