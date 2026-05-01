# PR1 — 修复 active-persona 误用为"会话对方"的潜伏 bug 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 8 处 AI 后端流程中"`getActivePersona()` 当会话对方"的捷径换成显式 `personaId` 入参，从被处理对象（character / conversation / memory entry）的归属反查 persona。

**Architecture:** 引入 `AppSystemPromptCtx` 给 system-prompt 注册表带上下文；为 heartbeat / compression / aiChatEngine / userApp SDK / memoryWriter / presenceAi 显式传 `personaId`。当前只有一个 persona，所以行为上无可见变化；改的是语义。

**Tech Stack:** TypeScript, Vitest, Zustand。

**Spec reference:** `docs/superpowers/specs/2026-05-01-multi-persona-sim-card-design.md` §5.1 + §6 PR1。

**Branch:** 在 `feat/m1-architecture` 上新建 `feat/persona-context-fix` 分支。

---

## 影响面文件清单

新建：
- `src/platform/identity/personaContext.ts` — `getPersonaById(id)` / `getActivePersonaId()` helpers
- `src/platform/identity/__tests__/personaContext.test.ts`

修改：
- `src/platform/ai/appSystemPromptRegistry.ts` — `AppSystemPromptFn` 签名加 ctx
- `src/platform/ai/heartbeatRegister.ts` — closure 改用 ctx
- `src/apps/XingYu/xingYuRegister.ts` — closure 接 ctx（XingYu 不用 persona，pass-through）
- `src/apps/Gomoku/gomokuRegister.ts` — 同上
- `src/platform/userApp/sdk/ai.ts:715` — re-export 包装时透传 ctx
- `src/platform/ai/heartbeatAgent.ts` — `runHeartbeat(characterId, personaId, signal)`
- `src/platform/ai/characterMemoryCompression.ts` — `runCompressionIfNeeded(characterId, personaId)`
- `src/platform/ai/aiChatEngine.ts` — 取 personaId 当参数
- `src/platform/userApp/sdk/ai.ts` — `ChatSession` 在创建时 capture personaId
- `src/platform/ai/memoryWriter.ts` — `buildCtx(currentCharId, personaId)`
- `src/apps/Presence/presenceAi.ts` — 同上
- `src/platform/ai/__tests__/heartbeatRegister.test.ts` — 调整 expectation
- `src/apps/Presence/__tests__/presenceAi.test.ts` — 同
- `src/platform/userApp/sdk/__tests__/ai.session.test.ts` — 同

不动（PromptViewer 是用户即时交互页面，用 active persona 是正确的）：
- `src/apps/Settings/pages/PromptViewerPage.tsx`

---

## Task 1: 新建 identity helper（getPersonaById / getActivePersonaId）

**Files:**
- Create: `src/platform/identity/personaContext.ts`
- Create: `src/platform/identity/__tests__/personaContext.test.ts`

- [ ] **Step 1.1: 写失败测试**

```typescript
// src/platform/identity/__tests__/personaContext.test.ts
import { beforeEach, describe, it, expect } from 'vitest';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { getPersonaById, getActivePersonaId } from '../personaContext';

describe('personaContext', () => {
  beforeEach(() => {
    usePersonaStore.setState({
      personas: [
        { id: 'default', name: '小星星', avatar: '', description: '', isDefault: true },
        { id: 'persona-bob', name: '鲍勃', avatar: '', description: '', isDefault: false },
      ],
      activePersonaId: 'default',
    });
  });

  it('getPersonaById returns the persona for a given id', () => {
    expect(getPersonaById('persona-bob')?.name).toBe('鲍勃');
    expect(getPersonaById('default')?.name).toBe('小星星');
  });

  it('getPersonaById returns undefined for unknown id', () => {
    expect(getPersonaById('persona-unknown')).toBeUndefined();
  });

  it('getActivePersonaId returns active id', () => {
    expect(getActivePersonaId()).toBe('default');
    usePersonaStore.setState({ activePersonaId: 'persona-bob' });
    expect(getActivePersonaId()).toBe('persona-bob');
  });
});
```

