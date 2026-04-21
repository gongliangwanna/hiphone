import { describe, it, expect } from 'vitest';
import {
  renderMemoryToTranscript,
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

// 2026-04-22 10:30 local time → timestamp; use explicit HH/MM in tests to
// avoid TZ flakiness: build Date objects with setHours/setMinutes.
function tsAt(hh: number, mm: number): number {
  const d = new Date(2026, 3, 22, hh, mm, 0, 0); // month is 0-indexed
  return d.getTime();
}

function mem(overrides: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'x',
    characterId: 'char-001',
    role: 'user',
    speakerId: 'me',
    content: 'x',
    source: 'xingyu',
    createdAt: tsAt(10, 30),
    ...overrides,
  };
}

describe('renderMemoryToTranscript — row formatting', () => {
  it('assistant → 我：<content>', () => {
    const out = renderMemoryToTranscript(
      [mem({ role: 'assistant', speakerId: 'char-001', content: '哈哈还没想好呢', createdAt: tsAt(0, 1) })],
      ctx,
    );
    expect(out.transcriptBlock).toBe('[历史记录]\n[00:01] 我：哈哈还没想好呢');
  });

  it('user / persona → <persona>：<content>', () => {
    const out = renderMemoryToTranscript(
      [mem({ role: 'user', speakerId: 'me', content: '你没名字吗', createdAt: tsAt(9, 5) })],
      ctx,
    );
    // single-entry & last is user → transcript is empty, turn is userTurn
    expect(out.transcriptBlock).toBeNull();
    expect(out.userTurn).toEqual({ role: 'user', content: '小米：你没名字吗' });
  });

  it('user / other character → <char name>：<content>', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'user', speakerId: 'char-002', content: '我请客', createdAt: tsAt(12, 0) }),
        mem({ role: 'assistant', speakerId: 'char-001', content: '好呀', createdAt: tsAt(12, 1) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe('[历史记录]\n[12:00] 小月：我请客\n[12:01] 我：好呀');
  });

  it('system entry → no speaker prefix', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'system', speakerId: 'system', source: 'system', content: '[上下文切换] 用户从 桌面 切到了 拍卖行', createdAt: tsAt(14, 30) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe('[历史记录]\n[14:30] [上下文切换] 用户从 桌面 切到了 拍卖行');
  });

  it('unknown speakerId falls back to the id itself', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'user', speakerId: 'char-ghost', content: '?', createdAt: tsAt(1, 2) }),
        mem({ role: 'assistant', speakerId: 'char-001', content: 'ok', createdAt: tsAt(1, 3) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe('[历史记录]\n[01:02] char-ghost：?\n[01:03] 我：ok');
  });

  it('multi-line content occupies multiple lines; next [HH:MM] bounds it', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'assistant',
          speakerId: 'char-001',
          content: '[自主活动记录]\n在房间里走了一圈',
          createdAt: tsAt(2, 0),
        }),
        mem({ role: 'user', speakerId: 'me', content: '好的', createdAt: tsAt(2, 1) }),
      ],
      ctx,
    );
    // last is user → transcript excludes the final entry, userTurn holds it
    expect(out.transcriptBlock).toBe('[历史记录]\n[02:00] 我：[自主活动记录]\n在房间里走了一圈');
    expect(out.userTurn).toEqual({ role: 'user', content: '小米：好的' });
  });

  it('HH and MM are zero-padded', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'assistant', speakerId: 'char-001', content: 'a', createdAt: tsAt(3, 5) }),
        mem({ role: 'user', speakerId: 'me', content: 'b', createdAt: tsAt(3, 9) }),
      ],
      ctx,
    );
    // last is user → transcript holds only the assistant entry
    expect(out.transcriptBlock).toBe('[历史记录]\n[03:05] 我：a');
    expect(out.userTurn).toEqual({ role: 'user', content: '小米：b' });
  });

  it('multi-party alternation preserves order and labels every turn', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'user', speakerId: 'me', content: '你们谁去拿快递', createdAt: tsAt(10, 0) }),
        mem({ role: 'user', speakerId: 'char-002', content: '我', createdAt: tsAt(10, 1) }),
        mem({ role: 'user', speakerId: 'char-002', content: '等下就去', createdAt: tsAt(10, 2) }),
        mem({ role: 'assistant', speakerId: 'char-001', content: '辛苦你啦', createdAt: tsAt(10, 3) }),
        mem({ role: 'user', speakerId: 'me', content: '谢谢小月', createdAt: tsAt(10, 4) }),
      ],
      ctx,
    );
    // last is user(me) → transcript holds the first 4 entries, userTurn holds the 5th
    expect(out.transcriptBlock).toBe(
      [
        '[历史记录]',
        '[10:00] 小米：你们谁去拿快递',
        '[10:01] 小月：我',
        '[10:02] 小月：等下就去',
        '[10:03] 我：辛苦你啦',
      ].join('\n'),
    );
    expect(out.userTurn).toEqual({ role: 'user', content: '小米：谢谢小月' });
  });
});

