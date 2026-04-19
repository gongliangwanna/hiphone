import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  useCharacterMemory,
  loadCharacterMemoryFromIdb,
  startCharacterMemoryIdbSync,
  stopCharacterMemoryIdbSync,
  _resetCharacterMemoryForTests,
} from '../characterMemoryStore';

describe('characterMemoryStore — IDB persistence', () => {
  beforeEach(async () => {
    await _resetCharacterMemoryForTests();
  });

  it('append writes to IDB; reload restores the same entries', async () => {
    startCharacterMemoryIdbSync();

    const first = useCharacterMemory.getState().append('c1', {
      role: 'user', speakerId: 'me', content: 'hello', source: 'xingyu',
    });
    const second = useCharacterMemory.getState().append('c1', {
      role: 'assistant', speakerId: 'c1', content: 'hi', source: 'xingyu',
    });

    await new Promise((r) => setTimeout(r, 30));

    stopCharacterMemoryIdbSync();
    useCharacterMemory.setState({ entries: {} });

    await loadCharacterMemoryFromIdb();
    const restored = useCharacterMemory.getState().getAll('c1');
    expect(restored.map((e) => e.id)).toEqual([first.id, second.id]);
    expect(restored.map((e) => e.content)).toEqual(['hello', 'hi']);
  });

  it('entries across multiple characters are restored', async () => {
    startCharacterMemoryIdbSync();
    useCharacterMemory.getState().append('c-a', { role: 'user', speakerId: 'me', content: 'A', source: 'xingyu' });
    useCharacterMemory.getState().append('c-b', { role: 'user', speakerId: 'me', content: 'B', source: 'xingyu' });
    await new Promise((r) => setTimeout(r, 30));
    stopCharacterMemoryIdbSync();
    useCharacterMemory.setState({ entries: {} });

    await loadCharacterMemoryFromIdb();
    expect(useCharacterMemory.getState().getAll('c-a').map((e) => e.content)).toEqual(['A']);
    expect(useCharacterMemory.getState().getAll('c-b').map((e) => e.content)).toEqual(['B']);
  });

  it('replaceRange deletes removed records from IDB and writes the summary', async () => {
    startCharacterMemoryIdbSync();
    const api = useCharacterMemory.getState();
    const e1 = api.append('c1', { role: 'user', speakerId: 'me', content: 'a', source: 'xingyu' });
    /* e2 */ api.append('c1', { role: 'assistant', speakerId: 'c1', content: 'b', source: 'xingyu' });
    const e3 = api.append('c1', { role: 'user', speakerId: 'me', content: 'c', source: 'xingyu' });
    await new Promise((r) => setTimeout(r, 30));

    const summary = {
      id: 'sum-1',
      characterId: 'c1',
      role: 'system' as const,
      speakerId: 'system',
      content: 'summary a-c',
      source: 'system' as const,
      createdAt: e3.createdAt + 1,
      compressed: true as const,
    };
    api.replaceRange('c1', e1.id, e3.id, summary);
    await new Promise((r) => setTimeout(r, 30));

    stopCharacterMemoryIdbSync();
    useCharacterMemory.setState({ entries: {} });

    await loadCharacterMemoryFromIdb();
    const restored = useCharacterMemory.getState().getAll('c1');
    expect(restored).toHaveLength(1);
    expect(restored[0]!.id).toBe('sum-1');
  });

  it('clear removes all entries for a character from IDB', async () => {
    startCharacterMemoryIdbSync();
    useCharacterMemory.getState().append('c1', { role: 'user', speakerId: 'me', content: 'x', source: 'xingyu' });
    await new Promise((r) => setTimeout(r, 30));
    useCharacterMemory.getState().clear('c1');
    await new Promise((r) => setTimeout(r, 30));

    stopCharacterMemoryIdbSync();
    useCharacterMemory.setState({ entries: {} });

    await loadCharacterMemoryFromIdb();
    expect(useCharacterMemory.getState().getAll('c1')).toEqual([]);
  });
});