- [ ] **Step 1.2: 运行测试确认失败**

```bash
pnpm vitest run src/platform/identity/__tests__/personaContext.test.ts
```

Expected: FAIL — `Cannot find module '../personaContext'`.

- [ ] **Step 1.3: 写最小实现**

```typescript
// src/platform/identity/personaContext.ts
import { usePersonaStore, type Persona } from '@/platform/stores/personaStore';

export function getPersonaById(id: string): Persona | undefined {
  return usePersonaStore.getState().personas.find((p) => p.id === id);
}

export function getActivePersonaId(): string {
  return usePersonaStore.getState().activePersonaId;
}
```

- [ ] **Step 1.4: 运行测试确认通过**

```bash
pnpm vitest run src/platform/identity/__tests__/personaContext.test.ts
```

Expected: PASS（3 tests）。

- [ ] **Step 1.5: Commit**

```bash
git add src/platform/identity/personaContext.ts \
        src/platform/identity/__tests__/personaContext.test.ts
git commit -m "feat(identity): add getPersonaById / getActivePersonaId helpers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: 给 AppSystemPromptFn 加 context 参数

**Files:**
- Modify: `src/platform/ai/appSystemPromptRegistry.ts`

- [ ] **Step 2.1: 修改 registry 类型 + 函数签名**

```typescript
// src/platform/ai/appSystemPromptRegistry.ts
export interface AppSystemPromptCtx {
  /** 当前正在被组装 prompt 的角色 id */
  characterId: string;
  /** 当前 prompt 服务于哪个 persona（玩家方）的对话上下文 */
  personaId: string;
}

export type AppSystemPromptFn = (ctx: AppSystemPromptCtx) => string;

const registry = new Map<string, AppSystemPromptFn>();

export function registerAppSystemPrompt(appId: string, fn: AppSystemPromptFn): void {
  registry.set(appId, fn);
}

export function getAppSystemPrompt(appId: string): AppSystemPromptFn | null {
  return registry.get(appId) ?? null;
}

export function unregisterApp(appId: string): void {
  registry.delete(appId);
}

