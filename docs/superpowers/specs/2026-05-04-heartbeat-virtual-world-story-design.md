# 心跳经历 · Design

**Date:** 2026-05-04
**Status:** spec
**Scope:** 心跳触发时，为开启该功能的角色先生成一段发生在小手机外的离线经历，写入角色记忆，并让同一次心跳后续行为立刻感知这段新经历。

## Context

当前心跳系统已经迁入 Tool Registry。心跳触发后，`heartbeatAgent` 会组装角色完整上下文，进入工具循环，让角色查看未读、发消息、发动态、写备忘录、和其他角色聊天等。

现有心跳记忆分两类：

- 工具执行结果通过 `ToolResult.memoryEvents` 生成确定性的 `[自主活动记录]`，再由隐藏 `heartbeat_log` 写入 `characterMemoryStore`。
- 手机内可见行为，例如主动消息、星球动态、AI-AI 聊天，通过各自链路写入 XingYu 数据和角色记忆。

本需求新增第三类记忆：**经历**。它不是手机内行为，不对应任何 App 工具，也不显示为聊天气泡。它代表角色在两次心跳之间于小手机外生活中发生的真实生活片段，用来让角色像真人一样拥有持续经历、增量记忆和可自然提起的谈资。

这会成为 `src/platform/ai/CLAUDE.md` 中“心跳工具 memoryEvents 必须确定性”的明确例外：工具行为日志继续保持确定性；经历是一个独立的、开关控制的 LLM 生成阶段，不归入工具 `memoryEvents`。

## User Requirements

1. 心跳触发后第一件事是让角色生成一段故事：从上次心跳到这次心跳之间发生了什么。
2. 故事不是发生在小手机里，而是角色在小手机外的生活经历。
3. 生成的经历完整记入角色记忆，使 AI 角色像真人一样有故事、有增量记忆，因此之后言之有物。
4. 这段故事要立刻影响同一次心跳后续工具决策。
5. 每个角色独立开关，默认关闭。
6. 故事风格是“日常为主，偶尔剧情”，但剧情中不能包含用户和其他 AI 角色。
7. 生成故事必须参考角色完整上下文，包括角色设定、世界书、结构化长期记忆、近期原始记忆和当前时间。
8. 故事隐藏在聊天 UI 中，不显示为聊天气泡，但能在记忆结构或调试视图看到。
9. 生成失败不阻断心跳后续流程，只记录心跳错误日志并继续现有工具循环。
10. 风格要求：更具体，少抒情；不要流水账，也不要悬疑感过强；每天应留下能后续自然聊起的轻量谈资。
11. 长度规则：1 天约 300 中文字符，每多 1 天增加 300 字，最多 1000 字；不足 1 天仍写约 200-300 字的具体片段。

## Key Decisions

| # | Decision | Choice | Reason |
|---|---|---|---|
| D1 | 执行方式 | 心跳工具循环前置一个独立故事生成阶段 | 能保证“第一件事”发生，且成功写入后同一次心跳重新读到新记忆 |
| D2 | 开关粒度 | `HeartbeatCharacterConfig` 增加 per-character 开关，默认 `false` | 不同角色可以独立决定是否拥有离线生活 |
| D3 | 存储方式 | 用隐藏 `heartbeat_log` 复用 `_appendMessage(msg, 'heartbeat')` 写入记忆 | 保持 UI 隐藏、IDB 持久化、Prompt Viewer 可见、压缩链路自动接入 |
| D4 | 记忆内容形态 | 程序包裹元数据，模型只生成正文 | 避免模型伪造标签和时间跨度 |
| D5 | Prompt 上下文 | 使用角色完整上下文，并给 prompt 组装器增加明确的 narrative 输出模式 | 既保持记忆连续性，又避免普通工具 JSON 回复格式污染故事输出 |
| D6 | 同次心跳感知 | 故事写入后重新读取 `characterMemoryStore` 并组装工具循环 prompt | 让后续发消息、发动态、写备忘录等行为能基于刚发生的经历 |
| D7 | 失败策略 | 故事生成失败不阻断心跳 | 心跳自主行为比故事生成更基础，不能因单步失败整次失效 |
| D8 | 与工具 memoryEvents 关系 | 明确分离 | 工具日志仍确定性；经历是独立 LLM 生成记忆 |

## Architecture

### 1. Settings

`HeartbeatCharacterConfig` 新增字段：

```ts
virtualWorldStoryEnabled: boolean;
```

默认配置为：

```ts
virtualWorldStoryEnabled: false;
```

`HeartbeatSettingsPage` 的每个角色配置卡片中新增一个开关，例如“经历”。关闭时心跳完全保持现有行为；开启时才执行前置故事生成。

