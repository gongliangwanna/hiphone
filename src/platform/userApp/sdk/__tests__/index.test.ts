import { describe, expect, it } from 'vitest';
import React from 'react';
import { resolveModule } from '../index';

describe('resolveModule', () => {
  it('resolves "react" to the React namespace', () => {
    const mod = resolveModule('react');
    expect(mod).toBe(React);
  });

  it('resolves "@hiphone/ui" to an object with NavBar', () => {
    const mod = resolveModule('@hiphone/ui') as { NavBar: unknown };
    expect(typeof mod.NavBar).toBe('function');
  });

  it('throws for unknown specifier', () => {
    expect(() => resolveModule('lodash')).toThrow(/Module not found/);
  });

  it('resolves "@hiphone/storage" to the storage SDK (M2 S3)', () => {
    const mod = resolveModule('@hiphone/storage') as Record<string, unknown>;
    expect(typeof mod.get).toBe('function');
    expect(typeof mod.set).toBe('function');
    expect(typeof mod.remove).toBe('function');
    expect(typeof mod.list).toBe('function');
    expect(typeof mod.globalGet).toBe('function');
    expect(typeof mod.globalSet).toBe('function');
  });

  it('throws for @hiphone/* submodules not yet available', () => {
    expect(() => resolveModule('@hiphone/ai')).toThrow(/Module not found/);
  });

  it('does NOT leak prototype-chain keys (toString, constructor, etc.)', () => {
    // The `in` operator would walk the prototype chain; Object.hasOwn does not.
    // Guard against future regressions that might switch back to `in`.
    expect(() => resolveModule('toString')).toThrow(/Module not found/);
    expect(() => resolveModule('constructor')).toThrow(/Module not found/);
    expect(() => resolveModule('hasOwnProperty')).toThrow(/Module not found/);
    expect(() => resolveModule('__proto__')).toThrow(/Module not found/);
  });
});
