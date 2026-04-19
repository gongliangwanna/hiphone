import { describe, it, expect } from 'vitest';
import {
  renderMemoryToChatMessages,
  trimMemoryToFit,
  type MemoryRenderContext,
} from '../promptAssembly';
import type { MemoryEntry } from '../characterMemoryStore';

const ctx: MemoryRenderContext = {
  currentCharId: 'char-001',
  charactersById: new Map([
    ['char-001', { id: 'char-001', name: '小星' }],
    ['char-002', { id: 'char-002', name: '小月' }],
  ]),
  personaName: '小米',
};

function mem(overrides: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'x',
    characterId: 'char-001',
    role: 'user',
    speakerId: 'me',
    content: 'x',
    source: 'xingyu',
    createdAt: 0,
    ...overrides,
  };
}

describe('renderMemoryToChatMessages', () => {
  it('user entry (persona) → role:user with 小米：prefix', () => {
    const out = renderMemoryToChatMessages(
      [mem({ role: 'user', speakerId: 'me', content: '你好' })],
      ctx,
    );
    expect(out).toEqual([{ role: 'user', content: '小米：你好' }]);
  });

  it('assistant entry → role:assistant, content passes through untouched (raw JSON preserved)', () => {
    const raw = '[{"type":"text","content":"挺不错的呀~"}]';
    const out = renderMemoryToChatMessages(
      [mem({ role: 'assistant', speakerId: 'char-001', content: raw })],
      ctx,
    );
    expect(out).toEqual([{ role: 'assistant', content: raw }]);
  });

  it("third-party character entry → role:user with that character's name", () => {
    const out = renderMemoryToChatMessages(
      [mem({ role: 'user', speakerId: 'char-002', content: '一起吃饭吧' })],
      ctx,
    );
    expect(out).toEqual([{ role: 'user', content: '小月：一起吃饭吧' }]);
  });

  it('unknown speakerId falls back to the id itself', () => {
    const out = renderMemoryToChatMessages(
      [mem({ role: 'user', speakerId: 'char-ghost', content: '?' })],
      ctx,
    );
    expect(out).toEqual([{ role: 'user', content: 'char-ghost：?' }]);
  });

  it('system (compressed summary) entry → role:system, content pass-through', () => {
    const out = renderMemoryToChatMessages(
      [
        mem({
          role: 'system',
          speakerId: 'system',
          content: '[之前的对话摘要] 小米和小星聊了吃饭',
          source: 'system',
          compressed: true,
        }),
      ],
      ctx,
    );
    expect(out).toEqual([
      { role: 'system', content: '[之前的对话摘要] 小米和小星聊了吃饭' },
    ]);
  });

  it('multi-party alternation preserves order and labels every user turn', () => {
    const out = renderMemoryToChatMessages(
      [
        mem({ role: 'user', speakerId: 'me', content: '你们谁去拿快递', createdAt: 1 }),
        mem({ role: 'user', speakerId: 'char-002', content: '我', createdAt: 2 }),
        mem({ role: 'user', speakerId: 'char-002', content: '等下就去', createdAt: 3 }),
        mem({
          role: 'assistant',
          speakerId: 'char-001',
          content: '[{"type":"text","content":"辛苦你啦"}]',
          createdAt: 4,
        }),
        mem({ role: 'user', speakerId: 'me', content: '谢谢小月', createdAt: 5 }),
      ],
      ctx,
    );
    expect(out).toEqual([
      { role: 'user', content: '小米：你们谁去拿快递' },
      { role: 'user', content: '小月：我' },
      { role: 'user', content: '小月：等下就去' },
      { role: 'assistant', content: '[{"type":"text","content":"辛苦你啦"}]' },
      { role: 'user', content: '小米：谢谢小月' },
    ]);
  });
});

describe('trimMemoryToFit', () => {
  const makeEntries = (count: number, contentSize: number): MemoryEntry[] =>
    Array.from({ length: count }, (_, i) =>
      mem({
        id: `e-${i}`,
        content: 'x'.repeat(contentSize),
        createdAt: i,
      }),
    );

  it('empty input → empty output', () => {
    expect(trimMemoryToFit([], 1000, 3)).toEqual([]);
  });

  it('fits in budget → unchanged', () => {
    const entries = makeEntries(5, 10);
    const out = trimMemoryToFit(entries, 100_000, 3);
    expect(out).toEqual(entries);
  });

  it('overflows → drops from the oldest end', () => {
    const entries = makeEntries(10, 400);
    const out = trimMemoryToFit(entries, 500, 3);
    expect(out.length).toBeLessThan(10);
    // Most recent 3 always survive
    expect(out.slice(-3).map((e) => e.id)).toEqual(['e-7', 'e-8', 'e-9']);
  });

  it('never trims below keepRecent count', () => {
    const entries = makeEntries(5, 1000);
    const out = trimMemoryToFit(entries, 10, /* keepRecent */ 3);
    expect(out.length).toBeGreaterThanOrEqual(3);
  });
});
