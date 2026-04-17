import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { compileTsx } from '../compiler';
import { executeInSandbox, executeSandboxed } from '../sandbox';

describe('executeSandboxed', () => {
  function makeResolver(modules: Record<string, unknown>) {
    return (specifier: string) => {
      if (specifier in modules) return modules[specifier];
      throw new Error(`Module not found: ${specifier}`);
    };
  }

  it('executes compiled code and returns default export', async () => {
    const compiled = await compileTsx(`
import React from 'react';
export default function Hello() {
  return React.createElement('div', null, 'hello');
}
    `);

    const Component = executeSandboxed(compiled, makeResolver({ react: React }));

    expect(typeof Component).toBe('function');
    const element = (Component as React.FC)({});
    expect(React.isValidElement(element)).toBe(true);
  });

  it('forwards require() calls to the resolver', async () => {
    const fakeUi = { NavBar: () => null };
    const compiled = await compileTsx(`
import React from 'react';
import { NavBar } from '@hiphone/ui';
export default function App() {
  return React.createElement(NavBar, null);
}
    `);

    const resolver = vi.fn(makeResolver({ react: React, '@hiphone/ui': fakeUi }));
    executeSandboxed(compiled, resolver);

    expect(resolver).toHaveBeenCalledWith('react');
    expect(resolver).toHaveBeenCalledWith('@hiphone/ui');
  });

  it('resolver errors propagate', async () => {
    // Sucrase's `imports` transform drops named imports whose bindings are
    // never referenced (the whole require() call is elided). Reference
    // `missing` in the body so require('does-not-exist') is emitted.
    const compiled = await compileTsx(`
import { missing } from 'does-not-exist';
export default function App() { return missing; }
    `);

    expect(() => {
      executeSandboxed(compiled, makeResolver({ react: React }));
    }).toThrow(/Module not found/);
  });

  it('shadows global window/document/fetch inside user code', async () => {
    const compiled = await compileTsx(`
export default function Probe() {
  return { win: typeof window, doc: typeof document, fet: typeof fetch };
}
    `);

    const Probe = executeSandboxed(
      compiled,
      makeResolver({}),
    ) as unknown as () => { win: string; doc: string; fet: string };

    const probed = Probe();
    expect(probed.win).toBe('undefined');
    expect(probed.doc).toBe('undefined');
    expect(probed.fet).toBe('undefined');
  });

  it('provides React as both injected parameter and via require("react")', async () => {
    const compiled = await compileTsx(`
import React, { createElement } from 'react';
export default function App() {
  return createElement('span', null, 'ok');
}
    `);

    const App = executeSandboxed(compiled, makeResolver({ react: React }));
    const rendered = (App as React.FC)({});
    expect(React.isValidElement(rendered)).toBe(true);
  });

  it('wraps module-init errors with context + preserves cause', async () => {
    const compiled = await compileTsx(`
export default function App() { return null; }
throw new Error('boom');
    `);

    try {
      executeSandboxed(compiled, makeResolver({}));
      throw new Error('expected executeSandboxed to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).message).toContain('User app module initialization failed');
      expect((err as Error).message).toContain('boom');
      // ES2022 cause chain preserves the original error
      expect((err as Error & { cause?: unknown }).cause).toBeInstanceOf(Error);
      expect(((err as Error & { cause?: Error }).cause as Error).message).toBe('boom');
    }
  });

  it('throws the platform error when default export is not a function', async () => {
    // Hand-written CJS (not Sucrase output) — directly assigns non-function.
    const handWritten = 'module.exports.default = 42;';
    expect(() => executeSandboxed(handWritten, () => null)).toThrow(
      /did not export a default component/,
    );
  });
});

describe('executeInSandbox (low-level)', () => {
  it('populates the caller-provided module.exports', () => {
    const code = `
      module.exports.hello = function() { return 'world'; };
    `;
    const module = { exports: {} as any };
    executeInSandbox(code, () => undefined, module);
    expect(typeof module.exports.hello).toBe('function');
    expect(module.exports.hello()).toBe('world');
  });

  it('allows require to return host modules', () => {
    const code = `
      var r = require('react');
      module.exports.r = r;
    `;
    const module = { exports: {} as any };
    executeInSandbox(code, (spec) => (spec === 'react' ? React : undefined), module);
    expect(module.exports.r).toBe(React);
  });

  it('shadows window / document globals (returns undefined)', () => {
    const code = `
      module.exports.win = typeof window;
      module.exports.doc = typeof document;
    `;
    const module = { exports: {} as any };
    executeInSandbox(code, () => undefined, module);
    expect(module.exports.win).toBe('undefined');
    expect(module.exports.doc).toBe('undefined');
  });
});

describe('executeSandboxed (high-level backward-compat)', () => {
  it('still returns the default export as before', () => {
    const code = `
      module.exports.default = function() { return 'ok'; };
    `;
    const Component = executeSandboxed(code, () => undefined);
    expect(typeof Component).toBe('function');
    expect((Component as any)()).toBe('ok');
  });
});
