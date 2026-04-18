/**
 * @hiphone/toast — user app–facing wrapper over the system Toast.
 *
 * The system Toast renderer lives in <Device>; user apps never need to
 * render anything themselves. `show(msg)` puts the message in the store
 * which auto-dismisses after ~2s (same behavior as all callers of
 * useToastStore in the app — see `system/Toast/toastStore.ts`).
 *
 * `warn` / `error` are currently aliased to `show()` — kept as named
 * exports for API stability and reserved for a future visual variant
 * (e.g. coloured stripe, leading icon). They behave identically to
 * `show()` today; do NOT use them for control flow.
 */
import { useToastStore } from '@/system';

export function show(message: string): void {
  useToastStore.getState().show(message);
}

export function warn(message: string): void {
  show(message);
}

export function error(message: string): void {
  show(message);
}
