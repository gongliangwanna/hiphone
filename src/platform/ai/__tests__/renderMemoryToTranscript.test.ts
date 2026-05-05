import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import {
  renderMemoryToTranscript,
  type MemoryRenderContext,
} from '../promptAssembly';
import type { MemoryEntry } from '../characterMemoryStore';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';
import { makeInitialState } from '../memoryStateTypes';

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

  it('multi-line assistant content: only the message block starts with [HH:MM] speaker', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'assistant',
          speakerId: 'char-001',
          content: '你好呀\n发了一个"笑脸"的表情包',
          createdAt: tsAt(2, 0),
        }),
        mem({ role: 'user', speakerId: 'me', content: '好的', createdAt: tsAt(2, 1) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe(
      '[历史记录]\n[02:00] 我：你好呀\n发了一个"笑脸"的表情包',
    );
    expect(out.userTurn).toEqual({ role: 'user', content: '小米：好的' });
  });

  it('multi-line assistant content preserves blank lines instead of rendering empty speaker turns', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'assistant',
          speakerId: 'char-001',
          content: '第一行\n\n第三行',
          createdAt: tsAt(2, 0),
        }),
        mem({ role: 'user', speakerId: 'me', content: '收到', createdAt: tsAt(2, 1) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe(
      '[历史记录]\n[02:00] 我：第一行\n\n第三行',
    );
    expect(out.transcriptBlock).not.toContain('\n我：\n');
  });

  it('legacy virtual-world experience labels are normalized to experience labels in transcript context', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'assistant',
          speakerId: 'char-001',
          source: 'heartbeat',
          content: '[虚拟世界经历]\n时间跨度：old\n\n我试了一杯咸柠气泡水。\n[虚拟世界经历结束]',
          createdAt: tsAt(2, 0),
        }),
        mem({ role: 'user', speakerId: 'me', content: '收到', createdAt: tsAt(2, 1) }),
      ],
      ctx,
    );

    expect(out.transcriptBlock).toBe(
      '[历史记录]\n[02:00] 我：[经历]\n时间跨度：old\n\n我试了一杯咸柠气泡水。\n[经历结束]',
    );
  });

  it('consecutive assistant messages each keep their own speaker prefix', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'assistant', speakerId: 'char-001', content: '……', createdAt: tsAt(23, 50) }),
        mem({ role: 'assistant', speakerId: 'char-001', content: '五个多小时', createdAt: tsAt(23, 50) }),
        mem({ role: 'assistant', speakerId: 'char-001', content: '你就发一个hi', createdAt: tsAt(23, 50) }),
        mem({ role: 'assistant', speakerId: 'char-001', content: '本将军在手机前坐到贝壳都被我捏裂了', createdAt: tsAt(23, 50) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe(
      [
        '[历史记录]',
        '[23:50] 我：……',
        '[23:50] 我：五个多小时',
        '[23:50] 我：你就发一个hi',
        '[23:50] 我：本将军在手机前坐到贝壳都被我捏裂了',
      ].join('\n'),
    );
  });

  it('latest multi-line user turn is prefixed once and keeps inner blank lines', () => {
    const out = renderMemoryToTranscript(
      [
        mem({ role: 'assistant', speakerId: 'char-001', content: '说吧', createdAt: tsAt(2, 0) }),
        mem({
          role: 'user',
          speakerId: 'me',
          content: '第一行\n\n第三行',
          createdAt: tsAt(2, 1),
        }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe('[历史记录]\n[02:00] 我：说吧');
    expect(out.userTurn).toEqual({ role: 'user', content: '小米：第一行\n\n第三行' });
  });

  it('multi-line system entry keeps [HH:MM] only (no speaker prefix on any line)', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'system',
          speakerId: 'system',
          source: 'system',
          content: '[多行事件]\nline1\nline2',
          createdAt: tsAt(2, 0),
        }),
        mem({ role: 'assistant', speakerId: 'char-001', content: 'ok', createdAt: tsAt(2, 5) }),
      ],
      ctx,
    );
    expect(out.transcriptBlock).toBe(
      '[历史记录]\n[02:00] [多行事件]\nline1\nline2\n[02:05] 我：ok',
    );
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
      stateTailBlock: null,
      transcriptBlock: null,
      userTurn: null,
    });
  });
});

