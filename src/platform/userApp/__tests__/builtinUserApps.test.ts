import React from 'react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { appRegistry } from '@/platform/appRegistry';
import {
  BUILTIN_USER_APPS,
  mountBuiltinUserApps,
  type BuiltinUserApp,
} from '../builtinUserApps';

describe('BUILTIN_USER_APPS shape', () => {
  it('translate entry exists with right fields', () => {
    const translate = BUILTIN_USER_APPS.find((a) => a.id === 'translate');
    expect(translate).toBeDefined();
    expect(translate!.name).toBe('翻译');
    expect(translate!.entry).toBe('TranslateApp.tsx');
    expect(translate!.files['TranslateApp.tsx']).toBeTruthy();
    expect(translate!.perspectiveAware).toBe(true);
    expect(translate!.globalData).toBe(false);
  });
});

describe('mountBuiltinUserApps', () => {
  beforeEach(() => {
    appRegistry.unregister('translate');
  });

  afterEach(() => {
    cleanup();
    appRegistry.unregister('translate');
  });

  it('registers translate as type: builtin', async () => {
    await mountBuiltinUserApps();

    const entry = appRegistry.get('translate');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('builtin');
    expect(entry!.name).toBe('翻译');
    expect(typeof entry!.component).toBe('function');
  });

  it('registered component renders without throwing', async () => {
    await mountBuiltinUserApps();

    const entry = appRegistry.get('translate');
    expect(entry).toBeDefined();

    // Should render without throwing — errors are caught by UserAppErrorBoundary
    expect(() => render(React.createElement(entry!.component))).not.toThrow();
  });

  it('failing app does not break other apps in the list', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Inject a broken app at the front (entry file not in files map)
    const brokenApp: BuiltinUserApp = {
      id: '__broken__',
      name: 'Broken',
      entry: 'Missing.tsx',
      files: { 'Other.tsx': 'export default function X(){}' },
      perspectiveAware: false,
      globalData: false,
    };
    BUILTIN_USER_APPS.unshift(brokenApp);

    try {
      await mountBuiltinUserApps();

      // translate should still be registered despite broken app failing
      const translateEntry = appRegistry.get('translate');
      expect(translateEntry).toBeDefined();
      expect(translateEntry!.type).toBe('builtin');

      // The broken app must NOT register — guards against future refactors
      // that register partial/corrupt entries before throwing.
      expect(appRegistry.has('__broken__')).toBe(false);

      // console.error should have been called for the broken app
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringContaining('[builtinUserApps] failed to mount "__broken__"'),
        expect.anything(),
      );
    } finally {
      BUILTIN_USER_APPS.shift();
      appRegistry.unregister('__broken__');
      errSpy.mockRestore();
    }
  });
});
