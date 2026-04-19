import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  serviceRegistry,
  ServiceNotFoundError,
  ServiceBootstrapError,
  type ServiceDef,
} from '../serviceRegistry';
import { appRegistry } from '@/platform/appRegistry';
import { install } from '@/platform/userApp/installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
} from '@/platform/storage/idbStorage';
import JSZip from 'jszip';

function def(name: string, value: unknown): ServiceDef {
  return { name, execute: async () => value };
}

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
      // Each bootstrap registers a uniquely-named marker service alongside
      // `echo`, so list('once') length tells us how many times services.ts
      // ran. Uses Date.now() + Math.random() which are NOT shadowed in the
      // sandbox (unlike globalThis).
      'services.ts': `
        import { registerService } from '@hiphone/services';
        registerService({
          name: 'bootstrap-marker-' + Date.now() + '-' + Math.random(),
          execute: async () => null,
        });
        registerService({ name: 'echo', execute: async (p) => p });
      `,
    });
    await install(zip);

    const [a, b, c] = await Promise.all([
      serviceRegistry.invoke('once', 'echo', 1),
      serviceRegistry.invoke('once', 'echo', 2),
      serviceRegistry.invoke('once', 'echo', 3),
    ]);
    expect([a, b, c]).toEqual([1, 2, 3]);
    // One marker per bootstrap; echo is shared. So 2 services total if one
    // bootstrap, 4 if two, etc.
    const names = await serviceRegistry.list('once');
    const markers = names.filter((n) => n.startsWith('bootstrap-marker-'));
    expect(markers.length).toBe(1);
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
      // Services module registers a marker w/ timestamp so we can observe
      // repeated bootstraps via list() length. Date.now()/Math.random()
      // survive the sandbox (only globalThis etc. are shadowed).
      'services.ts': `
        import { registerService } from '@hiphone/services';
        registerService({
          name: 'cycle-marker-' + Date.now() + '-' + Math.random(),
          execute: async () => null,
        });
        registerService({ name: 'x', execute: async () => 1 });
      `,
    });
    await install(zip);

    await serviceRegistry.invoke('cycle', 'x'); // bootstrap #1
    const markersAfter1 = (await serviceRegistry.list('cycle')).filter((n) =>
      n.startsWith('cycle-marker-'),
    );
    expect(markersAfter1.length).toBe(1);

    serviceRegistry.unregisterApp('cycle');
    await install(zip);
    await serviceRegistry.invoke('cycle', 'x'); // bootstrap #2
    const markersAfter2 = (await serviceRegistry.list('cycle')).filter((n) =>
      n.startsWith('cycle-marker-'),
    );
    // If bootstrap cache survived unregisterApp, markers would still be 0
    // after re-install (no re-run). Fresh bootstrap registers a new marker.
    expect(markersAfter2.length).toBe(1);
  });
});
