import { chatComplete } from '@/platform/ai/chatComplete';
import { getAdapter, pickGenerationParams } from '@/platform/ai/providers';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import type { ChatMessage } from '@/platform/ai/promptAssembly';

interface GenerateCharacterDescriptionInput {
  characterName: string;
  tags: string[];
  seed: string;
  currentDescription?: string;
  signal?: AbortSignal;
}

function requireAIConfig() {
  const cfg = useAIConfigStore.getState();
  if (!cfg.apiKey?.trim()) throw new Error('请先在 AI 服务中配置 API Key');
  if (!cfg.model?.trim()) throw new Error('请先在 AI 服务中选择模型');
  const adapter = getAdapter(cfg.provider);
  const endpoint = cfg.apiEndpoint?.trim() || adapter?.defaultEndpoint || '';
  if (!endpoint) throw new Error('请先在 AI 服务中配置 API 端点');

  return {
    endpoint,
    apiKey: cfg.apiKey.trim(),
    model: cfg.model.trim(),
    providerId: cfg.provider,
    openRouterProviderSlug: cfg.openRouterProviderSlug,
    generation: {
      ...pickGenerationParams(cfg),
      maxTokens: Math.min(Math.max(cfg.maxTokens || 1600, 1200), 2000),
      temperature: cfg.temperature ?? 0.8,
    },
  };
}

function buildMessages(input: GenerateCharacterDescriptionInput): ChatMessage[] {
  const tags = input.tags.length > 0 ? input.tags.join('、') : '无';
  const existing = input.currentDescription?.trim() || '无';

  return [
    {
      role: 'system',
      content:
        '你是女性向互动叙事产品的角色设定编辑。你擅长把简短想法扩写成可直接作为 AI 角色 system prompt 使用的完整角色描述。',
    },
    {
      role: 'user',
      content: [
        '请根据用户输入扩写一个完整角色设定。',
        '',
        `角色名：${input.characterName || '未命名角色'}`,
        `标签：${tags}`,
        `用户输入：${input.seed.trim()}`,
        `当前已有角色描述：${existing}`,
        '',
        '要求：',
        '1. 输出约 800 个中文字。',
        '2. 补充并融合角色外貌、性格、家庭、历史记忆、爱好、说话方式、与用户的互动关系和行为边界。',
        '3. 风格面向女性向陪伴/恋爱互动，但不要写露骨内容，不要替用户决定现实行为。',
        '4. 使用第二人称称呼用户时保持克制自然，避免油腻、夸张、模板化。',
        '5. 只输出角色设定正文，不要标题、编号、Markdown、解释或开场白。',
      ].join('\n'),
    },
  ];
}

export async function generateCharacterDescription(
  input: GenerateCharacterDescriptionInput,
): Promise<string> {
  const seed = input.seed.trim();
  if (!seed) throw new Error('请输入简短角色描述');

  const cfg = requireAIConfig();
  const text = await chatComplete(
    {
      endpoint: cfg.endpoint,
      apiKey: cfg.apiKey,
      model: cfg.model,
      providerId: cfg.providerId,
      openRouterProviderSlug: cfg.openRouterProviderSlug,
    },
    buildMessages({ ...input, seed }),
    cfg.generation,
    input.signal,
  );

  const result = text.trim();
  if (!result) throw new Error('AI 没有返回角色描述');
  return result;
}
