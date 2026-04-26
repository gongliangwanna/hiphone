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
    const outNone = systemBlock(BASE); // no availableTools
    expect(outNone).not.toContain('[可用动作]');

    const outEmpty = systemBlock({ ...BASE, availableTools: [] });
    expect(outEmpty).not.toContain('[可用动作]');
  });

  it('chunk 7 still fires even when no tools — unified path is the default', () => {
    const out = systemBlock({
      ...BASE,
      appSystemPromptSnapshot: 'some task',
      // no availableTools
    });
    expect(out).toContain('[回复格式]');
    expect(out).toContain('{"type":"<type>","param":<param>}');
    expect(out).not.toContain('[可用动作]');
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

  it('legacy availableStickers path: emits old [可用表情包] block when neither appPrompt nor tools set', () => {
    const out = systemBlock({
      ...BASE,
      availableStickers: [{ id: 's1', description: '笑' }],
    });
    expect(out).toContain('[可用表情包]');
    expect(out).toContain('s1：笑');
  });
});

describe('[工具状态] inline chunk (dynamicContext, default placement)', () => {
  it('aggregates non-tail dynamicContext into system block after [可用动作]', () => {
    const tools: ToolDefinition[] = [
      { type: 'tool_a', description: 'does A', param: 'string' },
      {
        type: 'tool_b',
        description: 'does B',
        param: '',
        dynamicContext: (ctx) => `state for ${ctx.characterId}`,
      },
    ];
    const sys = systemBlock({ ...BASE, currentAppId: 'test-app', availableTools: tools });

    // [可用动作] stays static
    expect(sys).toContain('[可用动作]');
    expect(sys).toContain('- tool_a: does A');
    expect(sys).toContain('- tool_b: does B');

    // [工具状态] appears after [可用动作]
    const actionsIdx = sys.indexOf('[可用动作]');
    const stateIdx = sys.indexOf('[工具状态]');
    expect(stateIdx).toBeGreaterThan(actionsIdx);

    // Each tool's dynamicContext is wrapped with [toolType] header
    expect(sys).toContain('[tool_b]\nstate for char-001');
  });

  it('skips [工具状态] chunk entirely when all dynamicContext return null/empty', () => {
    const tools: ToolDefinition[] = [
      { type: 'tool_a', description: 'A', param: '', dynamicContext: () => null },
      { type: 'tool_b', description: 'B', param: '', dynamicContext: () => '' },
      { type: 'tool_c', description: 'C', param: '', dynamicContext: () => '  ' },
    ];
    const sys = systemBlock({ ...BASE, currentAppId: 'test-app', availableTools: tools });
    expect(sys).not.toContain('[工具状态]');
  });

  it('skips tools marked contextAtTail from inline chunk', () => {
    const tools: ToolDefinition[] = [
      { type: 'inline', description: '', param: '', dynamicContext: () => 'I am inline' },
      { type: 'tail', description: '', param: '', dynamicContext: () => 'I am tail', contextAtTail: true },
    ];
    const sys = systemBlock({ ...BASE, currentAppId: 'test-app', availableTools: tools });
    expect(sys).toContain('I am inline');
    expect(sys).not.toContain('I am tail');
  });

  it('passes {appId, characterId: currentCharId} to the dynamicContext fn', () => {
    let capturedCtx: { appId: string; characterId: string } | null = null;
    const tools: ToolDefinition[] = [
      {
        type: 't',
        description: '',
        param: '',
        dynamicContext: (ctx) => {
          capturedCtx = ctx;
          return null;
        },
      },
    ];
    assemblePrompt({
      ...BASE,
      currentCharId: 'char-xyz',
      currentAppId: 'my-app',
      availableTools: tools,
    });
    expect(capturedCtx).toEqual({ appId: 'my-app', characterId: 'char-xyz' });
  });
});

