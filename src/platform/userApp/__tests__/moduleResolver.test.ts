import { describe, expect, it } from 'vitest';
import { resolveRelativePath, createUserAppRuntime } from '../moduleResolver';
import React from 'react';

describe('resolveRelativePath', () => {
  const compiledMap = {
    'App.tsx': 'irrelevant',
    'utils.ts': 'irrelevant',
    'components/TodoItem.tsx': 'irrelevant',
    'lib/index.tsx': 'irrelevant',
  };

  it('resolves "./utils" from App.tsx to utils.ts', () => {
    expect(resolveRelativePath('App.tsx', './utils', compiledMap)).toBe('utils.ts');
  });

  it('resolves "./components/TodoItem" from App.tsx', () => {
    expect(
      resolveRelativePath('App.tsx', './components/TodoItem', compiledMap),
    ).toBe('components/TodoItem.tsx');
  });

  it('resolves "./lib" as index.tsx when directory', () => {
    expect(resolveRelativePath('App.tsx', './lib', compiledMap)).toBe(
      'lib/index.tsx',
    );
  });

  it('resolves "../utils" from components/TodoItem.tsx', () => {
    expect(
      resolveRelativePath('components/TodoItem.tsx', '../utils', compiledMap),
    ).toBe('utils.ts');
  });

  it('throws when no candidate resolves', () => {
    expect(() =>
      resolveRelativePath('App.tsx', './missing', compiledMap),
    ).toThrow(/cannot resolve/i);
  });
});

import { compileTsx } from '../compiler';

describe('createUserAppRuntime — multi-file', () => {
  const sdkResolveMock = (spec: string) => {
    if (spec === 'react') return React;
    throw new Error('unknown spec: ' + spec);
  };

  it('handles entry that imports a sibling module', async () => {
    const compiledMap: Record<string, string> = {};
    compiledMap['App.tsx'] = await compileTsx(`
      import React from 'react';
      import { label } from './utils';
      export default function App() { return React.createElement('div', null, label); }
    `);
    compiledMap['utils.ts'] = await compileTsx(`
      export const label = 'hello-util';
    `);

    const Component = createUserAppRuntime(compiledMap, 'App.tsx', sdkResolveMock, 'test-app');
    const output = (Component as any)();
    expect(output.props.children).toBe('hello-util');
  });

  it('handles nested import path (./components/X)', async () => {
    const compiledMap: Record<string, string> = {};
    compiledMap['App.tsx'] = await compileTsx(`
      import React from 'react';
      import { TodoItem } from './components/TodoItem';
      export default function App() {
        return React.createElement(TodoItem, { text: 'x' });
      }
    `);
    compiledMap['components/TodoItem.tsx'] = await compileTsx(`
      import React from 'react';
      export function TodoItem({ text }) {
        return React.createElement('span', null, text);
      }
    `);

    const Component = createUserAppRuntime(compiledMap, 'App.tsx', sdkResolveMock, 'test-app');
    const output = (Component as any)();
    expect(output.type).toBeDefined();
  });

  it('handles circular dependency A ↔ B without infinite loop', async () => {
    const compiledMap: Record<string, string> = {};
    compiledMap['A.ts'] = await compileTsx(`
      import { b } from './B';
      export const a = 'A';
      export function greetB() { return b; }
    `);
    compiledMap['B.ts'] = await compileTsx(`
      import { a } from './A';
      export const b = 'B';
      export function greetA() { return a; }
    `);
    // Entry: a simple default-exporting wrapper
    compiledMap['Entry.tsx'] = await compileTsx(`
      import React from 'react';
      import { greetB } from './A';
      import { greetA } from './B';
      export default function Entry() {
        return React.createElement('div', null, greetA() + greetB());
      }
    `);

    const Component = createUserAppRuntime(
      compiledMap,
      'Entry.tsx',
      sdkResolveMock,
      'test-app',
    );
    const output = (Component as any)();
    expect(output.props.children).toBe('AB');
  });

  it('throws when entry does not export default', async () => {
    const compiledMap: Record<string, string> = {};
    compiledMap['App.tsx'] = await compileTsx(`
      export const x = 1;
    `);
    expect(() =>
      createUserAppRuntime(compiledMap, 'App.tsx', sdkResolveMock, 'test-app'),
    ).toThrow(/default/i);
  });

  it('throws when entry path not in compiledMap', () => {
    expect(() =>
      createUserAppRuntime({}, 'App.tsx', sdkResolveMock, 'test-app'),
    ).toThrow(/not in compiledMap/i);
  });
});
