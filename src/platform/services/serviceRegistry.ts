/**
 * Platform service registry.
 *
 * See docs/superpowers/specs/2026-04-19-service-registry-design.md.
 */
import { appRegistry } from '@/platform/appRegistry';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
} from '@/platform/storage/idbStorage';
import { evaluateUserAppModule } from '@/platform/userApp/moduleResolver';
import { resolveModule } from '@/platform/userApp/sdk';
import { withUserAppContext } from '@/platform/userApp/sdk/context';
import type { UserAppManifest } from '@/platform/userApp/manifest';

export interface ServiceDef {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  execute: (params?: unknown) => Promise<unknown>;
}

export class ServiceNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceNotFoundError';
  }
}

export class ServiceBootstrapError extends Error {
  public readonly appId: string;
  public readonly cause: unknown;
  constructor(appId: string, cause: unknown) {
    super(
      `services bootstrap failed for "${appId}": ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'ServiceBootstrapError';
    this.appId = appId;
    this.cause = cause;
  }
}

type AppServices = Map<string, ServiceDef>;
const registry = new Map<string, AppServices>();
const bootstrapped = new Set<string>();
const bootstrapping = new Map<string, Promise<void>>();

async function ensureBootstrapped(appId: string): Promise<void> {
  if (bootstrapped.has(appId)) return;
  const existing = bootstrapping.get(appId);
  if (existing) return existing;

  const p = doBootstrap(appId)
    .then(() => {
      bootstrapped.add(appId);
    })
    .finally(() => {
      bootstrapping.delete(appId);
    });
  bootstrapping.set(appId, p);
  return p;
}

async function doBootstrap(appId: string): Promise<void> {
  const entry = appRegistry.get(appId);
  if (!entry) {
    // Not in registry — maybe uninstalled during race, or never installed.
    // Either way, nothing to bootstrap. Leave alone; invoke will reject
    // with ServiceNotFoundError.
    return;
  }
  if (entry.type === 'builtin') {
    // Builtins register eagerly via registerBuiltinServices; nothing to do.
    return;
  }

  // User app — load manifest + compiledMap from IDB, evaluate services.ts.
  const db = await getDB();
  const [meta, src] = await Promise.all([
    new Promise<{ manifest: UserAppManifest } | undefined>((resolve, reject) => {
      const tx = db.transaction(APP_META_STORE, 'readonly');
      const req = tx.objectStore(APP_META_STORE).get(appId);
      req.onsuccess = () => resolve(req.result as { manifest: UserAppManifest } | undefined);
      req.onerror = () => reject(req.error);
    }),
    new Promise<{ compiledMap: Record<string, string> } | undefined>((resolve, reject) => {
      const tx = db.transaction(APP_SRC_STORE, 'readonly');
      const req = tx.objectStore(APP_SRC_STORE).get(appId);
      req.onsuccess = () => resolve(req.result as { compiledMap: Record<string, string> } | undefined);
      req.onerror = () => reject(req.error);
    }),
  ]);

  if (!meta || !src) return; // storage race / corruption — treat as no services
  const servicesPath = meta.manifest.services;
  if (!servicesPath) return; // app doesn't expose services

  try {
    evaluateUserAppModule(src.compiledMap, servicesPath, resolveModule, appId);
    // services.ts top-level ran registerService(...) under withUserAppContext,
    // populating `registry[appId]`. Nothing more to do.
  } catch (cause) {
    throw new ServiceBootstrapError(appId, cause);
  }
}

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
    bootstrapped.delete(appId);
    // In-flight promise (if any) completes naturally; its .finally() cleans
    // `bootstrapping` regardless. Subsequent invoke will re-bootstrap fresh.
  },

  async list(appId: string): Promise<string[]> {
    // Intentionally does NOT call ensureBootstrapped — `list` reports the
    // currently-registered surface, used for eager inspection (e.g. after
    // invoke() has already caused the bootstrap). Future Tool Registry
    // will call ensureBootstrapped explicitly before presenting a menu.
    const app = registry.get(appId);
    return app ? [...app.keys()] : [];
  },

  async invoke(appId: string, serviceName: string, params?: unknown): Promise<unknown> {
    await ensureBootstrapped(appId);
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
    return withUserAppContext(appId, () => def.execute(params));
  },

  /** Test-only: wipe the registry between tests. */
  _resetForTests(): void {
    registry.clear();
    bootstrapped.clear();
    bootstrapping.clear();
  },
};
