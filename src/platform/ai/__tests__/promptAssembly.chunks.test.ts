// src/platform/ai/__tests__/promptAssembly.chunks.test.ts
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
  now: new Date('2026-04-21T12:00:00Z'),
};

function systemBlock(input: PromptInput): string {
  const { messages } = assemblePrompt(input);
  const sys = messages.find((m) => m.role === 'system');
  if (!sys || typeof sys.content !== 'string') throw new Error('no system block');
  return sys.content;
}

describe('promptAssembly chunks 7 / 8 (M4.2.5 unified)', () => {
  it('chunk 7 emits unified template when tools registered', () => {
    const tools: ToolDefinition[] = [
      { type: 'text', description: 't', param: 'string' },
    ];
    const out = systemBlock({ ...BASE, availableTools: tools });
    expect(out).toContain('[回复格式]');
    expect(out).toContain('每条是一个工具调用');
    expect(out).toContain('{"type":"<type>","param":<param>}');
    expect(out).toContain('只输出 JSON 数组,不要其他内容');
    // Does NOT reference the M4.2 text+action duality anymore
    expect(out).not.toContain('两类之一');
    expect(out).not.toContain('叙述 / 对白');
  });

  it('chunk 6.5 [当前任务] still honors appSystemPromptSnapshot', () => {
    const out = systemBlock({
      ...BASE,
      appSystemPromptSnapshot: '你是一场拍卖会主持人',
    });
    expect(out).toContain('[当前任务]');
    expect(out).toContain('你是一场拍卖会主持人');
  });

  it('chunk 8 renders "- <type>: <desc>\\n  param: <hint>" per tool', () => {
    const tools: ToolDefinition[] = [
      { type: 'bid_call', description: '宣布叫价', param: '{item: string, min: number}' },
      { type: 'hammer_down', description: '落槌', param: '{item: string, final: number}' },
    ];
    const out = systemBlock({ ...BASE, availableTools: tools });
    expect(out).toContain('[可用动作]');
    expect(out).toContain('- bid_call: 宣布叫价');
    expect(out).toContain('  param: {item: string, min: number}');
    expect(out).toContain('- hammer_down: 落槌');
    expect(out).toContain('  param: {item: string, final: number}');
  });

  it('chunk 8 tools with empty param render without the "param:" line', () => {
    const tools: ToolDefinition[] = [
      { type: 'pass', description: '跳过', param: '' },
    ];
    const out = systemBlock({ ...BASE, availableTools: tools });
    expect(out).toContain('- pass: 跳过');
    // No "param:" label when hint is empty
    expect(out).not.toMatch(/- pass: 跳过\n\s*param:/);
  });

  it('chunk 8 omitted entirely when availableTools is empty or undefined', () => {
    // NOTE: the chunk-7 template prose mentions "详见 [可用动作]" in its
    // body, so we check for the chunk-8 HEADER specifically (at start of a
    // line or block) rather than a bare string presence.
    const outNone = systemBlock(BASE); // no availableTools
    expect(outNone).not.toMatch(/(^|\n\n)\[可用动作\]\n/);

    const outEmpty = systemBlock({ ...BASE, availableTools: [] });
    expect(outEmpty).not.toMatch(/(^|\n\n)\[可用动作\]\n/);
  });

  it('chunk 7 still fires even when no tools — unified path is the default', () => {
    const out = systemBlock({
      ...BASE,
      appSystemPromptSnapshot: 'some task',
      // no availableTools
    });
    expect(out).toContain('[回复格式]');
    expect(out).toContain('{"type":"<type>","param":<param>}');
    // Chunk-8 header absent (prose mention of [可用动作] inside chunk 7 is OK)
    expect(out).not.toMatch(/(^|\n\n)\[可用动作\]\n/);
  });

  it('ordering: 6.5 [当前任务] → 7 [回复格式] → 8 [可用动作]', () => {
    const tools: ToolDefinition[] = [
      { type: 'x', description: 'd', param: 'string' },
    ];
    const out = systemBlock({
      ...BASE,
      appSystemPromptSnapshot: 'task',
      availableTools: tools,
    });
    const iTask = out.indexOf('[当前任务]');
    const iFormat = out.indexOf('[回复格式]');
    const iActions = out.indexOf('[可用动作]');
    expect(iTask).toBeGreaterThan(-1);
    expect(iFormat).toBeGreaterThan(iTask);
    expect(iActions).toBeGreaterThan(iFormat);
  });

  it('formatOverride (heartbeat ReAct) short-circuits all 3 new chunks', () => {
    const tools: ToolDefinition[] = [
      { type: 't', description: '', param: '' },
    ];
    const out = systemBlock({
      ...BASE,
      formatOverride: '[Heartbeat ReAct format]',
      appSystemPromptSnapshot: 'task',
      availableTools: tools,
    });
    expect(out).toContain('[Heartbeat ReAct format]');
    expect(out).not.toContain('[当前任务]');
    expect(out).not.toContain('[回复格式]');
    // Chunk-8 header absent (prose mention of [可用动作] inside chunk 7 is irrelevant since chunk 7 is also gated out here)
    expect(out).not.toMatch(/(^|\n\n)\[可用动作\]\n/);
  });

  it('legacy availableStickers path: emits old [可用表情包] block when neither appPrompt nor tools set', () => {
    const out = systemBlock({
      ...BASE,
      availableStickers: [{ id: 's1', description: '笑' }],
    });
    expect(out).toContain('[可用表情包]');
    expect(out).toContain('s1：笑');
  });
});
