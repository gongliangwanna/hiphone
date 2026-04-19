# Service Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the platform Service Registry so any app (user or builtin) can register named services, callable by other apps via `invoke(appId, serviceName, params?)` — no foreground switch, no UI render. Demo: wallet exposes a `balance` service; shop queries it on mount to gate its buy buttons without ever mounting wallet's UI.

**Architecture:** Platform-level `serviceRegistry` = `Map<appId, Map<name, ServiceDef>>`. User apps declare a `services: "services.ts"` entry in `manifest.json`; Installer compiles it (compiledMap already covers all `.ts/.tsx` files for free). On first `invoke(appId, ...)`, the registry lazy-bootstraps: reads compiledMap from IDB, runs `services.ts` top-level inside `withUserAppContext(appId, …)`; top-level `registerService({...})` calls populate the Map. A shared in-flight Promise (same pattern as `ensureTwindInstalled`) de-duplicates concurrent bootstraps. Builtins skip the sandbox: `registerBuiltinServices(appId, defs)` is called from `registerBuiltins.ts`, handlers run as host code with direct Zustand access. `invoke` wraps every handler call in `withUserAppContext(calleeAppId, …)` so `@hiphone/storage` inside the handler routes to the callee's data. `installer.uninstall` calls `serviceRegistry.unregisterApp(id)` so user-app uninstall clears services + drops the cached runtime handle.

**Tech Stack:** TypeScript, Vitest, React 19 (only for UI fixtures), Zustand, existing Sucrase + sandbox pipeline. No new dependencies.

**Parent spec:** [`docs/superpowers/specs/2026-04-19-service-registry-design.md`](../superpowers/specs/2026-04-19-service-registry-design.md)

**Test command:** `pnpm test` (single-run vitest). Path alias `@/` → `src/`.

---

## File Structure

- **Create** `src/platform/services/serviceRegistry.ts` — Map + lazy bootstrap + in-flight dedup + invoke + context wrapping
- **Create** `src/platform/services/__tests__/serviceRegistry.test.ts`
- **Create** `src/platform/services/builtinServices.ts` — `registerBuiltinServices(appId, defs)` helper
- **Create** `src/platform/services/__tests__/builtinServices.test.ts`
- **Create** `src/platform/userApp/sdk/services.ts` — user-app-facing `registerService` / `invoke` / `list`
- **Create** `src/platform/userApp/sdk/__tests__/services.test.ts`
- **Create** `src/platform/userApp/__tests__/fixtures/wallet-app/services.ts` — demo services module
- **Modify** `src/platform/userApp/moduleResolver.ts` — extract `evaluateUserAppModule` helper that runs a non-UI entry and returns the exports (so service bootstrap can reuse the sandbox + require plumbing without needing a default React component)
- **Modify** `src/platform/userApp/__tests__/moduleResolver.test.ts` — test for the new helper
- **Modify** `src/platform/userApp/manifest.ts` — `services?: string` field + validator rule
- **Modify** `src/platform/userApp/__tests__/manifest.test.ts` — new field assertions
- **Modify** `src/platform/userApp/installer.ts` — `uninstall()` calls `serviceRegistry.unregisterApp(id)` at the end
- **Modify** `src/platform/userApp/sdk/index.ts` — `moduleMap` entry `'@hiphone/services': hiphoneServices`
- **Modify** `src/platform/userApp/sdk/__tests__/index.test.ts` — resolveModule assertion
- **Modify** `src/apps/registerBuiltins.ts` — call `registerBuiltinServices('settings', [{name:'currentOwnerId', …}])` after Settings registration
- **Modify** `src/platform/userApp/__tests__/fixtures/wallet-app/manifest.json` — add `"services": "services.ts"`
- **Modify** `src/platform/userApp/__tests__/fixtures/shop-app/App.tsx` — mount-time `invoke('test-wallet', 'balance')` → gate each item's buy button
- **Modify** `src/platform/userApp/__tests__/m3.e2e.test.ts` — 2-3 new tests for the full lazy-service flow

---

## Task 1: serviceRegistry core types + register/unregisterApp/list (no bootstrap yet)

**Files:**
- Create: `src/platform/services/serviceRegistry.ts`
- Create: `src/platform/services/__tests__/serviceRegistry.test.ts`

Skip the IDB-driven lazy bootstrap path for now; that comes in Task 4. This task locks the synchronous register/unregisterApp/list surface and the error types.

- [ ] **Step 1: Write failing tests**

