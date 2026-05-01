import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useXYData, _isGroupReplyGenerating } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

/**
 * 单聊默认手动触发 AI 回复（与群聊一致）。
 * 仅当 conv.aiAutoReply === true 时 sendMessage 才调度自动回复。
 * 关闭时，用户须显式调用 triggerSingleReply。
 */
describe('single-chat manual AI reply', () => {
  beforeEach(() => {
    // 不真正发请求；apiKey 缺失时 scheduleAICharacterReply 会写入一条
    // 错误气泡（"未配置 AI 服务"），可作为「触发了 AI 路径」的可观察信号。
    useAIConfigStore.setState({ apiKey: '', endpoint: '', model: '' } as any);
    useCharacterStore.setState({
      characters: [
        {
          id: 'char-001',
          name: '小星',
          avatar: '',
          description: '',
          personality: '',
          scenario: '',
          systemPrompt: '',
          postHistoryInstructions: '',
          messageExamples: [],
          firstMessage: '',
        },
      ],
    } as any);
    useXYData.setState({
      conversations: [
        {
          id: 'conv-1',
          idolId: 'char-001',
          characterId: 'char-001',
          lastMsg: '',
          lastTime: 0,
          unread: 0,
        },
      ],
      messages: [],
      generatingByConv: {},
    } as never);
  });

  it('aiAutoReply 关闭时 sendMessage 不调度 AI 回复', () => {
    useXYData.getState().sendMessage('conv-1', '你好', undefined);
    const all = useXYData.getState().messages.filter((m) => m.convId === 'conv-1');
    // 只有用户发出的那条消息，没有 AI 错误气泡 / 流式占位
    expect(all).toHaveLength(1);
    expect(all[0]!.senderId).toBe('me');
  });

  it('aiAutoReply 打开时 sendMessage 自动触发 AI 路径', () => {
    useXYData.getState().updateConversationSettings('conv-1', { aiAutoReply: true });
    useXYData.getState().sendMessage('conv-1', '你好', undefined);
    const all = useXYData.getState().messages.filter((m) => m.convId === 'conv-1');
    // 用户消息 + 一条来自 AI 的错误气泡（apiKey 缺失），证明走入了 AI 路径
    expect(all.length).toBeGreaterThanOrEqual(2);
    expect(all.some((m) => m.senderId === 'char-char-001')).toBe(true);
  });

  it('triggerSingleReply 在 aiAutoReply 关闭时也能触发', () => {
    useXYData.getState().triggerSingleReply('conv-1');
    const all = useXYData.getState().messages.filter((m) => m.convId === 'conv-1');
    expect(all.some((m) => m.senderId === 'char-char-001')).toBe(true);
  });

  it('triggerSingleReply 在并发期间被锁住（与群聊共享 generatingByConv）', async () => {
    useAIConfigStore.setState({
      apiKey: 'test-key',
      endpoint: 'https://example.invalid',
      model: 'm',
    } as any);

    const aiSdk = await import('@/platform/userApp/sdk/ai');
    const spy = vi.spyOn(aiSdk, 'chatWithCharacter').mockImplementation(() => {
      return {
        characterId: 'char-001',
        persistent: true,
        history: [],
        send: () => new Promise(() => {}),
        streamSend: async function* () {},
        append: () => {},
        replyToLast: () => new Promise(() => {}), // 永不 resolve，保持锁
        streamReplyToLast: async function* () {},
        abort: () => {},
      } as any;
    });

    try {
      useXYData.getState().triggerSingleReply('conv-1');
      expect(_isGroupReplyGenerating('conv-1')).toBe('char-001');

      const before = useXYData.getState().messages.filter((m) => m.convId === 'conv-1').length;

      // 第二次触发应该被锁挡掉，messages 数量不变
      useXYData.getState().triggerSingleReply('conv-1');
      const after = useXYData.getState().messages.filter((m) => m.convId === 'conv-1').length;
      expect(after).toBe(before);
    } finally {
      spy.mockRestore();
    }
  });

  it('triggerSingleReply 对没有 characterId 的会话 no-op', () => {
    useXYData.setState({
      conversations: [
        { id: 'legacy', idolId: 'mock-idol', lastMsg: '', lastTime: 0, unread: 0 },
      ],
      messages: [],
    } as never);
    useXYData.getState().triggerSingleReply('legacy');
    expect(useXYData.getState().messages).toHaveLength(0);
  });
});
