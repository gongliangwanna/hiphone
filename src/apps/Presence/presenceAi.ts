import { chatComplete } from '@/platform/ai/chatComplete';
import { buildDeviceContext } from '@/platform/ai/deviceContext';
import {
  renderMemoryToTranscript,
  trimMemoryToFit,
  type ChatMessage,
} from '@/platform/ai/promptAssembly';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import { getAdapter, pickGenerationParams } from '@/platform/ai/providers';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore, type CharacterCard } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import type { PresenceSession, PresenceSummary, PresenceTurn } from './presenceTypes';

interface ProviderBundle {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  openRouterProviderSlug?: string;
  generation: ReturnType<typeof pickGenerationParams>;
}

function requireProvider(): ProviderBundle {
  const cfg = useAIConfigStore.getState();
  if (!cfg.apiKey) throw new Error('AI provider is not configured');
  const adapter = getAdapter(cfg.provider);
  if (!adapter) throw new Error(`Unknown provider: ${cfg.provider}`);
  return {
    endpoint: cfg.apiEndpoint || adapter.defaultEndpoint,
    apiKey: cfg.apiKey,
    model: cfg.model,
    providerId: cfg.provider,
    openRouterProviderSlug: cfg.openRouterProviderSlug,
    generation: pickGenerationParams(cfg),
  };
}

function resolveCharacter(characterId: string): CharacterCard {
  const character = useCharacterStore
    .getState()
    .characters.find((item) => item.id === characterId);
  if (!character) throw new Error(`Character not found: ${characterId}`);
  return character;
}

export function buildPresenceModeInstruction(sceneText: string): string {
  return [
    '[在场模式]',
    '你现在不是在聊天软件里回复消息。',
    '你正处在一个具体场景中，和玩家面对面互动。',
    `场景：${sceneText}`,
    '',
    '请以你的角色身份自然回应玩家。你可以自由说话，也可以做任何符合角色、关系和场景的合理行为。',
    '你可以描写动作、眼神、表情、神态、姿态、距离变化、环境互动、沉默、停顿和主动提议。',
    '不需要遵循固定 JSON 或字段格式。优先输出自然、连贯、有现场感的小说式片段。',
    '当非语言描写有助于现场感时，可以使用括号；但括号不是强制格式。',
    '不要把自己描述成正在发消息，也不要提到聊天软件界面。',
    '不要替玩家决定重大动作、想法或感受；可以描写你观察到的玩家行为，并等待玩家回应。',
  ].join('\n');
}