export function _resetAppSystemPromptRegistryForTests(): void {
  registry.clear();
}
```

- [ ] **Step 2.2: 类型检查暂时会爆，先放着不修。下一 task 修各 closure**

```bash
pnpm tsc --noEmit
```

Expected: errors at heartbeatRegister.ts / xingYuRegister.ts / gomokuRegister.ts / userApp/sdk/ai.ts (closures 不接受 ctx)。这是预期，下一 task 修复。

- [ ] **Step 2.3: 暂不 commit，等 Task 3 修复编译错误后一起 commit**

---

## Task 3: 更新 heartbeatRegister 的 closure 用 ctx

**Files:**
- Modify: `src/platform/ai/heartbeatRegister.ts:190-235`

- [ ] **Step 3.1: 改写 registerAppSystemPrompt 调用**

把 `src/platform/ai/heartbeatRegister.ts:190` 处的：
```typescript
registerAppSystemPrompt(HEARTBEAT_APP_ID, () => {
  const persona = usePersonaStore.getState().getActivePersona();
  const userName = persona?.name ?? '用户';
  return [ ... ].join('\n');
});
```

改为：
```typescript
registerAppSystemPrompt(HEARTBEAT_APP_ID, (ctx) => {
  const persona = getPersonaById(ctx.personaId);
  const userName = persona?.name ?? '用户';
  return [ ... ].join('\n');  // 模板内容不变
});
```

import 也要加：
```typescript
import { getPersonaById } from '@/platform/identity/personaContext';
```

把原本的 `import { usePersonaStore } from '@/platform/stores/personaStore';`（第 17 行）删掉（如果文件别处不再用）；如果别处还用，保留。

- [ ] **Step 3.2: 验证 import 是否还需要**

```bash
grep -n "usePersonaStore" src/platform/ai/heartbeatRegister.ts
```

如果只剩 import 行没有其他使用，删除该 import。

---

## Task 4: 更新 XingYu / Gomoku register closure 接受 ctx 参数（pass-through）

**Files:**
- Modify: `src/apps/XingYu/xingYuRegister.ts:49`
- Modify: `src/apps/Gomoku/gomokuRegister.ts:34`

- [ ] **Step 4.1: XingYu register**

把 `src/apps/XingYu/xingYuRegister.ts:49` 的 `registerAppSystemPrompt(XINGYU_APP_ID, () => { ... })` 改为 `registerAppSystemPrompt(XINGYU_APP_ID, (_ctx) => { ... })`。函数体内目前不用 ctx，签名加上即可（编译通过）。

- [ ] **Step 4.2: Gomoku register**

同样把 `src/apps/Gomoku/gomokuRegister.ts:34` 的 closure 形参改成 `(_ctx)`。

- [ ] **Step 4.3: 验证编译通过**

```bash
pnpm tsc --noEmit
```

Expected: 还有 `getAppSystemPrompt(...)?.()` 调用点（不带 ctx）报错。下一 task 修。

---

## Task 5: 更新所有 `getAppSystemPrompt(appId)?.()` 调用点传 ctx

**Files:**
- Modify: `src/platform/ai/heartbeatAgent.ts:153`
- Modify: `src/platform/ai/aiChatEngine.ts:92`
- Modify: `src/platform/userApp/sdk/ai.ts`（搜 `getAppSystemPrompt`）

- [ ] **Step 5.1: heartbeatAgent**

`src/platform/ai/heartbeatAgent.ts:153` 当前：
```typescript
const frozenAppSystemPrompt = getAppSystemPrompt(HEARTBEAT_APP_ID)?.() ?? undefined;
```

改为：
```typescript
const frozenAppSystemPrompt = getAppSystemPrompt(HEARTBEAT_APP_ID)?.({
  characterId,
  personaId,
}) ?? undefined;
```

`personaId` 是 runHeartbeat 的新形参（Task 7 加）。这一步先以 placeholder 形式声明 `const personaId = getActivePersonaId();` 在 runHeartbeat 顶部（Task 7 改成参数传入）。

```typescript
import { getActivePersonaId } from '@/platform/identity/personaContext';
// ...
async function runHeartbeat(characterId: string, signal: AbortSignal): Promise<void> {
  const personaId = getActivePersonaId();  // TEMP — Task 7 改成形参
  // ...
}
```

- [ ] **Step 5.2: aiChatEngine**

`src/platform/ai/aiChatEngine.ts:92`：
```typescript
const frozenAppPrompt = getAppSystemPrompt(XINGYU_APP_ID)?.() ?? undefined;
```

改为：
```typescript
const frozenAppPrompt = getAppSystemPrompt(XINGYU_APP_ID)?.({
  characterId: responderId!,
  personaId: getActivePersonaId(),  // TEMP — Task 8 改成形参
}) ?? undefined;
```

但注意此处在 `for (const [responderId, otherCharId] of turnOrder)` 内部，每轮 responderId 不同。把 `frozenAppPrompt` 计算挪到循环内（放在循环开头）。

并 import：
```typescript
import { getActivePersonaId } from '@/platform/identity/personaContext';
```

- [ ] **Step 5.3: userApp/sdk/ai.ts**

```bash
grep -n "getAppSystemPrompt" src/platform/userApp/sdk/ai.ts
```

把搜到的每处 `getAppSystemPrompt(appId)?.()` 改为 `getAppSystemPrompt(appId)?.({ characterId, personaId })`，其中 `personaId = session.personaId`（Task 9 在 ChatSession 加这个字段）。本 task 暂用 `getActivePersonaId()`，标记 TEMP。

- [ ] **Step 5.4: 编译通过**

```bash
pnpm tsc --noEmit
```

Expected: PASS。

- [ ] **Step 5.5: Commit Task 2-5 一起**

```bash
git add src/platform/ai/appSystemPromptRegistry.ts \
        src/platform/ai/heartbeatRegister.ts \
        src/apps/XingYu/xingYuRegister.ts \
        src/apps/Gomoku/gomokuRegister.ts \
        src/platform/ai/heartbeatAgent.ts \
        src/platform/ai/aiChatEngine.ts \
        src/platform/userApp/sdk/ai.ts
