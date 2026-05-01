import { beforeEach, describe, expect, it } from 'vitest';
import { usePresenceStore } from '../presenceStore';

beforeEach(() => {
  usePresenceStore.setState({
    activeSession: null,
    records: [],
    recentScenes: [],
  });
});

describe('presenceStore', () => {
  it('creates a temporary session without records', () => {
    const session = usePresenceStore.getState().startSession({
      characterId: 'char-001',
      sceneText: '雨夜的便利店门口。',
      presetSceneId: 'convenience-rain',
    });

    expect(session.characterId).toBe('char-001');
    expect(session.backdropId).toBe('convenience-rain');
    expect(session.turns).toEqual([]);
    expect(usePresenceStore.getState().records).toEqual([]);
  });

  it('completes a session into a read-only record and clears active session', () => {
    const session = usePresenceStore.getState().startSession({
      characterId: 'char-001',
      sceneText: '深夜厨房。',
      presetSceneId: 'kitchen-night',
    });
    usePresenceStore.getState().appendTurn(session.id, 'user', '我坐下来。');
    usePresenceStore.getState().appendTurn(session.id, 'assistant', '（她倒了一杯水）');

    const record = usePresenceStore.getState().completeSession(
      session.id,
      {
        scene: '深夜厨房',
        whatHappened: '两人坐下聊天。',
        emotionalShift: '气氛变得安静。',
      },
      'mem-1',
      123,
    );

    expect(record?.memoryEntryId).toBe('mem-1');
    expect(record?.turns).toHaveLength(2);
    expect(usePresenceStore.getState().activeSession).toBeNull();
    expect(usePresenceStore.getState().records).toHaveLength(1);
  });

  it('discarding a session does not create a record', () => {
    const session = usePresenceStore.getState().startSession({
      characterId: 'char-001',
      sceneText: '傍晚天台。',
    });

    usePresenceStore.getState().discardSession(session.id);

    expect(usePresenceStore.getState().activeSession).toBeNull();
    expect(usePresenceStore.getState().records).toEqual([]);
  });
});
