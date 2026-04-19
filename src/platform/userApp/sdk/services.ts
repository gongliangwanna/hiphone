/**
 * @hiphone/services — user-app–facing service registry surface.
 *
 * Inside a user app's `services.ts`:
 *   import { registerService } from '@hiphone/services';
 *   registerService({ name: 'balance', execute: async () => ... });
 *
 * From any app (user or builtin) that wants to call another:
 *   import { invoke } from '@hiphone/services';
 *   const balance = await invoke('test-wallet', 'balance');
 *
 * See docs/superpowers/specs/2026-04-19-service-registry-design.md.
 */
import {
  serviceRegistry,
  type ServiceDef,
} from '@/platform/services/serviceRegistry';
import { getCurrentAppId } from './context';

export function registerService(def: ServiceDef): void {
  const appId = getCurrentAppId(); // services.ts runs under withUserAppContext
  serviceRegistry.register(appId, def);
}

export async function invoke(
  targetAppId: string,
  serviceName: string,
  params?: unknown,
): Promise<unknown> {
  return serviceRegistry.invoke(targetAppId, serviceName, params);
}

export async function list(targetAppId: string): Promise<string[]> {
  return serviceRegistry.list(targetAppId);
}
