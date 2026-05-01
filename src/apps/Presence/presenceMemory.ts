import { useCharacterMemory, type MemoryEntry } from '@/platform/ai/characterMemoryStore';
import type { PresenceSummary } from './presenceTypes';

const SOURCE = 'app:presence' as const;

function formatDateTime(ts: number): string {
  const date = new Date(ts);
  const yyyy = date.getFullYear();
  const mo = date.getMonth() + 1;
  const dd = date.getDate();
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
}

function hasSummaryContent(summary: PresenceSummary): boolean {
  return [
    summary.scene,
    summary.whatHappened,
    summary.emotionalShift,
  ].some((value) => value.trim().length > 0 && value.trim() !== '无');
}

export function buildPresenceMemoryContent(input: {
  summary: PresenceSummary;
  startedAt: number;
  endedAt: number;
}): string {
  const { summary } = input;
  return [
    '[在场经历总结]',
    `时间：${formatDateTime(input.startedAt)} - ${formatDateTime(input.endedAt)}`,
    `场景：${summary.scene.trim() || '未记录'}`,
    `发生了什么：${summary.whatHappened.trim() || '未记录'}`,
    `情绪变化：${summary.emotionalShift.trim() || '无明显变化'}`,
    '该场景已结束，切回到线上模式。',
  ].join('\n');
}

export function rememberPresenceSummary(input: {
  characterId: string;
  summary: PresenceSummary | null;
  startedAt: number;
  endedAt: number;
}): MemoryEntry | null {
  if (!input.characterId || !input.summary) return null;
  if (!hasSummaryContent(input.summary)) return null;
  return useCharacterMemory.getState().append(input.characterId, {
    role: 'system',
    speakerId: 'system',
    source: SOURCE,
    content: buildPresenceMemoryContent({
      summary: input.summary,
      startedAt: input.startedAt,
      endedAt: input.endedAt,
    }),
  });
}
