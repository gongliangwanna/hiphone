# 历史记录转为 System Transcript

**状态：** 需求定稿，待他人实现
**作者：** 产品 + Claude（brainstorming skill）
**关联代码：** `src/platform/ai/promptAssembly.ts`、`src/platform/ai/characterMemoryCompression.ts`、`src/platform/ai/aiChatEngine.ts`

---

## 1. 背景与核心诉求

### 现状

`promptAssembly.assemblePrompt()` 把 memoryStore 的每条 `MemoryEntry` 渲染成 OpenAI 兼容的 `{role, content}` 消息，形如：

```
{role: 'system', content: '<systemBlock>'}
{role: 'user',   content: '小星星：你没名字吗'}
{role: 'assistant', content: '哈哈还没想好呢'}
{role: 'system', content: '切换到拍卖行'}
{role: 'system', content: '<postHistory>'}
```

### 问题

这种格式在语义上**暗示模型"你正在/曾经参与这段对话"**。当 history 里夹杂 app 切换、压缩摘要、群里其他 AI 的发言时，模型容易把它们当作"我正在进行的对话的一部分"，分不清哪些是**背景交代**、哪些是**此刻要回应的事**。

### 目标

把历史从"对话参与"改为"上下文交代"——history 以**单条 system 消息**注入，内部是带时间戳的 transcript；模型看到的应该是"**这些事发生过，现在轮到我反应**"。

---

## 2. 最终需求

### 2.1 消息数组新形态

`assemblePrompt()` 的输出改为如下顺序：

```
system #1  [稳定 systemBlock]
           角色卡 + worldbook + 格式指令 + sticker/tool 清单 + appSystemPromptSnapshot + ...
           （与当前一致，唯一能命中 KV 缓存的部分）

system #2  [长期记忆]                            ← 可选
           <长期记忆文本>
           （memoryStore 中存在 compressed entry 时才生成；否则整条省略）

system #3  [历史记录]                            ← 新增，核心改动
           [HH:MM] <speakerLabel>：<content>
           [HH:MM] <speakerLabel>：<content>
           [HH:MM] <content>                    ← role=system 无 speaker
           ...
           （若无活 entry，整条省略）

system #4  [post-history]
           [当前时间：YYYY年M月D日 星期X HH:MM]
           <deviceContext>
           <postHistoryInstructions>
           <[当前场景] 你正在和X私聊...>         ← AI-AI 路径专用，由调用方传入

user       <speakerLabel>：<content>            ← 可选，见 2.4
```

### 2.2 system #3 —— 历史记录 transcript

**容器前缀：** 首行固定为 `[历史记录]`，下一行开始逐条渲染。

**每行格式：**

```
[HH:MM] <speakerLabel>：<content>     // role=user 或 role=assistant
[HH:MM] <content>                     // role=system，无 speaker 前缀
```

**时间戳：**
- 来源：`MemoryEntry.createdAt`（ms wallclock）
- 格式：`HH:MM`（24 小时制，本地时区），通过 `String(n).padStart(2,'0')` 补零
- 不含日期——跨天场景由压缩机制（长期记忆）化解，本次不引入日期前缀

**speakerLabel 解析规则：**

| entry | speakerLabel |
|---|---|
| `role === 'assistant'` | `'我'`（当前角色第一人称） |
| `role === 'user'`, `speakerId === 'me'` | `persona.name`（当前激活的玩家 persona 名） |
| `role === 'user'`, `speakerId === <otherCharId>` | `charactersById.get(speakerId)?.name ?? speakerId`（其他 AI 角色） |
| `role === 'system'` | `null`（不输出前缀） |

**连接符：** 统一用中文全角 `：`，与 `buildMemoryEntry` 中 `[引用 X：Y]` 风格一致。

