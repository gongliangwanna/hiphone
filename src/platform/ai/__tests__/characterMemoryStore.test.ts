import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterMemory, type MemoryEntry } from '../characterMemoryStore';

describe('characterMemoryStore — basic actions', () => {
  beforeEach(() => {
    useCharacterMemory.getState().clearAll();
  });

  it('append returns a MemoryEntry with generated id + createdAt and characterId set', () => {
    const entry = useCharacterMemory.getState().append('char-001', {
      role: 'user',
      speakerId: 'me',
      content: 'hello',
      source: 'xingyu',
    });
    expect(entry.id).toMatch(/./);
    expect(entry.characterId).toBe('char-001');
    expect(entry.createdAt).toBeGreaterThan(0);
    expect(entry.role).toBe('user');
    expect(entry.speakerId).toBe('me');
    expect(entry.content).toBe('hello');
    expect(entry.source).toBe('xingyu');
  });

  it('getAll returns entries in insertion order for a character', () => {
    const api = useCharacterMemory.getState();
    api.append('char-001', { role: 'user', speakerId: 'me', content: 'first', source: 'xingyu' });
    api.append('char-001', { role: 'assistant', speakerId: 'char-001', content: 'second', source: 'xingyu' });
    const entries = useCharacterMemory.getState().getAll('char-001');
    expect(entries.map((e) => e.content)).toEqual(['first', 'second']);
  });

  it('getAll for an unknown character returns an empty array', () => {
    expect(useCharacterMemory.getState().getAll('char-never')).toEqual([]);
  });

  it('entries from different characters are isolated', () => {
    const api = useCharacterMemory.getState();
    api.append('char-a', { role: 'user', speakerId: 'me', content: 'A msg', source: 'xingyu' });
    api.append('char-b', { role: 'user', speakerId: 'me', content: 'B msg', source: 'xingyu' });
    expect(useCharacterMemory.getState().getAll('char-a').map((e) => e.content)).toEqual(['A msg']);
    expect(useCharacterMemory.getState().getAll('char-b').map((e) => e.content)).toEqual(['B msg']);
  });

  it('getSnapshot returns an immutable copy that does not reflect later mutations', () => {
    const api = useCharacterMemory.getState();
    api.append('char-001', { role: 'user', speakerId: 'me', content: 'first', source: 'xingyu' });
    const snapshot = useCharacterMemory.getState().getSnapshot('char-001');
    expect(snapshot).toHaveLength(1);
    api.append('char-001', { role: 'user', speakerId: 'me', content: 'second', source: 'xingyu' });
    expect(snapshot).toHaveLength(1);
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(2);
  });

  it('batchAppend preserves input order and returns all created entries', () => {
    const results = useCharacterMemory.getState().batchAppend('char-001', [
      { role: 'user', speakerId: 'me', content: 'one', source: 'xingyu' },
      { role: 'assistant', speakerId: 'char-001', content: 'two', source: 'xingyu' },
      { role: 'user', speakerId: 'me', content: 'three', source: 'xingyu' },
    ]);
    expect(results).toHaveLength(3);
    expect(results.map((e) => e.content)).toEqual(['one', 'two', 'three']);
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(3);
  });

  it('clear removes all entries for one character but leaves others', () => {
    const api = useCharacterMemory.getState();
    api.append('char-a', { role: 'user', speakerId: 'me', content: 'A', source: 'xingyu' });
    api.append('char-b', { role: 'user', speakerId: 'me', content: 'B', source: 'xingyu' });
    api.clear('char-a');
    expect(useCharacterMemory.getState().getAll('char-a')).toEqual([]);
    expect(useCharacterMemory.getState().getAll('char-b')).toHaveLength(1);
  });
});

describe('characterMemoryStore — replaceRange (for summarizer)', () => {
  beforeEach(() => {
    useCharacterMemory.getState().clearAll();
  });

  it('replaces a contiguous range with a single summary entry', () => {
    const api = useCharacterMemory.getState();
    const e1 = api.append('c', { role: 'user', speakerId: 'me', content: 'a', source: 'xingyu' });
    /* e2 */ api.append('c', { role: 'assistant', speakerId: 'c', content: 'b', source: 'xingyu' });
    const e3 = api.append('c', { role: 'user', speakerId: 'me', content: 'c', source: 'xingyu' });
    const e4 = api.append('c', { role: 'assistant', speakerId: 'c', content: 'd', source: 'xingyu' });

    const summary: MemoryEntry = {
      id: 'sum-1',
      characterId: 'c',
      role: 'system',
      speakerId: 'system',
      content: '[summary] a/b/c',
      source: 'system',
      createdAt: e3.createdAt + 1,
      compressed: true,
    };

    api.replaceRange('c', e1.id, e3.id, summary);

    const all = useCharacterMemory.getState().getAll('c');
    expect(all.map((x) => x.content)).toEqual(['[summary] a/b/c', 'd']);
    expect(all[0]!.compressed).toBe(true);
    expect(all[1]!.id).toBe(e4.id);
  });

  it('is a no-op when start or end id is missing', () => {
    const api = useCharacterMemory.getState();
    api.append('c', { role: 'user', speakerId: 'me', content: 'a', source: 'xingyu' });

    const summary: MemoryEntry = {
      id: 'x',
      characterId: 'c',
      role: 'system',
      speakerId: 'system',
      content: 'x',
      source: 'system',
      createdAt: Date.now(),
      compressed: true,
    };
    api.replaceRange('c', 'nonexistent', 'nonexistent', summary);
    expect(useCharacterMemory.getState().getAll('c')).toHaveLength(1);
  });
});