Create `src/platform/services/__tests__/serviceRegistry.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import {
  serviceRegistry,
  ServiceNotFoundError,
  type ServiceDef,
} from '../serviceRegistry';

function def(name: string, value: unknown): ServiceDef {
  return { name, execute: async () => value };
}

describe('serviceRegistry — sync surface', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
  });

  it('register + list returns the names', async () => {
    serviceRegistry.register('xingyu', def('postMoment', null));
    serviceRegistry.register('xingyu', def('likeMoment', null));
    const names = await serviceRegistry.list('xingyu');
    expect(names.sort()).toEqual(['likeMoment', 'postMoment']);
  });

  it('register replaces a prior service with the same name (hot reload semantics)', async () => {
    serviceRegistry.register('xingyu', { name: 'x', execute: async () => 1 });
    serviceRegistry.register('xingyu', { name: 'x', execute: async () => 2 });
    const v = await serviceRegistry.invoke('xingyu', 'x');
    expect(v).toBe(2);
  });

  it('unregisterApp clears all services for that app', async () => {
    serviceRegistry.register('xingyu', def('a', 1));
    serviceRegistry.register('xingyu', def('b', 2));
    serviceRegistry.register('notes', def('c', 3));

    serviceRegistry.unregisterApp('xingyu');

    await expect(serviceRegistry.list('xingyu')).resolves.toEqual([]);
    await expect(serviceRegistry.list('notes')).resolves.toEqual(['c']);
  });

  it('invoke returns the handler value', async () => {
    serviceRegistry.register('w', { name: 'ping', execute: async () => 'pong' });
    await expect(serviceRegistry.invoke('w', 'ping')).resolves.toBe('pong');
  });

  it('invoke passes params through to the handler', async () => {
    serviceRegistry.register('w', {
      name: 'echo',
      execute: async (p) => p,
    });
    await expect(serviceRegistry.invoke('w', 'echo', { hi: 1 })).resolves.toEqual({ hi: 1 });
  });

  it('invoke rejects with ServiceNotFoundError when app is empty', async () => {
    await expect(serviceRegistry.invoke('unknown-app', 'x')).rejects.toBeInstanceOf(
      ServiceNotFoundError,
    );
  });

  it('invoke rejects with ServiceNotFoundError when service name is missing', async () => {
    serviceRegistry.register('w', def('a', 1));
    await expect(serviceRegistry.invoke('w', 'b')).rejects.toBeInstanceOf(
      ServiceNotFoundError,
    );
  });

  it('handler errors propagate unchanged to the caller', async () => {
    const boom = new Error('boom');
    serviceRegistry.register('w', {
      name: 'fail',
      execute: async () => { throw boom; },
    });
    await expect(serviceRegistry.invoke('w', 'fail')).rejects.toBe(boom);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test src/platform/services/__tests__/serviceRegistry.test.ts
```

Expected: FAIL with `Cannot find module '../serviceRegistry'`.

- [ ] **Step 3: Implement the core (no bootstrap yet)**

Create `src/platform/services/serviceRegistry.ts`:

```typescript
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
```

- [ ] **Step 4: Verify tests pass**

```bash
pnpm test src/platform/services/__tests__/serviceRegistry.test.ts
```

Expected: all 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/services/serviceRegistry.ts src/platform/services/__tests__/serviceRegistry.test.ts
git commit -m "$(cat <<'EOF'
feat(platform): service registry core — sync register / invoke / list

Introduces src/platform/services/serviceRegistry.ts with the base
surface: register(appId, def), unregisterApp(appId), list(appId),
invoke(appId, name, params?). ServiceDef carries reserved
description? + parameters? fields for the future AI Tool Registry
consumer. Handler errors propagate unchanged; missing app or service
throws ServiceNotFoundError.

Lazy bootstrap of user-app services and per-app context binding on
invoke land in a follow-up commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: @hiphone/services SDK + moduleMap entry

**Files:**
- Create: `src/platform/userApp/sdk/services.ts`
- Create: `src/platform/userApp/sdk/__tests__/services.test.ts`
- Modify: `src/platform/userApp/sdk/index.ts`
- Modify: `src/platform/userApp/sdk/__tests__/index.test.ts`

- [ ] **Step 1: Write failing SDK tests**

Create `src/platform/userApp/sdk/__tests__/services.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { registerService, invoke, list } from '../services';
import { withUserAppContext } from '../context';
import { serviceRegistry } from '@/platform/services/serviceRegistry';

describe('@hiphone/services', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
  });

  it('registerService uses the current app context for the appId', async () => {
    withUserAppContext('my-todo', () => {
      registerService({ name: 'noop', execute: async () => 42 });
    });
    await expect(invoke('my-todo', 'noop')).resolves.toBe(42);
  });

  it('invoke forwards params through to the registered handler', async () => {
    withUserAppContext('wallet', () => {
      registerService({
        name: 'echo',
        execute: async (p) => p,
      });
    });
    await expect(invoke('wallet', 'echo', { amount: 10 })).resolves.toEqual({ amount: 10 });
  });

  it('list returns the names an app has registered', async () => {
    withUserAppContext('wallet', () => {
      registerService({ name: 'balance', execute: async () => 100 });
      registerService({ name: 'history', execute: async () => [] });
    });
    await expect(list('wallet')).resolves.toEqual(
      expect.arrayContaining(['balance', 'history']),
    );
  });
});
```

Add these assertions to `src/platform/userApp/sdk/__tests__/index.test.ts` inside the existing `describe('resolveModule', …)`:

```typescript
  it('resolves "@hiphone/services" to an object with registerService, invoke, list', () => {
    const mod = resolveModule('@hiphone/services') as {
      registerService: unknown;
      invoke: unknown;
      list: unknown;
    };
    expect(typeof mod.registerService).toBe('function');
    expect(typeof mod.invoke).toBe('function');
    expect(typeof mod.list).toBe('function');
  });
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test src/platform/userApp/sdk/__tests__/services.test.ts src/platform/userApp/sdk/__tests__/index.test.ts
```

Expected: services.test.ts fails with `Cannot find module '../services'`; index.test.ts fails the new resolveModule assertion.

- [ ] **Step 3: Implement the SDK**

Create `src/platform/userApp/sdk/services.ts`:

```typescript
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
```

Update `src/platform/userApp/sdk/index.ts`. Add an import and moduleMap entry:

```typescript
import * as hiphoneServices from './services';
```

And extend `moduleMap`:

```typescript
  '@hiphone/banner': hiphoneBanner,
  '@hiphone/services': hiphoneServices,
```

- [ ] **Step 4: Verify**

```bash
pnpm test src/platform/userApp/sdk/__tests__/services.test.ts src/platform/userApp/sdk/__tests__/index.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/userApp/sdk/services.ts src/platform/userApp/sdk/__tests__/services.test.ts src/platform/userApp/sdk/index.ts src/platform/userApp/sdk/__tests__/index.test.ts
git commit -m "$(cat <<'EOF'
feat(userApp): @hiphone/services SDK + moduleMap entry

registerService() reads the current appId from the synchronous
context stack (same mechanism @hiphone/storage uses) so services.ts
top-level code doesn't self-identify. invoke / list are thin
wrappers over the platform registry.

Registered under '@hiphone/services' in resolveModule so user apps
can import the SDK inside their sandbox.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Manifest `services?: string` field

**Files:**
- Modify: `src/platform/userApp/manifest.ts`
- Modify: `src/platform/userApp/__tests__/manifest.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `src/platform/userApp/__tests__/manifest.test.ts` (inside the existing `describe('validateManifest', …)`):

```typescript
  it('accepts services field as a non-empty string', () => {
    const result = validateManifest({
      id: 'w',
      name: 'W',
      version: '1.0.0',
      entry: 'App.tsx',
      services: 'services.ts',
    });
    expect(result.services).toBe('services.ts');
  });

  it('defaults services to undefined when absent', () => {
    const result = validateManifest({
      id: 'w', name: 'W', version: '1.0.0', entry: 'App.tsx',
    });
    expect(result.services).toBeUndefined();
  });

  it('rejects non-string services value', () => {
    expect(() =>
      validateManifest({
        id: 'w', name: 'W', version: '1.0.0', entry: 'App.tsx',
        services: 42 as unknown as string,
      }),
    ).toThrow(/services/);
  });
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test src/platform/userApp/__tests__/manifest.test.ts
```

Expected: 3 new tests fail (current validator ignores `services`).

- [ ] **Step 3: Implement**

In `src/platform/userApp/manifest.ts`, add `services?: string` to the `UserAppManifest` interface (below the existing `statusBarStyle` line):

```typescript
  /**
   * Optional path (relative to zip root) to a services module. If set,
   * Installer compiles it into compiledMap; serviceRegistry lazy-runs
   * its top-level registerService() calls on first invoke of this app.
   */
  services?: string;
```

In the validator (inside `validateManifest`, just before the `return` block), add:

```typescript
  let services: string | undefined;
  if (obj.services !== undefined) {
    if (typeof obj.services !== 'string' || obj.services.length === 0) {
      throw new ManifestError(
        `manifest.services must be a non-empty string when provided (got ${JSON.stringify(obj.services)})`,
      );
    }
    services = obj.services;
  }
```

Then add `services,` to the returned object literal.

- [ ] **Step 4: Verify**

```bash
pnpm test src/platform/userApp/__tests__/manifest.test.ts
```

