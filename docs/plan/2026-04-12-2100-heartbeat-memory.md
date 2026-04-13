# 心跳记忆机制

## 用户需求
心跳触发后 AI 做了很多事（发动态、点赞、评论、改签名），但之后聊天时 AI 完全不知道自己做过什么，会"穿帮"。需要把心跳期间的行为记录为一段日志，插入聊天历史，这样：
1. 下次聊天时 AI 能在历史中看到自己做过什么
2. 下次心跳时 AI 也知道上次做了什么，避免重复
3. 随着上下文满了，现有的 summarizer 会把这段日志一起压缩

## 关键决策

### 机械格式化 vs LLM 摘要
选择机械格式化（不额外调 LLM）。简单可靠，不增加 API 成本。日志随历史一起被 summarizer 压缩时自然会被 LLM 精简。

### 存储方式：直接插入聊天历史
不搞额外的 system prompt 注入，直接作为一条消息写入 `xingYuDataStore.messages`。复用现有 prompt 管线（历史 → trim → summarize）。

### 消息类型
新增 MsgType `'heartbeat_log'`，senderId 为角色 ID（`char-xxx`），在 promptAssembly 中格式化为 `[自主活动记录] ...`，让 AI 知道这是自己的活动日志而非聊天消息。

## 改动文件

| 文件 | 改动 |
|------|------|
| `src/apps/XingYu/data.ts` | MsgType 新增 `'heartbeat_log'` |
| `src/platform/ai/heartbeatAgent.ts` | ReAct 循环中收集 actions，循环结束后格式化并插入 log 消息 |
| `src/platform/ai/promptAssembly.ts` | `messageToContent` 处理 `heartbeat_log` 类型 |
| `src/apps/XingYu/pages/ChatDetail.tsx` | 聊天界面隐藏或灰显 heartbeat_log 消息 |
