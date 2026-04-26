# src/platform/ai/ — AI 对话基建

## 架构
- `promptAssembly.ts` — 三阶段 prompt 组装（System → History → Post-history）
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
- 不经常变化的内容（角色设定、世界书、格式指令、表情包库存等）放 **System block**（Phase 1）
- 每次请求都变化的内容（当前时间、设备上下文等）放 **Post-history**（Phase 3）
- 绝对不要把高频变化的数据（时间戳、实时状态）混入 System block
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
- 心跳活动日记总结
- AI-AI 聊天
- 历史压缩/摘要

### Tool Registry `dynamicContext` 使用准则

`ToolDefinition` 现在支持可选的 `dynamicContext: (ctx) => string | null` + `contextAtTail?: boolean`。这两个字段让工具提供方能在 prompt-build 时注入运行时状态(例如 heartbeat 的当前可聊角色清单),但也带来几条必须遵守的规则:

1. **只有"每次 prompt 都可能变"的状态才用 `dynamicContext`**。Session 级不变的内容(XingYu 表情清单、用户名字)走 `registerAppSystemPrompt`——`appSystemPrompt` 在 session 创建时冻结一次,不会每条消息都重算,KV 缓存仍然命中。

2. **`dynamicContext` 必须是纯读**。这段代码每次 `assemblePrompt` 调用都会跑一次,任何副作用都会重复执行(mark-as-read 会被调 N 次消费掉未读;`setState` 会触发 N 次 re-render)。副作用留在 tool executor(tool 真正被执行时才跑一次)。

3. **`contextAtTail: true` 慎用**。它把 dynamicContext 输出放到 prompt 最末端,LLM 关注度最高——会显著提升该工具被触发的概率。只给"希望被频繁关注"的状态用(未读消息、限时事件);否则默认(不设此字段)就够。

4. **KV 缓存影响**。只要 tool 列表里有任一 `dynamicContext`,system block 就会每次都重新生成 → KV 前缀缓存 miss → 首 token 延迟 + 费用双倍。Heartbeat 每 30 分钟一次、影响小;XingYu 每条消息一次、慎加。如无充分理由,tools 仍以静态 description 为首选。

5. **例外:`chat_with_character.dynamicContext` 登记 c1/c2 aliases**。这属于"内存索引建立"而非状态修改,只要角色列表顺序稳定就是幂等的。其他地方如有类似需要,在 spec 里明确列出。
