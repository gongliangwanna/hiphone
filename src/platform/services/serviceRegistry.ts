/**
 * Platform service registry.
 *
 * See docs/superpowers/specs/2026-04-19-service-registry-design.md for
 * the full design. This module is the single source of truth for:
 *
 *   - Cross-app `invoke(appId, name, params?)` dispatch
 *   - Lazy bootstrap of user-app services modules (added in Task 4)
 *   - Per-app context binding during handler execution (added in Task 4)
 *   - Uninstall cleanup
 */

export interface ServiceDef {
  name: string;
  /** Human/LLM-readable description. Not consumed by Service Registry;
   *  reserved for the future AI Tool Registry consumer. */
  description?: string;
  /** JSON Schema for params. Reserved for AI Tool Registry. */
  parameters?: Record<string, unknown>;
  execute: (params?: unknown) => Promise<unknown>;
}

export class ServiceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceNotFoundError';
  }
}

type AppServices = Map<string, ServiceDef>;
const registry = new Map<string, AppServices>();

export const serviceRegistry = {
  register(appId: string, def: ServiceDef): void {
    let app = registry.get(appId);
    if (!app) {
      app = new Map();
      registry.set(appId, app);
    }
    app.set(def.name, def);
  },

  unregisterApp(appId: string): void {
    registry.delete(appId);
  },

  async list(appId: string): Promise<string[]> {
    const app = registry.get(appId);
    return app ? [...app.keys()] : [];
  },

  async invoke(appId: string, serviceName: string, params?: unknown): Promise<unknown> {
    const app = registry.get(appId);
    if (!app) {
      throw new ServiceNotFoundError(
        `app "${appId}" has no services registered`,
      );
    }
    const def = app.get(serviceName);
    if (!def) {
      throw new ServiceNotFoundError(
        `service "${appId}.${serviceName}" not registered`,
      );
    }
    return def.execute(params);
  },

  /** Test-only: wipe the registry between tests. */
  _resetForTests(): void {
    registry.clear();
  },
};
