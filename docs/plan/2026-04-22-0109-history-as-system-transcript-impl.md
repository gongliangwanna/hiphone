# History as System Transcript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 memoryStore 渲染从"user/assistant 交替 messages"改为"单条 system transcript"；同时修复长期记忆压缩 bug + 前缀改名 + AI-AI 场景注入收口。

**Architecture:** 纯函数优先，walking-skeleton 每 stage 测试全绿。新渲染函数 `renderMemoryToTranscript` 先独立存在并测试，再切入 `assemblePrompt`；压缩修复与前缀改名合并一次；AI-AI `[当前场景]` 通过 `PromptInput.sceneHint` 字段进 post-history，删掉外部 `chatMessages.push`。

**Tech Stack:** TypeScript, Vitest, Zustand, pnpm。

**关联文档：**
- 产品需求：`docs/plan/2026-04-21-0131-history-as-system-transcript.md`
- 设计 spec：`docs/superpowers/specs/2026-04-22-history-as-system-transcript-design.md`

**基线：** 测试 1167 passed + 4 skipped；HEAD `f10d708`；`pnpm` 包管理。

---

## 文件影响清单

| 文件 | 动作 |
|---|---|
| `src/platform/ai/promptAssembly.ts` | 改（新增 `renderMemoryToTranscript`、删 `renderMemoryToChatMessages`、`PromptInput.sceneHint` 新字段、`assemblePrompt` 装配重排、`inspectPrompt` sections 重写） |
| `src/platform/ai/characterMemoryCompression.ts` | 改（`compressStartIdx = 0`、prefix → `[长期记忆]`） |
| `src/platform/ai/aiChatEngine.ts` | 改（删 L145-149 外部 push，改传 `sceneHint`） |
| `src/apps/Settings/pages/PromptViewerPage.tsx` | 改（`SECTION_ICONS` 映射） |
| `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts` | 新建 |
| `src/platform/ai/__tests__/trimMemoryToFit.test.ts` | 新建（承接原 render test 的 trim 部分） |
| `src/platform/ai/__tests__/promptAssembly.render.test.ts` | 删除 |
| `src/platform/ai/__tests__/characterMemoryCompression.test.ts` | 改断言 |
| `src/platform/ai/__tests__/m4.2.5.e2e.test.ts` | 改断言 |
| `src/platform/ai/__tests__/summarizer.test.ts` | 若涉及前缀，跟进 |
| `src/platform/userApp/sdk/__tests__/ai.session.test.ts` | 若涉及 message 形态，跟进 |
| `src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts` | 若涉及 message 结构，跟进 |

---

## Stage 1: 新建 `renderMemoryToTranscript` 纯函数（独立，不接入）

**目标：** 纯函数 + 完整单测。函数写完即可，不动 `assemblePrompt`，不删旧 `renderMemoryToChatMessages`。

**Files:**
- Modify: `src/platform/ai/promptAssembly.ts`
- Create: `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`

---

### Task 1.1: 先写测试骨架（空 describe）

- [ ] **Step 1: Create test file skeleton**

Create `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`:

```ts
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

describe('renderMemoryToTranscript', () => {
  it.todo('placeholder — tasks below fill this in');
});
```

- [ ] **Step 2: Run to confirm file compiles**

Run: `pnpm vitest run src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`
Expected: FAIL with `renderMemoryToTranscript is not exported from '../promptAssembly'`（TS/import 错）。

- [ ] **Step 3: Commit skeleton**

```bash
git add src/platform/ai/__tests__/renderMemoryToTranscript.test.ts
# intentionally do not commit yet — we'll bundle with impl at task 1.3
```

(Skip commit now; commit after impl lands.)

---

### Task 1.2: 写 transcript 行格式测试（每种 role 一条）

- [ ] **Step 1: Replace the `it.todo` with the row-format tests**

Replace the `describe(...)` block contents in `renderMemoryToTranscript.test.ts` with:

```ts
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
});
```

- [ ] **Step 2: Run — expect all to fail with "not a function" / import error**

Run: `pnpm vitest run src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`
Expected: FAIL (function undefined).

---

### Task 1.3: 实现 `renderMemoryToTranscript` + 导出类型

- [ ] **Step 1: Add types and function to `promptAssembly.ts`**

In `src/platform/ai/promptAssembly.ts`, **after** the existing `MemoryRenderContext` interface (around line 149) and **before** `renderMemoryToChatMessages`, insert:

