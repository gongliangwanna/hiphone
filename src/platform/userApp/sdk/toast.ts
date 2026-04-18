/**
 * @hiphone/toast — user app–facing wrapper over the system Toast.
 *
 * The system Toast renderer lives in <Device>; user apps never need to
 * render anything themselves. `show(msg)` puts the message in the store
 * which auto-dismisses after ~2s (same behavior as all callers of
 * useToastStore in the app — see `system/Toast/toastStore.ts`).
 *
 * warn/error are convenience prefixes — do NOT use these for flow
 * control (they don't change the store's behavior, only the display).
 */
import { useToastStore } from '@/system';

export function show(message: string): void {
  useToastStore.getState().show(message);
}

export function warn(message: string): void {
  show(`⚠️ ${message}`);
}

export function error(message: string): void {
  show(`❌ ${message}`);
}