git commit -m "refactor(ai): thread persona context into AppSystemPromptFn registry

Adds AppSystemPromptCtx { characterId, personaId } so registry callbacks
can resolve the right persona at prompt-build time instead of reading
the active persona globally. Behavior unchanged today (single persona);
prepares for multi-persona where active != conversation partner.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: heartbeatRegister.test 调整 — closure 用 ctx 后断言变化

**Files:**
- Modify: `src/platform/ai/__tests__/heartbeatRegister.test.ts`

- [ ] **Step 6.1: 找到调用 closure 的地方**

```bash
grep -n "getAppSystemPrompt\|HEARTBEAT_APP_ID" src/platform/ai/__tests__/heartbeatRegister.test.ts
```

如果测试调用 `getAppSystemPrompt(HEARTBEAT_APP_ID)?.()`，改为 `getAppSystemPrompt(HEARTBEAT_APP_ID)?.({ characterId: 'c1', personaId: 'p1' })`。

如果测试只是 set state 然后跑 register，则需要新增一条测试覆盖 ctx-based persona 解析：

```typescript
it('heartbeat system prompt uses ctx.personaId for user name', () => {
  usePersonaStore.setState({
    personas: [
      { id: 'pa', name: 'Alice', avatar: '', description: '', isDefault: false },
      { id: 'pb', name: 'Bob', avatar: '', description: '', isDefault: false },
    ],
    activePersonaId: 'pa',
  });
  registerHeartbeatPromptOnce();  // or whatever bootstraps it
  const fn = getAppSystemPrompt(HEARTBEAT_APP_ID)!;
  expect(fn({ characterId: 'c1', personaId: 'pa' })).toContain('Alice');
  expect(fn({ characterId: 'c1', personaId: 'pb' })).toContain('Bob');
  // ↑ even though active is 'pa', personaId='pb' must produce Bob's name
});
```

- [ ] **Step 6.2: 运行测试**

```bash
pnpm vitest run src/platform/ai/__tests__/heartbeatRegister.test.ts
```

Expected: PASS。

- [ ] **Step 6.3: Commit**

