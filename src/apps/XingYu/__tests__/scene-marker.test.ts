import { describe, it, expect, beforeEach } from 'vitest';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import { ensureSceneMarker, SCENE_PREFIX } from '../sceneMarker';
import type { Conversation } from '../data';

const baseConv: Conversation = {
  id: 'c-char-a',
  idolId: 'a',
  unread: 0,
  lastMsg: '',
  lastTime: 0,
  characterId: 'a',
};

const groupConv: Conversation = {
  id: 'c-grp-1',
  idolId: 'group',
  unread: 0,
  lastMsg: '',
  lastTime: 0,
  groupName: '小队',
  groupMemberIds: ['a', 'b', 'c'],
};

describe('ensureSceneMarker', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        { id: 'a', name: '甲', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'b', name: '乙', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'c', name: '丙', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useCharacterMemory.setState({ entries: {} });
  });

  it('inserts a single-chat scene marker for a fresh character', () => {
    ensureSceneMarker('a', baseConv);
    const entries = useCharacterMemory.getState().getAll('a');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.role).toBe('system');
    expect(entries[0]!.content).toMatch(/一对一私聊/);
  });

  it('inserts a group scene marker including group name and members', () => {
    ensureSceneMarker('a', groupConv);
    const entries = useCharacterMemory.getState().getAll('a');
    expect(entries).toHaveLength(1);
    expect(entries[0]!.content).toContain(SCENE_PREFIX);
    expect(entries[0]!.content).toContain('「小队」');
    expect(entries[0]!.content).toContain('甲、乙、丙');
  });

  it('is idempotent — repeated calls in the same scene do not duplicate the marker', () => {
    ensureSceneMarker('a', groupConv);
    ensureSceneMarker('a', groupConv);
    ensureSceneMarker('a', groupConv);
    const entries = useCharacterMemory.getState().getAll('a');
    expect(entries).toHaveLength(1);
  });

  it('appends a new marker on single → group transition', () => {
    ensureSceneMarker('a', baseConv);
    ensureSceneMarker('a', groupConv);
    const entries = useCharacterMemory.getState().getAll('a');
    expect(entries).toHaveLength(2);
    expect(entries[0]!.content).toMatch(/一对一私聊/);
    expect(entries[1]!.content).toMatch(/群聊/);
  });

  it('appends a new marker on group → single transition', () => {
    ensureSceneMarker('a', groupConv);
    ensureSceneMarker('a', baseConv);
    const entries = useCharacterMemory.getState().getAll('a');
    expect(entries).toHaveLength(2);
    expect(entries[1]!.content).toMatch(/一对一私聊/);
  });

  it('appends a new marker when group membership changes', () => {
    ensureSceneMarker('a', groupConv);
    const reduced: Conversation = {
      ...groupConv,
      groupMemberIds: ['a', 'b'],
      groupName: '甲、乙',
    };
    ensureSceneMarker('a', reduced);
    const entries = useCharacterMemory.getState().getAll('a');
    expect(entries).toHaveLength(2);
    expect(entries[1]!.content).toContain('甲、乙');
  });

  it('does not affect an unrelated character', () => {
    ensureSceneMarker('a', groupConv);
    expect(useCharacterMemory.getState().getAll('b')).toHaveLength(0);
  });

  it('skips AI-AI conversations (aiChatParticipants)', () => {
    const aiAi: Conversation = {
      ...baseConv,
      id: 'c-ai-ai',
      characterId: undefined,
      aiChatParticipants: ['a', 'b'],
    };
    ensureSceneMarker('a', aiAi);
    expect(useCharacterMemory.getState().getAll('a')).toHaveLength(0);
  });
});
