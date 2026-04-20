// src/platform/ai/__tests__/toolRegistry.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTools,
  getTools,
  unregisterApp,
  _resetToolRegistryForTests,
  type ToolDefinition,
} from '../toolRegistry';

const SAMPLE: ToolDefinition[] = [
  { type: 'bid_call', description: '宣布叫价', param: '{item: string, min: number}' },
  { type: 'hammer_down', description: '落槌', param: '{item: string, final: number}' },
];

beforeEach(() => {
  _resetToolRegistryForTests();
});

describe('toolRegistry', () => {
  it('register + get round-trips the tool definitions', () => {
    registerTools('ai-auction', SAMPLE);
    expect(getTools('ai-auction')).toEqual(SAMPLE);
  });

  it('get returns [] for an unregistered appId', () => {
    expect(getTools('never-registered')).toEqual([]);
  });

  it('register replaces the previous registration for the same appId (not additive)', () => {
    registerTools('ai-auction', SAMPLE);
    registerTools('ai-auction', [{ type: 'x', description: 'y', param: '' }]);
    expect(getTools('ai-auction')).toEqual([{ type: 'x', description: 'y', param: '' }]);
  });

  it('unregisterApp clears the slot', () => {
    registerTools('ai-auction', SAMPLE);
    unregisterApp('ai-auction');
    expect(getTools('ai-auction')).toEqual([]);
  });

  it('unregisterApp is a no-op for unknown appId', () => {
    expect(() => unregisterApp('never-registered')).not.toThrow();
  });

  it('apps are isolated — one app’s tools do not leak into another', () => {
    registerTools('app-a', [{ type: 'tool_a', description: '', param: '' }]);
    registerTools('app-b', [{ type: 'tool_b', description: '', param: '' }]);
    expect(getTools('app-a').map((t) => t.type)).toEqual(['tool_a']);
    expect(getTools('app-b').map((t) => t.type)).toEqual(['tool_b']);
  });

  it('getTools returns a defensive copy (caller mutation must not affect registry)', () => {
    registerTools('app-a', SAMPLE);
    const retrieved = getTools('app-a');
    retrieved.push({ type: 'injected', description: '', param: '' });
    expect(getTools('app-a')).toEqual(SAMPLE); // unchanged
  });

  it('register defensive-copies the input array (caller push after register does not affect registry)', () => {
    const input: ToolDefinition[] = [{ type: 'a', description: '', param: '' }];
    registerTools('app-a', input);
    input.push({ type: 'injected', description: '', param: '' });
    const retrieved = getTools('app-a');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]!.type).toBe('a');
  });
});