```ts
// ---------------------------------------------------------------------------
// Transcript rendering (history-as-system-transcript refactor, 2026-04-22)
// ---------------------------------------------------------------------------

export interface TranscriptRenderResult {
  /** system #2 内容；含 `[长期记忆]\n...` 前缀。无压缩 entry 时为 null。 */
  longTermMemory: string | null;
  /** system #3 内容；含 `[历史记录]\n` 首行 + N 行 entry。无活 entry 时为 null。 */
  transcriptBlock: string | null;
  /** 最后一条活 entry 是 role=user 时非 null。 */
  userTurn: ChatMessage | null;
}

function formatHHMM(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function resolveTranscriptSpeaker(
  entry: MemoryEntry,
  ctx: MemoryRenderContext,
): string | null {
  if (entry.role === 'system') return null;
  if (entry.role === 'assistant') return '我';
  // role === 'user'
  if (entry.speakerId === 'me') return ctx.personaName;
  const byFull = ctx.charactersById.get(entry.speakerId);
  if (byFull) return byFull.name;
  const stripped = entry.speakerId.startsWith('char-')
    ? entry.speakerId.slice('char-'.length)
    : entry.speakerId;
  const byStripped = ctx.charactersById.get(stripped);
  if (byStripped) return byStripped.name;
  return entry.speakerId;
}

function renderTranscriptLine(entry: MemoryEntry, ctx: MemoryRenderContext): string {
  const time = formatHHMM(entry.createdAt);
  const speaker = resolveTranscriptSpeaker(entry, ctx);
  if (speaker === null) return `[${time}] ${entry.content}`;
  return `[${time}] ${speaker}：${entry.content}`;
}

export function renderMemoryToTranscript(
  entries: readonly MemoryEntry[],
  ctx: MemoryRenderContext,
): TranscriptRenderResult {
  // Latest compressed entry → long-term memory block (raw content, prefix already baked in).
  const latestCompressed = [...entries].reverse().find((e) => e.compressed);
  const longTermMemory = latestCompressed ? latestCompressed.content : null;

  const live = entries.filter((e) => !e.compressed);
  if (live.length === 0) {
    return { longTermMemory, transcriptBlock: null, userTurn: null };
  }

  const last = live[live.length - 1]!;

  // Decide user turn + which slice becomes transcript.
  let transcriptEntries: readonly MemoryEntry[];
  let userTurn: ChatMessage | null;

  if (last.role === 'user') {
    transcriptEntries = live.slice(0, -1);
    const speaker = resolveTranscriptSpeaker(last, ctx);
    userTurn = {
      role: 'user',
      content: speaker ? `${speaker}：${last.content}` : last.content,
    };
  } else {
    // role === 'system' | 'assistant' → no user turn, transcript holds everything
    transcriptEntries = live;
    userTurn = null;
  }

  let transcriptBlock: string | null;
  if (transcriptEntries.length === 0) {
    transcriptBlock = null;
  } else {
    const lines = transcriptEntries.map((e) => renderTranscriptLine(e, ctx));
    transcriptBlock = ['[历史记录]', ...lines].join('\n');
  }

  return { longTermMemory, transcriptBlock, userTurn };
}
```

- [ ] **Step 2: Run the row-format tests**

Run: `pnpm vitest run src/platform/ai/__tests__/renderMemoryToTranscript.test.ts -t "row formatting"`
Expected: PASS (7 tests).

If any fail, fix the implementation — do not change the tests.

---

### Task 1.4: userTurn 分派四分支测试

- [ ] **Step 1: Append the dispatch test block to the test file**

Append to `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`:

```ts
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
```

- [ ] **Step 2: Run these tests**

Run: `pnpm vitest run src/platform/ai/__tests__/renderMemoryToTranscript.test.ts -t "userTurn dispatch"`
Expected: PASS (4 tests).

---

### Task 1.5: 长期记忆抽离 + 多 compressed 容忍 + 仅 compressed 退化

- [ ] **Step 1: Append the long-term-memory test block**

Append to `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`:

```ts
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
```

- [ ] **Step 2: Run and confirm PASS**

Run: `pnpm vitest run src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`
Expected: PASS (all tests in the file, 14 total).

---

### Task 1.6: 提交 Stage 1

- [ ] **Step 1: Full test suite green**

Run: `pnpm test`
Expected: 1167 + 14 = 1181 passed (approximately) + 4 skipped. No regression.

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/platform/ai/promptAssembly.ts src/platform/ai/__tests__/renderMemoryToTranscript.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): S1 — add renderMemoryToTranscript pure function

New function produces {longTermMemory, transcriptBlock, userTurn} from
memoryStore entries. Not yet wired into assemblePrompt; old
renderMemoryToChatMessages still in use. Groundwork for the
history-as-system-transcript refactor.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 2: `PromptInput.sceneHint` 字段 + `buildPostHistory` 拼接

**目标：** 新字段落位；不破坏任何现有调用者。

**Files:**
- Modify: `src/platform/ai/promptAssembly.ts`
- Modify: `src/platform/ai/__tests__/promptAssembly.chunks.test.ts`（或新加一个最小测试）

---

### Task 2.1: 先写测试

- [ ] **Step 1: Append test to `promptAssembly.chunks.test.ts`** (or any existing integration test file that exercises `assemblePrompt`)

先看一下：

Run: `grep -l "assemblePrompt" src/platform/ai/__tests__/`
Expected: includes `promptAssembly.chunks.test.ts`.

Open `src/platform/ai/__tests__/promptAssembly.chunks.test.ts`, append at end:

```ts
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

    const postHistory = out.messages[out.messages.length - 1];
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

    const postHistory = out.messages[out.messages.length - 1];
    expect(postHistory.content).not.toContain('[当前场景]');
  });
});
```

If the file doesn't already `import { assemblePrompt }`, add it to its imports. Check first:

Run: `grep -n "assemblePrompt\|import" src/platform/ai/__tests__/promptAssembly.chunks.test.ts | head -20`

- [ ] **Step 2: Run and expect FAIL**

Run: `pnpm vitest run src/platform/ai/__tests__/promptAssembly.chunks.test.ts -t "sceneHint"`
Expected: FAIL (either TS error "sceneHint not in PromptInput" or runtime mismatch).

---

### Task 2.2: 实现 — 加字段 + 拼接

- [ ] **Step 1: Add field to `PromptInput`**

In `src/platform/ai/promptAssembly.ts`, inside the `PromptInput` interface (around line 54-83), add at the end:

```ts
  /** 场景级提示词（AI-AI 用来传 `[当前场景]`）；拼在 post-history 末尾。 */
  sceneHint?: string;
```

- [ ] **Step 2: Update `buildPostHistory` signature to accept sceneHint**

Replace the `buildPostHistory` function (around lines 404-434) with:

