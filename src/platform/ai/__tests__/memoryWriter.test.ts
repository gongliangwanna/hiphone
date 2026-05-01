import { describe, it, expect, beforeEach } from 'vitest';
import { _appendMessage } from '../memoryWriter';
import { useCharacterMemory } from '../characterMemoryStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useXYNav } from '@/apps/XingYu/xingYuNavStore';
import type { Message } from '@/apps/XingYu/data';

beforeEach(() => {
  useCharacterMemory.getState().clearAll();
  useXYData.setState({
    conversations: [],
    messages: [],
    moments: [],
    interactions: [],
    favorites: [],
  });
  useXYNav.setState({ activeChatId: null } as never);
  useCharacterStore.setState({
    characters: [
      { id: 'char-001', name: '小星' } as never,
      { id: 'char-002', name: '小月' } as never,
    ],
  });
  usePersonaStore.setState({
    activePersonaId: null,
    personas: [{ id: 'p1', name: '小米', description: '' }],
    getActivePersona: () => ({ id: 'p1', name: '小米', description: '' }),
  } as never);
});

describe('_appendMessage — 1-to-1 conv', () => {
  it('appends to xingYuDataStore.messages[] AND memoryStore', () => {
    useXYData.setState({
      conversations: [{
        id: 'c-char-char-001', idolId: 'char-001', characterId: 'char-001',
        lastMsg: '', lastTime: 0, unread: 0,
      }],
    });
    const msg: Message = {
      id: 'm1', convId: 'c-char-char-001', senderId: 'me',
      type: 'text', text: '你好', timestamp: 1700000000000,
    };

    _appendMessage(msg, 'xingyu');

    expect(useXYData.getState().messages).toHaveLength(1);
    expect(useXYData.getState().messages[0]!.id).toBe('m1');

    const mem = useCharacterMemory.getState().getAll('char-001');
    // _appendMessage now prefixes a [场景] system marker before the first
    // content entry it writes for a character (so single↔group switches are
    // visible in the transcript).
    expect(mem).toHaveLength(2);
    expect(mem[0]!.role).toBe('system');
    expect(mem[0]!.content).toMatch(/场景/);
    expect(mem[1]!).toMatchObject({
      role: 'user',
      speakerId: 'me',
      content: '你好',
      source: 'xingyu',
    });
  });

  it('updates conversation lastMsg / lastTime', () => {
    useXYData.setState({
      conversations: [{
        id: 'c-char-char-001', idolId: 'char-001', characterId: 'char-001',
        lastMsg: '', lastTime: 0, unread: 0,
      }],
    });
    const ts = 1700000000000;
    _appendMessage({
      id: 'm1', convId: 'c-char-char-001', senderId: 'char-001',
      type: 'text', text: '挺不错的', timestamp: ts,
    }, 'xingyu');

    const conv = useXYData.getState().conversations.find((c) => c.id === 'c-char-char-001')!;
    expect(conv.lastMsg).toBe('挺不错的');
    expect(conv.lastTime).toBe(ts);
  });

  it('char sends → unread bumps; user sends → unread resets to 0', () => {
    useXYData.setState({
      conversations: [{
        id: 'c-char-char-001', idolId: 'char-001', characterId: 'char-001',
        lastMsg: '', lastTime: 0, unread: 0,
      }],
    });
    _appendMessage({
      id: 'm1', convId: 'c-char-char-001', senderId: 'char-001',
      type: 'text', text: 'x', timestamp: 1,
    }, 'xingyu');
    expect(useXYData.getState().conversations[0]!.unread).toBe(1);

    // User replies — they're reading, so unread should clear.
    _appendMessage({
      id: 'm2', convId: 'c-char-char-001', senderId: 'me',
      type: 'text', text: 'y', timestamp: 2,
    }, 'xingyu');
    expect(useXYData.getState().conversations[0]!.unread).toBe(0);
  });

  it('does not bump unread when the chat is currently active', () => {
    useXYData.setState({
      conversations: [{
        id: 'c-char-char-001', idolId: 'char-001', characterId: 'char-001',
        lastMsg: '', lastTime: 0, unread: 0,
      }],
    });
    useXYNav.setState({ activeChatId: 'c-char-char-001' } as never);
    _appendMessage({
      id: 'm1', convId: 'c-char-char-001', senderId: 'char-001',
      type: 'text', text: 'x', timestamp: 1,
    }, 'xingyu');
    expect(useXYData.getState().conversations[0]!.unread).toBe(0);
  });

  it('heartbeat_log does not bump unread even when chat is not active', () => {
    useXYData.setState({
      conversations: [{
        id: 'c-char-char-001', idolId: 'char-001', characterId: 'char-001',
        lastMsg: '', lastTime: 0, unread: 3,
      }],
    });
    _appendMessage({
      id: 'm1', convId: 'c-char-char-001', senderId: 'char-001',
      type: 'heartbeat_log', text: 'today I visited moments', timestamp: 1,
    }, 'heartbeat');
    expect(useXYData.getState().conversations[0]!.unread).toBe(3);
  });

  it('error-placeholder messages appear in xingYuDataStore but skip memoryStore', () => {
    useXYData.setState({
      conversations: [{
        id: 'c-char-char-001', idolId: 'char-001', characterId: 'char-001',
        lastMsg: '', lastTime: 0, unread: 0,
      }],
    });
    _appendMessage({
      id: 'm1', convId: 'c-char-char-001', senderId: 'char-001',
      type: 'text', text: '[AI 回复失败] oops', timestamp: 1,
    }, 'xingyu');

    expect(useXYData.getState().messages).toHaveLength(1);
    expect(useCharacterMemory.getState().getAll('char-001')).toHaveLength(0);
  });
});