**content 不做二次加工：** memoryStore 里的 `content` 已经是 `buildMemoryEntry` 拍平后的文本，可能包含：
- `[图片 <url>]`
- `[表情：<描述>]`
- `[引用 <speakerName>：<preview>] <主文>`
- `[转发的聊天记录：<标题>]\n- <sender>：<body>\n...\n[/转发结束]`（多行）
- `[自主活动记录]\n<text>`（多行）
- `[上下文切换] 用户从 X 切到了 Y`
- `[格式错误] ...`（parse-fail 重试机制写入的 system entry）

transcript 行**原样**拼接这些 content，不做转义/折行/重排。多行 content 会让单条 entry 占多行；下一条以 `[HH:MM]` 开头，模型可自然识别边界。

### 2.3 system #2 —— 长期记忆（可选）

**触发条件：** `memoryStore.getAll(characterId)` 中存在任一 `entry.compressed === true` 的条目。

**内容：** 该条目的 `content`（前缀已是 `[长期记忆]\n...`，见 §3）。

**数量保证：** memoryStore 中任意时刻**最多只有 1 条** `compressed` entry（需修复现有 bug，见 §3）。

**位置：** 恒定排在 system #1 之后、system #3 之前。

**注意：** 长期记忆条目**不再**出现在 system #3 transcript 中——它已被独立抽出。渲染 transcript 时跳过 `compressed: true` 的 entry。

### 2.4 user turn —— 按最后一条 entry 的 role 决定

**规则：**

```pseudo
let live = memoryEntries.filter(e => !e.compressed)
let last = live[live.length - 1]

if (last && last.role === 'user'):
    transcript 渲染 live[0..n-2]
    user turn 存在：content = `${speakerLabel}：${last.content}`
    （speakerLabel 按 §2.2 规则；连接符同样是 `：`；不带 [HH:MM]）

else if (last && last.role === 'system'):
    transcript 渲染 live[0..n-1]（包含最后这条 system）
    不生成 user turn，messages 以 system #4 (post-history) 结尾

else if (last && last.role === 'assistant'):
    // 理论上不会作为触发态出现；保守处理同 system 分支
    transcript 渲染 live[0..n-1]
    不生成 user turn

else (live.length === 0):
    不生成 system #3，不生成 user turn
```

**覆盖场景：**

| 场景 | 最后一条 entry | 效果 |
|---|---|---|
| 玩家发消息 | `role=user, speakerId='me'` | user turn = `小星星：你好` |
| AI-AI 对方刚回 | `role=user, speakerId=otherCharId` | user turn = `另一个角色：...` |
| App 切换触发（`injectSystemEvent`） | `role=system` | 留在 transcript 末行，以 system 收尾 |
| Heartbeat 触发（多数） | `role=system` | 同上 |

**理由：** OpenAI 兼容 API 不强制 user 结尾（当前代码就经常以 `post-history` system 收尾，运行正常）。只有"真有新输入"时才用 user role，语义最清晰，且不改任何调用方契约。

### 2.5 AI-AI 场景调整

`src/platform/ai/aiChatEngine.ts:145-149` 当前在 `assemblePrompt()` 返回后额外 push：

```ts
chatMessages.push({
  role: 'system',
  content: `[当前场景] 你正在和${other.name}私聊。请直接回复${other.name}。`,
});
```

新设计下 user 必须是最后一条（或以 system #4 收尾），不能在外部追加。改法：

1. `assemblePrompt` 的 `PromptInput` 新增字段 `extraPostHistory?: string`（或复用既有 `deviceContext` 拼接）
2. `aiChatEngine` 通过该字段传入 `[当前场景]...` 文案
3. `assemblePrompt` 将其拼入 system #4 post-history 末尾
4. 删除外部 `chatMessages.push(...)`

具体字段名由实现方拍板，但**语义必须是"进 system #4，不破坏 user/end 位置"**。

### 2.6 Trim / 压缩交互

- `trimMemoryToFit()` 的逻辑不变（基于 token 预算从前往后砍），继续在 entry 级别运行。
- 压缩条目（`compressed: true`）**不参与 transcript 的 token 计算**，但它本身作为 system #2 贡献的 token 要计入 system 块预算。
- `keepRecentMessages` 含义不变：保留最近 N 条活 entry 不被 trim。
- `historyTokenRatio` 计算口径不变（只看非压缩 entry 的预 trim 总 token）——这是触发下一轮压缩的信号。

