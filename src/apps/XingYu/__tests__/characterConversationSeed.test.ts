import { beforeEach, describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

const characterWithLegacyGreeting = {
  id: 'char-001',
  name: '小星',
  avatar: '',
  description: '完整角色描述',
  personality: '旧性格',
  scenario: '旧情境',
  firstMessage: '你好，我是旧开场白',
  messageExamples: '旧示例对话',
  alternateGreetings: [],
  systemPrompt: '',
  postHistoryInstructions: '',
  creatorNotes: '',
  tags: [],
  version: '1.0',
};

describe('XingYu character conversation creation', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      activeCharacterId: 'char-001',
      characters: [characterWithLegacyGreeting],
    });
    useXYData.setState({
      conversations: [],
      messages: [],
      moments: [],
      interactions: [],
      favorites: [],
      generatingByConv: {},
    } as never);
  });

  it('does not seed a first AI message when opening a character conversation', () => {
    const convId = useXYData.getState().ensureCharacterConversation('char-001');

    expect(convId).toBe('c-char-char-001');
    expect(useXYData.getState().messages.filter((m) => m.convId === convId)).toHaveLength(0);
    expect(useXYData.getState().conversations[0]).toMatchObject({
      id: convId,
      characterId: 'char-001',
      lastMsg: '小星',
      unread: 0,
    });
  });

  it('clears messages without re-injecting a legacy first message', () => {
    const convId = 'c-char-char-001';
    useXYData.setState({
      conversations: [
        {
          id: convId,
          idolId: 'char-char-001',
          characterId: 'char-001',
          lastMsg: '旧消息',
          lastTime: 1,
          unread: 2,
        },
      ],
      messages: [
        {
          id: 'm1',
          convId,
          senderId: 'me',
          type: 'text',
          text: '旧用户消息',
          timestamp: 1,
        },
      ],
    } as never);

    useXYData.getState().clearCharacterMemory('char-001');

    expect(useXYData.getState().messages.filter((m) => m.convId === convId)).toHaveLength(0);
    expect(useXYData.getState().conversations[0]).toMatchObject({
      lastMsg: '小星',
      unread: 0,
    });
  });
});
