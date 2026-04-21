# 历史记录转为 System Transcript — Design

**日期：** 2026-04-22
**状态：** 设计定稿，待写实现计划
**关联计划：** `docs/plan/2026-04-21-0131-history-as-system-transcript.md`（产品需求定稿文档，本 spec 在其基础上落实"由实现方拍板"的 4 个决策点）
**关联代码：** `src/platform/ai/promptAssembly.ts`、`src/platform/ai/characterMemoryCompression.ts`、`src/platform/ai/aiChatEngine.ts`、`src/apps/Settings/pages/PromptViewerPage.tsx`

---

## 1. 背景

Plan 文档 (`2026-04-21-0131-history-as-system-transcript.md`) 已定稿产品需求：把 memoryStore 渲染从"user/assistant 交替 messages"改为"**单条 system 消息 transcript**"，并顺手修 `characterMemoryCompression.ts` 的长期记忆累积 bug + 前缀改名。本 spec 解决 plan §2.5/§4 等处遗留的"由实现方拍板"项，不改产品需求。

### 需求要点（来自 plan，不复述细节）
- 新 messages 形态：`system #1 稳定 | system #2 [长期记忆] | system #3 [历史记录] | system #4 post-history | user turn (可选)`
- transcript 行格式：`[HH:MM] <speakerLabel>：<content>`（role=system 无 speaker）
- user turn 仅在"最后一条活 entry 是 role=user"时生成
- 压缩 bug：`compressStartIdx = 0`（不跳过旧压缩 entry）
- 前缀改名：`[之前的对话摘要]` → `[长期记忆]`

---

## 2. 实现决策

### 2.1 AI-AI 场景注入 → `PromptInput.sceneHint`

**决策：** 在 `PromptInput` 新增字段 `sceneHint?: string`，语义窄，专用于"场景级提示"。

```ts
export interface PromptInput {
  // ... 既有字段
  /** 场景级提示词，拼在 post-history 末尾。AI-AI 路径用来传 [当前场景]。 */
  sceneHint?: string;
}
```

- `assemblePrompt` / `inspectPrompt` 在 `buildPostHistory` 之后（时间锚、deviceContext、postHistoryInstructions 之后）把 `sceneHint` 拼入 system #4 末尾
- `aiChatEngine.ts:145-149` 的外部 `chatMessages.push(...)` 删除，改为在 `assemblePrompt` 入参里传 `sceneHint: '[当前场景] 你正在和${other.name}私聊。请直接回复${other.name}。'`
- 未来若有群聊 / 多人场景要复用，继续使用该字段；通用化需求出现前不拓宽语义

**不采纳：** 复用 `deviceContext`（语义污染）；通用 `extraPostHistory`（语义太宽易滥用）。

### 2.2 Transcript 渲染函数：`renderMemoryToTranscript`

**决策：** 新建 `renderMemoryToTranscript`，直接替换 `renderMemoryToChatMessages`（删除旧函数，无外部消费者需要兼容）。

```ts
export interface TranscriptRenderResult {
  /** system #2 内容，含 `[长期记忆]\n...` 前缀；无压缩 entry 时为 null */
  longTermMemory: string | null;
  /** system #3 内容，含 `[历史记录]\n` 首行 + N 行 transcript；无活 entry 时为 null */
  transcriptBlock: string | null;
  /** 最后一条活 entry 是 role=user 时，渲染为 user turn；否则 null */
  userTurn: ChatMessage | null;
}

export function renderMemoryToTranscript(
  entries: readonly MemoryEntry[],
  ctx: MemoryRenderContext,
): TranscriptRenderResult;
```

**实现要点：**
- 先分离 `compressed` entry（最新一条 → `longTermMemory`；渲染 transcript 时跳过所有 compressed）
- `live = entries.filter(e => !e.compressed)`
- 按最后一条 `live` entry 的 role 决定 `userTurn`：
  - `role === 'user'` → transcript 渲染 `live[0..n-2]`，`userTurn = { role:'user', content: '${speakerLabel}：${content}' }`（无 `[HH:MM]` 前缀）
  - `role === 'system' | 'assistant' | empty` → transcript 渲染全部，`userTurn = null`
