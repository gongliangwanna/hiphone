import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTools,
  getTools,
  unregisterApp,
  _resetToolRegistryForTests,
  type ToolDefinition,
} from '../toolRegistry';

const SAMPLE: ToolDefinition[] = [
  { name: 'bid_call', description: '宣布叫价', parameters: { item: 'string', min: 'number' } },
  { name: 'hammer_down', description: '落槌', parameters: { item: 'string', final: 'number' } },
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
    registerTools('ai-auction', [{ name: 'x', description: 'y', parameters: {} }]);
    expect(getTools('ai-auction')).toEqual([{ name: 'x', description: 'y', parameters: {} }]);
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
    registerTools('app-a', [{ name: 'tool_a', description: '', parameters: {} }]);
    registerTools('app-b', [{ name: 'tool_b', description: '', parameters: {} }]);
    expect(getTools('app-a').map((t) => t.name)).toEqual(['tool_a']);
    expect(getTools('app-b').map((t) => t.name)).toEqual(['tool_b']);
  });

  it('getTools returns a defensive copy (caller mutation must not affect registry)', () => {
    registerTools('app-a', SAMPLE);
    const retrieved = getTools('app-a');
    retrieved.push({ name: 'injected', description: '', parameters: {} });
    expect(getTools('app-a')).toEqual(SAMPLE); // unchanged
  });

  it('register defensive-copies the input array (caller push after register does not affect registry)', () => {
    const input: ToolDefinition[] = [
      { name: 'a', description: '', parameters: {} },
    ];
    registerTools('app-a', input);
    input.push({ name: 'injected', description: '', parameters: {} });
    const retrieved = getTools('app-a');
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0]!.name).toBe('a');
  });
});
