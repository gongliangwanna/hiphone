/**
 * 场景切换标记 — 让角色在 memory 流里能感知到"刚刚从单聊切到了群聊"
 * 这种上下文转换。每次写入角色记忆前调用 `ensureSceneMarker`：若该角
 * 色记忆里最近一条 `[场景]` system entry 与当前 conv 描述不一致，
 * 就追加一条新的 system entry 作为分隔符。
 *
 * promptAssembly.ts:181 把 role:'system' 的 entry 渲染成无 speaker 的
 * `[HH:MM] {content}` 行，对 LLM 而言就是天然的场景分隔符。
 *
 * 仅 xingyu 单聊 / 群聊适用；AI-AI 会话 (aiChatParticipants) 不处理。
 */

import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import type { Conversation } from './data';

export const SCENE_PREFIX = '[场景]';

function buildSceneText(conv: Conversation): string | null {
  // AI-AI 会话不属于 "用户视角下的单/群聊"，跳过
  if (conv.aiChatParticipants?.length) return null;

  if (conv.groupMemberIds?.length) {
    const chars = useCharacterStore.getState().characters;
    const names = conv.groupMemberIds
      .map((id) => chars.find((c) => c.id === id)?.name ?? '未知')
      .join('、');
    const namePart =
      conv.groupName && conv.groupName !== names
        ? `「${conv.groupName}」`
        : '';
    return `${SCENE_PREFIX} 你正在群聊${namePart}中，群成员：${names}。`;
  }

  if (conv.characterId) {
    return `${SCENE_PREFIX} 你正在与用户的一对一私聊中。`;
  }

  return null;
}

function findLastSceneText(characterId: string): string | null {
  const entries = useCharacterMemory.getState().getAll(characterId);
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.role === 'system' && e.content.startsWith(SCENE_PREFIX)) {
      return e.content;
    }
  }
  return null;
}

/**
 * 若 characterId 上一条场景标记 ≠ 本次 conv 的场景描述，就插入一条新的
 * system 标记。幂等：同一场景下重复调用只插一次。
 */
export function ensureSceneMarker(
  characterId: string,
  conv: Conversation,
): void {
  const sceneText = buildSceneText(conv);
  if (!sceneText) return;
  if (findLastSceneText(characterId) === sceneText) return;
  useCharacterMemory.getState().append(characterId, {
    role: 'system',
    speakerId: 'system',
    content: sceneText,
    source: 'xingyu',
  });
}
