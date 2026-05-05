# Heartbeat Virtual World Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an opt-in per-character heartbeat feature that generates a hidden virtual-world life story before the existing heartbeat tool loop and immediately writes it into character memory.

**Architecture:** A new `heartbeatVirtualWorldStory` module owns story prompt construction, time-span calculation, LLM call, output cleanup, and hidden memory write. `heartbeatAgent` calls it before assembling the existing Tool Registry prompt, then reloads memory so the same heartbeat can act on the new experience. `promptAssembly` gains a narrative response mode so story generation can reuse full character context without the JSON tool-call protocol.

**Tech Stack:** React 19, Zustand, TypeScript, Vitest, existing `chatComplete`, `assemblePrompt`, `_appendMessage`, `characterMemoryStore`, and `heartbeatStore`.

---

## File Structure

- Modify: `src/platform/stores/heartbeatStore.ts`
  - Add `virtualWorldStoryEnabled` to `HeartbeatCharacterConfig`.
  - Default it to `false`.

- Modify: `src/apps/Settings/pages/HeartbeatSettingsPage.tsx`
  - Add a per-character iOS-style toggle inside the enabled heartbeat settings block.
  - The row label should be `经历`.

- Test: `src/apps/Settings/pages/__tests__/HeartbeatSettingsPage.test.tsx`
  - Verify the toggle is rendered for enabled characters.
  - Verify toggling updates only that character config.

- Modify: `src/platform/ai/promptAssembly.ts`
  - Add `responseMode?: 'structured-actions' | 'narrative'` to `PromptInput`.
  - Default to `structured-actions`.
  - Skip App protocol chunks in `narrative` mode while preserving system, memory, transcript, post-history, and final user turn behavior.

- Test: `src/platform/ai/__tests__/promptAssembly.chunks.test.ts`
  - Add coverage that narrative mode does not inject `[回复格式]` or `[可用动作]`.
  - Assert memory/history still render.

- Modify: `src/platform/ai/buildMemoryEntry.ts`
  - Special-case hidden `heartbeat_log` text beginning with `[经历]`.
  - Return it directly instead of wrapping it under `[自主活动记录]`.

- Test: `src/platform/ai/__tests__/buildMemoryEntry.test.ts`
  - Add a test for virtual-world story logs.
  - Keep existing heartbeat activity log behavior intact.

- Create: `src/platform/ai/heartbeatVirtualWorldStory.ts`
  - Export pure helpers for time-span/length calculation and prompt instruction building.
  - Export `generateVirtualWorldStoryForHeartbeat(input)` to run the LLM and write hidden memory.

- Test: `src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts`
  - Unit-test target length calculation.
  - Unit-test fallback time-span rules.
  - Mock `chatComplete` and verify successful story writes a hidden log.
  - Verify empty/failing output does not write memory.

- Modify: `src/platform/ai/heartbeatAgent.ts`
  - Capture `previousLastHeartbeat` before overwriting `lastHeartbeat`.
  - Pass it into `runHeartbeat`.
  - If the per-character toggle is enabled, call story generation before reading `memoryEntries` for the tool loop.
  - On generation error, push `virtual_story_error` and continue.

- Test: `src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts`
  - Verify toggle off does not add a story call.
  - Verify toggle on writes story before the first tool-loop call and the tool prompt contains `[经历]`.
  - Verify story generation failure still allows the existing tool loop to run.

- Modify: `src/platform/ai/CLAUDE.md`
  - Document the exception: virtual-world stories are an opt-in LLM-generated heartbeat prelude, separate from deterministic tool `memoryEvents`.

## Task 1: Store And Settings Toggle

**Files:**
- Modify: `src/platform/stores/heartbeatStore.ts`
- Modify: `src/apps/Settings/pages/HeartbeatSettingsPage.tsx`
- Create: `src/apps/Settings/pages/__tests__/HeartbeatSettingsPage.test.tsx`

- [ ] **Step 1: Write failing store test in the settings page test file**

Create `src/apps/Settings/pages/__tests__/HeartbeatSettingsPage.test.tsx` with:

```tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HeartbeatSettingsPage } from '../HeartbeatSettingsPage';
import { useHeartbeatStore } from '@/platform/stores/heartbeatStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

describe('HeartbeatSettingsPage experience toggle', () => {
  beforeEach(() => {
    useHeartbeatStore.setState({
      globalEnabled: true,
      configs: {
        'char-a': { enabled: true, intervalMinutes: 60, maxIterations: 10, aiChatMaxRounds: 6, virtualWorldStoryEnabled: false },
        'char-b': { enabled: true, intervalMinutes: 60, maxIterations: 10, aiChatMaxRounds: 6, virtualWorldStoryEnabled: false },
      },
      lastHeartbeat: {},
      runningCharacters: {},
      recentLog: [],
    } as never);
    useCharacterStore.setState({
      activeCharacterId: 'char-a',
      characters: [
        { id: 'char-a', name: '小星', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
        { id: 'char-b', name: '小月', avatar: '', description: '', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
      ],
    });
  });

  it('defaults virtual world stories to disabled for unknown character config', () => {
    expect(useHeartbeatStore.getState().getCharacterConfig('new-char').virtualWorldStoryEnabled).toBe(false);
  });

  it('renders a per-character experience toggle and updates only that character', () => {
    render(<HeartbeatSettingsPage />);

    const toggles = screen.getAllByLabelText('经历');
    expect(toggles).toHaveLength(2);

    fireEvent.click(toggles[0]!);

    expect(useHeartbeatStore.getState().getCharacterConfig('char-a').virtualWorldStoryEnabled).toBe(true);
    expect(useHeartbeatStore.getState().getCharacterConfig('char-b').virtualWorldStoryEnabled).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/HeartbeatSettingsPage.test.tsx
```

Expected: FAIL because `virtualWorldStoryEnabled` does not exist and no accessible row named `经历` is rendered.

- [ ] **Step 3: Add store field and default**

In `src/platform/stores/heartbeatStore.ts`, update the interface and default:

```ts
export interface HeartbeatCharacterConfig {
  enabled: boolean;
  /** Heartbeat interval in minutes: 15 | 30 | 60 | 120 | 240 | 480 */
  intervalMinutes: number;
  /** Max ReAct iterations per heartbeat: 5-20 */
  maxIterations: number;
  /** Max rounds when chatting with another AI character: 2-10 */
  aiChatMaxRounds: number;
  /** Generate a hidden virtual-world life story before each heartbeat. */
  virtualWorldStoryEnabled: boolean;
}

const DEFAULT_CONFIG: HeartbeatCharacterConfig = {
  enabled: false,
  intervalMinutes: 60,
  maxIterations: 10,
  aiChatMaxRounds: 6,
  virtualWorldStoryEnabled: false,
};
```

- [ ] **Step 4: Add accessible toggle row**

In `src/apps/Settings/pages/HeartbeatSettingsPage.tsx`, make `Toggle` accessible:

```tsx
function Toggle({
  value,
  onChange,
  label,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={value}
      onClick={() => onChange(!value)}
      style={{
        width: 51,
        height: 31,
        borderRadius: 16,
        backgroundColor: value ? 'var(--color-systemGreen)' : 'rgba(120,120,128,0.16)',
        padding: 2,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
        border: 'none',
      }}
    >
      <div
        style={{
          width: 27,
          height: 27,
          borderRadius: 14,
          backgroundColor: 'white',
          boxShadow: '0 0.5px 3px rgba(0,0,0,0.2)',
          transform: value ? 'translateX(20px)' : 'translateX(0)',
          transition: 'transform 0.2s',
        }}
      />
    </button>
  );
}
```

Update existing toggle calls:

```tsx
<Toggle label={`${name} 心跳`} value={config.enabled} onChange={(v) => setConfig(characterId, { enabled: v })} />
```

```tsx
<Toggle label="启用心跳" value={globalEnabled} onChange={setGlobalEnabled} />
```

Inside `config.enabled && <div className="pb-2">`, add this row before the interval block:

```tsx
<div className="flex items-center justify-between px-4" style={{ height: 44 }}>
  <div>
    <div style={{ fontSize: 'var(--font-size-body)', color: 'var(--color-label)' }}>
      经历
    </div>
    <div style={{ fontSize: 12, color: 'var(--color-secondaryLabel)', marginTop: 2 }}>
      心跳前生成隐藏经历记忆
    </div>
  </div>
  <Toggle
    label="经历"
    value={config.virtualWorldStoryEnabled}
    onChange={(v) => setConfig(characterId, { virtualWorldStoryEnabled: v })}
  />
</div>
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/HeartbeatSettingsPage.test.tsx
```

Expected: PASS.

## Task 2: Narrative Prompt Mode

**Files:**
- Modify: `src/platform/ai/promptAssembly.ts`
- Modify: `src/platform/ai/__tests__/promptAssembly.chunks.test.ts`