```ts
function buildPostHistory(
  character: PromptCharacter,
  aiConfig: PromptAIConfig,
  now: Date,
  deviceContext?: string,
  sceneHint?: string,
): string {
  const parts: string[] = [];

  if (character.postHistoryInstructions?.trim()) {
    parts.push(character.postHistoryInstructions.trim());
  }
  if (aiConfig.postHistoryInstructions?.trim()) {
    parts.push(aiConfig.postHistoryInstructions.trim());
  }

  // Time anchor — always present so the character is temporally grounded.
  const yyyy = now.getFullYear();
  const mo = now.getMonth() + 1;
  const dd = now.getDate();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  const wd = ZH_WEEKDAYS[now.getDay()] ?? '?';
  parts.push(`[当前时间：${yyyy}年${mo}月${dd}日 星期${wd} ${hh}:${mm}]`);

  if (deviceContext?.trim()) {
    parts.push(deviceContext.trim());
  }

  if (sceneHint?.trim()) {
    parts.push(sceneHint.trim());
  }

  return parts.join('\n\n');
}
```

- [ ] **Step 3: Pass `sceneHint` from both call sites**

In `assemblePrompt` (around line 564), replace:

```ts
  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext);
```

with:

```ts
  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext, input.sceneHint);
```

In `inspectPrompt` (around line 477), replace:

```ts
  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext);
```

with:

```ts
  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext, input.sceneHint);
```

- [ ] **Step 4: Run the targeted tests**

Run: `pnpm vitest run src/platform/ai/__tests__/promptAssembly.chunks.test.ts -t "sceneHint"`
Expected: PASS (2 tests).

- [ ] **Step 5: Run full suite — ensure no regression**

Run: `pnpm test`
Expected: all passing (no prior test fed `sceneHint`, default undefined → unchanged output).

- [ ] **Step 6: Commit**

```bash
git add src/platform/ai/promptAssembly.ts src/platform/ai/__tests__/promptAssembly.chunks.test.ts
git commit -m "$(cat <<'EOF'
feat(ai): S2 — PromptInput.sceneHint field, wired into post-history tail

Adds optional sceneHint field. buildPostHistory appends it after device
context and time anchor. Nothing consumes it yet; aiChatEngine migration
comes in S5.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 3: 压缩 bug 修复 + 前缀改名

**目标：** 把 `compressStartIdx = entries.findIndex(...)` 改为 `compressStartIdx = 0`，旧 compressed entry 会被 `replaceRange` 吞掉；前缀 `[之前的对话摘要]` → `[长期记忆]`。

**Files:**
- Modify: `src/platform/ai/characterMemoryCompression.ts`
- Modify: `src/platform/ai/__tests__/characterMemoryCompression.test.ts`
- 可能涉及: `src/platform/ai/__tests__/summarizer.test.ts`（仅若断言包含旧前缀）

---

### Task 3.1: 写"多次压缩只剩一条 compressed"的失败测试

- [ ] **Step 1: Add test to `characterMemoryCompression.test.ts`**

Open `src/platform/ai/__tests__/characterMemoryCompression.test.ts`, append inside `describe('runCompressionIfNeeded', ...)` (before its closing `});`):

```ts
  it('second compression replaces the prior long-term memory entry (bug fix)', async () => {
    useAIConfigStore.setState({
      apiKey: 'sk', model: 'x', provider: 'openrouter', apiEndpoint: '',
      contextWindow: 1000, maxTokens: 100,
      summarizeThreshold: 0.5, keepRecentMessages: 2,
    } as never);
    const api = useCharacterMemory.getState();
    const long = 'x'.repeat(2000);

    // Round 1: fill up beyond threshold.
    api.append('char-001', { role: 'user', speakerId: 'me', content: long, source: 'xingyu' });
    api.append('char-001', { role: 'assistant', speakerId: 'char-001', content: long, source: 'xingyu' });
    api.append('char-001', { role: 'user', speakerId: 'me', content: long, source: 'xingyu' });
    api.append('char-001', { role: 'assistant', speakerId: 'char-001', content: 'recent1', source: 'xingyu' });
    api.append('char-001', { role: 'user', speakerId: 'me', content: 'recent2', source: 'xingyu' });

    const spy = vi
      .spyOn(summarizer, 'compressHistory')
      .mockResolvedValueOnce('round1-summary')
      .mockResolvedValueOnce('round2-summary');

    await runCompressionIfNeeded('char-001');

    // After round 1: should have 1 compressed + 2 recent.
    let remaining = useCharacterMemory.getState().getAll('char-001');
    expect(remaining.filter((e) => e.compressed)).toHaveLength(1);

    // Round 2: append more and trigger again.
    api.append('char-001', { role: 'user', speakerId: 'me', content: long, source: 'xingyu' });
    api.append('char-001', { role: 'assistant', speakerId: 'char-001', content: long, source: 'xingyu' });
    api.append('char-001', { role: 'user', speakerId: 'me', content: 'recent3', source: 'xingyu' });

    await runCompressionIfNeeded('char-001');

    remaining = useCharacterMemory.getState().getAll('char-001');
    // Critical: ≤1 compressed entry ever, even after multiple rounds.
    expect(remaining.filter((e) => e.compressed)).toHaveLength(1);
    // And the one we have is the latest (round2-summary is in content).
    const latest = remaining.find((e) => e.compressed)!;
    expect(latest.content).toContain('round2-summary');

    spy.mockRestore();
  });