describe('renderMemoryToTranscript — userTurn dispatch', () => {
  it('last entry role=user → transcript excludes it, userTurn populated', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'assistant', speakerId: 'char-001', content: 'hi', createdAt: tsAt(8, 0) }),
        mem({ role: 'user', speakerId: 'me', content: '早', createdAt: tsAt(8, 1) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe('[历史记录]\n[08:00] 我：hi');
    expect(out.userTurn).toEqual({ role: 'user', content: '小米：早' });
  });

  it('last entry role=system → transcript includes all, no userTurn', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'user', speakerId: 'me', content: '早', createdAt: tsAt(8, 0) }),
        mem({
          role: 'system',
          speakerId: 'system',
          source: 'system',
          content: '[上下文切换] 切到了 拍卖行',
          createdAt: tsAt(8, 5),
        }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe(
      '[历史记录]\n[08:00] 小米：早\n[08:05] [上下文切换] 切到了 拍卖行',
    );
    expect(out.userTurn).toBeNull();
  });

  it('last entry role=assistant (defensive) → transcript includes all, no userTurn', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'user', speakerId: 'me', content: '早', createdAt: tsAt(8, 0) }),
        mem({ role: 'assistant', speakerId: 'char-001', content: '早安', createdAt: tsAt(8, 1) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe('[历史记录]\n[08:00] 小米：早\n[08:01] 我：早安');
    expect(out.userTurn).toBeNull();
  });

  it('empty entries → everything null', () => {
    const out = renderMemoryToTranscript([], ctx);
    expect(out).toEqual({
      longTermMemory: null,
      transcriptBlock: null,
      userTurn: null,
    });
  });
});

describe('renderMemoryToTranscript — long-term memory', () => {
  it('compressed entry → longTermMemory populated, not in transcript', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'system',
          speakerId: 'system',
          source: 'system',
          content: '[长期记忆]\n他们聊了吃饭。',
          compressed: true,
          createdAt: tsAt(7, 0),
        }),
        mem({ role: 'assistant', speakerId: 'char-001', content: '早', createdAt: tsAt(9, 0) }),
      ],
      ctx,
    );
    expect(out.longTermMemory).toBe('[长期记忆]\n他们聊了吃饭。');
    expect(out.transcriptBlock).toBe('[历史记录]\n[09:00] 我：早');
    expect(out.userTurn).toBeNull();
  });

  it('multiple compressed entries (transitional bug state) → keep only the latest', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'system', speakerId: 'system', source: 'system',
          content: '[长期记忆]\n旧 v1', compressed: true, createdAt: tsAt(1, 0),
        }),
        mem({
          role: 'system', speakerId: 'system', source: 'system',
          content: '[长期记忆]\n新 v2', compressed: true, createdAt: tsAt(2, 0),
        }),
        mem({ role: 'assistant', speakerId: 'char-001', content: 'hi', createdAt: tsAt(9, 0) }),
      ],
      ctx,
    );
    expect(out.longTermMemory).toBe('[长期记忆]\n新 v2');
  });

  it('only compressed entries → transcriptBlock/userTurn null, longTermMemory set', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'system', speakerId: 'system', source: 'system',
          content: '[长期记忆]\n only summary', compressed: true, createdAt: tsAt(0, 0),
        }),
      ],
      ctx,
    );
    expect(out.longTermMemory).toBe('[长期记忆]\n only summary');
    expect(out.transcriptBlock).toBeNull();
    expect(out.userTurn).toBeNull();
  });
});