describe('renderMemoryToTranscript — long-term memory (state-driven)', () => {
  beforeEach(async () => { await _resetMemoryStateForTests(); });

  it('no episodicSummary in state → longTermMemory null', () => {
    const out = renderMemoryToTranscript(
      [mem({ role: 'assistant', speakerId: 'char-001', content: '早', createdAt: tsAt(9, 0) })],
      ctx,
    );
    expect(out.longTermMemory).toBeNull();
    expect(out.transcriptBlock).toBe('[历史记录]\n[09:00] 我：早');
    expect(out.userTurn).toBeNull();
  });

  it('episodicSummary in state → longTermMemory populated with [长期记忆] prefix', () => {
    const s = makeInitialState('char-001');
    s.episodicSummary = { content: '他们聊了吃饭。', version: 1, coveringUpTo: 1, lastUpdatedAt: 1 };
    useMemoryState.getState().set('char-001', s);
    const out = renderMemoryToTranscript(
      [mem({ role: 'assistant', speakerId: 'char-001', content: '早', createdAt: tsAt(9, 0) })],
      ctx,
    );
    expect(out.longTermMemory).toBe('[长期记忆]\n他们聊了吃饭。');
    expect(out.transcriptBlock).toBe('[历史记录]\n[09:00] 我：早');
    expect(out.userTurn).toBeNull();
  });

  it('compressed entries are excluded from transcript (treated as consumed)', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'system', speakerId: 'system', source: 'system',
          content: '[长期记忆]\n old compressed entry', compressed: true, createdAt: tsAt(1, 0),
        }),
        mem({ role: 'assistant', speakerId: 'char-001', content: 'hi', createdAt: tsAt(9, 0) }),
      ],
      ctx,
    );
    // compressed entries are filtered out of live — only the assistant entry appears
    expect(out.transcriptBlock).toBe('[历史记录]\n[09:00] 我：hi');
    // no state set → longTermMemory null (legacy compressed entry is ignored)
    expect(out.longTermMemory).toBeNull();
  });

  it('only compressed entries → transcriptBlock/userTurn null, longTermMemory null (no state)', () => {
    const out = renderMemoryToTranscript(
      [
        mem({
          role: 'system', speakerId: 'system', source: 'system',
          content: '[长期记忆]\n only summary', compressed: true, createdAt: tsAt(0, 0),
        }),
      ],
      ctx,
    );
    // longTermMemory comes from state, not entries — null since state not set
    expect(out.longTermMemory).toBeNull();
    expect(out.transcriptBlock).toBeNull();
    expect(out.userTurn).toBeNull();
  });
});

describe('renderMemoryToTranscript — state-driven long-term memory', () => {
  beforeEach(async () => { await _resetMemoryStateForTests(); });

  it('episodicSummary 不存在 → longTermMemory=null', () => {
    const r = renderMemoryToTranscript([], {
      currentCharId: 'char-1', charactersById: new Map(), personaName: 'me',
    });
    expect(r.longTermMemory).toBeNull();
  });

  it('episodicSummary 存在 → longTermMemory 含[长期记忆]前缀', () => {
    const s = makeInitialState('char-1');
    s.episodicSummary = { content: '我们玩得很开心', version: 1, coveringUpTo: 1, lastUpdatedAt: 1 };
    useMemoryState.getState().set('char-1', s);
    const r = renderMemoryToTranscript([], {
      currentCharId: 'char-1', charactersById: new Map(), personaName: 'me',
    });
    expect(r.longTermMemory).toContain('[长期记忆]');
    expect(r.longTermMemory).toContain('我们玩得很开心');
  });

  it('stateTailBlock 在 state 非空时返回非 null', () => {
    const s = makeInitialState('char-1');
    s.relationship.lastUpdatedAt = Date.now();
    useMemoryState.getState().set('char-1', s);
    const r = renderMemoryToTranscript([], {
      currentCharId: 'char-1', charactersById: new Map(), personaName: 'me',
    });
    expect(r.stateTailBlock).toContain('[当前关系]');
  });
});