Expected: all PASS (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/platform/userApp/manifest.ts src/platform/userApp/__tests__/manifest.test.ts
git commit -m "$(cat <<'EOF'
feat(userApp): manifest.services field for service-providing apps

User apps declare "services": "services.ts" (or similar path) to
opt into the service registry's lazy-bootstrap pipeline. Validator
accepts only non-empty strings; absent field stays undefined for
back-compat with existing fixtures (only wallet will set it).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Extract `evaluateUserAppModule` + lazy bootstrap in registry

**Files:**
- Modify: `src/platform/userApp/moduleResolver.ts` — extract a helper so `createUserAppRuntime` and the new service bootstrap share the sandbox/require plumbing without the React-component assertion
- Modify: `src/platform/userApp/__tests__/moduleResolver.test.ts` — cover the helper
- Modify: `src/platform/services/serviceRegistry.ts` — add `ensureBootstrapped`, bootstrap deps, in-flight dedup, ServiceBootstrapError
- Modify: `src/platform/services/__tests__/serviceRegistry.test.ts` — bootstrap + dedup coverage

Context: `createUserAppRuntime` currently asserts `entryModule.exports.default` is a React component (lines 108-113). Services modules have no default export — they just call `registerService` at module top. We refactor the pre-component part into a reusable primitive.

- [ ] **Step 1: Write failing test for `evaluateUserAppModule`**

Append to `src/platform/userApp/__tests__/moduleResolver.test.ts`:

```typescript
import { evaluateUserAppModule } from '../moduleResolver';

describe('evaluateUserAppModule', () => {
  it('runs a non-UI entry and returns the exports', async () => {
    const { compileTsx } = await import('../compiler');
    const compiledMap: Record<string, string> = {
      'services.ts': await compileTsx(
        `export const ping = () => 'pong'; export default 42;`,
        'services.ts',
      ),
    };
    const resolve = (_s: string) => ({});
    const exports = evaluateUserAppModule(
      compiledMap,
      'services.ts',
      resolve,
      'test-app',
    ) as { ping: () => string; default: number };

    expect(exports.ping()).toBe('pong');
    expect(exports.default).toBe(42);
  });

  it('tolerates an entry with no default export (services module pattern)', async () => {
    const { compileTsx } = await import('../compiler');
    const compiledMap: Record<string, string> = {
      'services.ts': await compileTsx(
        `export const names = ['a', 'b'];`,
        'services.ts',
      ),
    };
    const resolve = (_s: string) => ({});
    const exports = evaluateUserAppModule(
      compiledMap,
      'services.ts',
      resolve,
      'test-app',
    );
    // Should NOT throw; default may be undefined.
    expect((exports as { names: string[] }).names).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test src/platform/userApp/__tests__/moduleResolver.test.ts
```

Expected: FAIL — `evaluateUserAppModule` not exported.

- [ ] **Step 3: Refactor moduleResolver.ts**

In `src/platform/userApp/moduleResolver.ts`, replace the body of `createUserAppRuntime` plus add `evaluateUserAppModule`:

```typescript
/**
 * Execute a user app entry module top-to-bottom inside the sandbox +
 * module-resolution runtime and return the module's exports object.
 *
 * Used for both UI entries (where the caller then expects a default
 * React component) and non-UI entries like services modules (where
 * the top-level side effects — e.g. registerService — are what matter
 * and there is no default export).
 */
export function evaluateUserAppModule(
  compiledMap: Record<string, string>,
  entryPath: string,
  sdkResolve: ModuleResolver,
  appId: string,
): Record<string, unknown> {
  if (!Object.prototype.hasOwnProperty.call(compiledMap, entryPath)) {
    throw new Error(`evaluateUserAppModule: entry "${entryPath}" not in compiledMap`);
  }

  const moduleCache = new Map<string, { exports: any }>();

  function requireFrom(fromPath: string): (specifier: string) => unknown {
    return (specifier: string) => {
      if (!specifier.startsWith('.')) {
        return sdkResolve(specifier);
      }
      const resolved = resolveRelativePath(fromPath, specifier, compiledMap);
      const cached = moduleCache.get(resolved);
      if (cached) return cached.exports;

      const module = { exports: {} as any };
      moduleCache.set(resolved, module);
      withUserAppContext(appId, () =>
        executeInSandbox(compiledMap[resolved]!, requireFrom(resolved), module),
      );
      return module.exports;
    };
  }

  const entryModule = { exports: {} as any };
  moduleCache.set(entryPath, entryModule);
  withUserAppContext(appId, () =>
    executeInSandbox(compiledMap[entryPath]!, requireFrom(entryPath), entryModule),
  );
  return entryModule.exports;
}

export function createUserAppRuntime(
  compiledMap: Record<string, string>,
  entryPath: string,
  sdkResolve: ModuleResolver,
  appId: string,
): ComponentType {
  const exports = evaluateUserAppModule(compiledMap, entryPath, sdkResolve, appId);
  const Component = exports.default;
  if (typeof Component !== 'function') {
    throw new Error(
      `Entry "${entryPath}" did not export a default React component`,
    );
  }

  return function UserAppRoot(props: any) {
    return withUserAppContext(appId, () => (Component as any)(props));
  };
}
```

- [ ] **Step 4: Verify moduleResolver tests pass**

```bash
pnpm test src/platform/userApp/__tests__/moduleResolver.test.ts
```

Expected: existing tests still PASS + 2 new tests PASS.

- [ ] **Step 5: Write failing tests for bootstrap + dedup + error path**

Append to `src/platform/services/__tests__/serviceRegistry.test.ts`:

```typescript
import 'fake-indexeddb/auto';
import { appRegistry } from '@/platform/appRegistry';
import { install } from '@/platform/userApp/installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { getDB, APP_META_STORE, APP_SRC_STORE, APP_KV_STORE } from '@/platform/storage/idbStorage';
import { ServiceBootstrapError } from '../serviceRegistry';
import JSZip from 'jszip';

async function resetInstallState(): Promise<void> {
  useInstalledUserAppsStore.setState({ apps: [] });
  for (const e of appRegistry.list()) {
    if (e.type === 'user') appRegistry.unregister(e.id);
  }
  const db = await getDB();
  await new Promise<void>((resolve) => {
    const tx = db.transaction(
      [APP_META_STORE, APP_SRC_STORE, APP_KV_STORE],
      'readwrite',
    );
    tx.objectStore(APP_META_STORE).clear();
    tx.objectStore(APP_SRC_STORE).clear();
    tx.objectStore(APP_KV_STORE).clear();
    tx.oncomplete = () => resolve();
  });
}

async function makeZip(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [path, content] of Object.entries(files)) zip.file(path, content);
  return zip.generateAsync({ type: 'blob' });
}

describe('serviceRegistry — lazy bootstrap', () => {
  beforeEach(async () => {
    serviceRegistry._resetForTests();
    await resetInstallState();
  });

  it('bootstraps a user app on first invoke and returns the handler value', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'svc-app', name: 'Svc', version: '1.0.0', entry: 'App.tsx',
        services: 'services.ts',
      }),
      'App.tsx': `import React from 'react'; export default () => React.createElement('div');`,
      'services.ts': `
        import { registerService } from '@hiphone/services';
        registerService({ name: 'hello', execute: async () => 'world' });
      `,
    });
    await install(zip);

    // Fresh registry — wallet services.ts has NOT been bootstrapped yet.
    await expect(serviceRegistry.list('svc-app')).resolves.toEqual([]);

    const result = await serviceRegistry.invoke('svc-app', 'hello');
    expect(result).toBe('world');

    // After invoke, the service is registered.
    await expect(serviceRegistry.list('svc-app')).resolves.toEqual(['hello']);
  });

  it('rejects invoke with ServiceNotFoundError when the app is not installed', async () => {
    await expect(
      serviceRegistry.invoke('never-installed', 'x'),
    ).rejects.toBeInstanceOf(ServiceNotFoundError);
  });

  it('concurrent invokes share a single bootstrap — services.ts runs only once', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'once', name: 'Once', version: '1.0.0', entry: 'App.tsx',
        services: 'services.ts',
      }),
      'App.tsx': `import React from 'react'; export default () => React.createElement('div');`,
      'services.ts': `
        import { registerService } from '@hiphone/services';
        // Counter observable from outside via global (test-only)
        (globalThis).__bootstrapRuns = ((globalThis).__bootstrapRuns ?? 0) + 1;
        registerService({ name: 'echo', execute: async (p) => p });
      `,
    });
    await install(zip);
    (globalThis as any).__bootstrapRuns = 0;

    const [a, b, c] = await Promise.all([
      serviceRegistry.invoke('once', 'echo', 1),
      serviceRegistry.invoke('once', 'echo', 2),
      serviceRegistry.invoke('once', 'echo', 3),
    ]);
    expect([a, b, c]).toEqual([1, 2, 3]);
    expect((globalThis as any).__bootstrapRuns).toBe(1);
  });

  it('bootstrap failure wraps to ServiceBootstrapError and allows retry after fix', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'bad-boot', name: 'Bad', version: '1.0.0', entry: 'App.tsx',
        services: 'services.ts',
      }),
      'App.tsx': `import React from 'react'; export default () => React.createElement('div');`,
      'services.ts': `throw new Error('boot failure');`,
    });
    await install(zip);

    await expect(serviceRegistry.invoke('bad-boot', 'any')).rejects.toBeInstanceOf(
      ServiceBootstrapError,
    );

    // Because bootstrap did NOT mark done, a replacement services.ts via
    // re-install (upgrade) should let the next invoke succeed.
    const goodZip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'bad-boot', name: 'Bad', version: '1.0.0', entry: 'App.tsx',
        services: 'services.ts',
      }),
      'App.tsx': `import React from 'react'; export default () => React.createElement('div');`,
      'services.ts': `
        import { registerService } from '@hiphone/services';
        registerService({ name: 'ping', execute: async () => 'pong' });
      `,
    });
    await install(goodZip);

    await expect(serviceRegistry.invoke('bad-boot', 'ping')).resolves.toBe('pong');
  });

  it('unregisterApp drops the bootstrap cache so next invoke re-bootstraps', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'cycle', name: 'C', version: '1.0.0', entry: 'App.tsx',
        services: 'services.ts',
      }),
      'App.tsx': `import React from 'react'; export default () => React.createElement('div');`,
      'services.ts': `
        import { registerService } from '@hiphone/services';
        (globalThis).__cycleRuns = ((globalThis).__cycleRuns ?? 0) + 1;
        registerService({ name: 'x', execute: async () => 1 });
      `,
    });
    await install(zip);
    (globalThis as any).__cycleRuns = 0;

    await serviceRegistry.invoke('cycle', 'x'); // bootstrap #1
    serviceRegistry.unregisterApp('cycle');
    // Note: after unregisterApp, the Map is empty, so invoke would
    // hit not-installed path. We only assert the bootstrap flag was
    // dropped by checking a fresh install re-runs services.ts.
    await install(zip);
    await serviceRegistry.invoke('cycle', 'x'); // bootstrap #2
    expect((globalThis as any).__cycleRuns).toBe(2);
  });
});
```

- [ ] **Step 6: Run — expect failure**

```bash
pnpm test src/platform/services/__tests__/serviceRegistry.test.ts
```

Expected: 5 new tests fail; 8 Task-1 tests still pass.

- [ ] **Step 7: Implement bootstrap + dedup + context wrapping**

Replace `src/platform/services/serviceRegistry.ts` with:

```typescript
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
  constructor(public appId: string, public override cause: unknown) {
    super(
      `services bootstrap failed for "${appId}": ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = 'ServiceBootstrapError';
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
    await ensureBootstrapped(appId);
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

  _resetForTests(): void {
    registry.clear();
    bootstrapped.clear();
    bootstrapping.clear();
  },
};
```

- [ ] **Step 8: Verify all tests pass**

```bash
pnpm test src/platform/services/__tests__/serviceRegistry.test.ts
pnpm test src/platform/userApp/__tests__/moduleResolver.test.ts
pnpm test src/platform/userApp/__tests__/installer.test.ts
```

Expected: all PASS.

- [ ] **Step 9: Commit**

```bash
git add src/platform/services/serviceRegistry.ts src/platform/services/__tests__/serviceRegistry.test.ts src/platform/userApp/moduleResolver.ts src/platform/userApp/__tests__/moduleResolver.test.ts
git commit -m "$(cat <<'EOF'
feat(services): lazy bootstrap + in-flight dedup + context binding

