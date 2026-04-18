import { useEffect, useRef } from 'react';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { getCurrentAppId } from './context';

/**
 * Clear this app's openParams entry from the runtime store. Used by
 * useOpenParams to enforce one-shot delivery: once a consumer has
 * latched the params, the store entry is removed so a later remount
 * (e.g. user returns to the app from springboard) doesn't observe
 * the same stale payload. A subsequent nav.open(...) to the same
 * app writes fresh params and the cycle repeats.
 */
function clearOpenParams(appId: string): void {
  useAppRuntimeStore.setState((s) => {
    if (!(appId in s.openParams)) return s;
    const next = { ...s.openParams };
    delete next[appId];
    return { openParams: next };
  });
}

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
 * Deep-link parameters delivered by the most recent `@hiphone/nav.open(thisApp, …)`.
 *
 * Semantics: **one-shot delivery** (iOS URL scheme style).
 *
 *  - If the app was opened via `nav.open(..., params)`, the FIRST render
 *    returns `params`; subsequent renders of the same mount keep returning
 *    the same latched object (so user code depending on it in useEffect
 *    doesn't see it flip to null mid-lifecycle).
 *  - If the app was opened some OTHER way (springboard tap, app switcher),
 *    or the user re-opens the app after previously consuming params,
 *    this returns `null`.
 *  - While mounted, a LATER `nav.open(thisApp, newParams)` delivers the
 *    new object (consumers depending on the return value refire their
 *    effects on the new reference).
 *
 * Rationale: keeping the store entry around across re-mounts caused the
 * target app to re-render its "pay confirm" page or re-fire its callback
 * toast every time the user returned to it from springboard. One-shot
 * delivery matches iOS URL-scheme expectations and eliminates the ghost.
 */
export function useOpenParams(): Record<string, unknown> | null {
  const appId = getCurrentAppId();
  const storeParams = useAppRuntimeStore((s) => s.openParams[appId] ?? null);
  const latchedRef = useRef<Record<string, unknown> | null>(null);

  // Latch on first sight of a non-null value (or a new object reference),
  // so subsequent renders are stable even after the store clears.
  if (storeParams !== null && storeParams !== latchedRef.current) {
    latchedRef.current = storeParams;
  }

  // Once we've latched, drop the store entry so remounts (without a fresh
  // nav.open) don't re-observe the same payload.
  useEffect(() => {
    if (storeParams !== null) {
      clearOpenParams(appId);
    }
  }, [appId, storeParams]);

  return latchedRef.current;
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