### 2. Story Generation Module

新增平台层模块，建议位置：

```text
src/platform/ai/heartbeatVirtualWorldStory.ts
```

职责：

- 计算故事时间跨度和目标长度。
- 基于角色完整上下文组装故事生成 prompt。
- 调用 `chatComplete`。
- 清理输出，拒绝空结果。
- 写入隐藏 `heartbeat_log`。
- 抛出或返回结构化错误，由 `heartbeatAgent` 记录日志并继续。

它不执行任何工具，不修改未读状态，不创建动态，不写备忘录。

### 3. Prompt Assembly Strategy

故事生成需要完整上下文，但不能使用心跳 Tool Registry 的 JSON 工具协议。实现时给 `PromptInput` 增加明确的输出模式更稳：

```ts
responseMode?: 'structured-actions' | 'narrative';
```

默认值为 `structured-actions`，保持现有聊天、心跳工具循环和 user app 行为不变。`responseMode: 'narrative'` 时：

1. 复用与 `heartbeatAgent` 相同的数据源：角色卡、persona、世界书、`characterMemoryStore`、结构化 `memoryState`、当前时间、设备上下文。
2. `assemblePrompt` 跳过 `[回复格式]`、`[可用动作]`、`[当前任务]` 等 App 协议块。
3. 在最终 user turn 中加入专用任务指令，要求模型只输出经历正文。
4. 继续保留 system block、状态层、长期记忆、历史记录和 post-history 当前时间。

选择修改 `assemblePrompt` 而不是在故事模块手写整套 messages，是因为完整上下文已经由 prompt 组装器维护；手写容易遗漏结构化记忆、历史裁剪或未来新增的上下文层。

### 4. Memory Write

生成成功后，程序构造隐藏消息：

```ts
const msg: Message = {
  id: uid(),
  convId: `c-char-${characterId}`,
  senderId: `char-${characterId}`,
  type: 'heartbeat_log',
  text: [
    '[经历]',
    `时间跨度：${fromLabel} 至 ${toLabel}`,
    '',
    story.trim(),
  ].join('\n'),
  timestamp: Date.now(),
};
_appendMessage(msg, 'heartbeat');
```

`buildMemoryEntry` 对 `heartbeat_log` 当前会包装为：

```text
[自主活动记录]
<msg.text>
```

实现时必须让 `buildMemoryEntry` 识别 `[经历]` 并渲染成更清晰的：

```text
[经历]
时间跨度：...
...
```

这样可以避免经历被嵌在 `[自主活动记录]` 里造成语义混淆。现有不带 `[经历]` 前缀的 `heartbeat_log` 继续走 `[自主活动记录]`。

## Data Flow

开启经历后的一次心跳：

```text
triggerHeartbeat / scheduler tick
  ↓
runHeartbeat(characterId)
  ↓
读取角色心跳配置
  ↓
如果 virtualWorldStoryEnabled=true:
  生成经历
  写入隐藏 heartbeat_log + characterMemoryStore
  失败则 pushLog(error) 并继续
  ↓
重新读取 characterMemoryStore 最新 entries
  ↓
组装现有 heartbeat Tool Registry prompt
  ↓
运行工具循环
  ↓
工具 memoryEvents 写入现有 [自主活动记录]
```

关键点：故事写入必须发生在工具循环 prompt 组装之前；写入后重新读取 `characterMemoryStore` 并组装工具循环 prompt。这样同一次心跳的工具决策才会看到刚新增的经历。

## Story Prompt

故事生成的核心任务指令：