### 2.7 多模态内容

memoryStore 现存储纯文本，`[图片 <url>]` 以 URL 形式出现在 content 中。新设计下 transcript 仍是**纯文本 message**（`ChatMessage.content: string`），不产出 `ContentPart[]` 多模态数组。若后续要恢复 vision multimodal，需要另行设计——不在本次范围。`PromptInput.aiConfig.enableVision` 字段在本次中**不被 transcript 渲染路径消费**；若当前代码里没有其他真实消费点，实现方可顺手加 TODO 注释或直接在 release notes 里写明"vision 暂不支持"。

---

## 3. 长期记忆 bug 修复（同一 plan 内一起做）

### 3.1 Bug 描述

`src/platform/ai/characterMemoryCompression.ts:71-72`：

```ts
const compressStartIdx = entries.findIndex((e) => !e.compressed);
```

跳过了旧的 `compressed` entry，导致 `replaceRange(startId, endId, summary)` 只替换"活 entry 区间"，旧的压缩条目**不会被删除**。跑 N 次压缩后 memoryStore 里会累积 N 条 `compressed: true` entry，每条都被下一次压缩通过 `previousSummary` 参数吸收进内容，所以最新那条是超集，旧的都是冗余。

### 3.2 修复

修改 `doCompression` 的范围计算：

```ts
// 旧：只从第一条非压缩 entry 开始
// 新：从第 0 条开始——如果存在旧压缩 entry，它就是第 0 条，会被一起替换掉
const compressStartIdx = 0;
```

效果：
- 每次压缩后，memoryStore 中 `compressed: true` 的 entry **永远 ≤ 1 条**
- `previousSummary` 的传递逻辑不变（仍通过 `entries.reverse().find(e => e.compressed)?.content` 读取）
- summarizer 无需改动，新摘要语义上仍是"旧摘要 + 新对话"的融合

### 3.3 术语变更

当前压缩 entry 的 content 前缀是 `[之前的对话摘要]\n...`，语义上其实是"长期记忆"（不只是对话摘要——它会持续吸收后续对话）。统一改名：

| 位置 | 旧 | 新 |
|---|---|---|
| `characterMemoryCompression.ts` entry content | `[之前的对话摘要]\n${summaryText}` | `[长期记忆]\n${summaryText}` |
| `promptAssembly.ts` inspectPrompt 侧的检测 | `startsWith('[之前的对话摘要]')` | `startsWith('[长期记忆]')` |
| Prompt Viewer UI label | `历史摘要` | `长期记忆` |

summarizer 自身不读前缀，无需改动。

---

## 4. 影响范围

### 直接改动

- `src/platform/ai/promptAssembly.ts`
  - 新增 transcript 渲染函数；现有 `renderMemoryToChatMessages` 可直接替换（无需保留旧实现，没有外部消费者需要兼容）
  - `assemblePrompt` 的 messages 组装逻辑按 §2.1 重排
  - `PromptInput` 新增 AI-AI 场景用的 extra post-history 字段
  - `inspectPrompt` 同步更新（prompt viewer UI 看到的 section 定义变了）
- `src/platform/ai/characterMemoryCompression.ts`
  - §3.2 的范围修复
  - §3.3 的前缀改名
- `src/platform/ai/aiChatEngine.ts`
  - 删除外部 `chatMessages.push({role:'system', ...})`，改走新 `PromptInput` 字段

### 间接/自动适配

三条 AI 调用路径都走 `assemblePrompt`，自动继承新格式，无需各自改动：

- **XingYu 1-on-1**（`xingYuDataStore.ts` → `session.replyToLast()`）
- **AI-AI 对话**（`aiChatEngine.ts`，仅 §2.5 那一处手动挪）
- **Heartbeat Agent**（`heartbeatAgent.ts`，其 `formatOverride` 只影响 system #1 的 format chunk，不影响 history 渲染）

### 测试影响（需要更新的 snapshot / 断言）

