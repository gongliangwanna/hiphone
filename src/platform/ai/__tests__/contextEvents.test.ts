import { describe, it, expect, beforeEach } from 'vitest';
import { injectSystemEvent } from '../contextEvents';
import { useCharacterMemory } from '../characterMemoryStore';

beforeEach(() => {
  useCharacterMemory.getState().clearAll();
});

describe('injectSystemEvent', () => {
  it('writes a role=system entry to memoryStore with the given message', () => {
    injectSystemEvent('char-001', '[上下文切换] 用户从 XingYu 切到了 ai-auction');
    const entries = useCharacterMemory.getState().getAll('char-001');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.role).toBe('system');
    expect(entries[0]!.speakerId).toBe('system');
    expect(entries[0]!.source).toBe('system');
    expect(entries[0]!.content).toBe(
      '[上下文切换] 用户从 XingYu 切到了 ai-auction',
    );
  });

  it('multiple calls append in order', () => {
    injectSystemEvent('char-001', 'event #1');
    injectSystemEvent('char-001', 'event #2');
    const entries = useCharacterMemory.getState().getAll('char-001');
    expect(entries.map((e) => e.content)).toEqual(['event #1', 'event #2']);
  });

  it('different characters are isolated', () => {
    injectSystemEvent('char-001', 'for A');
    injectSystemEvent('char-002', 'for B');
    expect(useCharacterMemory.getState().getAll('char-001').map((e) => e.content)).toEqual(['for A']);
    expect(useCharacterMemory.getState().getAll('char-002').map((e) => e.content)).toEqual(['for B']);
  });
});
