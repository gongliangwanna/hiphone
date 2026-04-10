# SillyTavern Prompt 组装管线深度拆解

调研日期：2026-04-10

## 关键结论

1. Prompt 组装不是简单拼接，而是一个 **10 阶段的流水线**，每阶段有独立的职责、Token 预算和位置控制。
2. 核心类是 `ChatCompletion`（Token 预算管理）、`PromptManager`（注入位置系统）、`MessageCollection`（嵌套消息容器）。
3. 注入位置分两种模式：**RELATIVE（相对）** 相对于角色定义区插入，**ABSOLUTE（绝对）** 在聊天历史的指定深度插入。
4. Token 预算采用 **先预留后填充** 策略：先预留控制提示和工具的空间，再用聊天历史填满剩余预算，溢出时裁剪最老消息。
5. 角色卡可以覆盖 `main`（系统提示）和 `jailbreak` 两个关键提示位，但可通过 `forbid_overrides` 锁定。

## 1. 整体架构

### 入口调用链

```
用户发送消息
  ↓
Generate('normal', {}, true)
  ↓
prepareOpenAIMessages({...})          ← 入口
  ├─ preparePromptsForChatCompletion  ← 阶段1: 收集所有 Prompt
  ├─ populateChatCompletion           ← 阶段2-11: 组装最终消息数组
  ├─ createGenerationParameters       ← 阶段12: 构造 API 请求参数
  └─ sendOpenAIRequest                ← 阶段13: 发送给 LLM
```

### 核心数据结构

```
Message {
  identifier: string
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | object[]    // 支持多模态
  name?: string
  tokens: number                // 异步计数
  tool_calls?: object[]
}

MessageCollection {
  identifier: string
  collection: (Message | MessageCollection)[]   // 可嵌套
  getChat(): ChatCompletionMessage[]            // 展平为 API 格式
  getTokens(): number                           // 总 Token
}

ChatCompletion {
  tokenBudget: number
  messages: MessageCollection
  overriddenPrompts: string[]

  setTokenBudget(context, response)   // 预算 = context - response
  reserveBudget(message | number)     // 预留空间
  freeBudget(message)                 // 释放预留
  canAfford(message): boolean         // 是否还有预算
  add(collection, position?)          // 插入消息
}
```

## 2. 阶段1: Prompt 收集 (preparePromptsForChatCompletion)

### 系统提示数组的组装顺序

按以下顺序创建 systemPrompts 数组，每项带有 `identifier` 标识：

| 序号 | Identifier | 来源 | 说明 |
| --- | --- | --- | --- |
| 1 | `worldInfoBefore` | World Info 系统 | 角色定义前的世界信息 |
| 2 | `charDescription` | 角色卡 `description` | 角色描述 |
| 3 | `charPersonality` | 角色卡 `personality` | 性格（通过 personality_format 格式化） |
| 4 | `scenario` | 角色卡 `scenario` | 情境（通过 scenario_format 格式化） |
| 5 | `worldInfoAfter` | World Info 系统 | 角色定义后的世界信息 |
| 6 | `impersonate` | 内置模板 | "以 {{user}} 视角写下一条回复" |
| 7 | `quietPrompt` | 系统内部 | 摘要/分析请求 |
| 8 | `groupNudge` | 群聊系统 | "只以 {{char}} 身份回复" |
| 9 | `bias` | 内置 | assistant 角色的偏置信息 |

### 扩展提示注入

已知扩展按 `position` 字段注入：

| 扩展模块 | Identifier | 说明 |
| --- | --- | --- |
| `1_memory` | `summary` | 聊天摘要 |
| `2_floating_prompt` | `authorsNote` | 作者笔记 |
| `3_vectors` | `vectorsMemory` | 向量记忆 |
| `4_vectors_data_bank` | `vectorsDataBank` | 向量数据库 |
| `chromadb` | `smartContext` | ChromaDB 智能上下文 |

其他扩展按 `BEFORE_PROMPT` 或 `IN_PROMPT` 类型过滤。

### 角色卡覆盖逻辑

```
IF 角色卡有 system_prompt 覆盖
   AND 目标提示存在
   AND forbid_overrides !== true
   AND 该提示未被禁用
THEN:
   替换 "main" 提示的 content
   记录到 overriddenPrompts[]

同理处理 jailbreak 覆盖
```

**只有 `main` 和 `jailbreak` 两个位支持角色覆盖。**

### 属性合并

