import { describe, it, expect, beforeEach } from 'vitest';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

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