- [ ] **Step 1: Write failing prompt test**

Append to `src/platform/ai/__tests__/promptAssembly.chunks.test.ts`:

```ts
it('responseMode=narrative skips app protocol but keeps memory and post-history', () => {
  const result = assemblePrompt({
    character: baseCharacter(),
    persona: { name: '玩家', description: '喜欢热茶' },
    aiConfig: baseAIConfig(),
    worldBookChunk: '',
    memoryEntries: [
      {
        id: 'm1',
        characterId: 'char-a',
        role: 'assistant',
        speakerId: 'char-char-a',
        content: '[经历]\n昨天试了一杯咸柠气泡水。',
        source: 'heartbeat',
        createdAt: new Date('2026-05-03T10:00:00+08:00').getTime(),
      },
    ],
    currentCharId: 'char-a',
    charactersById: new Map([['char-a', { id: 'char-a', name: '小星' }]]),
    now: new Date('2026-05-04T10:00:00+08:00'),
    availableTools: [
      { type: 'send_message', description: '发消息', param: '{text:string}' },
    ],
    appSystemPromptSnapshot: '自主行为模式',
    currentAppId: 'heartbeat',
    responseMode: 'narrative',
  });

  const joined = result.messages.map((m) => typeof m.content === 'string' ? m.content : '').join('\n');
  expect(joined).not.toContain('[回复格式]');
  expect(joined).not.toContain('[可用动作]');
  expect(joined).not.toContain('[当前任务]');
  expect(joined).toContain('[历史记录]');
  expect(joined).toContain('[经历]');
  expect(joined).toContain('[当前时间：2026年5月4日');
});
```

If this test file does not expose `baseCharacter` / `baseAIConfig`, add local helpers at the top of the file matching the existing `PromptCharacter` and `PromptAIConfig` shapes.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/promptAssembly.chunks.test.ts
```

Expected: FAIL because `responseMode` is not defined and the app protocol is still injected.

- [ ] **Step 3: Add response mode**

In `src/platform/ai/promptAssembly.ts`, add:

```ts
export type PromptResponseMode = 'structured-actions' | 'narrative';
```

Add to `PromptInput`:

```ts
/** Output contract. Narrative mode skips JSON/tool protocol for plain prose generation. */
responseMode?: PromptResponseMode;
```

In both `inspectPrompt` and `assemblePrompt`, define:

```ts
const responseMode = input.responseMode ?? 'structured-actions';
```

Build app protocol only for structured mode:

```ts
let appProtocol = '';
if (responseMode === 'structured-actions') {
  appProtocol = buildAppProtocolBlock(
    availableStickers,
    input.availableTools,
    input.appSystemPromptSnapshot,
    input.currentAppId,
    input.currentCharId,
  );
  appProtocol = expandMacros(appProtocol, character, persona, now);
}
```

Keep `tailContext` only for structured mode:

```ts
const tailContext = responseMode === 'structured-actions'
  ? buildTailToolStateChunk(input.availableTools, toolBuildCtx)
  : undefined;
```

- [ ] **Step 4: Run prompt tests**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/promptAssembly.chunks.test.ts src/platform/ai/__tests__/renderMemoryToTranscript.test.ts
```

Expected: PASS.

## Task 3: Virtual Story Memory Entry Rendering

**Files:**
- Modify: `src/platform/ai/buildMemoryEntry.ts`
- Modify: `src/platform/ai/__tests__/buildMemoryEntry.test.ts`

- [ ] **Step 1: Write failing buildMemoryEntry test**

Append to the `heartbeat_log` describe block in `src/platform/ai/__tests__/buildMemoryEntry.test.ts`:

```ts
it('experience heartbeat_log keeps [经历] as the top-level memory label', () => {
  const entry = buildMemoryEntry(
    {
      id: 'm-story',
      convId: 'c-char-char-a',
      senderId: 'char-char-a',
      type: 'heartbeat_log',
      text: '[经历]\n时间跨度：2026-05-03 10:00 至 2026-05-04 10:00\n\n我去试了一杯咸柠气泡水。',
      timestamp: 1,
    },
    'heartbeat',
    ctx,
  );

  expect(entry?.role).toBe('assistant');
  expect(entry?.content).toBe('[经历]\n时间跨度：2026-05-03 10:00 至 2026-05-04 10:00\n\n我去试了一杯咸柠气泡水。');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/buildMemoryEntry.test.ts
```