serviceRegistry.invoke now loads a user app's services.ts from IDB
on first call, evaluates its top-level inside withUserAppContext
(so registerService() captures the right appId), and caches the
result. Concurrent invokes share a single in-flight bootstrap
Promise via a bootstrapping Map — the test asserts services.ts
runs exactly once across three parallel invokes. Handler invocation
is wrapped in withUserAppContext(calleeAppId, …) so @hiphone/storage
calls inside the handler route to the callee's data.

Added ServiceBootstrapError for top-level throws in services.ts;
bootstrapped flag is NOT set on failure, so the next invoke after
a fix (e.g. re-install) retries cleanly.

moduleResolver.ts: extracted evaluateUserAppModule() — the core
"run a sandbox entry and return exports" primitive that both
createUserAppRuntime (UI, requires default component) and the new
service bootstrap (no UI, only side effects matter) use.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Builtin services — `registerBuiltinServices` + Settings example

**Files:**
- Create: `src/platform/services/builtinServices.ts`
- Create: `src/platform/services/__tests__/builtinServices.test.ts`
- Modify: `src/apps/registerBuiltins.ts`

- [ ] **Step 1: Write failing tests**

Create `src/platform/services/__tests__/builtinServices.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { registerBuiltinServices } from '../builtinServices';
import { serviceRegistry } from '../serviceRegistry';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { registerBuiltins } from '@/apps/registerBuiltins';
import { appRegistry } from '@/platform/appRegistry';

describe('registerBuiltinServices', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
  });

  it('populates the platform registry eagerly (no bootstrap needed)', async () => {
    registerBuiltinServices('builtin-x', [
      { name: 'a', execute: async () => 1 },
      { name: 'b', execute: async () => 2 },
    ]);
    await expect(serviceRegistry.list('builtin-x')).resolves.toEqual(
      expect.arrayContaining(['a', 'b']),
    );
  });
});

describe('Settings builtin service via registerBuiltins', () => {
  beforeEach(() => {
    serviceRegistry._resetForTests();
    // Wipe registry so registerBuiltins can run fresh.
    for (const e of appRegistry.list()) appRegistry.unregister(e.id);
    registerBuiltins();
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
  });

  it('settings.currentOwnerId returns null when viewing the player phone', async () => {
    await expect(
      serviceRegistry.invoke('settings', 'currentOwnerId'),
    ).resolves.toBeNull();
  });

  it('settings.currentOwnerId reflects live store updates (not a snapshot)', async () => {
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });
    await expect(
      serviceRegistry.invoke('settings', 'currentOwnerId'),
    ).resolves.toBe('char-001');

    usePhoneOwnerStore.setState({ phoneOwnerId: null });
    await expect(
      serviceRegistry.invoke('settings', 'currentOwnerId'),
    ).resolves.toBeNull();
  });
});
```

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test src/platform/services/__tests__/builtinServices.test.ts
```

Expected: FAIL — `registerBuiltinServices` not exported; Settings service not registered.

- [ ] **Step 3: Implement `registerBuiltinServices`**

Create `src/platform/services/builtinServices.ts`:

```typescript
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
```

- [ ] **Step 4: Register Settings' `currentOwnerId` service**

In `src/apps/registerBuiltins.ts`, add imports near the top:

```typescript
import { registerBuiltinServices } from '@/platform/services/builtinServices';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
```

Inside `registerBuiltins()`, after the `appRegistry.register({ id: 'settings', … })` line, add:

```typescript
  registerBuiltinServices('settings', [
    {
      name: 'currentOwnerId',
      description: '当前视角的角色 id (玩家视角时返回 null)',
      execute: async () => usePhoneOwnerStore.getState().phoneOwnerId,
    },
  ]);