```bash
git add src/platform/ai/__tests__/heartbeatRegister.test.ts
git commit -m "test(heartbeat): assert ctx.personaId drives user name resolution

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: heartbeatAgent.runHeartbeat 加 personaId 形参

**Files:**
- Modify: `src/platform/ai/heartbeatAgent.ts`

- [ ] **Step 7.1: 修改函数签名**

```typescript
// runHeartbeat
async function runHeartbeat(
  characterId: string,
  personaId: string,
  signal: AbortSignal,
): Promise<void> {
  // 删掉 Task 5.1 加的 const personaId = getActivePersonaId() TEMP 行

  // ... 后面所有 getActivePersona() 全部替换为 getPersonaById(personaId)
  const persona = getPersonaById(personaId);
```

搜 `usePersonaStore.getState().getActivePersona()` 和 `getActivePersonaId()`（除 dispatcher 入口外），全部替换。

- [ ] **Step 7.2: 修改 dispatch site**

heartbeatAgent.ts 内部 call runHeartbeat 的两处（line 385, 533）：

```typescript
// 这两处是入口，应该读 active persona
runHeartbeat(characterId, getActivePersonaId(), controller.signal);
```

import：
```typescript
import { getActivePersonaId, getPersonaById } from '@/platform/identity/personaContext';
```

- [ ] **Step 7.3: 删除 import usePersonaStore（如果只剩 dispatcher 用）**

```bash
grep -n "usePersonaStore" src/platform/ai/heartbeatAgent.ts
```

如果没有 setActivePersona / 直接 store 操作的用法，删除 import。

- [ ] **Step 7.4: 编译 + 测试**

```bash
pnpm tsc --noEmit
pnpm vitest run src/platform/ai/__tests__
```

Expected: PASS（如有测试改动一并修复）。

- [ ] **Step 7.5: Commit**

```bash
git add src/platform/ai/heartbeatAgent.ts
git commit -m "refactor(heartbeat): explicit personaId param in runHeartbeat

Caller (dispatcher) reads active persona once at the top; runHeartbeat
itself never reads getActivePersona again. Prepares per-pair scheduling.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: characterMemoryCompression 加 personaId 形参

**Files:**
- Modify: `src/platform/ai/characterMemoryCompression.ts`

- [ ] **Step 8.1: 修改公开函数签名**

```typescript
export function runCompressionIfNeeded(characterId: string, personaId: string): Promise<void> {
  // ...
}

export function runCompressionForce(characterId: string, personaId: string): Promise<void> {
  // ...
}
```

- [ ] **Step 8.2: 修改内部 line 108-109**

```typescript
// before
const persona = usePersonaStore.getState().getActivePersona();
const personaName = persona?.name ?? '用户';

// after
const persona = getPersonaById(personaId);
const personaName = persona?.name ?? '用户';
```

import 加：
```typescript
import { getPersonaById } from '@/platform/identity/personaContext';
```

删除 `import { usePersonaStore } from '@/platform/stores/personaStore';`。

- [ ] **Step 8.3: 修改 installAutoCompression（line 149）**

```bash
grep -n "runCompressionIfNeeded\|installAutoCompression" src/platform/ai/characterMemoryCompression.ts
```

`installAutoCompression` 内部如果 hook 上调 `runCompressionIfNeeded(charId)`，要改成 `runCompressionIfNeeded(charId, getActivePersonaId())`。dispatcher 视角，读 active 是合理的（PR4 后会改成针对 pair）。

- [ ] **Step 8.4: 修改外部 caller**

```bash
grep -rn "runCompressionIfNeeded\|runCompressionForce" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

每个 caller 加 `getActivePersonaId()` 作第二参数。

- [ ] **Step 8.5: 测试 + commit**

```bash
pnpm vitest run src/platform/ai/__tests__
```

Expected: PASS（如有测试改动一并修复）。

```bash
git add src/platform/ai/characterMemoryCompression.ts $(grep -rl "runCompressionIfNeeded\|runCompressionForce" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__)
git commit -m "refactor(memory): explicit personaId param in runCompressionIfNeeded

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: aiChatEngine 显式 personaId

**Files:**
- Modify: `src/platform/ai/aiChatEngine.ts`

- [ ] **Step 9.1: 修改 entry function 签名**

找到 aiChatEngine 的 export 入口（搜 `export function` / `export async function`），加 `personaId: string` 参数。

```typescript
export async function runAIToAIChat(
  initiatorCharId: string,
  targetCharId: string,
  openingMessage: string,
  personaId: string,                  // NEW
  options: { maxRounds: number; signal: AbortSignal },
): Promise<AIChatResult> {
  // ...
}
```

- [ ] **Step 9.2: 内部使用**

把 line 85 的 `const persona = usePersonaStore.getState().getActivePersona();` 删掉，改为：
```typescript
const persona = getPersonaById(personaId);
```

把 Task 5.2 加的 TEMP `personaId: getActivePersonaId()` 改成 `personaId`（即上面的形参）。

- [ ] **Step 9.3: 修改 caller**

```bash
grep -rn "runAIToAIChat\|从 aiChatEngine 导入的入口名字" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

每个 caller 传 `getActivePersonaId()` 作为新参数。

- [ ] **Step 9.4: 测试 + commit**

```bash
pnpm vitest run src/platform/ai
```

```bash
git add src/platform/ai/aiChatEngine.ts $(grep -rl "runAIToAIChat" src/ | grep -v __tests__)
git commit -m "refactor(ai-chat): explicit personaId param in aiChatEngine

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: userApp SDK ChatSession 在创建时 capture personaId

**Files:**
- Modify: `src/platform/userApp/sdk/ai.ts`
- Modify: `src/platform/userApp/sdk/__tests__/ai.session.test.ts`

- [ ] **Step 10.1: 找到 ChatSession 类型定义**

```bash
grep -n "ChatSession\|interface ChatSession\|type ChatSession" src/platform/userApp/sdk/ai.ts
```

在 ChatSession 接口/类型上加 `personaId: string` 字段（不可变，session 创建时冻结）。

- [ ] **Step 10.2: 找到创建 ChatSession 的工厂**

```bash
grep -n "createChatSession\|chatWithCharacter\b" src/platform/userApp/sdk/ai.ts
```

在创建处读一次 `getActivePersonaId()` 写进 session 字段：

```typescript
const personaId = getActivePersonaId();
return {
  // ... existing fields
  personaId,
  // ...
};
```

- [ ] **Step 10.3: 内部使用 session.personaId 替代 getActivePersona**

把 line 396 / 446 的 `const persona = usePersonaStore.getState().getActivePersona()` 删掉。改为：
```typescript
const persona = getPersonaById(session.personaId);
```

把 line 374 的 `entry.role === 'user' ? 'me' : characterId` 暂时不动（PR2 会处理 'me' 字面量）。

- [ ] **Step 10.4: 测试**

`ai.session.test.ts` 增加一条断言：
```typescript
it('captures active persona at session creation, ignores subsequent switch', async () => {
  usePersonaStore.setState({
    personas: [
      { id: 'pa', name: 'Alice', ...defaults },
      { id: 'pb', name: 'Bob', ...defaults },
    ],
    activePersonaId: 'pa',
  });
  const session = chatWithCharacter('char-1');
  // simulate active persona switch mid-session
  usePersonaStore.setState({ activePersonaId: 'pb' });
  expect(session.personaId).toBe('pa');  // session frozen on Alice
});
```

- [ ] **Step 10.5: 测试通过 + commit**

```bash
pnpm vitest run src/platform/userApp/sdk/__tests__/ai.session.test.ts
```

```bash
git add src/platform/userApp/sdk/ai.ts \
        src/platform/userApp/sdk/__tests__/ai.session.test.ts
git commit -m "refactor(userapp-sdk): freeze personaId on ChatSession creation

Session captures active persona at creation; subsequent persona switch
does not affect ongoing session. This ensures memory writes during the
session attribute correctly even if user switches persona mid-flight.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: memoryWriter.buildCtx 加 personaId

**Files:**
- Modify: `src/platform/ai/memoryWriter.ts`

- [ ] **Step 11.1: buildCtx 签名变化**

```typescript
function buildCtx(currentCharId: string, personaId: string): BuildMemoryContext {
  const characters = useCharacterStore.getState().characters;
  const persona = getPersonaById(personaId);
  const userNickname = useXYData.getState().userSettings?.nickname ?? '用户';
  return {
    currentCharId,
    charactersById: new Map(characters.map((c) => [c.id, { id: c.id, name: c.name }])),
    personaName: persona?.name ?? userNickname,
    userNickname,
  };
}
```

import 加 `getPersonaById`，删 `usePersonaStore`（如不再用）。

- [ ] **Step 11.2: 修改 buildCtx 的所有 caller**

```bash
grep -n "buildCtx\b" src/platform/ai/memoryWriter.ts
```

每个 caller（如 `_appendMessage`、`recordSystemEvent` 等）：
- 如果调用方已经有 conversation/session 上下文（知道 personaId），传该值
- 如果调用方在用户当下交互入口（如 sendMessage 触发），传 `getActivePersonaId()`

具体每个 caller 检查上下文。如果 caller 也是 internal helper 没有 personaId，把 personaId 也添加到该 helper 的形参一路上溯，直到上溯到入口（sendMessage / heartbeat / aiChatEngine / chatWithCharacter）——这些入口已经在 Task 7-10 拿到了 personaId。

- [ ] **Step 11.3: line 118 的 'me' 比较**

memoryWriter.ts:118 的 `if (msg.senderId === 'me') return 0;` 暂不动（PR2 处理）。

- [ ] **Step 11.4: 编译 + 测试**

```bash
pnpm tsc --noEmit
pnpm vitest run src/platform/ai
```

- [ ] **Step 11.5: Commit**

```bash
git add src/platform/ai/memoryWriter.ts
git commit -m "refactor(memory): explicit personaId in buildCtx and callers

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: presenceAi 显式 personaId

**Files:**
- Modify: `src/apps/Presence/presenceAi.ts`
- Modify: `src/apps/Presence/__tests__/presenceAi.test.ts`

- [ ] **Step 12.1: 找入口函数**

```bash
grep -n "export function\|export async function" src/apps/Presence/presenceAi.ts
```

每个 export 入口加 `personaId: string` 参数（一般是 `runPresenceXxx(...)` 或类似）。

- [ ] **Step 12.2: 内部使用**

line 81, 124, 141 的 `usePersonaStore.getState().getActivePersona()` 全替换为 `getPersonaById(personaId)`。import `getPersonaById`，删除 `usePersonaStore`（如不再需要）。

- [ ] **Step 12.3: 修改 caller**

```bash
grep -rn "import.*from.*presenceAi\|presence.*Ai" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
```

每个 caller 在调用入口处传 `getActivePersonaId()`。

- [ ] **Step 12.4: 测试调整 + commit**

```bash
pnpm vitest run src/apps/Presence
```

```bash
git add src/apps/Presence/presenceAi.ts \
        src/apps/Presence/__tests__/presenceAi.test.ts \
        $(grep -rl "import.*from.*presenceAi" src/ | grep -v __tests__)
git commit -m "refactor(presence): explicit personaId param in presenceAi

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: 全局 grep 验证 high-risk 列表已全部修复

**Files:**
- 仅做查询验证

- [ ] **Step 13.1: 列出 spec §5.1 的高危点**

```bash
grep -n "getActivePersona" src/platform/ai/heartbeatRegister.ts src/platform/ai/heartbeatAgent.ts src/platform/ai/characterMemoryCompression.ts src/platform/ai/aiChatEngine.ts src/platform/userApp/sdk/ai.ts src/platform/ai/memoryWriter.ts src/apps/Presence/presenceAi.ts 2>/dev/null
```

Expected: **没有任何输出**，或仅在 dispatcher 入口（Task 7-12 中标注为"读 active 是合理的"的位置）。

- [ ] **Step 13.2: 写一条 lint-style 测试锁定**

```typescript
// src/platform/identity/__tests__/no-active-persona-leak.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const ALLOWLIST = new Set([
  // dispatcher 入口允许读 active persona
  'src/platform/ai/heartbeatAgent.ts',           // 仅 dispatcher 处
  'src/platform/ai/characterMemoryCompression.ts', // 仅 installAutoCompression
  'src/platform/userApp/sdk/ai.ts',               // 仅 ChatSession 创建处
  // UI 即时交互层，active persona 是正确语义
  'src/apps/Settings/SettingsHome.tsx',
  'src/apps/Settings/pages/PersonaPage.tsx',
  'src/apps/Settings/pages/PromptViewerPage.tsx',
  'src/apps/XingYu/tabs/ContactsTab.tsx',
  'src/apps/XingYu/tabs/ChatListTab.tsx',
  'src/apps/XingYu/pages/ChatDetail.tsx',
  'src/apps/XingYu/pages/ContactSelect.tsx',
  // tests
]);