```

- [ ] **Step 2: Run — expect FAIL**

Run: `pnpm vitest run src/platform/ai/__tests__/characterMemoryCompression.test.ts -t "second compression replaces"`
Expected: FAIL — after round 2, there are 2 compressed entries.

---

### Task 3.2: 修复 `compressStartIdx` + 改名

- [ ] **Step 1: Apply the fix**

In `src/platform/ai/characterMemoryCompression.ts`:

- Line 71: replace
  ```ts
    const compressStartIdx = entries.findIndex((e) => !e.compressed);
    if (compressStartIdx < 0 || compressStartIdx > compressEndIdx) return;
  ```
  with
  ```ts
    // Always start from index 0 so any prior compressed entry is replaced,
    // preventing accumulation of long-term memory entries.
    const compressStartIdx = 0;
    if (compressStartIdx > compressEndIdx) return;
  ```

- Line 114: replace
  ```ts
    content: `[之前的对话摘要]\n${summaryText}`,
  ```
  with
  ```ts
    content: `[长期记忆]\n${summaryText}`,
  ```

- [ ] **Step 2: Run the new test — expect PASS**

Run: `pnpm vitest run src/platform/ai/__tests__/characterMemoryCompression.test.ts -t "second compression replaces"`
Expected: PASS.

- [ ] **Step 3: Update the existing compression test's content assertion**

In `src/platform/ai/__tests__/characterMemoryCompression.test.ts`, the earlier test `"compresses the oldest batch ..."` asserts:
```ts
    expect(remaining[0]!).toMatchObject({
      role: 'system',
      compressed: true,
      source: 'system',
      content: expect.stringContaining('他们聊了很久。'),
    });
```
The `stringContaining` assertion still passes (the summary text is unchanged, only the prefix changed). Verify by running the whole compression test file.

- [ ] **Step 4: Run the full compression test file**

Run: `pnpm vitest run src/platform/ai/__tests__/characterMemoryCompression.test.ts`
Expected: all PASS.

---

### Task 3.3: 检查 summarizer.test.ts 是否需要改

- [ ] **Step 1: Search for old prefix in tests**

Run: `grep -rn "之前的对话摘要" src/`
Expected: only the live reference should be gone (L114 of characterMemoryCompression.ts now says `[长期记忆]`). If matches appear in tests, update them to `[长期记忆]`.

- [ ] **Step 2: Run summarizer tests**

Run: `pnpm vitest run src/platform/ai/__tests__/summarizer.test.ts`
Expected: all PASS. Fix prefix strings if anything fails.

---

### Task 3.4: 全量测试 + 提交 Stage 3

- [ ] **Step 1: Full suite**

Run: `pnpm test`
Expected: all PASS.

**NOTE:** `inspectPrompt` in `promptAssembly.ts` (around L500) still has a `startsWith('[之前的对话摘要]')` check; it will no longer match new compressed entries. This detection is being entirely removed in Stage 4's inspectPrompt rewrite. Intermediate effect: Prompt Viewer shows the compressed entry as "聊天历史" (not "历史摘要") until Stage 4. This is cosmetic and does not break any test — confirm with `pnpm test`.

- [ ] **Step 2: Commit**

```bash
git add src/platform/ai/characterMemoryCompression.ts src/platform/ai/__tests__/characterMemoryCompression.test.ts
# Include summarizer.test.ts only if it was modified:
# git add src/platform/ai/__tests__/summarizer.test.ts
git commit -m "$(cat <<'EOF'
fix(ai): S3 — compress from index 0, rename prefix to [长期记忆]

Long-term memory entries previously accumulated because compression
started from the first non-compressed index, skipping the old
compressed entry. Start from 0 so replaceRange absorbs the prior
compressed entry each run — guarantees ≤1 compressed entry at any time.

Also renames the content prefix from [之前的对话摘要] to [长期记忆] to
match the product-level terminology.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 4: 接入 `assemblePrompt` + 删旧函数 + 重写测试

**目标：** 最大的一 stage。`assemblePrompt` 切换到 `renderMemoryToTranscript`；删除 `renderMemoryToChatMessages`；`inspectPrompt` sections 重写；PromptViewerPage 图标表更新；所有受影响的测试修好。

**Files:**
- Modify: `src/platform/ai/promptAssembly.ts`（切换 + 删旧 + 重写 inspectPrompt）
- Modify: `src/apps/Settings/pages/PromptViewerPage.tsx`（SECTION_ICONS）
- Delete: `src/platform/ai/__tests__/promptAssembly.render.test.ts`
- Create: `src/platform/ai/__tests__/trimMemoryToFit.test.ts`（承接原文件的 trim 部分）
- Modify: `src/platform/ai/__tests__/m4.2.5.e2e.test.ts`（消息形态断言）
- Potentially modify: `src/platform/userApp/sdk/__tests__/ai.session.test.ts`、`src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts`、`src/platform/ai/__tests__/m4.1.e2e.test.ts`

---

### Task 4.1: 切换 `assemblePrompt` 到新渲染函数

- [ ] **Step 1: Rewrite the Phase 2 block of `assemblePrompt`**

In `src/platform/ai/promptAssembly.ts`, inside `assemblePrompt` (around lines 577-602), replace:

```ts
  // Phase 2 — Chat history. Compression ratio uses live (non-compressed) entries.
  const preTrimTokens = input.memoryEntries
    .filter((e) => !e.compressed)
    .reduce((sum, e) => sum + estimateTokens(e.content) + 6, 0);

  const trimmed = trimMemoryToFit(
    input.memoryEntries,
    historyBudget,
    aiConfig.keepRecentMessages,
  );
  const historyMessages = renderMemoryToChatMessages(trimmed, {
    currentCharId: input.currentCharId,
    charactersById: input.charactersById,
    personaName: persona.name,
  });

  // Assemble final message array.
  const messages: ChatMessage[] = [
    { role: 'system', content: systemBlock },
    ...historyMessages,
  ];

  // Inject post-history as a trailing system message (highest attention weight).
  if (postHistory) {
    messages.push({ role: 'system', content: postHistory });
  }

  const tokenEstimate =
    systemTokens +
    historyMessages.reduce((s, m) => s + estimateContentTokens(m.content), 0) +
    postTokens +
    overhead;

  // Ratio: how much of the history budget is consumed by raw history tokens.
  const historyTokenRatio = historyBudget > 0 ? preTrimTokens / historyBudget : 0;

  return { messages, tokenEstimate, historyTokenRatio, historyBudget };
}
```

with:

```ts
  // Phase 2 — Chat history. Compression ratio uses live (non-compressed) entries.
  const preTrimTokens = input.memoryEntries
    .filter((e) => !e.compressed)
    .reduce((sum, e) => sum + estimateTokens(e.content) + 6, 0);

  const trimmed = trimMemoryToFit(
    input.memoryEntries,
    historyBudget,
    aiConfig.keepRecentMessages,
  );
  const { longTermMemory, transcriptBlock, userTurn } = renderMemoryToTranscript(
    trimmed,
    {
      currentCharId: input.currentCharId,
      charactersById: input.charactersById,
      personaName: persona.name,
    },
  );

  // Assemble final message array: system #1, optional system #2/#3, system #4, optional user turn.
  const messages: ChatMessage[] = [{ role: 'system', content: systemBlock }];
  if (longTermMemory) {
    messages.push({ role: 'system', content: longTermMemory });
  }
  if (transcriptBlock) {
    messages.push({ role: 'system', content: transcriptBlock });
  }
  if (postHistory) {
    messages.push({ role: 'system', content: postHistory });
  }
  if (userTurn) {
    messages.push(userTurn);
  }

  const historyTokens =
    (longTermMemory ? estimateTokens(longTermMemory) : 0) +
    (transcriptBlock ? estimateTokens(transcriptBlock) : 0) +
    (userTurn ? estimateContentTokens(userTurn.content) : 0);

  const tokenEstimate = systemTokens + historyTokens + postTokens + overhead;

  // Ratio: how much of the history budget is consumed by raw history tokens.
  const historyTokenRatio = historyBudget > 0 ? preTrimTokens / historyBudget : 0;

  return { messages, tokenEstimate, historyTokenRatio, historyBudget };
}
```

- [ ] **Step 2: Delete old `renderMemoryToChatMessages`**

In `src/platform/ai/promptAssembly.ts`, delete the entire `renderMemoryToChatMessages` function (from its comment block through closing `}`, roughly lines 151-188), and delete the `resolveSpeakerName` helper (lines 178-188) as it's now only used by the deleted function (`renderMemoryToTranscript` has its own `resolveTranscriptSpeaker`).

**Before deleting `resolveSpeakerName`:** confirm no other consumers exist:

Run: `grep -rn "resolveSpeakerName\b" src/`
Expected: zero matches (or only inside promptAssembly.ts itself). If matches exist outside, keep the helper and update instead.

- [ ] **Step 3: TypeScript build check (will catch downstream breakage)**

Run: `pnpm build`
Expected: may fail if external consumers import `renderMemoryToChatMessages`. Check:

Run: `grep -rn "renderMemoryToChatMessages" src/`
Expected: zero matches after this step. If matches appear in test files, those will be updated in Task 4.3.

---

### Task 4.2: 重写 `inspectPrompt` sections

- [ ] **Step 1: Replace the `inspectPrompt` body**

In `src/platform/ai/promptAssembly.ts`, replace the entire `inspectPrompt` function (around lines 462-538) with:

```ts
export function inspectPrompt(input: PromptInput): PromptInspection {
  const { character, persona, aiConfig, worldBookChunk, now, deviceContext, availableStickers, formatOverride } = input;

  let systemBlock = buildSystemBlock(
    character,
    persona,
    aiConfig,
    worldBookChunk,
    availableStickers,
    formatOverride,
    input.availableTools,
    input.appSystemPromptSnapshot,
  );
  systemBlock = expandMacros(systemBlock, character, persona, now);

  let postHistory = buildPostHistory(character, aiConfig, now, deviceContext, input.sceneHint);
  postHistory = expandMacros(postHistory, character, persona, now);

  const systemTokens = estimateTokens(systemBlock);
  const postTokens = estimateTokens(postHistory);
  const overhead = 3;
  const totalBudget = Math.floor(aiConfig.contextWindow * SAFETY_MARGIN);
  const historyBudget = Math.max(0, totalBudget - aiConfig.maxTokens - systemTokens - postTokens - overhead);

  const trimmed = trimMemoryToFit(input.memoryEntries, historyBudget, aiConfig.keepRecentMessages);
  const { longTermMemory, transcriptBlock, userTurn } = renderMemoryToTranscript(trimmed, {
    currentCharId: input.currentCharId,
    charactersById: input.charactersById,
    personaName: persona.name,
  });

  const sections: PromptSection[] = [
    { label: 'System 提示词', content: systemBlock, tokens: systemTokens },
  ];

  if (longTermMemory) {
    sections.push({
      label: '长期记忆',
      content: longTermMemory,
      tokens: estimateTokens(longTermMemory),
    });
  }

  if (transcriptBlock) {
    sections.push({
      label: '历史记录',
      content: transcriptBlock,
      tokens: estimateTokens(transcriptBlock),
    });
  }

  if (postHistory) {
    sections.push({ label: 'Post-history 指令', content: postHistory, tokens: postTokens });
  }

  if (userTurn) {
    sections.push({
      label: '当前输入',
      content: typeof userTurn.content === 'string' ? userTurn.content : contentToText(userTurn.content),
      tokens: estimateContentTokens(userTurn.content),
    });
  }

  const historyTokens =
    (longTermMemory ? estimateTokens(longTermMemory) : 0) +
    (transcriptBlock ? estimateTokens(transcriptBlock) : 0) +
    (userTurn ? estimateContentTokens(userTurn.content) : 0);

  return {
    sections,
    totalTokens: systemTokens + historyTokens + postTokens + overhead,
    contextWindow: aiConfig.contextWindow,
    maxTokens: aiConfig.maxTokens,
    historyBudget,
  };
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm build`
Expected: build succeeds.