```

- [ ] **Step 5: Verify**

```bash
pnpm test src/platform/services/__tests__/builtinServices.test.ts
```

Expected: all 3 tests PASS.

Run the full installer/moduleResolver/etc. suite to check the extra `registerBuiltins` path didn't break anything:

```bash
pnpm test src/platform/userApp/__tests__ src/apps/__tests__
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/platform/services/builtinServices.ts src/platform/services/__tests__/builtinServices.test.ts src/apps/registerBuiltins.ts
git commit -m "$(cat <<'EOF'
feat(services): registerBuiltinServices helper + settings.currentOwnerId

Builtins eagerly register at app-boot time via registerBuiltins.ts —
no sandbox, handlers are host code with direct Zustand access.

Settings exposes currentOwnerId as the first real builtin service,
reflecting phoneOwnerStore live (not a snapshot). This is the primary
demo of cross-domain service calls: a user app can now ask "whose
phone am I on?" without importing the host store.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Installer uninstall cleanup

**Files:**
- Modify: `src/platform/userApp/installer.ts`
- Modify: `src/platform/userApp/__tests__/installer.test.ts` (add one assertion to existing uninstall test, no new file needed)

- [ ] **Step 1: Write failing assertion**

Find the existing uninstall test in `src/platform/userApp/__tests__/installer.test.ts` (the one that asserts IDB + registry cleanup). Add after the existing asserts:

```typescript
    // Services for this app should also be cleared.
    const { serviceRegistry } = await import('@/platform/services/serviceRegistry');
    expect(await serviceRegistry.list(APP_ID)).toEqual([]);
```

Where `APP_ID` is the test app's id (use whatever local variable that test uses).

- [ ] **Step 2: Run — expect failure**

```bash
pnpm test src/platform/userApp/__tests__/installer.test.ts
```

Expected: the uninstall test fails because serviceRegistry still has (potentially) stale services for the id, or more importantly because `uninstall()` never called `unregisterApp`.

- [ ] **Step 3: Call `unregisterApp` in `uninstall`**

In `src/platform/userApp/installer.ts`, add an import at the top (near the other platform imports):

```typescript
import { serviceRegistry } from '@/platform/services/serviceRegistry';
```