const HIGH_RISK_PATHS = [
  'src/platform/ai/heartbeatRegister.ts',
  'src/platform/ai/memoryWriter.ts',
  'src/apps/Presence/presenceAi.ts',
  'src/platform/ai/aiChatEngine.ts',
];

describe('persona context leak prevention', () => {
  it('high-risk files do not call getActivePersona', () => {
    const violations: string[] = [];
    for (const path of HIGH_RISK_PATHS) {
      const src = readFileSync(path, 'utf8');
      if (/getActivePersona\b/.test(src)) {
        violations.push(path);
      }
    }
    expect(violations).toEqual([]);
  });
});
```

- [ ] **Step 13.3: 跑测试**

```bash
pnpm vitest run src/platform/identity/__tests__/no-active-persona-leak.test.ts
```

Expected: PASS。

- [ ] **Step 13.4: Commit**

```bash
git add src/platform/identity/__tests__/no-active-persona-leak.test.ts
git commit -m "test(identity): lint-style guard against active-persona regression

High-risk modules (heartbeat / memoryWriter / presenceAi / aiChatEngine)
must never read getActivePersona; they receive personaId from caller.
This test fails if anyone reintroduces the leak.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: 全量回归 + 准备 PR

- [ ] **Step 14.1: 跑全量测试**

