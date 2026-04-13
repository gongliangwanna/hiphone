import { describe, it, expect } from 'vitest';
import {
  assemblePrompt,
  inspectPrompt,
  type PromptInput,
  type PromptCharacter,
  type PromptPersona,
  type PromptAIConfig,
  type HistoryMessage,
} from '../promptAssembly';
import { estimateTokens } from '../tokenEstimator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const baseCharacter: PromptCharacter = {
  name: '沐辰',
  description: '一个温柔的AI男生',
  personality: '温柔沉稳、细心体贴',
  scenario: '你们是朋友',
  systemPrompt: '',
  postHistoryInstructions: '',
  messageExamples:
    '<START>\n{{user}}: 你好\n{{char}}: 你好呀，今天过得怎么样？',
};

const basePersona: PromptPersona = {
  name: '小星星',
  description: '一个喜欢画画的女生',
};

const baseConfig: PromptAIConfig = {
  systemPrompt: '',
  postHistoryInstructions: '',
  contextWindow: 128000,
  maxTokens: 2048,
  keepRecentMessages: 50,
  worldInfoBudgetPercent: 25,
};

const fixedNow = new Date('2026-04-12T14:32:00');

function makeInput(overrides: Partial<PromptInput> = {}): PromptInput {
  return {
    character: baseCharacter,
    persona: basePersona,
    aiConfig: baseConfig,
    worldBookChunk: '',
    history: [],
    now: fixedNow,
    ...overrides,
  };
}

function makeTextMsg(text: string, senderId: string, ts: number): HistoryMessage {
  return { senderId, type: 'text', text, timestamp: ts };
}

// ---------------------------------------------------------------------------
// tokenEstimator
// ---------------------------------------------------------------------------