PromptManager 中存储的元数据会覆盖到每个 prompt：
- `injection_position` (RELATIVE=0 / ABSOLUTE=1)
- `injection_depth` (对于 ABSOLUTE，从最新消息往回数几条)
- `injection_order` (同一深度内的排序，默认 100)
- `role` (system / user / assistant)

## 3. 阶段2-11: 消息组装 (populateChatCompletion)

### 完整组装流程

```
Phase 1: 预留开销
├─ reserveBudget(3)                         // assistant 起始标记
│
Phase 2: 角色信息块（RELATIVE 注入）
├─ add(worldInfoBefore)
├─ add(main)                                // 系统提示
├─ add(worldInfoAfter)
├─ add(charDescription)
├─ add(charPersonality)
├─ add(scenario)
├─ add(personaDescription)                  // 如果位置是 IN_PROMPT
│
Phase 3: 控制提示（预留，最后添加）
├─ controlPrompts = new MessageCollection()
├─ controlPrompts.add(impersonate)          // 仅 type=impersonate
├─ controlPrompts.add(quietPrompt)          // 必须在最后
├─ reserveBudget(controlPrompts)            // 先预留空间
│
Phase 4: 系统提示 + 用户自定义提示（RELATIVE）
├─ add(nsfw)
├─ add(jailbreak)
├─ add(用户自定义 RELATIVE 提示，按集合顺序)
│
Phase 5: 已知扩展提示（注入到 main 内部）
├─ injectToMain(summary, position)
├─ injectToMain(authorsNote, position)
├─ injectToMain(vectorsMemory, position)
├─ injectToMain(vectorsDataBank, position)
├─ injectToMain(smartContext, position)
│     ↑ position 可以是 'start', 'end', 或数字偏移
│
Phase 6: 其他扩展提示
├─ 遍历所有带 position 的扩展提示
├─ injectToMain(each, position)
│
Phase 7: 工具预分配
├─ IF 支持 tool calling:
│    reserveBudget(toolTokens)
│
Phase 8: 续写预填充
├─ IF type === 'continue':
│    提取最后一条消息作为 assistant prefill
│    加入 controlPrompts
│
Phase 9: ABSOLUTE 注入（聊天历史内）
├─ populationInjectionPrompts(absolutePrompts, messages)
│   ├─ 遍历 depth 0 → maxDepth
│   ├─ 找出该深度的所有 ABSOLUTE 提示
│   ├─ 按 injection_order 排序
│   └─ 插入到对应位置的聊天消息之间
│
Phase 10: 对话示例 + 聊天历史
├─ IF pin_examples:
│    populateDialogueExamples()   // 示例优先，保证不被裁剪
│    populateChatHistory()        // 历史填剩余预算
├─ ELSE:
│    populateChatHistory()        // 历史优先
│    populateDialogueExamples()   // 示例填剩余
│
Phase 11: 添加控制提示
├─ freeBudget(controlPrompts)     // 释放预留
├─ add(controlPrompts)            // 添加到最后
├─ squashSystemMessages()         // 合并连续 system 消息
```

### 关键设计决策

**控制提示始终在最后**：quiet prompt 是最后一条指令，确保 LLM 优先遵循。

**pin_examples 决定优先级**：
- `true`：示例对话优先于聊天历史（适合需要严格风格控制的角色）
- `false`：聊天历史优先（适合需要更多上下文的长对话）

**squashSystemMessages**：连续的 system 消息会被合并为一条，减少消息数量，提高兼容性。

## 4. 注入位置系统

### RELATIVE (injection_position = 0)

相对于角色定义区的位置：
- 跟随 addToChatCompletion 的调用顺序
- 在系统提示块内排列
- 适合全局性质的指令

### ABSOLUTE (injection_position = 1)

在聊天历史中的指定深度插入：

```
depth = 0  →  在用户最新消息之后
depth = 1  →  在用户上一条消息之后
depth = N  →  从最新消息往回数 N 条
```

同一 depth 内按 `injection_order` 排序（默认 100，数字越小越靠前）。

**典型用途**：
- depth=0: "请在下一条回复中表现出焦虑"（即时指令）
- depth=4: Author's Note 默认深度（中期记忆）
- depth=高: 长期背景设定

## 5. Token 预算算法

```
可用预算 = max_context - max_tokens（生成长度）

示例：
  max_context = 8192
  max_tokens  = 2048
  可用预算    = 6144

分配流程：
  预留 assistant 起始     -3        → 6141
  添加系统提示           -N        → 6141-N
  预留控制提示           -M        → 6141-N-M
  预留工具 Token         -T        → 6141-N-M-T
  填充聊天历史           -剩余      → 0 (溢出时裁剪最老消息)
  释放控制提示预留       +M        → M
  添加控制提示           -M        → 0

警告阈值：
  剩余 < 1500 Token  →  警告 "聊天历史发送量很少"
  剩余 < 500 Token   →  危险 "上下文严重不足"
```

