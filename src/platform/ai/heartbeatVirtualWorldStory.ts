import { useStickerStore } from '@/apps/XingYu/stickerStore';
import type { Message } from '@/apps/XingYu/data';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { uid } from '@/platform/utils/uid';
import { assemblePrompt } from './promptAssembly';
import { buildDeviceContext } from './deviceContext';
import { chatComplete } from './chatComplete';
import { useCharacterMemory } from './characterMemoryStore';
import { _appendMessage } from './memoryWriter';
import { getAdapter, pickGenerationParams } from './providers';

const DAY_MS = 24 * 60 * 60 * 1000;
const EXPERIENCE_START_MARKERS = ['[经历]', '[虚拟世界经历]'] as const;

export interface VirtualStoryInstructionInput {
  fromLabel: string;
  toLabel: string;
  elapsedDays: number;
  targetChars: number;
}

export interface ResolveVirtualStoryStartTimeInput {
  characterId: string;
  previousLastHeartbeat?: number;
  intervalMinutes: number;
  nowMs: number;
}

export interface GenerateVirtualWorldStoryInput {
  characterId: string;
  previousLastHeartbeat?: number;
  now: Date;
  intervalMinutes: number;
  signal: AbortSignal;
}

export interface GenerateVirtualWorldStoryResult {
  written: boolean;
  story?: string;
  reason?: 'missing_character' | 'missing_adapter' | 'blank_output';
}

export function calculateVirtualStoryTargetChars(elapsedDays: number): number {
  return Math.min(1000, Math.max(1, elapsedDays) * 300);
}

export function resolveVirtualStoryStartTime(input: ResolveVirtualStoryStartTimeInput): number {
  const latestStory = [...useCharacterMemory.getState().getAll(input.characterId)]
    .reverse()
    .find((entry) =>
      entry.source === 'heartbeat' &&
      entry.role === 'assistant' &&
      EXPERIENCE_START_MARKERS.some((marker) => entry.content.trim().startsWith(marker)),
    );
  if (latestStory) return latestStory.createdAt;
  if (input.previousLastHeartbeat) return input.previousLastHeartbeat;
  return input.nowMs - input.intervalMinutes * 60_000;
}

function formatStoryTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
}

export function buildVirtualWorldStoryInstruction(input: VirtualStoryInstructionInput): string {
  return [
    '你现在要补全一段“从上次心跳到这次心跳之间”发生在你小手机外生活中的经历。',
    '',
    '这不是聊天回复，不是发给用户的消息，也不是发生在小手机里的行为记录。',
    '这段内容会作为你的真实经历写入长期记忆。之后你会自然记得它，并可以在合适的时候把它当作谈资、心情来源或行动背景。',
    '',
    '时间跨度：',
    `${input.fromLabel} 到 ${input.toLabel}`,
    `约 ${input.elapsedDays} 天`,
    '',
    '写作要求：',
    '- 使用第一人称“我”。',
    '- 必须基于你的完整上下文生成：角色设定、世界书、长期记忆、近期记忆、当前时间都会影响这段经历。',
    '- 经历发生在你的小手机外生活中，不发生在手机 App、聊天窗口、朋友圈、备忘录等小手机系统里。',
    '- 不要让用户出现在事件中。',
    '- 不要让其他 AI 角色出现在事件中。',
    '- 不要替用户或其他角色新增事实、承诺、情绪或行动。',
    '- 日常为主，偶尔可以有小剧情，但不要写成悬疑、冒险或大事件。',
    '- 不要写流水账。不要平均描述一整天。',
    '- 每天只选择 1 个最值得记住的小事件，多个日期可以合并成 2-4 个片段。',
    '- 事件要具体，有地点、行动、物品、过程和结果。',
    '- 每段至少留下一个“以后能聊起来”的谈资：一次试错、一个新发现、一个小麻烦、一个具体选择、一个没完成的小计划、一个让你之后可能再提起的物件或经历。',
    '- 情绪可以存在，但不要用大段抒情解释情绪；让情绪通过行动和细节体现。',
    '- 不要写标题，不要 markdown，不要 JSON，不要解释你在执行任务。',
    '- 只输出经历正文。',
    '',
    '长度要求：',
    `写约 ${input.targetChars} 个中文字符。`,
    '计算规则：1 天约 300 字，每多 1 天增加 300 字，最多 1000 字。',
    '如果时间不足 1 天，仍写一个约 200-300 字的具体片段。',
    '',
    '好的谈资示例：',
    '- 试了一种奇怪但具体的饮料，后来影响了晚饭做法。',
    '- 去了一个新地方，发现它和预期不一样。',
    '- 买错、走错、修坏、忘带、临时改变计划，但结果留下了一个具体后续。',
    '- 学到一个小知识，或决定明天继续处理某件小事。',
    '',
    '不好的写法：',
    '- 只写打扫、吃饭、散步、看书，没有后续可聊点。',
    '- 连续堆旧地图、怀表、神秘花瓣这类强剧情物件。',
    '- 大段写“我有点难过/释然/孤独”，但没有具体事件。',
  ].join('\n');
}