Expected: FAIL because content is wrapped with `[自主活动记录]`.

- [ ] **Step 3: Implement virtual story special case**

In `messageToRawContent`, replace the `heartbeat_log` case with:

```ts
case 'heartbeat_log': {
  const text = msg.text?.trim();
  if (!text) return null;
  if (text.startsWith('[经历]')) return text;
  return `[自主活动记录]\n${text}`;
}
```

- [ ] **Step 4: Run test**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/buildMemoryEntry.test.ts
```

Expected: PASS.

## Task 4: Story Generation Module

**Files:**
- Create: `src/platform/ai/heartbeatVirtualWorldStory.ts`
- Create: `src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts`

- [ ] **Step 1: Write failing module tests**

Create `src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts` with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateVirtualStoryTargetChars,
  resolveVirtualStoryStartTime,
  buildVirtualWorldStoryInstruction,
  generateVirtualWorldStoryForHeartbeat,
} from '../heartbeatVirtualWorldStory';
import { useCharacterMemory, _resetCharacterMemoryForTests } from '../characterMemoryStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useXYData } from '@/apps/XingYu/xingYuDataStore';
import * as chatCompleteMod from '../chatComplete';

const DAY = 24 * 60 * 60 * 1000;

describe('heartbeatVirtualWorldStory', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await _resetCharacterMemoryForTests();
    useCharacterStore.setState({
      characters: [
        { id: 'char-a', name: '小星', avatar: '', description: '安静但行动具体', personality: '', scenario: '', firstMessage: '', messageExamples: '', alternateGreetings: [], systemPrompt: '', postHistoryInstructions: '', creatorNotes: '', tags: [], version: '' },
      ],
    });
    useAIConfigStore.setState({
      apiKey: 'test-key',
      provider: 'openrouter',
      apiEndpoint: 'https://api.test',
      model: 'gpt-test',
      temperature: 0.8,
      contextWindow: 8000,
      maxTokens: 1000,
      keepRecentMessages: 10,
      summarizeThreshold: 0.8,
      worldInfoBudgetPercent: 0.3,
      enableVision: false,
      systemPrompt: '',
      postHistoryInstructions: '',
    } as never);
    usePersonaStore.setState({
      personas: [{ id: 'p', name: '玩家', description: '喜欢热茶', avatar: '', isDefault: false }],
      activePersonaId: 'p',
    } as never);
    useWorldBookStore.setState({ entries: [] } as never);
    useXYData.setState({
      conversations: [{ id: 'c-char-char-a', idolId: 'char-char-a', characterId: 'char-a', lastMsg: '', lastTime: 0, unread: 0 }],
      messages: [],
      moments: [],
      characterSignatures: {},
      userSignatureHistory: [],
      interactions: [],
      unreadInteractionCount: 0,
      characterLastReadMsgTs: {},
      characterSeenInteractionCount: {},
      favorites: [],
      userSettings: { nickname: '玩家', bio: '', accentColor: '#000', avatarUrl: '', coverUrl: '' },
    } as never);
  });

  it('calculates 300 chars per elapsed day capped at 1000', () => {
    expect(calculateVirtualStoryTargetChars(1)).toBe(300);
    expect(calculateVirtualStoryTargetChars(2)).toBe(600);
    expect(calculateVirtualStoryTargetChars(4)).toBe(1000);
  });

  it('prefers the latest virtual story memory timestamp as the next start time', () => {
    useCharacterMemory.getState().append('char-a', {
      role: 'assistant',
      speakerId: 'char-char-a',
      source: 'heartbeat',
      content: '[经历]\n时间跨度：old\n\n旧经历',
    });
    const storyEntry = useCharacterMemory.getState().getAll('char-a')[0]!;
    const previousLastHeartbeat = storyEntry.createdAt - DAY;

    expect(resolveVirtualStoryStartTime({
      characterId: 'char-a',
      previousLastHeartbeat,
      intervalMinutes: 60,
      nowMs: storyEntry.createdAt + DAY,
    })).toBe(storyEntry.createdAt);
  });

  it('builds an instruction that forbids user and other AI characters from participating', () => {
    const instruction = buildVirtualWorldStoryInstruction({
      fromLabel: '2026-05-03 10:00',
      toLabel: '2026-05-04 10:00',
      elapsedDays: 1,
      targetChars: 300,
    });

    expect(instruction).toContain('不要让用户出现在事件中');
    expect(instruction).toContain('不要让其他 AI 角色出现在事件中');
    expect(instruction).toContain('只输出经历正文');
  });

  it('writes successful story generation as hidden heartbeat memory', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('下午我试了一杯咸柠气泡水，后来把这个味道带进了晚饭。');

    const result = await generateVirtualWorldStoryForHeartbeat({
      characterId: 'char-a',
      previousLastHeartbeat: Date.now() - DAY,
      now: new Date('2026-05-04T10:00:00+08:00'),
      intervalMinutes: 60,
      signal: new AbortController().signal,
    });

    expect(result.written).toBe(true);
    const memoryText = useCharacterMemory.getState().getAll('char-a').map((e) => e.content).join('\n');
    expect(memoryText).toContain('[经历]');
    expect(memoryText).toContain('咸柠气泡水');
  });

  it('does not write memory for blank output', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValue('   ');

    const result = await generateVirtualWorldStoryForHeartbeat({
      characterId: 'char-a',
      previousLastHeartbeat: Date.now() - DAY,
      now: new Date('2026-05-04T10:00:00+08:00'),
      intervalMinutes: 60,
      signal: new AbortController().signal,
    });

    expect(result.written).toBe(false);
    expect(useCharacterMemory.getState().getAll('char-a')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts
```

