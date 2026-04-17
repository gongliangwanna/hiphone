import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { makeTestZip, installDevApi } from '../devInstall';
import { install } from '../installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { appRegistry } from '@/platform/appRegistry';

describe('makeTestZip', () => {
  it('returns a Blob from an inline spec', async () => {
    const blob = await makeTestZip({
      manifest: { id: 'hix', name: 'Hi', version: '1.0.0', entry: 'App.tsx' },
      files: {
        'App.tsx': `import React from 'react'; export default () => React.createElement('div', null, 'x');`,
      },
    });
    expect(blob).toBeInstanceOf(Blob);
    // Can be installed
    const result = await install(blob);
    expect(result.id).toBe('hix');
  });

  it('"todo" preset produces an installable zip', async () => {
    useInstalledUserAppsStore.setState({ apps: [] });
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));

    const blob = await makeTestZip('todo');
    const result = await install(blob);
    expect(result.id).toMatch(/todo/);
  });
});

describe('installDevApi', () => {
  beforeEach(() => {
    delete (globalThis as any).__hiphoneInstall;
    delete (globalThis as any).__hiphoneUninstall;
    delete (globalThis as any).__hiphoneMakeTestZip;
  });

  it('attaches __hiphoneInstall / __hiphoneUninstall / __hiphoneMakeTestZip', () => {
    installDevApi();
    expect(typeof (globalThis as any).__hiphoneInstall).toBe('function');
    expect(typeof (globalThis as any).__hiphoneUninstall).toBe('function');
    expect(typeof (globalThis as any).__hiphoneMakeTestZip).toBe('function');
  });
});