```bash
pnpm test
```

Expected: 全部 PASS。如有失败：定位是真 bug 还是 test fixture 落后于新 API，分别处理。

- [ ] **Step 14.2: build 验证**

```bash
pnpm build
```

Expected: 成功。

- [ ] **Step 14.3: 手动冒烟（关键流）**

启动 dev：`pnpm dev`，依次验证：
1. 跟一个 char 单聊正常发收
2. 心跳触发后 AI 主动给玩家发消息（等几分钟）
3. AI 朋友圈自动生成（presenceAi 链路）
4. 历史压缩自动触发（聊天满 keepRecentMessages 后）
5. AI-AI 自动聊天（aiChatEngine）

每条流程行为应与改前完全一致（单 persona 行为不变）。

- [ ] **Step 14.4: PR 描述**

PR title: `refactor(persona): thread explicit personaId through AI backend flows`

PR body：
```markdown
## Summary
- Introduce `getPersonaById(id)` / `getActivePersonaId()` helpers in `src/platform/identity/`
- Add `AppSystemPromptCtx { characterId, personaId }` to AppSystemPromptFn signature
- Heartbeat / compression / aiChatEngine / userApp SDK / memoryWriter / presenceAi now take `personaId` as explicit parameter
- Lint-style test guards against regression

## Why
Spec `docs/superpowers/specs/2026-05-01-multi-persona-sim-card-design.md` §5.1 — these modules currently use `getActivePersona()` as a proxy for "the conversation partner". This is fine with one persona but will silently corrupt cross-persona memory once multi-persona ships. This PR fixes the latent bug independently of multi-persona enablement.

## Test plan
- [x] All unit tests pass
- [x] Lint-style guard test (`no-active-persona-leak.test.ts`)
- [x] Build succeeds
- [x] Manual smoke: chat / heartbeat / presence / compression / AI-AI chat behavior unchanged
- [x] Single-persona behavior is byte-identical to before

## Refs
- Spec: docs/superpowers/specs/2026-05-01-multi-persona-sim-card-design.md
- Tracker: docs/plan/2026-05-01-2322-M-Persona-overview.md
```