- transcript 行格式：
  - `role='assistant'` → `[HH:MM] 我：<content>`
  - `role='user', speakerId='me'` → `[HH:MM] <persona.name>：<content>`
  - `role='user', speakerId=otherCharId` → `[HH:MM] <charactersById.get(speakerId)?.name ?? speakerId>：<content>`
  - `role='system'` → `[HH:MM] <content>`（无 speaker）
- `HH:MM`：本地时区，`String(n).padStart(2,'0')`
- content 原样拼接（多行 content 占多行，不折行不转义），下一条以 `[HH:MM]` 开头作为自然边界

### 2.3 `assemblePrompt` 装配

```
messages = [
  { role:'system', content: systemBlock },                // #1
  longTermMemory       ? { role:'system', content: longTermMemory }    : skip,  // #2
  transcriptBlock      ? { role:'system', content: transcriptBlock }   : skip,  // #3
  { role:'system', content: postHistory + optional sceneHint },        // #4
  userTurn             ? userTurn : skip,
]
```

- `system #4` 总是存在（时间锚恒在），`sceneHint` 若提供则拼在其末尾（以 `\n\n` 分隔）
- `tokenEstimate` 按新 message 列表重新累加
- `historyTokenRatio` 口径不变：基于"预 trim 的非压缩 entry content token 总和"与 `historyBudget` 的比值（见 plan §2.6）

### 2.4 `trimMemoryToFit` 保持不动

**决策：** 保留现有 `estimateTokens(content) + ROLE_OVERHEAD(=6)` 的按条计算公式，不因 transcript 合并改成 wrapper + 前缀成本模型。

**理由：**
- 现实差额 ~4 tok/entry（旧 role overhead 6 vs 新前缀成本 ~10），对 8K+ 历史预算是噪声级别
- `SAFETY_MARGIN = 0.9` 已兜底估算误差
- YAGNI，不扩散改动面

### 2.5 Token 成本小修

`assemblePrompt` 现在的 `tokenEstimate` 通过累加 `historyMessages.reduce(...)` 算历史部分。transcript 合并后该表达式自然适配（只 1-2 条 message），无需特殊处理。

### 2.6 `inspectPrompt` / Prompt Viewer sections

**决策：** 对齐新 messages 结构，切 4-5 个 section：

```
System 提示词 | 长期记忆（可选）| 历史记录（可选）| Post-history 指令 | 当前输入（可选）
```

- 无 `longTermMemory` → 跳「长期记忆」
- 无 `transcriptBlock` → 跳「历史记录」
- 无 `userTurn` → 跳「当前输入」（直接隐藏，不显示 empty state）
- 「历史记录」section 内容就是 raw `transcriptBlock`（含 `[历史记录]` 首行）；不再做 `[用户] / [助手]` 二次 prettify
- 删除现有 `historyMessages.find(startsWith('[之前的对话摘要]'))` 检测逻辑

`SECTION_ICONS` 更新：
```ts
const SECTION_ICONS = {
  'System 提示词': Brain,
  '长期记忆': FileText,
  '历史记录': MessageSquare,
  'Post-history 指令': Clock,
  '当前输入': Send,  // 新增 lucide 图标
};
```

（废弃 `历史摘要` 的映射；`聊天历史` 的 startsWith 判断移除。）

### 2.7 压缩修复（plan §3 落地）

`src/platform/ai/characterMemoryCompression.ts`：

- L71 `const compressStartIdx = entries.findIndex((e) => !e.compressed);` → `const compressStartIdx = 0;`
- L114 `content: '[之前的对话摘要]\n${summaryText}'` → `content: '[长期记忆]\n${summaryText}'`
- `previousSummary` 读取逻辑不变（`[...entries].reverse().find(e => e.compressed)?.content`）
- 效果：压缩后 `compressed: true` entry 永远 ≤ 1 条

---

## 3. 影响范围

