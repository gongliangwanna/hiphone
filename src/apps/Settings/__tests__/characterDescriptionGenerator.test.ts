import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCharacterDescription } from '../characterDescriptionGenerator';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { chatComplete } from '@/platform/ai/chatComplete';

vi.mock('@/platform/ai/chatComplete', () => ({
  chatComplete: vi.fn(),
}));

const chatCompleteMock = vi.mocked(chatComplete);

describe('generateCharacterDescription', () => {
  beforeEach(() => {
    chatCompleteMock.mockReset();
    useAIConfigStore.setState({
      provider: 'openrouter',
      apiKey: 'sk-test',
      apiEndpoint: '',
      model: 'test/model',
      temperature: 0.8,
      maxTokens: 8192,
      topP: 0.9,
      frequencyPenalty: 0,
      presencePenalty: 0,
      reasoningEffort: 'off',
    } as never);
  });

  it('asks the configured model to expand a concise female-oriented role seed', async () => {
    chatCompleteMock.mockResolvedValue('  生成后的完整角色设定  ');

    const result = await generateCharacterDescription({
      characterName: '陆沉',
      tags: ['温柔男友', '年上'],
      seed: '冷静克制的律师，和用户是旧识。',
      currentDescription: '已有一点设定',
    });

    expect(result).toBe('生成后的完整角色设定');
    expect(chatCompleteMock).toHaveBeenCalledTimes(1);
    const [config, messages, generation] = chatCompleteMock.mock.calls[0]!;
    expect(config).toMatchObject({
      endpoint: 'https://openrouter.ai/api/v1',
      apiKey: 'sk-test',
      model: 'test/model',
      providerId: 'openrouter',
    });
    expect(generation).toMatchObject({ maxTokens: 2000, temperature: 0.8 });
    const prompt = messages.map((m) => m.content).join('\n');
    expect(prompt).toContain('约 800 个中文字');
    expect(prompt).toContain('外貌');
    expect(prompt).toContain('性格');
    expect(prompt).toContain('家庭');
    expect(prompt).toContain('历史记忆');
    expect(prompt).toContain('爱好');
    expect(prompt).toContain('陆沉');
    expect(prompt).toContain('温柔男友、年上');
    expect(prompt).toContain('冷静克制的律师');
    expect(prompt).toContain('已有一点设定');
  });

  it('requires a configured API key and model before generating', async () => {
    useAIConfigStore.setState({ apiKey: '', model: '' } as never);

    await expect(
      generateCharacterDescription({
        characterName: '新角色',
        tags: [],
        seed: '温柔男友',
      }),
    ).rejects.toThrow('请先在 AI 服务中配置 API Key');

    expect(chatCompleteMock).not.toHaveBeenCalled();
  });
});
