import { describe, it, expect } from 'vitest';
import { assemblePrompt, type PromptInput } from '../promptAssembly';
import type { ToolDefinition } from '../toolRegistry';

const BASE: PromptInput = {
  character: {
    name: '小星',
    description: '',
    personality: '',
    scenario: '',
    systemPrompt: '',
    postHistoryInstructions: '',
    messageExamples: '',
  },
  persona: { name: '小米', description: '' },
  aiConfig: {
    systemPrompt: '',
    postHistoryInstructions: '',
    contextWindow: 100_000,
    maxTokens: 2000,
    keepRecentMessages: 10,
    worldInfoBudgetPercent: 0.3,
    enableVision: false,
  },
  worldBookChunk: '',
  memoryEntries: [],
  currentCharId: 'char-001',
  charactersById: new Map([['char-001', { id: 'char-001', name: '小星' }]]),
  now: new Date('2026-04-19T12:00:00Z'),
};

function systemBlock(input: PromptInput): string {
  const { messages } = assemblePrompt(input);
  const sys = messages.find((m) => m.role === 'system');
  if (!sys || typeof sys.content !== 'string') throw new Error('no system block');
  return sys.content;
}

describe('promptAssembly chunks 6.5 / 7 / 8', () => {
  it('chunk 7 [回复格式] unified template appears when no formatOverride + no legacy stickers', () => {
    const out = systemBlock({ ...BASE, availableTools: [] });
    expect(out).toContain('[回复格式]');
    expect(out).toContain('{"type":"text","content":"..."}');
    expect(out).toContain('{"type":"action","name"');
  });

  it('chunk 6.5 [当前任务] appears only when appSystemPromptSnapshot is non-empty', () => {
    const withSnapshot = systemBlock({
      ...BASE,
      appSystemPromptSnapshot: '你是一场拍卖会主持人',
    });
    expect(withSnapshot).toContain('[当前任务]');
    expect(withSnapshot).toContain('你是一场拍卖会主持人');

    const noSnapshot = systemBlock(BASE);
    expect(noSnapshot).not.toContain('[当前任务]');

    const emptySnapshot = systemBlock({ ...BASE, appSystemPromptSnapshot: '   ' });
    expect(emptySnapshot).not.toContain('[当前任务]');
  });

  it('chunk 8 [可用动作] appears only when availableTools has entries; derived from the list', () => {
    const tools: ToolDefinition[] = [
      { name: 'bid_call', description: '宣布叫价', parameters: { item: 'string', min: 'number' } },
      { name: 'hammer_down', description: '落槌成交', parameters: { item: 'string', final: 'number' } },
    ];
    const out = systemBlock({ ...BASE, availableTools: tools });
    expect(out).toContain('[可用动作]');
    expect(out).toContain('- bid_call: 宣布叫价');
    expect(out).toContain('item: string, min: number');
    expect(out).toContain('- hammer_down: 落槌成交');

    const noTools = systemBlock({ ...BASE, availableTools: [] });
    expect(noTools).not.toContain('[可用动作]');

    const undefTools = systemBlock(BASE);
    expect(undefTools).not.toContain('[可用动作]');
  });

  it('chunk ordering: 6 (messageExamples) → 6.5 → 7 → 8, all BEFORE the memory history', () => {
    const out = systemBlock({
      ...BASE,
      character: { ...BASE.character, messageExamples: '小星喜欢...' },
      appSystemPromptSnapshot: 'APP-TASK',
      availableTools: [{ name: 'x', description: 'd', parameters: { a: 'string' } }],
    });
    const idxExamples = out.indexOf('[对话示例]');
    const idxTask = out.indexOf('[当前任务]');
    const idxFormat = out.indexOf('[回复格式]');
    const idxActions = out.indexOf('[可用动作]');
    expect(idxExamples).toBeGreaterThan(-1);
    expect(idxTask).toBeGreaterThan(idxExamples);
    expect(idxFormat).toBeGreaterThan(idxTask);
    expect(idxActions).toBeGreaterThan(idxFormat);
  });

  it('legacy availableStickers path: when present AND appSystemPrompt/tools absent, emits the old [可用表情包] block', () => {
    // Back-compat: callers like heartbeat that still pass availableStickers
    // get the old rendering even after the M4.2 chunks land.
    const out = systemBlock({
      ...BASE,
      availableStickers: [{ id: 's1', description: '笑' }],
    });
    expect(out).toContain('[可用表情包]');
    expect(out).toContain('s1：笑');
  });

  it('formatOverride (heartbeat ReAct) short-circuits chunks 6.5 / 7 / 8 / stickers', () => {
    const out = systemBlock({
      ...BASE,
      formatOverride: '[Heartbeat ReAct format]',
      appSystemPromptSnapshot: 'task',
      availableTools: [{ name: 't', description: '', parameters: {} }],
      availableStickers: [{ id: 's1', description: '笑' }],
    });
    expect(out).toContain('[Heartbeat ReAct format]');
    expect(out).not.toContain('[当前任务]');
    expect(out).not.toContain('[回复格式]');
    expect(out).not.toContain('[可用动作]');
    expect(out).not.toContain('[可用表情包]');
  });
});