---

### Task 4.3: 更新 `PromptViewerPage.tsx` SECTION_ICONS

- [ ] **Step 1: Update icon import and map**

In `src/apps/Settings/pages/PromptViewerPage.tsx`, at the top import line:

```ts
import { ChevronRight, Brain, Cpu, MessageSquare, Clock, FileText, Archive, Loader2 } from 'lucide-react';
```

Replace with (add `Send`):

```ts
import { ChevronRight, Brain, Cpu, MessageSquare, Clock, FileText, Archive, Loader2, Send } from 'lucide-react';
```

Then replace the `SECTION_ICONS` constant (around lines 23-27):

```ts
const SECTION_ICONS: Record<string, typeof Brain> = {
  'System 提示词': Brain,
  '历史摘要': FileText,
  'Post-history 指令': Clock,
};

function getSectionIcon(label: string) {
  if (label.startsWith('聊天历史')) return MessageSquare;
  return SECTION_ICONS[label] ?? Cpu;
}
```

with:

```ts
const SECTION_ICONS: Record<string, typeof Brain> = {
  'System 提示词': Brain,
  '长期记忆': FileText,
  '历史记录': MessageSquare,
  'Post-history 指令': Clock,
  '当前输入': Send,
};

function getSectionIcon(label: string) {
  return SECTION_ICONS[label] ?? Cpu;
}
```

- [ ] **Step 2: Verify no other `startsWith('[之前的对话摘要]')` consumers remain**

Run: `grep -rn "之前的对话摘要" src/`
Expected: zero matches.

Run: `grep -rn "historyMessages.find" src/`
Expected: zero matches (that was only in the old inspectPrompt).

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: PASS.

---

### Task 4.4: 删除旧 render test 文件，迁移 trim 测试

- [ ] **Step 1: Create new `trimMemoryToFit.test.ts`**