### 直接改动
- `src/platform/ai/promptAssembly.ts`
  - 删除 `renderMemoryToChatMessages`，新增 `renderMemoryToTranscript` + `TranscriptRenderResult` 类型
  - `PromptInput` 新增 `sceneHint?: string`
  - `assemblePrompt` 装配顺序按 §2.3 重排
  - `buildPostHistory` 签名加入 `sceneHint` 参数（或在 assemblePrompt 内拼接）
  - `inspectPrompt` sections 切分按 §2.6 改写
- `src/platform/ai/characterMemoryCompression.ts` — §2.7 两处修改
- `src/platform/ai/aiChatEngine.ts` — 删除 L145-149 外部 push，改传 `sceneHint`
- `src/apps/Settings/pages/PromptViewerPage.tsx` — `SECTION_ICONS` 按 §2.6 更新

### 间接适配（自动继承，无需改动）
- XingYu 1-on-1（`session.replyToLast()` 走 `assemblePrompt`）
- Heartbeat Agent（`formatOverride` 不影响 transcript 路径）

### 测试（按 plan §4）
- `src/platform/ai/__tests__/promptAssembly.render.test.ts` — 消息形态断言大改
- `src/platform/ai/__tests__/m4.2.5.e2e.test.ts` — 端到端断言（plan 写作旧名 m4.2.e2e.test.ts，现已重命名）
- `src/platform/ai/__tests__/characterMemoryCompression.test.ts` — entry 数量 + 前缀断言
- `src/platform/ai/__tests__/summarizer.test.ts` — 若涉及前缀，跟进
- `src/platform/userApp/sdk/__tests__/ai.session.test.ts` — 若断言 message 形态
- `src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts` — 若断言 message 结构
- **新增** `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`，覆盖：
  - 4 种 role 的行格式（assistant/user-me/user-other/system）
  - userTurn 的 4 种分派分支（user last / system last / assistant last / empty）
  - 长期记忆抽离到 `longTermMemory`、不出现在 `transcriptBlock`
  - 多条 compressed entry 时只取最新一条（过渡状态容忍）
  - 空 memoryStore / 仅 compressed entry 的退化场景
  - `HH:MM` 补零、本地时区

---

## 4. 非目标（与 plan §5 一致）

- 不引入日期前缀（跨天由压缩化解）
- 不改 SDK 外部契约（`chatWithCharacter` / `session.send` / `session.replyToLast` / `injectSystemEvent` 签名语义不变）
- 不改 `MemoryEntry` shape
- 不改 `replyParser` / `toolRegistry`（M4.2.5 已定稿）
- 不做 multimodal/vision 适配（`aiConfig.enableVision` 暂无 transcript 消费点）
- 不改 `summarizer` 内部逻辑（只改前缀 + 压缩范围）

---

## 5. 验收标准

- [ ] 全部现有单测 + E2E 通过（更新断言后）
- [ ] `renderMemoryToTranscript` 新增单测覆盖所有分支
- [ ] 跑一次 XingYu 聊天，Prompt Viewer 能看到：
  - `[长期记忆]` 独立 section（仅当有压缩 entry）
  - `[历史记录]` 带 `[HH:MM]` 时间戳的 transcript
  - 玩家刚发消息时「当前输入」section 显示 `<persona>：<玩家输入>`
- [ ] 连续压缩多次后，memoryStore 中 `compressed: true` entry 始终 ≤ 1
- [ ] AI-AI 场景 `[当前场景]` 出现在 system #4 末尾；messages 数组不再出现孤立的外部追加 system

---

## 6. 决策记录汇总

| # | 决策点 | 选择 | 否决方案 |
|---|---|---|---|
| §2.1 | AI-AI 场景字段 | `sceneHint?: string`（专用） | `deviceContext` 混用（语义污染）、`extraPostHistory`（通用过宽） |
| §2.2 | 渲染函数命名 | 新建 `renderMemoryToTranscript`，删旧 | 保留旧名改内部（名字与现实不符）；并存（无必要） |
| §2.4 | Token 成本模型 | 保留 `+ ROLE_OVERHEAD` 不动 | 精确改（复杂度高收益小）；换常数 10（差异可忽略） |
| §2.6 | Viewer sections | 对齐 messages 5 section，无则隐藏 | 保留旧标签"聊天历史"（标签与内容脱节） |