Inside the existing `uninstall(appId)` function, after `appRegistry.unregister(appId)` (the last current step), add:

```typescript
  serviceRegistry.unregisterApp(appId);
```

- [ ] **Step 4: Verify**

```bash
pnpm test src/platform/userApp/__tests__/installer.test.ts
```

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/userApp/installer.ts src/platform/userApp/__tests__/installer.test.ts
git commit -m "$(cat <<'EOF'
feat(installer): clear serviceRegistry on uninstall

uninstall(appId) now additionally calls serviceRegistry.unregisterApp
so the app's services Map and bootstrap cache are dropped. A later
invoke of the same appId (e.g. after re-install) re-bootstraps
cleanly.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Wallet services.ts fixture + shop consumes balance

**Files:**
- Create: `src/platform/userApp/__tests__/fixtures/wallet-app/services.ts`
- Modify: `src/platform/userApp/__tests__/fixtures/wallet-app/manifest.json`
- Modify: `src/platform/userApp/__tests__/fixtures/shop-app/App.tsx`
- Modify: `src/platform/userApp/__tests__/m3.e2e.test.ts`

- [ ] **Step 1: Create wallet services.ts**

Create `src/platform/userApp/__tests__/fixtures/wallet-app/services.ts`:

```typescript
import { registerService } from '@hiphone/services';
import { get } from '@hiphone/storage';

const DEFAULT_BALANCE = 1000;

registerService({
  name: 'balance',
  description: '当前钱包余额 (CNY)',
  execute: async () => {
    const b = await get('balance');
    return typeof b === 'number' ? b : DEFAULT_BALANCE;
  },
});
```

- [ ] **Step 2: Update wallet manifest**

Edit `src/platform/userApp/__tests__/fixtures/wallet-app/manifest.json` — add `"services": "services.ts"` as a new field:

```json
{
  "id": "test-wallet",
  "name": "测试钱包",
  "version": "1.0.0",
  "entry": "App.tsx",
  "icon": "icon.svg",
  "perspectiveAware": false,
  "services": "services.ts"
}
```

- [ ] **Step 3: Shop consumes balance service on mount**

In `src/platform/userApp/__tests__/fixtures/shop-app/App.tsx`, add:

1. Import `invoke` and `useEffect` (likely already imported):

```typescript
import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import { invoke } from '@hiphone/services';
```

2. Inside the `ShopApp` component, add state + effect right after the existing `params` / `consumedRef` declarations:

```typescript
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    invoke('test-wallet', 'balance')
      .then((b) => {
        if (typeof b === 'number') setBalance(b);
      })
      .catch(() => {
        // test-wallet not installed — leave balance null (UI shows "未连接钱包")
        setBalance(null);
      });
  }, [params]); // refetch when we return from wallet with a payment result
```

3. Replace the price-to-button rendering for each item. Current code is:

```jsx
<button
  type="button"
  data-testid={isPrimary ? 'shop-buy' : undefined}
  onClick={() => buy(item)}
  className="..."
>
  立即购买
</button>
```

Replace with:

```jsx
<button
  type="button"
  data-testid={isPrimary ? 'shop-buy' : undefined}
  onClick={() => buy(item)}
  disabled={balance !== null && balance < item.price}
  className={
    balance !== null && balance < item.price
      ? 'mt-3 w-full bg-gray-200 text-gray-400 rounded-lg py-2 text-sm font-medium cursor-not-allowed'
      : 'mt-3 w-full bg-blue-500 text-white rounded-lg py-2 text-sm font-medium active:bg-blue-600 hover:bg-blue-600 transition-colors'
  }
>
  {balance !== null && balance < item.price ? '余额不足' : '立即购买'}
</button>
```

4. Just above the grid, add a balance readout banner:

```jsx
<div
  className="mb-3 flex items-center justify-between rounded-lg bg-white px-3 py-2 text-xs"
  style={{ border: '1px solid rgba(0,0,0,0.06)' }}
>
  <span style={{ color: 'var(--color-secondaryLabel)' }}>钱包余额</span>
  <span
    data-testid="shop-balance"
    style={{ color: 'var(--color-label)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
  >
    {balance === null ? '— 未连接' : `￥ ${balance}`}
  </span>
</div>
```

- [ ] **Step 4: Add new E2E tests**

Append to `src/platform/userApp/__tests__/m3.e2e.test.ts` (inside the existing top-level describe, after the last test):

```typescript
  it('shop reads wallet balance via service without mounting wallet', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    // Only shop renders. Wallet UI is never mounted.
    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });
    // Flush the mount-effect's async invoke:
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByTestId('shop-balance')).toHaveTextContent(/1000/);
  });

  it('shop shows "余额不足" when seeded balance is below item price', async () => {
    await install(await loadFixtureZip('shop-app'));
    await install(await loadFixtureZip('wallet-app'));

    // Seed wallet's balance to 50 directly in IDB so the service returns 50.
    // @hiphone/storage writes the owner-prefixed key `test-wallet:owner:me:balance`.
    const { appStorageSet } = await import('@/platform/userApp/appStorage');
    await appStorageSet('test-wallet', 'test-wallet:owner:me:balance', {
      appId: 'test-wallet',
      scope: 'owner',
      ownerId: 'me',
      userKey: 'balance',
      value: 50,
    });

    await act(async () => {
      render(React.createElement(AppScene, { appId: 'test-shop' }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    expect(screen.getByTestId('shop-balance')).toHaveTextContent(/50/);
    const btn = screen.getByTestId('shop-buy') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.textContent).toContain('余额不足');
  });
```