describe('[工具状态] tail chunk (dynamicContext with contextAtTail:true)', () => {
  it('appears as a system message right before the user turn', () => {
    const out = assemblePrompt({
      ...BASE,
      currentAppId: 'test-app',
      currentCharId: 'char-001',
      memoryEntries: [
        {
          id: 'u1', characterId: 'char-001', role: 'user', speakerId: 'me',
          content: 'hello', source: 'xingyu', createdAt: Date.now(),
        },
      ],
      availableTools: [
        {
          type: 'alert',
          description: 'notify',
          param: '',
          dynamicContext: () => 'You have 3 unread messages',
          contextAtTail: true,
        },
      ],
    });

    // Find the last system message before the user turn.
    const roles = out.messages.map((m) => m.role);
    const userIdx = roles.indexOf('user');
    expect(userIdx).toBeGreaterThanOrEqual(0);
    const lastSysBeforeUser = out.messages
      .slice(0, userIdx)
      .reverse()
      .find((m) => m.role === 'system');
    const content = lastSysBeforeUser!.content as string;
    expect(content).toContain('[工具状态]');
    expect(content).toContain('[alert]\nYou have 3 unread messages');
  });

  it('keeps tail separate from inline — both placements coexist correctly', () => {
    const out = assemblePrompt({
      ...BASE,
      currentAppId: 'test-app',
      availableTools: [
        { type: 'inline_tool', description: '', param: '',
          dynamicContext: () => 'inline body' },
        { type: 'tail_tool', description: '', param: '',
          dynamicContext: () => 'tail body', contextAtTail: true },
      ],
    });

    // First system block is the big system block — should contain inline body, NOT tail body.
    const firstSys = out.messages[0]!;
    const sys1 = firstSys.content as string;
    expect(sys1).toContain('inline body');
    expect(sys1).not.toContain('tail body');

    // Aggregate all message contents — tail body must show up somewhere.
    const allContent = out.messages
      .map((m) => typeof m.content === 'string' ? m.content : '')
      .join('\n');
    expect(allContent).toContain('tail body');
  });

  it('skips tail chunk entirely when all tail tools return null', () => {
    const out = assemblePrompt({
      ...BASE,
      currentAppId: 'test-app',
      availableTools: [
        { type: 't', description: '', param: '',
          dynamicContext: () => null, contextAtTail: true },
      ],
    });
    const allContent = out.messages
      .map((m) => typeof m.content === 'string' ? m.content : '')
      .join('\n');
    // The inline [工具状态] might be absent too; the point is tail doesn't
    // spuriously produce an empty chunk.
    expect(allContent.match(/\[工具状态\]/g) ?? []).toHaveLength(0);
  });

  it('tail [工具状态] appears AFTER sceneHint in post-history', () => {
    const out = assemblePrompt({
      ...BASE,
      currentAppId: 'test-app',
      sceneHint: '[当前场景] 私聊中',
      availableTools: [
        {
          type: 'alert',
          description: '',
          param: '',
          dynamicContext: () => 'unread',
          contextAtTail: true,
        },
      ],
    });
    // The post-history system message contains both sceneHint and tail chunk.
    const postSys = out.messages.find(
      (m) =>
        m.role === 'system' &&
        typeof m.content === 'string' &&
        (m.content as string).includes('[当前场景]'),
    );
    const c = postSys!.content as string;
    expect(c.indexOf('[当前场景]')).toBeLessThan(c.indexOf('[工具状态]'));
  });

  it('multiple contextAtTail tools concatenate in registration order', () => {
    const out = assemblePrompt({
      ...BASE,
      currentAppId: 'test-app',
      availableTools: [
        { type: 'first',  description: '', param: '',
          dynamicContext: () => 'first body',  contextAtTail: true },
        { type: 'second', description: '', param: '',
          dynamicContext: () => 'second body', contextAtTail: true },
        { type: 'third',  description: '', param: '',
          dynamicContext: () => 'third body',  contextAtTail: true },
      ],
    });
    // Find the tail [工具状态] chunk (post-history contains it after deviceContext etc.)
    const allContent = out.messages
      .map((m) => (typeof m.content === 'string' ? m.content : ''))
      .join('\n');
    const idxFirst  = allContent.indexOf('first body');
    const idxSecond = allContent.indexOf('second body');
    const idxThird  = allContent.indexOf('third body');
    expect(idxFirst).toBeGreaterThan(-1);
    expect(idxFirst).toBeLessThan(idxSecond);
    expect(idxSecond).toBeLessThan(idxThird);
    // Verify they're in the same chunk (separated by the tool-type headers)
    expect(allContent).toContain('[first]\nfirst body');
    expect(allContent).toContain('[second]\nsecond body');
    expect(allContent).toContain('[third]\nthird body');
  });
});

describe('PromptInput.sceneHint', () => {
  it('sceneHint is appended to the post-history system message', () => {
    const out = assemblePrompt({
      character: {
        name: '小星', description: '', personality: '', scenario: '',
        systemPrompt: '', postHistoryInstructions: '', messageExamples: '',
      },
      persona: { name: '小米', description: '' },
      aiConfig: {
        systemPrompt: '', postHistoryInstructions: '',
        contextWindow: 10000, maxTokens: 500,
        keepRecentMessages: 5, worldInfoBudgetPercent: 30,
      },
      worldBookChunk: '',
      memoryEntries: [],
      currentCharId: 'char-001',
      charactersById: new Map([['char-001', { id: 'char-001', name: '小星' }]]),
      now: new Date(2026, 3, 22, 10, 30),
      sceneHint: '[当前场景] 你正在和小月私聊。请直接回复小月。',
    });

    const postHistory = out.messages[out.messages.length - 1]!;
    expect(postHistory.role).toBe('system');
    expect(postHistory.content).toContain('[当前场景] 你正在和小月私聊');
    // Time anchor must still come first in post-history
    expect((postHistory.content as string).indexOf('[当前时间'))
      .toBeLessThan((postHistory.content as string).indexOf('[当前场景]'));
  });

  it('absent sceneHint → post-history unchanged', () => {
    const out = assemblePrompt({
      character: {
        name: '小星', description: '', personality: '', scenario: '',
        systemPrompt: '', postHistoryInstructions: '', messageExamples: '',
      },
      persona: { name: '小米', description: '' },
      aiConfig: {
        systemPrompt: '', postHistoryInstructions: '',
        contextWindow: 10000, maxTokens: 500,
        keepRecentMessages: 5, worldInfoBudgetPercent: 30,
      },
      worldBookChunk: '',
      memoryEntries: [],
      currentCharId: 'char-001',
      charactersById: new Map([['char-001', { id: 'char-001', name: '小星' }]]),
      now: new Date(2026, 3, 22, 10, 30),
    });

    const postHistory = out.messages[out.messages.length - 1]!;
    expect(postHistory.content).not.toContain('[当前场景]');
  });
});
