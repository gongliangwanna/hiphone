import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { migrateLegacyLongTermMemory } from '../memoryStateMigration';
import {
  useCharacterMemory,
  _resetCharacterMemoryForTests,
} from '../characterMemoryStore';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';

describe('migrateLegacyLongTermMemory', () => {
  beforeEach(async () => {
    await _resetCharacterMemoryForTests();
    await _resetMemoryStateForTests();
  });

  it('遇到 compressed=true 的 system entry → 迁移到 state.episodicSummary 并删除', async () => {
    useCharacterMemory.setState({
      entries: {
        'char-1': [
          {
            id: 'legacy-1', characterId: 'char-1', role: 'system',
            speakerId: 'system', content: '[长期记忆]\n旧的记忆',
            source: 'system', createdAt: 100, compressed: true,
          },
          {
            id: 'live-1', characterId: 'char-1', role: 'user',
            speakerId: 'me', content: 'hi', source: 'xingyu', createdAt: 200,
          },
        ],
      },
    });

    await migrateLegacyLongTermMemory();

    const state = useMemoryState.getState().get('char-1');
    expect(state?.episodicSummary?.content).toContain('旧的记忆');

    const remaining = useCharacterMemory.getState().getAll('char-1');
    expect(remaining.find((e) => e.id === 'legacy-1')).toBeUndefined();
    expect(remaining.find((e) => e.id === 'live-1')).toBeDefined();
  });

  it('已有 episodicSummary 不覆盖', async () => {
    useCharacterMemory.setState({
      entries: {
        'char-1': [{
          id: 'legacy-1', characterId: 'char-1', role: 'system',
          speakerId: 'system', content: '[长期记忆]\n旧的',
          source: 'system', createdAt: 100, compressed: true,
        }],
      },
    });
    useMemoryState.getState().set('char-1', {
      ...useMemoryState.getState().getOrInit('char-1'),
      episodicSummary: { content: '新的', version: 1, coveringUpTo: 0, lastUpdatedAt: 0 },
    });

    await migrateLegacyLongTermMemory();

    expect(useMemoryState.getState().get('char-1')?.episodicSummary?.content).toBe('新的');
  });

  it('无 legacy entry 时是 no-op', async () => {
    await migrateLegacyLongTermMemory();
    expect(useMemoryState.getState().get('char-1')).toBeUndefined();
  });

  it('幂等：重复跑不重复迁移', async () => {
    useCharacterMemory.setState({
      entries: {
        'char-1': [{
          id: 'legacy-1', characterId: 'char-1', role: 'system',
          speakerId: 'system', content: '[长期记忆]\nX',
          source: 'system', createdAt: 100, compressed: true,
        }],
      },
    });
    await migrateLegacyLongTermMemory();
    await migrateLegacyLongTermMemory();
    expect(useMemoryState.getState().get('char-1')?.episodicSummary?.content).toContain('X');
  });
});
