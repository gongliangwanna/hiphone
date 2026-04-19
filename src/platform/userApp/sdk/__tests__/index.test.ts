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

  it('resolves "@hiphone/ai" to an object with complete / streamComplete / getCharacters / extractPlainText', () => {
    const mod = resolveModule('@hiphone/ai') as {
      complete: unknown;
      streamComplete: unknown;
      getCharacters: unknown;
      extractPlainText: unknown;
      AIUnavailableError: unknown;
    };
    expect(typeof mod.complete).toBe('function');
    expect(typeof mod.streamComplete).toBe('function');
    expect(typeof mod.getCharacters).toBe('function');
    expect(typeof mod.extractPlainText).toBe('function');
    expect(mod.AIUnavailableError).toBeDefined();
  });

  it("resolveModule('@hiphone/ai') exposes M4.2 registry surface", () => {
    const mod = resolveModule('@hiphone/ai') as Record<string, unknown>;
    expect(typeof mod.registerTools).toBe('function');
    expect(typeof mod.registerReplyRenderer).toBe('function');
    expect(typeof mod.registerAppSystemPrompt).toBe('function');
    expect(typeof mod.injectSystemEvent).toBe('function');
  });

  it('resolves "@hiphone/nav" to an object with open and goHome', () => {
    const mod = resolveModule('@hiphone/nav') as { open: unknown; goHome: unknown };
    expect(typeof mod.open).toBe('function');
    expect(typeof mod.goHome).toBe('function');
  });

  it('resolves "@hiphone/toast" to an object with show/warn/error', () => {
    const mod = resolveModule('@hiphone/toast') as { show: unknown; warn: unknown; error: unknown };
    expect(typeof mod.show).toBe('function');
    expect(typeof mod.warn).toBe('function');
    expect(typeof mod.error).toBe('function');
  });

  it('resolves "lucide-react" to the host icon library namespace', () => {
    const mod = resolveModule('lucide-react') as Record<string, unknown>;
    // Sample icons the user apps would typically import. Any one missing
    // would indicate the namespace re-export broke.
    expect(mod.Sword).toBeDefined();
    expect(mod.Shield).toBeDefined();
    expect(mod.Gem).toBeDefined();
  });

  it('resolves "@hiphone/banner" to an object with show and dismiss', () => {
    const mod = resolveModule('@hiphone/banner') as { show: unknown; dismiss: unknown };
    expect(typeof mod.show).toBe('function');
    expect(typeof mod.dismiss).toBe('function');
  });

  it('resolves "@hiphone/services" to an object with registerService, invoke, list', () => {
    const mod = resolveModule('@hiphone/services') as {
      registerService: unknown;
      invoke: unknown;
      list: unknown;
    };
    expect(typeof mod.registerService).toBe('function');
    expect(typeof mod.invoke).toBe('function');
    expect(typeof mod.list).toBe('function');
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