describe('_appendMessage — AI-AI cross-write', () => {
  it('A→B message writes to both participants, role flipped from each POV', () => {
    useXYData.setState({
      conversations: [{
        id: 'aiai-1',
        idolId: 'char-001',
        characterId: 'char-001',
        aiChatParticipants: ['char-001', 'char-002'],
        lastMsg: '', lastTime: 0, unread: 0,
      }],
    });

    _appendMessage({
      id: 'm1', convId: 'aiai-1', senderId: 'char-001',
      type: 'text', text: '你最近怎么样', timestamp: 1,
    }, 'xingyu');

    const aMem = useCharacterMemory.getState().getAll('char-001');
    expect(aMem).toHaveLength(1);
    expect(aMem[0]!).toMatchObject({
      role: 'assistant',
      speakerId: 'char-001',
      content: '你最近怎么样',
    });

    const bMem = useCharacterMemory.getState().getAll('char-002');
    expect(bMem).toHaveLength(1);
    expect(bMem[0]!).toMatchObject({
      role: 'user',
      speakerId: 'char-001',
      content: '你最近怎么样',
    });
  });
});

describe('_appendMessage — group fan-out', () => {
  beforeEach(() => {
    useCharacterMemory.setState({ entries: {} } as any);
    useCharacterStore.setState({
      characters: [
        { id: 'a', name: 'A', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'b', name: 'B', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'c', name: 'C', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({
      conversations: [{
        id: 'c-group-x',
        idolId: 'c-group-x',
        lastMsg: '', lastTime: 0, unread: 0,
        groupName: 'G',
        groupMemberIds: ['a', 'b', 'c'],
      }],
      messages: [],
    });
  });

  it('user text fans out to every group member as role=user', () => {
    _appendMessage({
      id: 'm1', convId: 'c-group-x', senderId: 'me',
      type: 'text', text: 'hi everyone', timestamp: 1000,
    }, 'xingyu');
    // Each member's memory now begins with a [场景] system marker (group
    // scene) before the first content entry.
    for (const memberId of ['a', 'b', 'c']) {
      const entries = useCharacterMemory.getState().getAll(memberId);
      expect(entries).toHaveLength(2);
      expect(entries[0]!.role).toBe('system');
      expect(entries[0]!.content).toMatch(/群聊/);
      expect(entries[1]!.role).toBe('user');
      expect(entries[1]!.content).toBe('hi everyone');
    }
  });

  it('member A reply fans out with role=assistant for A, role=user for B/C', () => {
    _appendMessage({
      id: 'm2', convId: 'c-group-x', senderId: 'char-a',
      type: 'text', text: 'hello', timestamp: 2000,
    }, 'xingyu');
    // Index [0] is the [场景] marker; the message lands at [1] for every member.
    expect(useCharacterMemory.getState().getAll('a')[1]!.role).toBe('assistant');
    expect(useCharacterMemory.getState().getAll('b')[1]!.role).toBe('user');
    expect(useCharacterMemory.getState().getAll('c')[1]!.role).toBe('user');
    expect(useCharacterMemory.getState().getAll('b')[1]!.speakerId).toBe('char-a');
  });
});
