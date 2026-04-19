/**
 * Eager registration helper for builtin-app services.
 *
 * Builtins don't go through the sandbox — their handlers are host code
 * with direct access to Zustand stores, UI refs, etc. Call this from
 * registerBuiltins.ts right after each appRegistry.register() for
 * any builtin that wants to expose services.
 */
import { serviceRegistry, type ServiceDef } from './serviceRegistry';

export function registerBuiltinServices(
  appId: string,
  defs: ServiceDef[],
): void {
  for (const def of defs) {
    serviceRegistry.register(appId, def);
  }
}