function cleanStoryOutput(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:text|markdown|md)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

export async function generateVirtualWorldStoryForHeartbeat(
  input: GenerateVirtualWorldStoryInput,
): Promise<GenerateVirtualWorldStoryResult> {
  const character = useCharacterStore
    .getState()
    .characters.find((c) => c.id === input.characterId);
  if (!character) return { written: false, reason: 'missing_character' };

  const aiConfig = useAIConfigStore.getState();
  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return { written: false, reason: 'missing_adapter' };
  const endpoint = aiConfig.apiEndpoint || adapter.defaultEndpoint;

  const persona = usePersonaStore.getState().getActivePersona();
  const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();
  const allStickers = useStickerStore.getState().packs.flatMap((pack) =>
    pack.stickers.map((s) => ({ id: s.id, description: s.description })),
  );
  const charactersById = new Map(
    useCharacterStore
      .getState()
      .characters.map((c) => [c.id, { id: c.id, name: c.name }]),
  );

  const nowMs = input.now.getTime();
  const startMs = resolveVirtualStoryStartTime({
    characterId: input.characterId,
    previousLastHeartbeat: input.previousLastHeartbeat,
    intervalMinutes: input.intervalMinutes,
    nowMs,
  });
  const elapsedDays = Math.max(1, Math.ceil((nowMs - startMs) / DAY_MS));
  const targetChars = calculateVirtualStoryTargetChars(elapsedDays);
  const fromLabel = formatStoryTime(new Date(startMs));
  const toLabel = formatStoryTime(input.now);
  const instruction = buildVirtualWorldStoryInstruction({
    fromLabel,
    toLabel,
    elapsedDays,
    targetChars,
  });

  const { messages } = assemblePrompt({
    character: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
      messageExamples: character.messageExamples,
    },
    persona: {
      name: persona?.name ?? '用户',
      description: persona?.description ?? '',
    },
    aiConfig: {
      systemPrompt: aiConfig.systemPrompt,
      postHistoryInstructions: aiConfig.postHistoryInstructions,
      contextWindow: aiConfig.contextWindow,
      maxTokens: aiConfig.maxTokens,
      keepRecentMessages: aiConfig.keepRecentMessages,
      worldInfoBudgetPercent: aiConfig.worldInfoBudgetPercent,
      enableVision: aiConfig.enableVision,
    },
    worldBookChunk,
    memoryEntries: useCharacterMemory.getState().getAll(input.characterId),
    currentCharId: input.characterId,
    charactersById,
    now: input.now,
    deviceContext: buildDeviceContext(),
    availableStickers: allStickers.length > 0 ? allStickers : undefined,
    responseMode: 'narrative',
  });
  const storyMessages = messages.filter((m) => m.role !== 'user');
  storyMessages.push({ role: 'user', content: instruction });

  const raw = await chatComplete(
    {
      endpoint,
      apiKey: aiConfig.apiKey,
      model: aiConfig.model,
      providerId: aiConfig.provider,
      openRouterProviderSlug: aiConfig.openRouterProviderSlug,
    },
    storyMessages,
    pickGenerationParams(aiConfig),
    input.signal,
  );
  const story = cleanStoryOutput(raw);
  if (!story) return { written: false, reason: 'blank_output' };

  const msg: Message = {
    id: uid(),
    convId: `c-char-${input.characterId}`,
    senderId: `char-${input.characterId}`,
    type: 'heartbeat_log',
    text: [
      '[经历]',
      `时间跨度：${fromLabel} 至 ${toLabel}`,
      '',
      story,
      '[经历结束]',
    ].join('\n'),
    timestamp: Date.now(),
  };
  _appendMessage(msg, 'heartbeat');
  return { written: true, story };
}