Create `src/platform/ai/__tests__/trimMemoryToFit.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { trimMemoryToFit } from '../promptAssembly';
import type { MemoryEntry } from '../characterMemoryStore';

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
    expect(out.slice(-3).map((e) => e.id)).toEqual(['e-7', 'e-8', 'e-9']);
  });

  it('never trims below keepRecent count', () => {
    const entries = makeEntries(5, 1000);
    const out = trimMemoryToFit(entries, 10, 3);
    expect(out.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Delete the old test file**

Run: `git rm src/platform/ai/__tests__/promptAssembly.render.test.ts`

- [ ] **Step 3: Run both the new trim test and the transcript test**

Run: `pnpm vitest run src/platform/ai/__tests__/trimMemoryToFit.test.ts src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`
Expected: all PASS.

---

### Task 4.5: 修 `m4.2.5.e2e.test.ts` 的 message 断言

- [ ] **Step 1: Identify failing lines**

Run: `pnpm vitest run src/platform/ai/__tests__/m4.2.5.e2e.test.ts`
Expected: failures on lines that assert `{ role: 'user', content: '...' }` or similar user/assistant messages in the `chatMessages` / `messages` array.

- [ ] **Step 2: Translate assertions to new shape**

Pattern to apply, for any failing assertion of the form:

```ts
// OLD
expect(messages[1]).toMatchObject({ role: 'user', content: '小米：早上好' });
```

Translate to either:

(a) **If that entry was the LAST entry in memoryEntries (triggering message)**, it becomes the user turn (last message in array):

```ts
expect(messages[messages.length - 1]).toMatchObject({ role: 'user', content: '小米：早上好' });
```

(b) **If it was a historical entry (not last)**, it becomes a line inside the transcript block (a single system message, not its own message):

```ts
const transcript = messages.find(
  (m) => m.role === 'system' && typeof m.content === 'string' && m.content.startsWith('[历史记录]'),
);
expect(transcript?.content).toContain('小米：早上好');
// If timestamp matters, also:
// expect(transcript?.content).toMatch(/\[\d{2}:\d{2}\] 小米：早上好/);
```

Work through each failing assertion. The common failures from plan §4 test list come from `toMatchObject({ role: 'user', content: '早上好' })` / `toMatchObject({ role: 'user', content: '开始' })` etc. (seen at `m4.2.5.e2e.test.ts:118` and `:153`) — these must be reclassified (triggering last entry → `userTurn` final message; mid-history → transcript substring).

- [ ] **Step 3: Run until green**

Run: `pnpm vitest run src/platform/ai/__tests__/m4.2.5.e2e.test.ts`
Expected: PASS.

---

### Task 4.6: 修 `ai.session.test.ts` 和 `xingyu-via-memoryStore.test.ts`

- [ ] **Step 1: Run both**

Run: `pnpm vitest run src/platform/userApp/sdk/__tests__/ai.session.test.ts src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts`
Expected: may pass (if they don't assert prompt message shape) or fail on similar patterns.

- [ ] **Step 2: Apply the same translation pattern from Task 4.5**

For each failing assertion, reclassify as:
- Triggering last entry → `messages[messages.length - 1]` as user turn
- Mid-history → substring of the `[历史记录]` block

- [ ] **Step 3: Run until green**

Run: `pnpm vitest run src/platform/userApp/sdk/__tests__/ai.session.test.ts src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts`
Expected: PASS.

---

### Task 4.7: 修 `m4.1.e2e.test.ts` if it asserts message shape

- [ ] **Step 1: Run**

Run: `pnpm vitest run src/platform/ai/__tests__/m4.1.e2e.test.ts`
Expected: may pass or fail. If fails, apply same translation pattern.

- [ ] **Step 2: Fix and re-run until green**

---

### Task 4.8: 全量测试 + 提交 Stage 4

- [ ] **Step 1: Full suite**

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 2: Build**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/platform/ai/promptAssembly.ts \
        src/platform/ai/__tests__/trimMemoryToFit.test.ts \
        src/platform/ai/__tests__/m4.2.5.e2e.test.ts \
        src/apps/Settings/pages/PromptViewerPage.tsx
git rm src/platform/ai/__tests__/promptAssembly.render.test.ts
# Include any other tests modified:
# git add src/platform/userApp/sdk/__tests__/ai.session.test.ts
# git add src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts
# git add src/platform/ai/__tests__/m4.1.e2e.test.ts
git commit -m "$(cat <<'EOF'
refactor(ai): S4 — wire renderMemoryToTranscript into assemblePrompt

assemblePrompt now emits: system #1 (stable) | [长期记忆] | [历史记录]
transcript | post-history | optional user turn. Deletes
renderMemoryToChatMessages; inspectPrompt sections mirror the new
messages layout (长期记忆 / 历史记录 / 当前输入 replace 历史摘要 /
聊天历史). Prompt Viewer icons updated accordingly.

Test impact: promptAssembly.render.test.ts split into
renderMemoryToTranscript.test.ts + trimMemoryToFit.test.ts;
m4.2.5.e2e and cross-app tests updated to assert the new shape.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 5: AI-AI `aiChatEngine.ts` 切到 `sceneHint`

**目标：** 删除外部 `chatMessages.push({role:'system', ...})`，改成在 `assemblePrompt` 入参里传 `sceneHint`。

**Files:**
- Modify: `src/platform/ai/aiChatEngine.ts`

---

### Task 5.1: 切换

- [ ] **Step 1: Edit `aiChatEngine.ts`**

In `src/platform/ai/aiChatEngine.ts`, find the block around lines 117-149 (the `assemblePrompt` call + subsequent `chatMessages.push(...)` for scene context). Replace:

```ts
    const { messages: chatMessages } = assemblePrompt({
      character: {
        name: responder.name,
        description: responder.description,
        personality: responder.personality,
        scenario: responder.scenario,
        systemPrompt: responder.systemPrompt,
        postHistoryInstructions: responder.postHistoryInstructions,
        messageExamples: responder.messageExamples,
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
      memoryEntries,
      currentCharId: responderId!,
      charactersById,
      now: new Date(),
      deviceContext: buildDeviceContext(),
    });

    // Inject current chat scene context
    chatMessages.push({
      role: 'system',
      content: `[当前场景] 你正在和${other.name}私聊。请直接回复${other.name}。`,
    });
```

with:

```ts
    const { messages: chatMessages } = assemblePrompt({
      character: {
        name: responder.name,
        description: responder.description,
        personality: responder.personality,
        scenario: responder.scenario,
        systemPrompt: responder.systemPrompt,
        postHistoryInstructions: responder.postHistoryInstructions,
        messageExamples: responder.messageExamples,
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
      memoryEntries,
      currentCharId: responderId!,
      charactersById,
      now: new Date(),
      deviceContext: buildDeviceContext(),
      sceneHint: `[当前场景] 你正在和${other.name}私聊。请直接回复${other.name}。`,
    });
```

- [ ] **Step 2: Confirm zero external pushes remain**

Run: `grep -n "chatMessages.push" src/platform/ai/aiChatEngine.ts`
Expected: no matches.

- [ ] **Step 3: Run any AI-chat-related tests**

Run: `pnpm vitest run --dir src -t "aiChat"` (or the full suite):

Run: `pnpm test`
Expected: all PASS.

- [ ] **Step 4: Build check**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/platform/ai/aiChatEngine.ts
git commit -m "$(cat <<'EOF'
refactor(ai): S5 — AI-AI [当前场景] migrated to PromptInput.sceneHint

Removes the external chatMessages.push({role:'system', ...}) that sat
after assemblePrompt(). The same text now flows through the new
sceneHint field, landing cleanly at the end of post-history (system #4)
without violating the user-turn-at-end convention of the new message
layout.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 6: 发布说明 + 手测验证

**目标：** 写 release note；启动 dev server 手测一次 XingYu + AI-AI 场景；确认 Prompt Viewer 显示正确。

**Files:**
- Create: `docs/release-notes/2026-04-22-history-as-system-transcript.md`

---

### Task 6.1: 写 release note

- [ ] **Step 1: Create the file**

Create `docs/release-notes/2026-04-22-history-as-system-transcript.md`:

```markdown
# 2026-04-22 — History as System Transcript

## 本次改动
- 历史消息从"user/assistant 交替 messages"改为"单条 system transcript"
  - 新 messages 形态：`system #1 稳定 | system #2 [长期记忆]（可选）| system #3 [历史记录]（可选）| system #4 post-history | user turn（可选）`
  - system #3 每行 `[HH:MM] <说话人>：<内容>`；role=system 的行无说话人前缀
  - user turn 仅在"最后一条活 entry 是 role=user"时生成
- 长期记忆压缩 bug 修复：`compressStartIdx` 从 `findIndex(!compressed)` 改为 `0`，每次压缩都会吞掉上一次的 compressed entry；memoryStore 中 `compressed: true` 条目永远 ≤ 1
- 前缀改名：`[之前的对话摘要]` → `[长期记忆]`（compression 输出、inspectPrompt UI、Prompt Viewer section 标签三处同步）
- AI-AI 场景的 `[当前场景]` 通过 `PromptInput.sceneHint` 进 post-history，不再外部追加 system message
- Prompt Viewer section 布局：`System 提示词 | 长期记忆（可选）| 历史记录（可选）| Post-history 指令 | 当前输入（可选）`

## 非目标 / 本次不做
- 不引入日期前缀（跨天靠长期记忆化解）
- 不改 SDK 对外契约（`chatWithCharacter` / `session.send` / `session.replyToLast` / `injectSystemEvent` 签名语义不变）
- 不改 `MemoryEntry` shape
- 不改 replyParser / toolRegistry（M4.2.5 已定稿）
- 不做 multimodal/vision 适配（`aiConfig.enableVision` 当前路径下无消费点）

## 验证
- 测试套件全绿
- 手测：XingYu 1-on-1 聊天 + AI-AI 对话 + Prompt Viewer 各 section 显示

## 关联文档
- 产品需求：`docs/plan/2026-04-21-0131-history-as-system-transcript.md`
- 设计 spec：`docs/superpowers/specs/2026-04-22-history-as-system-transcript-design.md`
- 实现计划：`docs/plan/2026-04-22-0109-history-as-system-transcript-impl.md`
```

- [ ] **Step 2: Verify directory exists**

Run: `ls docs/release-notes/ 2>/dev/null || mkdir -p docs/release-notes`

---

### Task 6.2: 手测

- [ ] **Step 1: Start dev server**

Run: `pnpm dev` (run in background)
Visit: local URL printed by Vite.

- [ ] **Step 2: XingYu 1-on-1 验证**

1. 打开 XingYu，选择一个已配角色
2. 发送一条消息，等角色回复
3. 打开 Settings → AI → Prompt Viewer
4. 确认 sections 顺序：`System 提示词 | 历史记录 | Post-history 指令 | 当前输入`（无长期记忆，因为没触发压缩）
5. 点开"历史记录"，确认首行是 `[历史记录]`，后续行是 `[HH:MM] <说话人>：<内容>`
6. 点开"当前输入"，确认显示 `<persona>：<刚刚的玩家输入>`

- [ ] **Step 3: 压缩后验证**

1. Prompt Viewer 页面点"立即压缩"
2. 压缩完成后确认 sections 顺序：`System 提示词 | 长期记忆 | 历史记录 | Post-history 指令 | 当前输入`
3. 点开"长期记忆"，确认首行是 `[长期记忆]` + 摘要文本

- [ ] **Step 4: AI-AI 场景验证**

1. 触发 AI-AI 对话（例如星语角色之间互相发消息）
2. 查看 Prompt Viewer 的 Post-history 指令 section
3. 确认末尾包含 `[当前场景] 你正在和<对方名>私聊。请直接回复<对方名>。`

- [ ] **Step 5: 压缩累积不再发生**

1. 手动触发多次压缩（连续点"立即压缩"）
2. 浏览器 devtools console:
   ```js
   const { useCharacterMemory } = await import('./src/platform/ai/characterMemoryStore');
   const entries = useCharacterMemory.getState().getAll('<当前 char id>');
   entries.filter(e => e.compressed).length;
   ```
3. 确认结果恒 ≤ 1

---

### Task 6.3: 最终 commit

- [ ] **Step 1: Full suite + build**

Run: `pnpm test && pnpm build`
Expected: all PASS.

- [ ] **Step 2: Commit release note**

```bash
git add docs/release-notes/2026-04-22-history-as-system-transcript.md
git commit -m "$(cat <<'EOF'
docs: S6 — release notes for history-as-system-transcript

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 3: 可选：stop dev server**

Kill the `pnpm dev` background process.

---

## 验收标准（来自 spec §5）

- [ ] 全部现有单测 + E2E 通过（更新断言后）
- [ ] `renderMemoryToTranscript` 新增单测覆盖所有分支：行格式 5 种 / userTurn 分派 4 种 / 长期记忆 3 种退化
- [ ] 跑一次 XingYu 聊天，Prompt Viewer 能看到：
  - `[长期记忆]` 独立 section（仅当有压缩 entry）
  - `[历史记录]` 带 `[HH:MM]` 时间戳的 transcript
  - 玩家刚发消息时「当前输入」section 显示 `<persona>：<玩家输入>`
- [ ] 连续压缩多次后，memoryStore 中 `compressed: true` entry 始终 ≤ 1
- [ ] AI-AI 场景 `[当前场景]` 出现在 system #4 末尾；messages 数组不再出现孤立的外部追加 system

---

## 决策记录（汇总自 spec §6）

| # | 决策点 | 选择 |
|---|---|---|
| S2 | AI-AI 场景字段 | `PromptInput.sceneHint?: string`（专用，非通用 extraPostHistory） |
| S1/S4 | 渲染函数命名 | 新建 `renderMemoryToTranscript`，删旧 `renderMemoryToChatMessages` |
| 全局 | Token 成本模型 | 保留 `trimMemoryToFit` 的 `+ ROLE_OVERHEAD = 6` 不动（误差在 SAFETY_MARGIN 兜底内） |
| S4 | Viewer sections | 对齐 messages 5-section 布局，无内容则隐藏（不显示 empty state） |