## 6. Author's Notes 系统

### 三级回退

```
优先级: 角色笔记 > 聊天笔记 > 全局默认

1. 检查 extension_settings.note.chara[角色文件名]
   → 存在且 useChara 启用？使用角色笔记
2. 检查 chat_metadata.note_prompt
   → 存在？使用聊天笔记
3. 使用 extension_settings.note.default
   → 全局默认笔记
```

### 间隔插入

```
messagesTillInsertion = 最新消息序号 % interval

interval = 1: 每条消息都插入
interval = 5: 每 5 条用户消息插入一次
```

### 位置控制

| 值 | 含义 |
| --- | --- |
| 0 (replace) | 替换 main 提示 |
| 1 (before) | 在 main 提示之前 |
| 2 (after) | 在 main 提示之后 |

默认：depth=4, position=after, interval=1, role=system

## 7. Instruct Mode 格式化

### 消息包装

```
用户输入:   input_sequence + 消息 + input_suffix
AI 输出:    output_sequence + 消息 + output_suffix
系统消息:   system_sequence + 消息 + system_suffix
最后系统:   last_system_sequence（覆盖 system_sequence）
```

### 模型自动匹配

```
1. 精确映射: power_user.model_templates_mappings[modelId]
2. 正则匹配: 遍历预设的 activation_regex，首个命中即选中
3. 上下文绑定: bind_to_context 启用时，匹配上下文模板
4. 回退: 保持当前预设
```

### 停止序列

合并以下序列作为停止标记：
- stop_sequence
- input_sequence / output_sequence
- first_output_sequence / last_output_sequence
- system_sequence / last_system_sequence
- chat_start / example_separator（如启用）

## 8. 宏展开

### 展开时机

宏在以下时刻展开：
- Prompt 准备阶段（格式化各字段）
- 消息组装阶段
- 控制提示构造阶段

### 宏分类

| 类别 | 示例 | 说明 |
| --- | --- | --- |
| 名称替换 | `<USER>` `<BOT>` `{{char}}` | 角色/用户名 |
| 时间感知 | `{{time}}` `{{date}}` `{{weekday}}` | 当前时间日期 |
| 随机 | `{{random::a,b,c}}` `{{roll 2d20}}` | 随机选择/掷骰 |
| 确定性随机 | `{{pick::a,b,c}}` | 按聊天 ID 种子的固定选择 |
| Token 信息 | `{{maxPrompt}}` `{{maxContext}}` | 当前 Token 限制 |
| 聊天上下文 | `{{lastMessage}}` `{{lastUserMessage}}` | 最近消息 |
| 变量 | `{{getvar::name}}` `{{setvar::name::val}}` | 局部/全局变量 |
| 注释 | `{{//这是注释}}` | 被剥离，不进入 prompt |

### 展开顺序

```
1. 预环境宏（roll, trim, noop, input）
2. 环境变量替换（自定义值）
3. 后环境宏（time, tokens, messages）
4. 空内容检查（宏展开后为空则停止处理）
```

## 9. 最终输出结构

发送给 LLM 的消息数组：

```json
[
  // 系统提示块（连续 system 消息已合并）
  { "role": "system", "content": "World Info + 角色描述 + 性格 + 情境 + 扩展" },

  // NSFW / Jailbreak（如启用）
  { "role": "system", "content": "..." },

  // 聊天历史（最老 → 最新，受 Token 预算约束）
  { "role": "user", "content": "用户消息", "name": "User" },
  { "role": "assistant", "content": "角色回复", "name": "Character" },
  // ...

  // ABSOLUTE 注入（在指定深度插入）
  { "role": "system", "content": "Author's Note / 深度注入" },

  // 对话示例（根据 pin_examples 位置不同）
  { "role": "system", "content": "[示例对话]" },

  // 控制提示（始终在最后）
  { "role": "system", "content": "Impersonate 提示" },
  { "role": "system", "content": "Quiet 提示" }
]
```

## 参考来源

- SillyTavern/public/scripts/openai.js (prompt 组装主逻辑)
- SillyTavern/public/scripts/PromptManager.js (注入位置系统)
- SillyTavern/public/scripts/authors-note.js (作者笔记)
- SillyTavern/public/scripts/instruct-mode.js (指令格式化)
- SillyTavern/public/scripts/macros.js (宏引擎)
