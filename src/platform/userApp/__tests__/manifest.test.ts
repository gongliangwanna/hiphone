import { describe, expect, it } from 'vitest';
import { validateManifest, ManifestError } from '../manifest';

describe('validateManifest', () => {
  it('accepts a minimal valid manifest', () => {
    const result = validateManifest({
      id: 'my-todo',
      name: '待办',
      version: '1.0.0',
      entry: 'App.tsx',
    });
    expect(result.id).toBe('my-todo');
    expect(result.perspectiveAware).toBe(false); // default
  });

  it('accepts perspectiveAware and icon', () => {
    const result = validateManifest({
      id: 'app2',
      name: 'App',
      version: '1.0.0',
      entry: 'App.tsx',
      icon: 'icon.png',
      perspectiveAware: true,
    });
    expect(result.perspectiveAware).toBe(true);
    expect(result.icon).toBe('icon.png');
  });

  it('accepts edgeToEdge + statusBarStyle', () => {
    const result = validateManifest({
      id: 'immersive',
      name: 'X',
      version: '1.0.0',
      entry: 'App.tsx',
      edgeToEdge: true,
      statusBarStyle: 'light',
    });
    expect(result.edgeToEdge).toBe(true);
    expect(result.statusBarStyle).toBe('light');
  });

  it('defaults edgeToEdge + statusBarStyle to undefined when absent', () => {
    const result = validateManifest({
      id: 'plain', name: 'X', version: '1.0.0', entry: 'App.tsx',
    });
    expect(result.edgeToEdge).toBeUndefined();
    expect(result.statusBarStyle).toBeUndefined();
  });

  it('rejects invalid statusBarStyle value', () => {
    expect(() =>
      validateManifest({
        id: 'bad',
        name: 'X',
        version: '1.0.0',
        entry: 'App.tsx',
        statusBarStyle: 'blue',
      }),
    ).toThrow(/statusBarStyle/);
  });

  it('ignores unknown optional fields (author, description, permissions, aiTools)', () => {
    const result = validateManifest({
      id: 'app3', name: 'X', version: '1.0.0', entry: 'App.tsx',
      author: 'foo', description: 'bar', permissions: ['x'], aiTools: 'AI.tsx',
    });
    expect(result.id).toBe('app3');
    // these fields pass through but have no M2 behavior
    expect(result.author).toBe('foo');
  });

  it('rejects missing required field', () => {
    expect(() => validateManifest({ id: 'x', name: 'x', version: '1.0.0' })).toThrow(
      ManifestError,
    );
    expect(() => validateManifest({ name: 'x', version: '1.0.0', entry: 'a.tsx' })).toThrow(
      ManifestError,
    );
  });

  it('rejects invalid id format', () => {
    expect(() =>
      validateManifest({ id: 'Foo', name: 'x', version: '1.0.0', entry: 'a.tsx' }),
    ).toThrow(/id.*pattern/i);
    expect(() =>
      validateManifest({ id: '1abc', name: 'x', version: '1.0.0', entry: 'a.tsx' }),
    ).toThrow();
    expect(() =>
      validateManifest({ id: '__reserved', name: 'x', version: '1.0.0', entry: 'a.tsx' }),
    ).toThrow(/reserved/i);
    expect(() =>
      validateManifest({ id: 'ab', name: 'x', version: '1.0.0', entry: 'a.tsx' }),
    ).toThrow(/length/i);
  });

  it('rejects non-object input', () => {
    expect(() => validateManifest(null)).toThrow();
    expect(() => validateManifest('string')).toThrow();
    expect(() => validateManifest([])).toThrow();
  });
});
