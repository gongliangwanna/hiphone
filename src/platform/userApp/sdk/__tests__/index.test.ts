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

  it('throws for @hiphone/* submodules not yet available in M1', () => {
    expect(() => resolveModule('@hiphone/storage')).toThrow(/Module not found/);
    expect(() => resolveModule('@hiphone/ai')).toThrow(/Module not found/);
  });
});