Expected: FAIL because `heartbeatVirtualWorldStory.ts` does not exist.

- [ ] **Step 3: Implement module**

Create `src/platform/ai/heartbeatVirtualWorldStory.ts`:

```ts
import { useCharacterStore } from '@/platform/stores/characterStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useStickerStore } from '@/apps/XingYu/stickerStore';
import { useCharacterMemory } from './characterMemoryStore';
import { buildDeviceContext } from './deviceContext';
import { assemblePrompt } from './promptAssembly';
import { chatComplete } from './chatComplete';
import { getAdapter, pickGenerationParams } from './providers';
import { _appendMessage } from './memoryWriter';
import { uid } from '@/platform/utils/uid';
import type { Message } from '@/apps/XingYu/data';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface VirtualStoryInstructionInput {
  fromLabel: string;
  toLabel: string;
  elapsedDays: number;
  targetChars: number;
}

export interface ResolveVirtualStoryStartTimeInput {
  characterId: string;
  previousLastHeartbeat?: number;
  intervalMinutes: number;
  nowMs: number;
}

export interface GenerateVirtualWorldStoryInput {
  characterId: string;
  previousLastHeartbeat?: number;
  now: Date;
  intervalMinutes: number;
  signal: AbortSignal;
}

export interface GenerateVirtualWorldStoryResult {
  written: boolean;
  story?: string;
  reason?: 'missing_character' | 'missing_adapter' | 'blank_output';
}

export function calculateVirtualStoryTargetChars(elapsedDays: number): number {
  return Math.min(1000, Math.max(1, elapsedDays) * 300);
}

export function resolveVirtualStoryStartTime(input: ResolveVirtualStoryStartTimeInput): number {
  const latestStory = [...useCharacterMemory.getState().getAll(input.characterId)]
    .reverse()
    .find((entry) =>
      entry.source === 'heartbeat' &&
      entry.role === 'assistant' &&
      entry.content.trim().startsWith('[经历]'),
    );
  if (latestStory) return latestStory.createdAt;
  if (input.previousLastHeartbeat) return input.previousLastHeartbeat;
  return input.nowMs - input.intervalMinutes * 60_000;
}

function formatStoryTime(date: Date): string {
  const yyyy = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mo}-${dd} ${hh}:${mm}`;
}

