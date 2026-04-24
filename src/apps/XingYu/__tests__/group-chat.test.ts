import { describe, it, expect, beforeEach } from 'vitest';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

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

  it('stores bare characterIds without char- prefix', () => {
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

  it('strips char- prefix if caller passes prefixed ids', () => {
    const convId = useXYData.getState().createGroupConversation(['char-xiaoxing', 'char-yueyue']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['xiaoxing', 'yueyue']);
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
});