- [ ] **Step 5: Run E2E**

```bash
pnpm test src/platform/userApp/__tests__/m3.e2e.test.ts
```

Expected: all prior M3 E2E tests + 2 new tests PASS.

- [ ] **Step 6: Commit fixtures + shop consumer**

```bash
git add src/platform/userApp/__tests__/fixtures/wallet-app/ src/platform/userApp/__tests__/fixtures/shop-app/App.tsx src/platform/userApp/__tests__/m3.e2e.test.ts
git commit -m "$(cat <<'EOF'
test(fixtures): wallet exposes balance service; shop gates buttons

Wallet fixture now carries a services.ts that registers a balance
service backed by @hiphone/storage. Shop consumes it on mount via
@hiphone/services.invoke('test-wallet', 'balance') and renders:
  - A balance readout at the top of the grid
  - Each item button disabled + relabeled "余额不足" when the wallet
    balance is below the item's price

Two new E2E tests lock the behavior end-to-end:
  1. Shop reads default balance (1000) via service without wallet
     UI ever rendering — proves lazy bootstrap works.
  2. Seeded balance=50 → shop shows 50, 宝剑 (100) button disabled
     with "余额不足" label.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Full verification + repack demo zips + final commit

**Files:** none modified in this task; verify all earlier work holds together.

- [ ] **Step 1: Full test suite**

```bash
pnpm test
```

Expected: all tests PASS. Expected delta from prior baseline (~968): roughly +20 new tests across this plan → ~988 PASS.

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: zero new errors from this plan. Pre-existing PerformanceHUD typecheck issues from parallel perf-HUD work are acceptable.

- [ ] **Step 3: Build**

```bash
pnpm build
```

Expected: build succeeds. If `vite-plugin-pwa` complains about main-bundle > 2 MiB, note it's not caused by this plan; document in commit body if needed.

- [ ] **Step 4: Repack shop/wallet demo zips**

```bash
rm -f /tmp/shop.zip /tmp/wallet.zip
cd src/platform/userApp/__tests__/fixtures/shop-app && zip -r /tmp/shop.zip . -q && cd -
cd src/platform/userApp/__tests__/fixtures/wallet-app && zip -r /tmp/wallet.zip . -q && cd -
ls -la /tmp/shop.zip /tmp/wallet.zip
```

Expected: both zips produced. wallet.zip should now include `services.ts` alongside `manifest.json`, `App.tsx`, `icon.svg`.

Verify contents:
```bash
unzip -l /tmp/wallet.zip
```

Expected: 4 files: `App.tsx`, `icon.svg`, `manifest.json`, `services.ts`.

- [ ] **Step 5 (optional, recommended): Manual smoke test**

```bash
pnpm dev
```

In the running browser:
1. Open DevTools → Application → IndexedDB → delete `hiPhone-storage`
2. Reload
3. Open App Store → upload `/tmp/wallet.zip` → upload `/tmp/shop.zip`
4. Return to springboard — two new icons
5. Open shop **without opening wallet first**: balance readout shows 1000, all four item buttons enabled
6. Open wallet manually, click some expensive items to exhaust balance to below 30
7. Return to shop: readout reflects the new balance; lower-priced items still "立即购买", higher-priced items "余额不足"
8. Uninstall wallet via Manage tab → return to shop → balance readout shows "— 未连接"

All eight bullets should work without any friction.

- [ ] **Step 6: Acceptance commit**

```bash
git commit --allow-empty -m "$(cat <<'EOF'
chore(services): service registry complete — demo end-to-end green

Acceptance checklist (matches spec 2026-04-19-service-registry-design):

  [x] Wallet not opened once → shop can read wallet balance via service
  [x] Concurrent invokes share single bootstrap (one services.ts run)
  [x] Builtin (settings.currentOwnerId) callable immediately after boot,
      reflects live phoneOwnerStore state
  [x] Uninstall user app → services + bootstrap cache cleared
  [x] services.ts bootstrap failure → ServiceBootstrapError + retry on fix
  [x] Handler-internal @hiphone/storage routes to callee's data

All prior tests green; ~20 new tests landed across this plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance checklist (for verifying post-implementation)

- [ ] `pnpm test` all green (existing + ~20 new)
- [ ] `pnpm typecheck` no new errors
- [ ] `pnpm build` succeeds (pre-existing PWA precache warning unrelated)
- [ ] `/tmp/wallet.zip` contains `services.ts`
- [ ] `/tmp/shop.zip` App.tsx has the balance readout + gated buttons
- [ ] `serviceRegistry._resetForTests()` is exported (used in tests only; fine)
- [ ] `registerBuiltinServices` called exactly once for Settings in registerBuiltins.ts (idempotent if called again — test resets + re-registers)
- [ ] No new npm dependencies added
- [ ] Parent spec §9 AI Tool Registry future path preserved: `ServiceDef.description` and `ServiceDef.parameters` fields exist and are unused by Service Registry (consumed later)

## Out of scope (future work)

- **AI Tool Registry** — independent spec, builds on this
- **Permissions** — game context; any app can call any service
- **Reactive subscriptions** (`subscribe(appId, name, cb)`) — caller refetches for now
- **Timeout / cancellation** — caller's responsibility
- **Migrating `heartbeatTools.ts`** — AI Tool Registry stage