export function buildVirtualWorldStoryInstruction(input: VirtualStoryInstructionInput): string {
  return [
    '你现在要补全一段“从上次心跳到这次心跳之间”发生在你小手机外生活中的经历。',
    '',
    '这不是聊天回复，不是发给用户的消息，也不是发生在小手机里的行为记录。',
    '这段内容会作为你的真实经历写入长期记忆。之后你会自然记得它，并可以在合适的时候把它当作谈资、心情来源或行动背景。',
    '',
    '时间跨度：',
    `${input.fromLabel} 到 ${input.toLabel}`,
    `约 ${input.elapsedDays} 天`,
    '',
    '写作要求：',
    '- 使用第一人称“我”。',
    '- 必须基于你的完整上下文生成：角色设定、世界书、长期记忆、近期记忆、当前时间都会影响这段经历。',
    '- 故事发生在你的小手机外生活中，不发生在手机 App、聊天窗口、朋友圈、备忘录等小手机系统里。',
    '- 不要让用户出现在事件中。',
    '- 不要让其他 AI 角色出现在事件中。',
    '- 不要替用户或其他角色新增事实、承诺、情绪或行动。',
    '- 日常为主，偶尔可以有小剧情，但不要写成悬疑、冒险或大事件。',
    '- 不要写流水账。不要平均描述一整天。',
    '- 每天只选择 1 个最值得记住的小事件，多个日期可以合并成 2-4 个片段。',
    '- 事件要具体，有地点、行动、物品、过程和结果。',
    '- 每段至少留下一个“以后能聊起来”的谈资：一次试错、一个新发现、一个小麻烦、一个具体选择、一个没完成的小计划、一个让你之后可能再提起的物件或经历。',
    '- 情绪可以存在，但不要用大段抒情解释情绪；让情绪通过行动和细节体现。',
    '- 不要写标题，不要 markdown，不要 JSON，不要解释你在执行任务。',
    '- 只输出经历正文。',
    '',
    '长度要求：',
    `写约 ${input.targetChars} 个中文字符。`,
    '计算规则：1 天约 300 字，每多 1 天增加 300 字，最多 1000 字。',
    '如果时间不足 1 天，仍写一个约 200-300 字的具体片段。',
    '',
    '好的谈资示例：',
    '- 试了一种奇怪但具体的饮料，后来影响了晚饭做法。',
    '- 去了一个新地方，发现它和预期不一样。',
    '- 买错、走错、修坏、忘带、临时改变计划，但结果留下了一个具体后续。',
    '- 学到一个小知识，或决定明天继续处理某件小事。',
    '',
    '不好的写法：',
    '- 只写打扫、吃饭、散步、看书，没有后续可聊点。',
    '- 连续堆旧地图、怀表、神秘花瓣这类强剧情物件。',
    '- 大段写“我有点难过/释然/孤独”，但没有具体事件。',
  ].join('\n');
}

