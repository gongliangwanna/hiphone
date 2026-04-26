import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  putMemoryState,
  loadMemoryState,
  loadAllMemoryStates,
  deleteMemoryState,
} from '../idbRecordStorage';
import { makeInitialState } from '@/platform/ai/memoryStateTypes';

describe('idbRecordStorage — memoryState', () => {
  beforeEach(async () => {
    const all = await loadAllMemoryStates();
    for (const s of all) await deleteMemoryState(s.characterId);
  });

  it('put + load 单条', async () => {
    const s = makeInitialState('char-1');
    await putMemoryState(s);
    const loaded = await loadMemoryState('char-1');
    expect(loaded).toEqual(s);
  });

  it('load 不存在的 characterId 返回 null', async () => {
    const loaded = await loadMemoryState('nonexistent');
    expect(loaded).toBeNull();
  });

  it('loadAll 返回多条', async () => {
    await putMemoryState(makeInitialState('char-1'));
    await putMemoryState(makeInitialState('char-2'));
    const all = await loadAllMemoryStates();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.characterId).sort()).toEqual(['char-1', 'char-2']);
  });

  it('put 覆盖同 characterId', async () => {
    await putMemoryState(makeInitialState('char-1'));
    const updated = makeInitialState('char-1');
    updated.relationship.affinity = 80;
    await putMemoryState(updated);
    const loaded = await loadMemoryState('char-1');
    expect(loaded?.relationship.affinity).toBe(80);
  });

  it('delete 后 load 返回 null', async () => {
    await putMemoryState(makeInitialState('char-1'));
    await deleteMemoryState('char-1');
    expect(await loadMemoryState('char-1')).toBeNull();
  });
});