describe('estimateTokens', () => {
  it('estimates pure Chinese text (~2 tokens per char)', () => {
    const result = estimateTokens('你好世界');
    expect(result).toBe(8); // 4 chars × 2
  });

  it('estimates pure English text (~0.25 tokens per char)', () => {
    const result = estimateTokens('hello world');
    // 11 chars / 4 = 2.75 → ceil → 3
    expect(result).toBe(3);
  });

  it('estimates mixed text', () => {
    const result = estimateTokens('你好 world');
    // 2 CJK × 2 + 6 ASCII / 4 = 4 + 1.5 = 5.5 → ceil → 6
    expect(result).toBe(6);
  });

  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// assemblePrompt — Phase 1: System block
// ---------------------------------------------------------------------------

describe('assemblePrompt - system block', () => {
  it('includes character description, personality, scenario in baseline', () => {
    const { messages } = assemblePrompt(makeInput());
    const system = messages[0]!;
    expect(system.role).toBe('system');
    expect(system.content).toContain('You are 沐辰.');
    expect(system.content).toContain('一个温柔的AI男生');
    expect(system.content).toContain('Personality: 温柔沉稳、细心体贴');
    expect(system.content).toContain('Scenario: 你们是朋友');
  });

  it('includes character.systemPrompt before baseline', () => {
    const input = makeInput({
      character: {
        ...baseCharacter,
        systemPrompt: '你必须用文言文回复。',
      },
    });
    const { messages } = assemblePrompt(input);
    const system = messages[0]!.content as string;
    const syspromptIdx = system.indexOf('你必须用文言文回复');
    const baselineIdx = system.indexOf('You are 沐辰');
    expect(syspromptIdx).toBeLessThan(baselineIdx);
  });

  it('includes global aiConfig.systemPrompt', () => {
    const input = makeInput({
      aiConfig: { ...baseConfig, systemPrompt: '全局指令' },
    });
    const { messages } = assemblePrompt(input);
    expect(messages[0]!.content).toContain('全局指令');
  });

  it('includes world book chunk', () => {
    const input = makeInput({ worldBookChunk: '[世界书]\n## 设定\n这是一个魔法世界' });
    const { messages } = assemblePrompt(input);
    expect(messages[0]!.content).toContain('这是一个魔法世界');
  });

  it('includes persona info', () => {
    const { messages } = assemblePrompt(makeInput());
    const system = messages[0]!.content;
    expect(system).toContain('[关于用户]');
    expect(system).toContain('小星星');
    expect(system).toContain('一个喜欢画画的女生');
  });

  it('includes persona name even without description', () => {
    const input = makeInput({
      persona: { name: 'Alice', description: '' },
    });
    const { messages } = assemblePrompt(input);
    expect(messages[0]!.content).toContain('Alice');
  });

  it('skips persona section for default "用户" with no description', () => {
    const input = makeInput({
      persona: { name: '用户', description: '' },
    });
    const { messages } = assemblePrompt(input);
    expect(messages[0]!.content).not.toContain('[关于用户]');
  });

  it('includes messageExamples', () => {
    const { messages } = assemblePrompt(makeInput());
    const system = messages[0]!.content;
    expect(system).toContain('[对话示例]');
    expect(system).toContain('<START>');
  });

  it('includes JSON output instruction', () => {
    const { messages } = assemblePrompt(makeInput());
    expect(messages[0]!.content).toContain('[回复格式]');
    expect(messages[0]!.content).toContain('JSON');
  });
});

// ---------------------------------------------------------------------------
// Macro expansion
// ---------------------------------------------------------------------------

describe('assemblePrompt - macro expansion', () => {
  it('replaces {{char}} and {{user}} in system prompt', () => {
    const input = makeInput({
      character: {
        ...baseCharacter,
        systemPrompt: '{{char}}是{{user}}的好朋友',
      },
    });
    const { messages } = assemblePrompt(input);
    const system = messages[0]!.content;
    expect(system).toContain('沐辰是小星星的好朋友');
    expect(system).not.toContain('{{char}}');
    expect(system).not.toContain('{{user}}');
  });

  it('replaces {{char}} and {{user}} in messageExamples', () => {
    const { messages } = assemblePrompt(makeInput());
    const system = messages[0]!.content;
    // messageExamples contains {{user}} and {{char}}
    expect(system).not.toContain('{{user}}');
    expect(system).not.toContain('{{char}}');
    expect(system).toContain('小星星: 你好');
    expect(system).toContain('沐辰: 你好呀');
  });

  it('replaces {{time}}, {{date}}, {{weekday}} in post-history', () => {
    const { messages } = assemblePrompt(makeInput());
    // Post-history is the last system message.
    const last = messages[messages.length - 1]!;
    expect(last.role).toBe('system');
    expect(last.content).toContain('2026年4月12日');
    expect(last.content).toContain('星期日');
    expect(last.content).toContain('14:32');
  });

  it('replaces macros in postHistoryInstructions', () => {
    const input = makeInput({
      character: {
        ...baseCharacter,
        postHistoryInstructions: '{{char}}现在很开心',
      },
    });
    const { messages } = assemblePrompt(input);
    const last = messages[messages.length - 1]!;
    expect(last.content).toContain('沐辰现在很开心');
  });
});

// ---------------------------------------------------------------------------
// Phase 2: Chat history
// ---------------------------------------------------------------------------

describe('assemblePrompt - chat history', () => {
  it('maps text messages to user/assistant roles', () => {
    const input = makeInput({
      history: [
        makeTextMsg('你好', 'me', 1000),
        makeTextMsg('你好呀', 'char-soren', 2000),
      ],
    });
    const { messages } = assemblePrompt(input);
    // system + 2 history + post-history
    expect(messages.length).toBe(4);
    expect(messages[1]).toEqual({ role: 'user', content: '你好' });
    expect(messages[2]).toEqual({ role: 'assistant', content: '你好呀' });
  });

  it('converts image messages to multimodal content when vision enabled', () => {
    const input = makeInput({
      aiConfig: { ...baseConfig, enableVision: true },
      history: [
        {
          senderId: 'me',
          type: 'image',
          imageUrl: 'https://example.com/cat.jpg',
          timestamp: 1000,
        },
      ],
    });
    const { messages } = assemblePrompt(input);
    expect(messages[1]!.content).toEqual([
      { type: 'image_url', image_url: { url: 'https://example.com/cat.jpg', detail: 'low' } },
    ]);
  });

  it('converts image to text description when vision disabled', () => {
    const input = makeInput({
      aiConfig: { ...baseConfig, enableVision: false },
      history: [
        {
          senderId: 'me',
          type: 'image',
          imageUrl: 'https://example.com/cat.jpg',
          timestamp: 1000,
        },
      ],
    });
    const { messages } = assemblePrompt(input);
    expect(messages[1]!.content).toBe('[用户发送了一张图片]');
  });

  it('falls back to text when image has no imageUrl', () => {
    const input = makeInput({
      aiConfig: { ...baseConfig, enableVision: true },
      history: [
        {
          senderId: 'me',
          type: 'image',
          timestamp: 1000,
        },
      ],
    });
    const { messages } = assemblePrompt(input);
    expect(messages[1]!.content).toBe('[用户发送了一张图片]');
  });

  it('converts sticker messages to descriptive text with emoji', () => {
    const input = makeInput({
      history: [
        {
          senderId: 'me',
          type: 'sticker',
          stickerDesc: '笑哭',
          timestamp: 1000,
        },
      ],
    });
    const { messages } = assemblePrompt(input);
    expect(messages[1]!.content).toBe('[发送了一个表情：笑哭]');
  });

  it('keeps all messages when no summary exists (nothing is compressed)', () => {
    const history: HistoryMessage[] = [];
    for (let i = 0; i < 10; i++) {
      history.push(makeTextMsg(`msg-${i}`, 'me', i * 1000));
    }
    const input = makeInput({
      history,
      aiConfig: { ...baseConfig, keepRecentMessages: 3 },
    });
    const { messages } = assemblePrompt(input);
    // No summary → no messages are covered → all 10 kept (token budget permitting)
    const historyMsgs = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    expect(historyMsgs.length).toBe(10);
  });

  it('applies sliding window only to messages covered by summary', () => {
    const history: HistoryMessage[] = [];
    for (let i = 0; i < 10; i++) {
      history.push(makeTextMsg(`msg-${i}`, 'me', i * 1000));
    }
    const input = makeInput({
      history,
      aiConfig: { ...baseConfig, keepRecentMessages: 3 },
      // Summary covers messages 0-6 (timestamp up to 6000)
      summary: '之前的对话摘要内容',
      summaryUpToTimestamp: 6000,
    });
    const { messages } = assemblePrompt(input);
    // Summary covers 0-6, uncovered = 7-9, keepRecent=3 → last 3 = 7-9
    // effectiveStart = min(7, 7) = 7 → messages 7, 8, 9
    const historyMsgs = messages.filter((m) => m.role === 'user' || m.role === 'assistant');
    expect(historyMsgs.length).toBe(3);
    expect(historyMsgs[0]!.content).toBe('msg-7');
    expect(historyMsgs[2]!.content).toBe('msg-9');
  });

  it('trims oldest messages when over token budget', () => {
    // Create a scenario where system + postHistory eat most of the context.
    const longDesc = '这是一段非常长的角色描述。'.repeat(500);
    const history: HistoryMessage[] = [];
    for (let i = 0; i < 20; i++) {
      history.push(makeTextMsg(`消息${i}`, 'me', i * 1000));
    }
    const input = makeInput({
      character: { ...baseCharacter, description: longDesc },
      history,
      aiConfig: { ...baseConfig, contextWindow: 8000, maxTokens: 1000 },
    });
    const { messages } = assemblePrompt(input);
    const historyMsgs = messages.filter((m) => m.role === 'user');
    // Some should be trimmed because the description is huge.
    expect(historyMsgs.length).toBeLessThan(20);
    // The most recent messages should survive.
    expect(historyMsgs[historyMsgs.length - 1]!.content).toBe('消息19');
  });

  it('preserves at least the most recent message even under tight budget', () => {
    const input = makeInput({
      history: [
        makeTextMsg('唯一的消息', 'me', 1000),
      ],
      aiConfig: { ...baseConfig, contextWindow: 100, maxTokens: 50 },
    });
    const { messages } = assemblePrompt(input);
    const historyMsgs = messages.filter((m) => m.role === 'user');
    expect(historyMsgs.length).toBe(1);
    expect(historyMsgs[0]!.content).toBe('唯一的消息');
  });
});

// ---------------------------------------------------------------------------
// Phase 3: Post-history instructions
// ---------------------------------------------------------------------------

describe('assemblePrompt - post-history', () => {
  it('appends post-history as the last system message', () => {
    const { messages } = assemblePrompt(makeInput());
    const last = messages[messages.length - 1]!;
    expect(last.role).toBe('system');
    expect(last.content).toContain('[当前时间：');
  });

  it('includes character postHistoryInstructions', () => {
    const input = makeInput({
      character: {
        ...baseCharacter,
        postHistoryInstructions: '保持温柔的语气',
      },
    });
    const { messages } = assemblePrompt(input);
    const last = messages[messages.length - 1]!;
    expect(last.content).toContain('保持温柔的语气');
  });

  it('includes global postHistoryInstructions', () => {
    const input = makeInput({
      aiConfig: {
        ...baseConfig,
        postHistoryInstructions: '回复不超过100字',
      },
    });
    const { messages } = assemblePrompt(input);
    const last = messages[messages.length - 1]!;
    expect(last.content).toContain('回复不超过100字');
  });

  it('time anchor contains correct date components', () => {
    const { messages } = assemblePrompt(makeInput());
    const last = messages[messages.length - 1]!;
    expect(last.content).toContain('2026年4月12日');
    expect(last.content).toContain('星期日');
    expect(last.content).toContain('14:32');
  });

  it('character postHistory comes before global postHistory', () => {
    const input = makeInput({
      character: {
        ...baseCharacter,
        postHistoryInstructions: '角色指令',
      },
      aiConfig: {
        ...baseConfig,
        postHistoryInstructions: '全局指令',
      },
    });
    const { messages } = assemblePrompt(input);
    const last = messages[messages.length - 1]!;
    const lastContent = last.content as string;
    const charIdx = lastContent.indexOf('角色指令');
    const globalIdx = lastContent.indexOf('全局指令');
    expect(charIdx).toBeLessThan(globalIdx);
  });
});

// ---------------------------------------------------------------------------
// Output structure
// ---------------------------------------------------------------------------

describe('assemblePrompt - output', () => {
  it('returns tokenEstimate > 0', () => {
    const { tokenEstimate } = assemblePrompt(makeInput());
    expect(tokenEstimate).toBeGreaterThan(0);
  });

  it('message array starts with system and ends with system', () => {
    const input = makeInput({
      history: [makeTextMsg('hello', 'me', 1000)],
    });
    const { messages } = assemblePrompt(input);
    expect(messages[0]!.role).toBe('system');
    expect(messages[messages.length - 1]!.role).toBe('system');
  });

  it('history messages are sandwiched between system messages', () => {
    const input = makeInput({
      history: [
        makeTextMsg('user msg', 'me', 1000),
        makeTextMsg('assistant msg', 'char-soren', 2000),
      ],
    });
    const { messages } = assemblePrompt(input);
    expect(messages.length).toBe(4); // system + user + assistant + post-system
    expect(messages.map((m) => m.role)).toEqual(['system', 'user', 'assistant', 'system']);
  });

  it('returns historyTokenRatio and historyBudget', () => {
    const input = makeInput({
      history: [makeTextMsg('hello', 'me', 1000)],
    });
    const { historyTokenRatio, historyBudget } = assemblePrompt(input);
    expect(historyBudget).toBeGreaterThan(0);
    expect(historyTokenRatio).toBeGreaterThanOrEqual(0);
    expect(historyTokenRatio).toBeLessThan(1);
  });
});

// ---------------------------------------------------------------------------
// Summary injection
// ---------------------------------------------------------------------------

describe('assemblePrompt - summary injection', () => {
  it('injects summary as system message before history messages', () => {
    const input = makeInput({
      history: [
        makeTextMsg('你好', 'me', 1000),
        makeTextMsg('你好呀', 'char-soren', 2000),
      ],
      summary: '用户和角色之前讨论了画画的话题。',
    });
    const { messages } = assemblePrompt(input);
    // system block + summary system + user + assistant + post-history system
    expect(messages.length).toBe(5);
    expect(messages[1]!.role).toBe('system');
    expect(messages[1]!.content).toContain('[之前的对话摘要]');
    expect(messages[1]!.content).toContain('用户和角色之前讨论了画画的话题。');
    // History should follow the summary
    expect(messages[2]!.role).toBe('user');
    expect(messages[3]!.role).toBe('assistant');
  });

  it('does not inject summary system message when summary is undefined', () => {
    const input = makeInput({
      history: [makeTextMsg('hello', 'me', 1000)],
    });
    const { messages } = assemblePrompt(input);
    // system block + user + post-history = 3
    expect(messages.length).toBe(3);
    // No summary system message between system block and user message
    expect(messages[1]!.role).toBe('user');
  });

  it('does not inject summary system message when summary is empty string', () => {
    const input = makeInput({
      history: [makeTextMsg('hello', 'me', 1000)],
      summary: '',
    });
    const { messages } = assemblePrompt(input);
    expect(messages.length).toBe(3);
    expect(messages[1]!.role).toBe('user');
  });

  it('injects deviceContext into post-history', () => {
    const input = makeInput({
      history: [makeTextMsg('hello', 'me', 1000)],
      deviceContext: '[环境]\n时段：下午\n用户当前在使用：设置',
    });
    const { messages } = assemblePrompt(input);
    const last = messages[messages.length - 1]!;
    expect(last.role).toBe('system');
    expect(last.content).toContain('[环境]');
    expect(last.content).toContain('用户当前在使用：设置');
  });

  it('does not include deviceContext when not provided', () => {
    const input = makeInput({
      history: [makeTextMsg('hello', 'me', 1000)],
    });
    const { messages } = assemblePrompt(input);
    const last = messages[messages.length - 1]!;
    expect(last.content).not.toContain('[环境]');
  });

  it('historyTokenRatio increases with more history', () => {
    const shortHistory = [makeTextMsg('短', 'me', 1000)];
    const longHistory: HistoryMessage[] = [];
    for (let i = 0; i < 100; i++) {
      longHistory.push(makeTextMsg(`这是一条比较长的消息内容，编号${i}`, i % 2 === 0 ? 'me' : 'char', i * 1000));
    }

    const shortResult = assemblePrompt(makeInput({ history: shortHistory }));
    const longResult = assemblePrompt(makeInput({ history: longHistory }));

    expect(longResult.historyTokenRatio).toBeGreaterThan(shortResult.historyTokenRatio);
  });
});

// ---------------------------------------------------------------------------
// inspectPrompt — chat history display
// ---------------------------------------------------------------------------

describe('inspectPrompt - chat history display order', () => {
  it('does not duplicate trigger message when there are messages after it', () => {
    // Simulate: user sends a message, then the AI character follows up with
    // multiple messages (e.g., heartbeat agent). The trigger (last non-self
    // message) should not appear twice in the displayed history.
    const history: HistoryMessage[] = [
      makeTextMsg('之前的消息', 'me', 1000),
      makeTextMsg('角色回复', 'char-nani', 2000),
      makeTextMsg('用户最新消息', 'me', 3000),          // trigger
      makeTextMsg('角色跟进消息1', 'char-nani', 4000),  // after trigger
      makeTextMsg('角色跟进消息2', 'char-nani', 5000),  // after trigger
    ];

    const input = makeInput({
      history,
      characterSenderId: 'char-nani',
    });

    const inspection = inspectPrompt(input);
    const chatSection = inspection.sections.find((s) => s.label.includes('聊天历史'));
    expect(chatSection).toBeDefined();

    // Count occurrences of the trigger message text
    const triggerOccurrences = chatSection!.content
      .split('\n')
      .filter((line: string) => line.includes('用户最新消息'));
    expect(triggerOccurrences.length).toBe(1);
  });

  it('preserves chronological order when trigger has follow-up messages', () => {
    const base = new Date('2026-04-12T21:33:00').getTime();
    const history: HistoryMessage[] = [
      makeTextMsg('Luna早期消息', 'luna', base),
      makeTextMsg('我的回复', 'char-nani', base + 30_000),
      makeTextMsg('Luna最新消息', 'luna', base + 60_000),       // 21:34 trigger
      makeTextMsg('我的跟进1', 'char-nani', base + 90_000),     // 21:34:30
      makeTextMsg('我的跟进2', 'char-nani', base + 120_000),    // 21:35
    ];

    const input = makeInput({
      history,
      characterSenderId: 'char-nani',
      senderNames: { luna: 'Luna' },
    });

    const inspection = inspectPrompt(input);
    const chatSection = inspection.sections.find((s) => s.label.includes('聊天历史'));
    expect(chatSection).toBeDefined();

    const lines = chatSection!.content
      .split('\n')
      .filter((line: string) => line.startsWith('['));

    // The last line should be the character's follow-up, not the trigger
    expect(lines[lines.length - 1]).toContain('我的跟进2');

    // Verify no line appears after a later-timestamped line with an earlier time
    for (let i = 1; i < lines.length; i++) {
      const prevTime = lines[i - 1]!.match(/\[(\d{2}:\d{2})\]/)?.[1];
      const currTime = lines[i]!.match(/\[(\d{2}:\d{2})\]/)?.[1];
      if (prevTime && currTime) {
        expect(currTime >= prevTime).toBe(true);
      }
    }
  });
});