function cleanStoryOutput(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:text|markdown|md)?/i, '')
    .replace(/```$/i, '')
    .trim();
}

export async function generateVirtualWorldStoryForHeartbeat(
  input: GenerateVirtualWorldStoryInput,
): Promise<GenerateVirtualWorldStoryResult> {
  const character = useCharacterStore.getState().characters.find((c) => c.id === input.characterId);
  if (!character) return { written: false, reason: 'missing_character' };

  const aiConfig = useAIConfigStore.getState();
  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return { written: false, reason: 'missing_adapter' };

  const endpoint = aiConfig.apiEndpoint || adapter.defaultEndpoint;
  const persona = usePersonaStore.getState().getActivePersona();
  const worldBookChunk = useWorldBookStore.getState().buildSystemPromptChunk();
  const allStickers = useStickerStore.getState().packs.flatMap((pack) =>
    pack.stickers.map((s) => ({ id: s.id, description: s.description })),
  );
  const charactersById = new Map(
    useCharacterStore.getState().characters.map((c) => [c.id, { id: c.id, name: c.name }]),
  );

  const nowMs = input.now.getTime();
  const startMs = resolveVirtualStoryStartTime({
    characterId: input.characterId,
    previousLastHeartbeat: input.previousLastHeartbeat,
    intervalMinutes: input.intervalMinutes,
    nowMs,
  });
  const elapsedDays = Math.max(1, Math.ceil((nowMs - startMs) / DAY_MS));
  const targetChars = calculateVirtualStoryTargetChars(elapsedDays);
  const fromLabel = formatStoryTime(new Date(startMs));
  const toLabel = formatStoryTime(input.now);
  const instruction = buildVirtualWorldStoryInstruction({
    fromLabel,
    toLabel,
    elapsedDays,
    targetChars,
  });

  const { messages } = assemblePrompt({
    character: {
      name: character.name,
      description: character.description,
      personality: character.personality,
      scenario: character.scenario,
      systemPrompt: character.systemPrompt,
      postHistoryInstructions: character.postHistoryInstructions,
      messageExamples: character.messageExamples,
    },
    persona: {
      name: persona?.name ?? '用户',
      description: persona?.description ?? '',
    },
    aiConfig: {
      systemPrompt: aiConfig.systemPrompt,
      postHistoryInstructions: aiConfig.postHistoryInstructions,
      contextWindow: aiConfig.contextWindow,
      maxTokens: aiConfig.maxTokens,
      keepRecentMessages: aiConfig.keepRecentMessages,
      worldInfoBudgetPercent: aiConfig.worldInfoBudgetPercent,
      enableVision: aiConfig.enableVision,
    },
    worldBookChunk,
    memoryEntries: useCharacterMemory.getState().getAll(input.characterId),
    currentCharId: input.characterId,
    charactersById,
    now: input.now,
    deviceContext: buildDeviceContext(),
    availableStickers: allStickers.length > 0 ? allStickers : undefined,
    responseMode: 'narrative',
  });
  const storyMessages = messages.filter((m) => m.role !== 'user');
  storyMessages.push({ role: 'user', content: instruction });

  const raw = await chatComplete(
    { endpoint, apiKey: aiConfig.apiKey, model: aiConfig.model, providerId: aiConfig.provider },
    storyMessages,
    pickGenerationParams(aiConfig),
    input.signal,
  );
  const story = cleanStoryOutput(raw);
  if (!story) return { written: false, reason: 'blank_output' };

  const msg: Message = {
    id: uid(),
    convId: `c-char-${input.characterId}`,
    senderId: `char-${input.characterId}`,
    type: 'heartbeat_log',
    text: ['[经历]', `时间跨度：${fromLabel} 至 ${toLabel}`, '', story].join('\n'),
    timestamp: Date.now(),
  };
  _appendMessage(msg, 'heartbeat');
  return { written: true, story };
}
```

- [ ] **Step 4: Run module test**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts
```

Expected: PASS.

## Task 5: Heartbeat Agent Integration

**Files:**
- Modify: `src/platform/ai/heartbeatAgent.ts`
- Modify: `src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts`

- [ ] **Step 1: Write failing integration tests**

In `src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts`, update config fixtures to include:

```ts
virtualWorldStoryEnabled: false,
```

Add tests:

```ts
it('virtual story disabled keeps the existing one-call done path', async () => {
  useHeartbeatStore.setState({
    configs: { [CHAR]: { enabled: true, intervalMinutes: 60, maxIterations: 5, aiChatMaxRounds: 3, virtualWorldStoryEnabled: false } },
  } as never);
  const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
    .mockResolvedValueOnce('[{"type":"done","param":{}}]');

  await triggerHeartbeat(CHAR);

  expect(spy).toHaveBeenCalledTimes(1);
});

it('virtual story enabled writes the story before the tool loop sees memory', async () => {
  useHeartbeatStore.setState({
    configs: { [CHAR]: { enabled: true, intervalMinutes: 60, maxIterations: 5, aiChatMaxRounds: 3, virtualWorldStoryEnabled: true } },
    lastHeartbeat: { [CHAR]: Date.now() - 24 * 60 * 60 * 1000 },
  } as never);
  const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
    .mockResolvedValueOnce('下午我试了一杯咸柠气泡水，后来把这个味道带进了晚饭。')
    .mockResolvedValueOnce('[{"type":"done","param":{}}]');

  await triggerHeartbeat(CHAR);

  expect(spy).toHaveBeenCalledTimes(2);
  const secondCallMessages = spy.mock.calls[1]![1];
  const joined = secondCallMessages.map((m) => typeof m.content === 'string' ? m.content : '').join('\n');
  expect(joined).toContain('[经历]');
  expect(joined).toContain('咸柠气泡水');
});

it('virtual story failure logs an error and continues tool loop', async () => {
  useHeartbeatStore.setState({
    configs: { [CHAR]: { enabled: true, intervalMinutes: 60, maxIterations: 5, aiChatMaxRounds: 3, virtualWorldStoryEnabled: true } },
    lastHeartbeat: { [CHAR]: Date.now() - 24 * 60 * 60 * 1000 },
  } as never);
  const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
    .mockRejectedValueOnce(new Error('story failed'))
    .mockResolvedValueOnce('[{"type":"done","param":{}}]');

  await triggerHeartbeat(CHAR);

  expect(spy).toHaveBeenCalledTimes(2);
  expect(useHeartbeatStore.getState().recentLog.some((entry) => entry.action === 'virtual_story_error')).toBe(true);
});
```

- [ ] **Step 2: Run integration test to verify failure**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts
```

Expected: FAIL because `heartbeatAgent` does not call the story module and `previousLastHeartbeat` is not captured.

- [ ] **Step 3: Integrate story prelude**

In `src/platform/ai/heartbeatAgent.ts`, import:

```ts
import { generateVirtualWorldStoryForHeartbeat } from './heartbeatVirtualWorldStory';
```

Change `runHeartbeat` signature:

```ts
async function runHeartbeat(
  characterId: string,
  signal: AbortSignal,
  previousLastHeartbeat?: number,
): Promise<void> {
```

After `resetHeartbeatLimits(characterId);`, add:

```ts
if (config.virtualWorldStoryEnabled) {
  try {
    await generateVirtualWorldStoryForHeartbeat({
      characterId,
      previousLastHeartbeat,
      now: new Date(),
      intervalMinutes: config.intervalMinutes,
      signal,
    });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
    useHeartbeatStore.getState().pushLog({
      characterId,
      action: 'virtual_story_error',
      detail: e instanceof Error ? e.message : String(e),
    });
  }
}
```

Ensure this block runs before:

```ts
const memoryEntries = useCharacterMemory.getState().getAll(characterId);
```

In `launchCharacterHeartbeat`, capture previous timestamp before overwriting:

```ts
const previousLastHeartbeat = useHeartbeatStore.getState().lastHeartbeat[characterId];
useHeartbeatStore.getState().setLastHeartbeat(characterId, Date.now());

runHeartbeat(characterId, controller.signal, previousLastHeartbeat)
```

In `triggerHeartbeat`, do the same:

```ts
const previousLastHeartbeat = useHeartbeatStore.getState().lastHeartbeat[characterId];
useHeartbeatStore.getState().setLastHeartbeat(characterId, Date.now());

try {
  await runHeartbeat(characterId, controller.signal, previousLastHeartbeat);
} finally {
```

- [ ] **Step 4: Run integration tests**

Run:

```bash
pnpm vitest run src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts
```

Expected: PASS.

## Task 6: Documentation And Focused Verification

**Files:**
- Modify: `src/platform/ai/CLAUDE.md`

- [ ] **Step 1: Update AI platform docs**

In `src/platform/ai/CLAUDE.md`, below “心跳工具必须输出确定性记忆事件”, add:

```md
### 心跳经历是 memoryEvents 规则的显式例外

心跳可以在工具循环前运行一个独立的经历生成阶段。它是 per-character 开关控制的 LLM 叙事生成，不属于工具 `memoryEvents`。

规则：
- 工具 `memoryEvents` 仍必须由程序根据工具真实执行结果确定性渲染。
- 经历只写隐藏 `heartbeat_log`，不显示聊天气泡。
- 经历必须发生在小手机外的角色小手机外生活中，不能让用户或其他 AI 角色参与事件。
- 写入后再组装本次心跳工具 prompt，让同一次心跳能感知这段新记忆。
```

- [ ] **Step 2: Run focused test suite**

Run:

```bash
pnpm vitest run \
  src/apps/Settings/pages/__tests__/HeartbeatSettingsPage.test.tsx \
  src/platform/ai/__tests__/promptAssembly.chunks.test.ts \
  src/platform/ai/__tests__/buildMemoryEntry.test.ts \
  src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts \
  src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Review diff scope**

Run:

```bash
git status --short
git diff -- src/platform/stores/heartbeatStore.ts src/apps/Settings/pages/HeartbeatSettingsPage.tsx src/apps/Settings/pages/__tests__/HeartbeatSettingsPage.test.tsx src/platform/ai/promptAssembly.ts src/platform/ai/__tests__/promptAssembly.chunks.test.ts src/platform/ai/buildMemoryEntry.ts src/platform/ai/__tests__/buildMemoryEntry.test.ts src/platform/ai/heartbeatVirtualWorldStory.ts src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts src/platform/ai/heartbeatAgent.ts src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts src/platform/ai/CLAUDE.md docs/plan/2026-05-04-2312-heartbeat-virtual-world-story.md
```

Expected: Only this feature’s files are changed by this implementation. Pre-existing unrelated dirty files may remain in `git status`; do not revert them.

## Self-Review

- Spec coverage: per-character default-off toggle is covered by Task 1; narrative prompt mode by Task 2; hidden memory write by Tasks 3 and 4; same-heartbeat visibility and failure continuation by Task 5; docs by Task 6.
- Placeholder scan: this plan contains concrete file paths, tests, code snippets, and commands. It avoids open-ended implementation placeholders.
- Type consistency: the new config property is consistently named `virtualWorldStoryEnabled`; the new prompt mode is consistently `responseMode: 'narrative'`; the new module entry point is consistently `generateVirtualWorldStoryForHeartbeat`.
