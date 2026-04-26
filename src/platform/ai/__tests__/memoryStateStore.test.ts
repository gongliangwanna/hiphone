import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  useMemoryState,
  loadMemoryStateFromIdb,
  startMemoryStateIdbSync,
  stopMemoryStateIdbSync,
  _resetMemoryStateForTests,
} from '../memoryStateStore';
import { loadMemoryState } from '@/platform/storage/idbRecordStorage';

describe('memoryStateStore', () => {
  beforeEach(async () => {
    await _resetMemoryStateForTests();
  });

  it('getOrInit 不存在时创建初始 state', () => {
    const s = useMemoryState.getState().getOrInit('char-1');
    expect(s.characterId).toBe('char-1');
    expect(s.relationship.affinity).toBe(50);
  });

  it('getOrInit 已存在时返回原 state', () => {
    const a = useMemoryState.getState().getOrInit('char-1');
    a.relationship.affinity = 80;
    useMemoryState.getState().set('char-1', a);
    const b = useMemoryState.getState().getOrInit('char-1');
    expect(b.relationship.affinity).toBe(80);
  });

  it('set 触发 IDB 写入', async () => {
    startMemoryStateIdbSync();
    try {
      const s = useMemoryState.getState().getOrInit('char-1');
      s.relationship.affinity = 75;
      useMemoryState.getState().set('char-1', s);
      await new Promise((r) => setTimeout(r, 10));
      const persisted = await loadMemoryState('char-1');
      expect(persisted?.relationship.affinity).toBe(75);
    } finally {
      stopMemoryStateIdbSync();
    }
  });

  it('loadMemoryStateFromIdb 还原 state', async () => {
    startMemoryStateIdbSync();
    const s = useMemoryState.getState().getOrInit('char-1');
    s.relationship.affinity = 90;
    useMemoryState.getState().set('char-1', s);
    await new Promise((r) => setTimeout(r, 10));
    stopMemoryStateIdbSync();

    useMemoryState.setState({ states: {} });
    await loadMemoryStateFromIdb();
    expect(useMemoryState.getState().get('char-1')?.relationship.affinity).toBe(90);
  });
});
