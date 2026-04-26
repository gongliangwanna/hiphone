// src/platform/ai/__tests__/toolRegistry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTools,
  getTools,
  getAllTools,
  unregisterApp,
  _resetToolRegistryForTests,
  type ToolBuildContext,
  type ToolDefinition,
} from '../toolRegistry';
import { useDisabledToolsStore } from '../disabledToolsStore';

describe('toolRegistry', () => {
  beforeEach(() => {
    _resetToolRegistryForTests();
  });

  it('registers and retrieves tools with static fields only', () => {
    registerTools('app-a', [
      { type: 'do_x', description: 'does x', param: 'string' },
    ]);
    expect(getTools('app-a')).toEqual([
      { type: 'do_x', description: 'does x', param: 'string' },
    ]);
  });

  it('preserves dynamicContext + contextAtTail on the registered tool', () => {
    const ctxFn = (ctx: ToolBuildContext) => `for ${ctx.characterId}`;
    registerTools('app-b', [
      {
        type: 'do_y',
        description: 'does y',
        param: '',
        dynamicContext: ctxFn,
        contextAtTail: true,
      },
    ]);
    const tools = getTools('app-b');
    expect(tools).toHaveLength(1);
    expect(tools[0]!.dynamicContext).toBe(ctxFn);
    expect(tools[0]!.contextAtTail).toBe(true);
    expect(
      tools[0]!.dynamicContext!({ appId: 'app-b', characterId: 'char-001' }),
    ).toBe('for char-001');
  });

  it('getTools returns a defensive copy (mutation does not leak)', () => {
    registerTools('app-c', [
      { type: 'a', description: '', param: '' },
    ]);
    const snapshot = getTools('app-c');
    snapshot.push({ type: 'b', description: '', param: '' });
    expect(getTools('app-c')).toHaveLength(1);
  });

  it('unregisterApp wipes the slot', () => {
    registerTools('app-d', [{ type: 'a', description: '', param: '' }]);
    unregisterApp('app-d');
    expect(getTools('app-d')).toEqual([]);
  });

  it('get returns [] for an unregistered appId', () => {
    expect(getTools('never-registered')).toEqual([]);
  });

  it('register replaces the previous registration for the same appId (not additive)', () => {
    registerTools('app-a', [
      { type: 'first', description: 'a', param: '' },
    ]);
    registerTools('app-a', [
      { type: 'second', description: 'b', param: '' },
    ]);
    expect(getTools('app-a')).toEqual([
      { type: 'second', description: 'b', param: '' },
    ]);
  });

  it('unregisterApp is a no-op for unknown appId', () => {
    expect(() => unregisterApp('never-registered')).not.toThrow();
  });

  it('apps are isolated - one app\'s tools do not leak into another', () => {
    registerTools('app-a', [{ type: 'tool_a', description: '', param: '' }]);
    registerTools('app-b', [{ type: 'tool_b', description: '', param: '' }]);
    expect(getTools('app-a').map((t) => t.type)).toEqual(['tool_a']);
    expect(getTools('app-b').map((t) => t.type)).toEqual(['tool_b']);
  });

  it('register defensive-copies the input array (caller push after register does not affect registry)', () => {
    const input: ToolDefinition[] = [{ type: 'a', description: '', param: '' }];
    registerTools('app-a', input);
    input.push({ type: 'injected', description: '', param: '' });
    const retrieved = getTools('app-a');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]!.type).toBe('a');
  });

  describe('getTools — disabled filter', () => {
    beforeEach(() => {
      _resetToolRegistryForTests();
      useDisabledToolsStore.setState({ disabled: {} });
    });

    it('returns all tools when nothing is disabled', () => {
      registerTools('app-x', [
        { type: 'a', description: '', param: '' },
        { type: 'b', description: '', param: '' },
      ]);
      expect(getTools('app-x').map((t) => t.type)).toEqual(['a', 'b']);
    });

    it('hides disabled tools from getTools', () => {
      registerTools('app-x', [
        { type: 'a', description: '', param: '' },
        { type: 'b', description: '', param: '' },
        { type: 'c', description: '', param: '' },
      ]);
      useDisabledToolsStore.getState().setDisabled('app-x', 'b', true);
      expect(getTools('app-x').map((t) => t.type)).toEqual(['a', 'c']);
    });

    it('shows ALL tools via getAllTools (used by Settings UI)', () => {
      registerTools('app-x', [
        { type: 'a', description: '', param: '' },
        { type: 'b', description: '', param: '' },
      ]);
      useDisabledToolsStore.getState().setDisabled('app-x', 'b', true);
      expect(getAllTools('app-x').map((t) => t.type)).toEqual(['a', 'b']);
    });

    it('disabled-tool isolation: filter on appId-A does not affect appId-B', () => {
      registerTools('app-a', [{ type: 'shared', description: '', param: '' }]);
      registerTools('app-b', [{ type: 'shared', description: '', param: '' }]);
      useDisabledToolsStore.getState().setDisabled('app-a', 'shared', true);
      expect(getTools('app-a')).toEqual([]);
      expect(getTools('app-b').map((t) => t.type)).toEqual(['shared']);
    });

    it('returns [] when ALL tools are disabled', () => {
      registerTools('app-x', [
        { type: 'a', description: '', param: '' },
        { type: 'b', description: '', param: '' },
      ]);
      const s = useDisabledToolsStore.getState();
      s.setDisabled('app-x', 'a', true);
      s.setDisabled('app-x', 'b', true);
      expect(getTools('app-x')).toEqual([]);
      expect(getAllTools('app-x').map((t) => t.type)).toEqual(['a', 'b']);
    });
  });
});
