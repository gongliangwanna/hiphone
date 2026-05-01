import { beforeEach, describe, expect, it } from 'vitest';
import { useCharacterMemory } from '@/platform/ai/characterMemoryStore';
import {
  buildPresenceMemoryContent,
  rememberPresenceSummary,
} from '../presenceMemory';

beforeEach(() => {
  useCharacterMemory.getState().clearAll();
});

describe('presenceMemory', () => {
  it('writes one system memory entry with summary fields and online-mode ending', () => {
    const entry = rememberPresenceSummary({
      characterId: 'char-001',
      startedAt: 1,
      endedAt: 2,
      summary: {
        scene: '雨中便利店',
        whatHappened: '用户迟到后认真解释。',
        emotionalShift: '气氛从僵硬转为柔和。',
      },
    });

    expect(entry).not.toBeNull();
    const memory = useCharacterMemory.getState().getAll('char-001');
    expect(memory).toHaveLength(1);
    expect(memory[0]).toMatchObject({
      role: 'system',
      speakerId: 'system',
      source: 'app:presence',
    });
    expect(memory[0]!.content).toContain('[在场经历总结]');
    expect(memory[0]!.content).toContain('场景：雨中便利店');
    expect(memory[0]!.content).toContain('发生了什么：用户迟到后认真解释。');
    expect(memory[0]!.content).toContain('情绪变化：气氛从僵硬转为柔和。');
    expect(memory[0]!.content).not.toContain('待续事项');
    expect(memory[0]!.content.trim().endsWith('该场景已结束，切回到线上模式。')).toBe(true);
  });

  it('does not write when there is no summary', () => {
    const entry = rememberPresenceSummary({
      characterId: 'char-001',
      startedAt: 1,
      endedAt: 2,
      summary: null,
    });

    expect(entry).toBeNull();
    expect(useCharacterMemory.getState().getAll('char-001')).toEqual([]);
  });

  it('formats missing fields without inventing memory value labels', () => {
    const content = buildPresenceMemoryContent({
      startedAt: 1,
      endedAt: 2,
      summary: {
        scene: '',
        whatHappened: '',
        emotionalShift: '',
      },
    });

    expect(content).toContain('场景：未记录');
    expect(content).not.toContain('待续事项');
    expect(content).not.toContain('记忆价值');
    expect(content.trim().endsWith('该场景已结束，切回到线上模式。')).toBe(true);
  });
});