function formatHHMM(ts: number): string {
  const date = new Date(ts);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatPresenceTurns(
  turns: readonly PresenceTurn[],
  characterName: string,
): string {
  if (turns.length === 0) return '';
  const lines = turns.map((turn) => {
    const speaker = turn.role === 'assistant' ? characterName : '玩家';
    return `[${formatHHMM(turn.createdAt)}] ${speaker}：${turn.content}`;
  });
  return ['[本次在场临时记录]', ...lines].join('\n');
}

function buildSystemPrompt(character: CharacterCard, sceneText: string): string {
  const cfg = useAIConfigStore.getState();
  const persona = usePersonaStore.getState().getActivePersona();
  const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();
  const parts: string[] = [];

  if (cfg.systemPrompt.trim()) parts.push(cfg.systemPrompt.trim());
  if (worldBookChunk.trim()) parts.push(worldBookChunk.trim());
  parts.push(`You are ${character.name}.`);
  if (character.description.trim()) parts.push(character.description.trim());
  if (persona?.name || persona?.description) {
    parts.push(
      [
        '[关于用户]',
        persona?.name ? `名字：${persona.name}` : '',
        persona?.description ? persona.description : '',
      ].filter(Boolean).join('\n'),
    );
  }
  parts.push(buildPresenceModeInstruction(sceneText));
  return parts.join('\n\n');
}

function buildPostHistoryPrompt(sceneText: string): string {
  const now = new Date();
  const cfg = useAIConfigStore.getState();
  const parts: string[] = [];
  if (cfg.postHistoryInstructions.trim()) {
    parts.push(cfg.postHistoryInstructions.trim());
  }
  parts.push(
    `[当前时间：${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}]`,
  );
  const device = buildDeviceContext();
  if (device.trim()) parts.push(device.trim());
  parts.push(`[当前场景]\n${sceneText}`);
  return parts.join('\n\n');
}

export function buildPresencePromptMessages(input: {
  characterId: string;
  sceneText: string;
  turns: readonly PresenceTurn[];
}): ChatMessage[] {
  const character = resolveCharacter(input.characterId);
  const persona = usePersonaStore.getState().getActivePersona();
  const cfg = useAIConfigStore.getState();
  const allCharacters = useCharacterStore.getState().characters;
  const charactersById = new Map(
    allCharacters.map((item) => [item.id, { id: item.id, name: item.name }]),
  );
  const memoryEntries = useCharacterMemory
    .getState()
    .getSnapshot(input.characterId);
  const budget = Math.max(
    0,
    Math.floor(cfg.contextWindow * 0.45) - cfg.maxTokens,
  );
  const trimmed = trimMemoryToFit(memoryEntries, budget, cfg.keepRecentMessages);
  const memory = renderMemoryToTranscript(trimmed, {
    currentCharId: input.characterId,
    charactersById,
    personaName: persona?.name ?? '用户',
  });

  const messages: ChatMessage[] = [
    { role: 'system', content: buildSystemPrompt(character, input.sceneText) },
  ];
  if (memory.stateTailBlock) {
    messages.push({ role: 'system', content: memory.stateTailBlock });
  }
  if (memory.longTermMemory) {
    messages.push({ role: 'system', content: memory.longTermMemory });
  }
  if (memory.transcriptBlock) {
    messages.push({ role: 'system', content: memory.transcriptBlock });
  }
  messages.push({
    role: 'system',
    content: buildPostHistoryPrompt(input.sceneText),
  });

  const last = input.turns[input.turns.length - 1];
  const priorTurns =
    last?.role === 'user' ? input.turns.slice(0, -1) : input.turns;
  const prior = formatPresenceTurns(priorTurns, character.name);
  if (prior) messages.push({ role: 'system', content: prior });

  messages.push({
    role: 'user',
    content:
      last?.role === 'user'
        ? `玩家：${last.content}`
        : '玩家：继续这个场景。',
  });

  return messages;
}

export async function requestPresenceReply(input: {
  session: PresenceSession;
  signal?: AbortSignal;
}): Promise<string> {
  const provider = requireProvider();
  const messages = buildPresencePromptMessages({
    characterId: input.session.characterId,
    sceneText: input.session.sceneText,
    turns: input.session.turns,
  });
  const raw = await chatComplete(
    {
      endpoint: provider.endpoint,
      apiKey: provider.apiKey,
      model: provider.model,
      providerId: provider.providerId,
      openRouterProviderSlug: provider.openRouterProviderSlug,
    },
    messages,
    provider.generation,
    input.signal,
  );
  return raw.trim() || '（她安静地看着你，像是在等你继续说下去。）';
}

function transcriptForSummary(session: PresenceSession, characterName: string): string {
  return session.turns
    .map((turn) => {
      const speaker = turn.role === 'assistant' ? characterName : '玩家';
      return `${speaker}：${turn.content}`;
    })
    .join('\n');
}

export function parsePresenceSummary(raw: string): PresenceSummary | null {
  const trimmed = raw.trim();
  if (!trimmed || /^SKIP$/i.test(trimmed)) return null;

  function pick(label: string): string {
    const labels = ['场景', '发生了什么', '情绪变化', '待续事项', '待办事项'];
    const current = labels.indexOf(label);
    const nextLabels = labels.slice(current + 1).join('|');
    const pattern = nextLabels
      ? new RegExp(`${label}\\s*[:：]\\s*([\\s\\S]*?)(?=\\n\\s*(?:${nextLabels})\\s*[:：]|$)`)
      : new RegExp(`${label}\\s*[:：]\\s*([\\s\\S]*)$`);
    return trimmed.match(pattern)?.[1]?.trim() ?? '';
  }

  const summary: PresenceSummary = {
    scene: pick('场景'),
    whatHappened: pick('发生了什么'),
    emotionalShift: pick('情绪变化'),
  };

  if (
    !summary.scene &&
    !summary.whatHappened &&
    !summary.emotionalShift
  ) {
    return {
      scene: '',
      whatHappened: trimmed,
      emotionalShift: '未提及',
    };
  }
  return summary;
}

export async function summarizePresenceSession(input: {
  session: PresenceSession;
  signal?: AbortSignal;
}): Promise<PresenceSummary | null> {
  const meaningfulTurns = input.session.turns.filter(
    (turn) => turn.content.trim().length > 0,
  );
  if (meaningfulTurns.length < 2) return null;

  const provider = requireProvider();
  const character = resolveCharacter(input.session.characterId);
  const messages: ChatMessage[] = [
    {
      role: 'system',
      content: [
        '你是「在场」App 的经历整理器。',
        '请把一段现场式角色互动整理为角色长期记忆使用的摘要。',
        '只输出三项：场景、发生了什么、情绪变化。',
        '不要输出“记忆价值”。',
        '不要输出待办事项、待续事项或后续行动。',
        '不要逐句复述，不要编造 transcript 中没有的信息。',
        '如果本次互动没有实质内容，只输出：SKIP。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `角色：${character.name}`,
        `场景：${input.session.sceneText}`,
        '[互动记录]',
        transcriptForSummary(input.session, character.name),
        '',
        '请按以下格式输出：',
        '场景：...',
        '发生了什么：...',
        '情绪变化：...',
      ].join('\n'),
    },
  ];

  const raw = await chatComplete(
    {
      endpoint: provider.endpoint,
      apiKey: provider.apiKey,
      model: provider.model,
      providerId: provider.providerId,
      openRouterProviderSlug: provider.openRouterProviderSlug,
    },
    messages,
    { ...provider.generation, temperature: 0.2 },
    input.signal,
  );
  return parsePresenceSummary(raw);
}