```text
你现在要补全一段“从上次心跳到这次心跳之间”发生在你小手机外生活中的经历。

这不是聊天回复，不是发给用户的消息，也不是发生在小手机里的行为记录。
这段内容会作为你的真实经历写入长期记忆。之后你会自然记得它，并可以在合适的时候把它当作谈资、心情来源或行动背景。

时间跨度：
{lastStoryTime} 到 {now}
约 {elapsedDays} 天

写作要求：
- 使用第一人称“我”。
- 必须基于你的完整上下文生成：角色设定、世界书、长期记忆、近期记忆、当前时间都会影响这段经历。
- 故事发生在你的小手机外生活中，不发生在手机 App、聊天窗口、朋友圈、备忘录等小手机系统里。
- 不要让用户出现在事件中。
- 不要让其他 AI 角色出现在事件中。
- 不要替用户或其他角色新增事实、承诺、情绪或行动。
- 日常为主，偶尔可以有小剧情，但不要写成悬疑、冒险或大事件。
- 不要写流水账。不要平均描述一整天。
- 每天只选择 1 个最值得记住的小事件，多个日期可以合并成 2-4 个片段。
- 事件要具体，有地点、行动、物品、过程和结果。
- 每段至少留下一个“以后能聊起来”的谈资：一次试错、一个新发现、一个小麻烦、一个具体选择、一个没完成的小计划、一个让你之后可能再提起的物件或经历。
- 情绪可以存在，但不要用大段抒情解释情绪；让情绪通过行动和细节体现。
- 不要写标题，不要 markdown，不要 JSON，不要解释你在执行任务。
- 只输出经历正文。

长度要求：
写约 {targetChars} 个中文字符。
计算规则：1 天约 300 字，每多 1 天增加 300 字，最多 1000 字。
如果时间不足 1 天，仍写一个约 200-300 字的具体片段。

好的谈资示例：
- 试了一种奇怪但具体的饮料，后来影响了晚饭做法。
- 去了一个新地方，发现它和预期不一样。
- 买错、走错、修坏、忘带、临时改变计划，但结果留下了一个具体后续。
- 学到一个小知识，或决定明天继续处理某件小事。

不好的写法：
- 只写打扫、吃饭、散步、看书，没有后续可聊点。
- 连续堆旧地图、怀表、神秘花瓣这类强剧情物件。
- 大段写“我有点难过/释然/孤独”，但没有具体事件。
```

模型只输出正文。`[经历]`、时间跨度和其他元数据由程序写入。

## Time Span And Length

时间跨度来源优先级：

1. 该角色上一条 `[经历]` 记忆的时间戳。
2. 若不存在，使用本次心跳启动前捕获的 `previousLastHeartbeat`。
3. 若仍不存在，使用当前时间往前推一个心跳间隔。

注意：当前 `launchCharacterHeartbeat` / `triggerHeartbeat` 会在调用 `runHeartbeat` 前写入 `setLastHeartbeat(characterId, Date.now())`，这是为了避免重复触发。因此实现时不能在故事模块里直接读取 `heartbeatStore.lastHeartbeat[characterId]` 作为“上次心跳”。应在覆盖之前捕获旧值并传入 `runHeartbeat`，或等价地调整调用顺序但保持防重入语义。

目标长度：

```ts
const elapsedDays = Math.max(1, Math.ceil(elapsedMs / DAY_MS));
const targetChars = Math.min(1000, elapsedDays * 300);
```

不足一天时仍生成约 200-300 字，避免过短导致没有谈资。

## Error Handling

- API Key 缺失：保持现有心跳逻辑，整个心跳已会记录“未配置 API Key”并返回。
- 故事生成 API 失败：`pushLog({ action: 'virtual_story_error', detail })`，继续工具循环。
- 输出为空：视为故事生成失败，不写记忆，继续工具循环。
- 输出疑似 JSON 或包含 markdown 标题：实现阶段可做轻量清理，但不需要复杂审核器。
- Abort：如果心跳被中断，故事生成中断后不写记忆，后续流程按现有 abort 逻辑退出。

## Testing

新增或扩展单测：

1. `heartbeatStore` 默认配置中 `virtualWorldStoryEnabled` 为 `false`。
2. 设置页每个角色卡片能独立开关经历。
3. 开关关闭时，`triggerHeartbeat` 不调用故事生成模块。
4. 开关开启时，故事生成发生在工具循环第一次 `chatComplete` 之前。
5. 故事写入后，同一次工具循环的 prompt 包含 `[经历]`。
6. 故事生成失败时，仍继续现有工具循环。
7. `buildMemoryEntry` 对经历隐藏日志生成清晰记忆文本。
8. `ChatDetail` 继续隐藏 `heartbeat_log`，不显示故事气泡。
9. 长度计算：1 天 300、2 天 600、4 天 capped 到 1000。

## Non-goals

- 不做可见日记 UI。
- 不做故事质量二次 LLM 审核。
- 不让故事生成阶段调用工具。
- 不在故事中创建手机内动态、备忘录或聊天消息。
- 不引入向量检索。
- 不让用户或其他 AI 角色参与经历事件。

## Documentation Notes

实施阶段需要同步更新：

- `src/platform/ai/CLAUDE.md`：记录经历是心跳工具确定性 memoryEvents 规则之外的独立例外。
- 如新增 `src/platform/ai/AGENTS.md` 不必要；现有 `CLAUDE.md` 已覆盖 AI 基建踩坑。
- 按项目规范，代码实施前还需要写 `docs/plan/yyyy-mm-dd-hhmm-计划名.md`，记录实施步骤和关键决策。
