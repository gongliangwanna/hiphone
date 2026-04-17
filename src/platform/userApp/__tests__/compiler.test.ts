import { describe, expect, it } from 'vitest';
import { compileTsx } from '../compiler';

describe('compileTsx', () => {
  it('compiles basic TSX to commonjs JS', async () => {
    const source = `
import React from 'react';

interface Props { name: string }

export default function Hello({ name }: Props) {
  return <div>Hello, {name}</div>;
}
    `;

    const compiled = await compileTsx(source);

    // After Sucrase transforms [typescript, jsx, imports], the output:
    // - Strips TypeScript interface
    // - Converts ESM import to require() calls
    // - Converts JSX to React.createElement (Sucrase emits _react2.default.createElement)
    // - Uses CommonJS-style `exports.default = ...` (writable on the same
    //   object reachable as module.exports from the sandbox)
    expect(compiled).toContain('require(');
    expect(compiled).toContain('react');
    expect(compiled).toMatch(
      /React\.createElement|_react\d*\.default\.createElement/,
    );
    expect(compiled).toMatch(/exports\.default|module\.exports/);
    expect(compiled).not.toContain('interface Props');
  });

  it('compiles TSX with @hiphone/ui import', async () => {
    const source = `
import React from 'react';
import { NavBar } from '@hiphone/ui';

export default function App() {
  return <NavBar title="Test" />;
}
    `;

    const compiled = await compileTsx(source);

    expect(compiled).toContain('@hiphone/ui');
    expect(compiled).toMatch(/exports\.default|module\.exports/);
  });

  it('throws on syntax errors', async () => {
    const bad = `export default function Broken({ { { `;
    await expect(compileTsx(bad)).rejects.toThrow();
  });

  it('emits inline source map (sourceMappingURL)', async () => {
    const compiled = await compileTsx(`
import React from 'react';
export default function App() {
  return <div>hi</div>;
}
    `);

    // Source map is appended as a base64 data URL comment at the end.
    expect(compiled).toMatch(/\/\/# sourceMappingURL=data:application\/json;base64,/);
  });

  it('uses the provided filePath in the source map', async () => {
    const compiled = await compileTsx(
      `export default function App() { return null; }`,
      'my-todo.tsx',
    );

    const match = compiled.match(/sourceMappingURL=data:application\/json;base64,(.+)/);
    expect(match).not.toBeNull();
    // Decode the map and check sources field mentions our filePath
    const mapJson = atob(match![1]!.trim());
    const map = JSON.parse(mapJson);
    expect(map.sources?.some((s: string) => s.includes('my-todo'))).toBe(true);
  });
});