- [ ] **Step 14.5: Push branch**

不主动 push，等用户审完再决定。

---

## 自检（Self-Review）

- [x] **Spec coverage**：spec §5.1 列的 8 个高危点全部 covered（Task 7-12 + Task 5 内联）。spec §6 PR1 章节描述的"显式 personaId"被实现。
- [x] **Placeholder scan**：每步都给了具体代码或具体命令，无 TBD / TODO。
- [x] **Type consistency**：`AppSystemPromptCtx` / `getPersonaById` / `runHeartbeat(characterId, personaId, signal)` / ChatSession.personaId 在前后 task 命名一致。
- [x] **Scope check**：所有改动都属于"显式 personaId 入参 + lint guard"，不引入多 persona 任何能力。

## Risk

| 风险 | 缓解 |
|---|---|
| Task 11 的 buildCtx caller 上溯链可能比预期长 | 真触发时单独评估；如果链超过 3 层往上传 personaId 不优雅，考虑把 buildCtx 调用移到入口附近 |
| `'me'` 字面量仍存在（PR2 处理）— 跟 ctx.personaId 共存期间是否会有 confusion | 不会。Task 中明确标注 PR2 范围；当前 PR 仅处理 active-persona 误用 |
| heartbeatRegister 测试需要新增 ctx-based 断言但没有现成 fixture | Task 6 给出完整 test 代码模板，照抄即可 |
