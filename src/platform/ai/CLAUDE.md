# src/platform/ai/ — AI 对话基建

## 架构
- `promptAssembly.ts` — 四段 prompt 组装（System → History → App 协议 → Post-history）
- `replyParser.ts` — 解析 LLM 结构化 JSON 回复（text / sticker / signature）
- `chatComplete.ts` — API 调用层
- `summarizer.ts` — 历史压缩 / 摘要
- `tokenEstimator.ts` — token 估算
- `deviceContext.ts` — 设备上下文注入（当前 app、天气等）
- `replyFilters.ts` — 回复后处理过滤

## 踩坑记录

### System 提示词必须保持稳定，避免频繁变化
LLM 服务商（如 OpenAI、DeepSeek）对 system 提示词做 KV 缓存。如果 system block 每次请求都变化，缓存永远无法命中，导致：
- **首 token 延迟大幅增加**（无缓存时需要完整计算 system 部分的 KV）
- **API 费用增加**（缓存命中的 token 通常有折扣）

**规则：**
- 全局且跨 app 稳定的内容（角色设定、世界书、基础回复约束等）放 **System block**（Phase 1）
- app 相关但相对稳定的内容（当前 app 任务、app 回复格式、可用工具/动作、表情包库存等）放 **App 协议**（History 之后、Post-history 之前）
- 每次请求都变化的内容（当前时间、设备上下文、需要强提醒的工具尾部状态等）放 **Post-history**（Phase 4）
- 绝对不要把高频变化的数据（时间戳、实时状态）混入 System block
- 绝对不要把 app 专属协议混入全局 System block；否则切换 app 会破坏稳定前缀，降低 KV cache 命中率
- 绝对不要把稳定数据（角色设定、可用表情列表）放到 Post-history

### 结构化输出格式
AI 回复必须是 JSON 数组，支持三种类型：
- `{"type":"text","content":"..."}` — 文字消息
- `{"type":"sticker","stickerId":"...","content":"描述"}` — 表情包（`content` 必需，用于预览和语义理解）
- `{"type":"signature","text":"..."}` — 修改角色个性签名（静默操作，不产生聊天气泡；提示 AI 不要频繁更换）
- `replyParser.ts` 有三级 fallback（直接 parse → code block 提取 → bracket 提取 → 纯文本兜底）

### maxTokens 必须使用用户配置，禁止硬编码
所有 `chatComplete` 调用的 `maxTokens` 必须来自 `aiConfig.maxTokens`（用户在设置中配置的值），不允许写死数字。这包括：
- 常规聊天回复
- 心跳 agent ReAct 循环
- AI-AI 聊天
- 历史压缩/摘要

### 心跳工具必须输出确定性记忆事件

心跳工具的 `ToolResult` 支持 `memoryEvents?: string[]`。这不是给当前 ReAct 循环看的 observation，而是进入角色长期上下文的事实流水。

**规则：**
- `memoryEvents` 必须由程序根据工具真实执行结果渲染，禁止再调用 LLM 写“自主活动日记”。
- `observation` 只服务本次心跳循环；`memoryEvents` 才服务后续记忆。
- 读写工具都可以记录业务结果，包括空列表、没有更多内容、业务对象找不到等。
- JSON 解析失败、API 失败、Abort 等系统噪声不要写成角色记忆。
- `chat_with_character` 不重复写完整 transcript；AI-AI 聊天记录已经由聊天链路完整落盘。

### 心跳经历是 memoryEvents 规则的显式例外

心跳可以在工具循环前运行一个独立的经历生成阶段。它是 per-character 开关控制的 LLM 叙事生成，不属于工具 `memoryEvents`。

**规则：**
- 工具 `memoryEvents` 仍必须由程序根据工具真实执行结果确定性渲染。
- 经历只写隐藏 `heartbeat_log`，不显示聊天气泡。
- 经历必须发生在小手机外的角色生活中，不能让用户或其他 AI 角色参与事件。
- 写入后再组装本次心跳工具 prompt，让同一次心跳能感知这段新记忆。

### Tool Registry `dynamicContext` 使用准则

`ToolDefinition` 现在支持可选的 `dynamicContext: (ctx) => string | null` + `contextAtTail?: boolean`。这两个字段让工具提供方能在 prompt-build 时注入运行时状态(例如 heartbeat 的当前可聊角色清单),但也带来几条必须遵守的规则:

1. **只有"每次 prompt 都可能变"的状态才用 `dynamicContext`**。Session 级不变的内容(XingYu 表情清单、用户名字)走 `registerAppSystemPrompt`——`appSystemPrompt` 在 session 创建时冻结一次,不会每条消息都重算。

2. **`dynamicContext` 必须是纯读**。这段代码每次 `assemblePrompt` 调用都会跑一次,任何副作用都会重复执行(mark-as-read 会被调 N 次消费掉未读;`setState` 会触发 N 次 re-render)。副作用留在 tool executor(tool 真正被执行时才跑一次)。

3. **`contextAtTail: true` 慎用**。它把 dynamicContext 输出放到 prompt 最末端,LLM 关注度最高——会显著提升该工具被触发的概率。只给"希望被频繁关注"的状态用(未读消息、限时事件);否则默认(不设此字段)就够。

4. **KV 缓存影响**。`dynamicContext` 会让 App 协议或 Post-history 的对应片段每次重算；虽然不会污染全局 System block,但仍会增加 prompt 变化面。Heartbeat 每 30 分钟一次、影响小;XingYu 每条消息一次、慎加。如无充分理由,tools 仍以静态 description 为首选。

5. **例外:`chat_with_character.dynamicContext` 登记 c1/c2 aliases**。这属于"内存索引建立"而非状态修改,只要角色列表顺序稳定就是幂等的。其他地方如有类似需要,在 spec 里明确列出。