- `src/platform/ai/__tests__/promptAssembly.render.test.ts` —— 大量 message 形态断言要改
- `src/platform/ai/__tests__/m4.2.e2e.test.ts` —— 端到端 prompt 断言
- `src/platform/ai/__tests__/characterMemoryCompression.test.ts` —— entry 数量断言 + 前缀断言
- `src/platform/ai/__tests__/summarizer.test.ts` —— 若涉及前缀，跟进
- `src/platform/userApp/sdk/__tests__/ai.session.test.ts` —— 若涉及 message 形态
- `src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts` —— 若断言具体 message 结构
- 新增 `renderMemoryToTranscript`（或等价实现）的单测，覆盖：
  - 每种 role 的行格式
  - 最后一条 role 决定 user turn 的四种分支
  - 长期记忆被抽走、不出现在 transcript
  - 多条 compressed entry 时（过渡状态容忍）只取最新一条
  - 空 memoryStore / 仅 compressed entry 的退化场景

---

## 5. 非目标 / 本次不做

- **不引入日期前缀**（跨天的 `[04-20 14:30]` 之类）——短期内由压缩化解
- **不改 SDK 外部契约**（`chatWithCharacter` / `session.send` / `session.replyToLast` / `injectSystemEvent` 对调用方的签名和语义不变）
- **不改 memoryStore 数据结构**（`MemoryEntry` shape 不动）
- **不改 replyParser / toolRegistry**（这些是 M4.2.5 做的事）
- **不做 multimodal/vision 适配**（见 §2.7）
- **不改 summarizer 内部逻辑**（只换前缀名和压缩触发的范围）

---

## 6. 验收标准

- [ ] 所有现有单测 + E2E 通过（更新断言即可）
- [ ] 新增 transcript 渲染的单测覆盖 §2.2 / §2.4 全分支
- [ ] 实际跑一次 XingYu 聊天，prompt viewer 能看到：
  - `[长期记忆]` 作为独立 section
  - `[历史记录]` 带时间戳的 transcript
  - user turn 仅在玩家刚发消息时存在、且内容 = `<persona>：<玩家输入>`
- [ ] 压缩触发多次后，memoryStore 中 `compressed: true` 条目始终 ≤ 1
- [ ] AI-AI 场景的 `[当前场景]` 提示出现在 system #4 末尾、不破坏 user 结尾约定

---

## 7. 决策记录

本节记录 brainstorm 中讨论过但最终没采用的方案及理由，帮助实现方理解"为什么是这样"。

**不采纳：把 history 塞进主 system block。**
理由：会让 system #1 每轮都变，彻底废掉 KV 缓存——`src/platform/ai/CLAUDE.md` 明确要求 system 稳定。拆成独立 system #3 让 #1 保持稳定。

**不采纳：W2 架构（`send(content)` 不 pre-append，content 作为参数传入）。**
理由：`replyToLast` / heartbeat / AI-AI 路径天然没有"新参数 content"，会迫使实现一个"从 memoryStore 最后一条派生 trigger"的辅助函数，绕回 W1。且改动面波及整个 SDK。保持"memoryStore 是唯一事实源，触发态永远是最后一条"的既有约定。

**不采纳：把 `[此刻]` 锚点塞进 post-history，完全不要 user turn。**
理由：当有真实玩家输入时，用 user role 区分"此刻被这句话问话"在语义上最清晰。只有没有新输入（system 事件触发）时才退化为 system 结尾。

**不采纳：多条 `compressed` entry 在 system #2 合并显示。**
理由：长期记忆本应单条（见 §3）。多条是 bug 的产物，不是要长期保留的形态。

**采纳：`我` 作为当前角色的第一人称 label。**
理由：符合产品直觉示例（`[00:01] 我：哈哈还没想好呢`），让角色读 transcript 时天然把 assistant 行识别为"我之前说过"。

**采纳：时间戳固定 `HH:MM` 而非 `HH:MM:SS` 或完整日期。**
理由：产品示例形态，节奏感足够，token 开销最小。
