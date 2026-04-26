import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useXYData, _isGroupReplyGenerating } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';

describe('createGroupConversation', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        { id: 'xiaoxing', name: '小星', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'yueyue',   name: '月月', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'aria',     name: 'Aria', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({ conversations: [], messages: [] });
  });

  it('stores characterIds verbatim', () => {
    const convId = useXYData.getState().createGroupConversation(['xiaoxing', 'yueyue']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['xiaoxing', 'yueyue']);
  });

  it('auto-derives group name from first 3 member names', () => {
    const convId = useXYData.getState().createGroupConversation(['xiaoxing', 'yueyue', 'aria']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupName).toBe('小星、月月、Aria');
  });

  it('adds 等 N 人 suffix when more than 3 members', () => {
    useCharacterStore.setState({
      characters: [
        ...useCharacterStore.getState().characters,
        { id: 'c4', name: '小四', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'c5', name: '小五', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    const convId = useXYData.getState().createGroupConversation(['xiaoxing', 'yueyue', 'aria', 'c4', 'c5']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupName).toBe('小星、月月、Aria 等 5 人');
  });

  it('preserves real char-prefixed IDs without clobbering', () => {
    useCharacterStore.setState({
      characters: [
        { id: 'char-1700000000-1', name: '阿尔法', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'char-1700000000-2', name: '贝塔', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    const convId = useXYData.getState().createGroupConversation(['char-1700000000-1', 'char-1700000000-2']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['char-1700000000-1', 'char-1700000000-2']);
    expect(conv.groupName).toBe('阿尔法、贝塔');
  });
});

describe('group settings mutations', () => {
  let convId: string;
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        { id: 'a', name: 'A', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'b', name: 'B', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'c', name: 'C', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({ conversations: [], messages: [] });
    convId = useXYData.getState().createGroupConversation(['a', 'b']);
  });

  it('updateGroupSettings changes avatar / announcement / name', () => {
    useXYData.getState().updateGroupSettings(convId, {
      groupAvatar: 'data:image/png;base64,xxx',
      groupAnnouncement: '今天开会',
      groupName: '技术组',
    });
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupAvatar).toBe('data:image/png;base64,xxx');
    expect(conv.groupAnnouncement).toBe('今天开会');
    expect(conv.groupName).toBe('技术组');
  });

  it('addGroupMembers appends new ids and dedupes', () => {
    useXYData.getState().addGroupMembers(convId, ['c', 'a']); // 'a' already member
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['a', 'b', 'c']);
  });

  it('removeGroupMember strips an id', () => {
    useXYData.getState().addGroupMembers(convId, ['c']);
    useXYData.getState().removeGroupMember(convId, 'b');
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['a', 'c']);
  });

  it('removeGroupMember refuses to drop below 2 members', () => {
    expect(() => useXYData.getState().removeGroupMember(convId, 'a')).toThrow(
      /至少/,
    );
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['a', 'b']); // unchanged
  });
});

describe('triggerGroupReply', () => {
  beforeEach(() => {
    // Minimal AI config so API-key early-exit triggers error bubble
    // instead of network call. We're testing the lock + dispatch shape,
    // not the LLM integration.
    useAIConfigStore.setState({ apiKey: '', endpoint: '', model: '' } as any);
    useCharacterStore.setState({
      characters: [
        { id: 'a', name: 'A', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'b', name: 'B', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({ conversations: [], messages: [] });
  });

  it('triggerGroupReply writes an error bubble when API key missing (smoke)', () => {
    const convId = useXYData.getState().createGroupConversation(['a', 'b']);
    useXYData.getState().triggerGroupReply(convId, 'a');
    const msgs = useXYData.getState().messages.filter((m) => m.convId === convId);
    expect(msgs.length).toBe(1);
    expect(msgs[0]!.senderId).toBe('char-a');
    expect((msgs[0] as any).text).toMatch(/未配置 AI 服务/);
  });

  it('triggerGroupReply no-ops when characterId not in members', () => {
    const convId = useXYData.getState().createGroupConversation(['a', 'b']);
    useXYData.getState().triggerGroupReply(convId, 'stranger');
    const msgs = useXYData.getState().messages.filter((m) => m.convId === convId);
    expect(msgs).toHaveLength(0);
  });

  it('group fan-out: speaker reply is mirrored to other members memory as user turn', async () => {
    useAIConfigStore.setState({ apiKey: 'test-key', endpoint: 'https://example.invalid', model: 'm' } as any);
    // Reset memory store so we observe only what this test writes
    useCharacterMemory.setState({ entriesByCharacter: {} } as any);

    const convId = useXYData.getState().createGroupConversation(['a', 'b']);

    const aiSdk = await import('@/platform/userApp/sdk/ai');
    const reply = {
      items: [{ type: 'text', param: '你好呀' }],
      rendered: '你好呀',
    };
    const spy = vi.spyOn(aiSdk, 'chatWithCharacter').mockImplementation(() => {
      return {
        characterId: 'a',
        persistent: true,
        history: [],
        send: () => Promise.resolve(reply as any),
        streamSend: async function* () {},
        append: () => {},
        replyToLast: () => Promise.resolve(reply as any),
        streamReplyToLast: async function* () {},
        abort: () => {},
      } as any;
    });

    try {
      useXYData.getState().triggerGroupReply(convId, 'a');
      // Wait for the .then() callback to run
      await new Promise((r) => setTimeout(r, 10));

      const aMem = useCharacterMemory.getState().getAll('a');
      const bMem = useCharacterMemory.getState().getAll('b');

      // Speaker (a) gets role=assistant
      expect(aMem.some((e) => e.role === 'assistant' && e.content === '你好呀')).toBe(true);
      // Other member (b) sees a's reply as a user turn attributed to a
      expect(bMem.some((e) => e.role === 'user' && e.content === '你好呀' && e.speakerId === 'char-a')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });

  it('serial lock: second trigger no-ops while first is generating', async () => {
    // Provide valid-looking AI config so the apiKey early-exit doesn't fire.
    useAIConfigStore.setState({ apiKey: 'test-key', endpoint: 'https://example.invalid', model: 'm' } as any);

    const convId = useXYData.getState().createGroupConversation(['a', 'b']);

    // Mock chatWithCharacter to return a ChatSession whose replyToLast() never resolves,
    // keeping the lock held for the duration of the test.
    const aiSdk = await import('@/platform/userApp/sdk/ai');
    const spy = vi.spyOn(aiSdk, 'chatWithCharacter').mockImplementation(() => {
      return {
        characterId: 'a',
        persistent: true,
        history: [],
        send: () => new Promise(() => {}),
        streamSend: async function* () {},
        append: () => {},
        replyToLast: () => new Promise(() => {}), // never resolves → lock stays held
        streamReplyToLast: async function* () {},
        abort: () => {},
      } as any;
    });

    try {
      useXYData.getState().triggerGroupReply(convId, 'a');
      expect(_isGroupReplyGenerating(convId)).toBe('a');

      const msgsAfterFirst = useXYData.getState().messages.filter((m) => m.convId === convId).length;

      // Second call should be no-op due to lock
      useXYData.getState().triggerGroupReply(convId, 'b');
      expect(_isGroupReplyGenerating(convId)).toBe('a'); // still 'a', not 'b'
      const msgsAfterSecond = useXYData.getState().messages.filter((m) => m.convId === convId).length;
      expect(msgsAfterSecond).toBe(msgsAfterFirst);
    } finally {
      spy.mockRestore();
      // Clean up the lock so it doesn't bleed into other tests
      // (the never-resolving promise means .finally() on the session never runs)
    }
  });
});
