import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDraft } from '../builderGenerator';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useAIAppBuilderConfigStore } from '../aiAppBuilderConfigStore';
import * as chatCompleteMod from '@/platform/ai/chatComplete';

describe('generateDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAIConfigStore.setState({
      apiKey: 'sk',
      provider: 'openrouter',
      apiEndpoint: 'https://api.test',
      model: 'gpt',
      maxTokens: 4000,
      temperature: 0.7,
    } as never);
    useAIAppBuilderConfigStore.setState({ modelOverride: null });
  });

  it('returns parsed files on success', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValueOnce(
      JSON.stringify({
        files: [
          { path: 'manifest.json', content: '{"id":"x"}' },
          { path: 'App.tsx', content: 'export default () => null;' },
        ],
      }),
    );
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: '番茄钟', timestamp: 1 }],
    });
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.files).toEqual({
        'manifest.json': '{"id":"x"}',
        'App.tsx': 'export default () => null;',
      });
    }
  });

  it('retries once on parse failure, succeeds second try', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('totally not JSON, here is some prose')
      .mockResolvedValueOnce(JSON.stringify({
        files: [{ path: 'App.tsx', content: 'ok' }],
      }));
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'x', timestamp: 1 }],
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe('success');
  });

  it('returns parse-error after 1 retry exhausts', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValue('not JSON');
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'x', timestamp: 1 }],
    });
    expect(result.kind).toBe('parse-error');
  });

  it('returns api-error if chatComplete throws', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockRejectedValue(new Error('rate limit'));
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'x', timestamp: 1 }],
    });
    expect(result.kind).toBe('api-error');
    if (result.kind === 'api-error') {
      expect(result.message).toContain('rate limit');
    }
  });

  it('uses modelOverride when set', async () => {
    useAIAppBuilderConfigStore.getState().setOverride({
      model: 'special-code-model',
      maxTokens: 8000,
    });
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValueOnce(
      JSON.stringify({ files: [{ path: 'App.tsx', content: 'x' }] }),
    );
    await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'y', timestamp: 1 }],
    });
    const call = spy.mock.calls[0]!;
    expect(call[0]!.model).toBe('special-code-model');
    expect(call[2]!.maxTokens).toBe(8000);
  });

  it('threads chat history into the messages array', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValueOnce(
      JSON.stringify({ files: [{ path: 'App.tsx', content: 'x' }] }),
    );
    await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [
        { role: 'user', text: '番茄钟', timestamp: 1 },
        { role: 'builder', text: '已生成', timestamp: 2 },
        { role: 'user', text: '加暂停按钮', timestamp: 3 },
      ],
    });
    const messages = spy.mock.calls[0]![1];
    // System prompt + 3 history-derived messages
    expect(messages.length).toBeGreaterThanOrEqual(4);
    expect(messages[0]!.role).toBe('system');
    // The first chat turn surfaces as user
    expect(messages.some((m) => m.role === 'user' && m.content === '番茄钟')).toBe(true);
    expect(messages.some((m) => m.role === 'user' && m.content === '加暂停按钮')).toBe(true);
  });
});
