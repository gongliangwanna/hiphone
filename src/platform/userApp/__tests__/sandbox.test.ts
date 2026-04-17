import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { compileTsx } from '../compiler';
import { executeSandboxed } from '../sandbox';

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
    // Sucrase `imports` transform tree-shakes unused specifiers in
    // `production` mode, so the binding must be referenced for the
    // `require('does-not-exist')` call to be emitted at module init.
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
});
