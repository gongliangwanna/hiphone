# 心跳 ReAct 多 Action 支持

**日期**: 2026-04-13  
**需求**: 心跳 ReAct 循环中，AI 每轮可以返回多个 Action（数组），批量执行后将所有 Observation 一起返回。

## 用户需求
- 保留 ReAct 循环（Thought → Actions → Observations → 重复）
- 每轮 Action 从单个改为数组，一次可执行多个工具
- 取消 `send_message` 每次心跳只能发 1 条的限制
- 减少来回调用轮次，节省 token 和时间

## 关键决策

### 输出格式
从:
```
Thought: ...
Action: tool_name
ActionInput: {...}
```
改为:
```
Thought: ...
Actions:
[{"action": "view_moments", "input": {"page": 1}}, {"action": "like_moment", "input": {"momentId": "m1"}}]
```

用 JSON 数组表示多个 action，简洁且 LLM 友好。

### 解析器变更
- `parseReactOutput` 返回 `ParsedAction[]`（数组）而非单个
- 兼容单 action 写法（fallback）

### 执行变更
- 批量顺序执行所有 action（顺序重要：先 view 再 like）
- 收集所有 observation，一次性拼接返回
- 遇到 `done` 时停止后续 action

### 限制变更
- 移除 `messageSentThisHeartbeat` 限制
- `aiChatUsedThisHeartbeat` 保留（AI 对话开销大，仍限制 1 次）

## 涉及文件
1. `heartbeatPrompt.ts` — 更新格式说明和示例
2. `heartbeatAgent.ts` — 更新 parser + 执行循环
3. `heartbeatTools.ts` — 移除 send_message 限制
