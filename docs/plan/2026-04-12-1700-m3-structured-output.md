# 2026-04-12 M3：结构化输出 + 多消息回复

## 用户需求

> 不需要流式了，因为正常和真人聊天发的消息也不是流式的。但是一次可以发多条消息，而不是发一条长消息，这样更像真人。
> AI 返回结构化 JSON，是一个数组，每条消息是一个 item，之后还可以增加各种类型（表情包、红包）。去掉动作描述（*叹气*），通过提示词而非过滤。

## 现状

- AI 回复通过 streamChat() 逐 token 流式显示
- 一次回复 = 一条消息，长回复变成一大段文字墙
- 提示词 closing instruction 里无 JSON 格式要求
- 无多消息拆分逻辑

## 关键决策

### D1. JSON 输出格式

```json
[
  { "type": "text", "content": "你好呀" },
  { "type": "text", "content": "今天过得怎么样？" }
]
```

- 数组，每个元素一条独立消息
- 当前只实现 `text` 类型，schema 可扩展（sticker/redpacket/...）
- system prompt 里明确要求 JSON 格式输出

### D2. 非流式请求

用 `chatComplete()`（非流式）替代 `streamChat()`。理由：
- 真人聊天不是流式的
- JSON 必须完整才能解析，流式没意义
- 代码更简单

### D3. 多消息延迟投递

解析出 N 条消息后，逐条投递，每条之间加随机延迟（300-800ms），模拟真人连发。
第一条消息之前显示 typing indicator。

### D4. JSON 解析容错

- 先尝试 JSON.parse
- 失败则尝试提取 ```json ... ``` 代码块中的 JSON
- 仍失败则 fallback 为单条纯文本消息
- 不做 keyword fallback 双通道

### D5. 提示词调整

- closing instruction 改为要求 JSON 数组输出
- 明确禁止动作描述（*叹气*、*微笑*）
- 要求每条消息简短，像真人发微信一样

### D6. 移除流式相关代码

- Message.streaming 字段保留（向后兼容持久化数据）但新回复不再使用
- TypingDots 保留，在等待 API 返回时显示

## 交付清单

1. **新建** `src/platform/ai/chatComplete.ts` — 非流式 chat completion
2. **新建** `src/platform/ai/replyParser.ts` — JSON 解析 + 容错
3. **修改** `src/platform/ai/promptAssembly.ts` — closing instruction 改为 JSON 格式要求
4. **修改** `src/apps/XingYu/xingYuDataStore.ts` — 重写 scheduleAICharacterReply：非流式 + 多消息投递
5. **修改** `src/platform/ai/replyFilters.ts` — 去掉动作描述过滤（改由提示词处理）
6. **新建** tests
7. 本 plan md

## 测试计划

1. `pnpm vitest run` 全绿
2. `pnpm typecheck` 无错
3. `pnpm build` + deploy
