# 历史记录说话人前缀按消息块渲染

## 用户需求

用户检查一次 AI 请求 curl 后发现 `[历史记录]` 中大量出现逐行 `我：` 前缀，尤其是空行也被渲染成只有 `我：` 的空发言。用户确认问题不在于使用 `我` 作为角色自身称呼，而在于对同一条多行消息逐行重复加说话人标签。

本次优化目标：

- 保留 `我：` 作为 assistant/当前角色的说话人标签。
- 一条多行消息只在消息块开头带一次 `[HH:MM] 说话人：`。
- 如果是连续发送的多条消息，每条消息都应作为独立 entry，各自带 `[HH:MM] 说话人：`。
- 消息内部换行和空行保持原样，不生成额外的 `我：` / `小星星：` 空发言。
- system 事件仍保持现有格式：只在首行带时间戳，不补说话人。
- 末尾最新 user turn 的 prompt 内容也按同样规则处理，避免用户多行输入被逐行污染。

## 根因

`src/platform/ai/promptAssembly.ts` 的 `renderTranscriptLine` 会对非 system entry 执行：

```ts
const rest = lines.slice(1).map((l) => `${speaker}：${l}`);
```

因此每个换行后的 continuation line 都会获得一次说话人前缀；当原内容存在空行时，空行被渲染成 `我：`。

追加排查（2026-05-05）：XingYu AI 回复路径还有一个上游合并点。`src/apps/XingYu/xingYuDataStore.ts` 会把 UI 气泡按 `reply.items` 逐条投递，但写 memoryStore 时只写一条 `content: reply.rendered`。而默认 renderer 会把多个 `{type:"text"}` item 用换行合成一个字符串，所以后续 transcript 渲染只能看到“一条多行 assistant entry”。

## 关键决策

1. 改为“按 memory entry / 消息块加前缀”，不是“按文本行加前缀”。
   - 多条连续消息 = 多个 memory entry = 每条都加前缀。
   - 单条消息里的换行 = 同一个 memory entry 内部文本 = 只首行加前缀。
2. XingYu 的 assistant memory 写入要和 UI 气泡粒度对齐：一次 AI 回复里的多个 `text` item 要写成多个 assistant memory entry，而不是合并成一条 `reply.rendered`。
3. 不做大范围 prompt 架构调整；只修改 transcript 渲染、XingYu assistant memory 写入和对应测试。
4. 保持 `[历史记录]` 仍为 system transcript block，保持 KV cache 分层设计不变。
5. 新增/调整单测覆盖：
   - assistant 多行内容只首行带 `我：`。
   - assistant 内容中的空行保持为空行，不渲染 `我：`。
   - 连续多条 assistant 消息各自保留 `我：`。
   - XingYu 一次 AI 回复里的多个 `text` item 在 memoryStore 中落为多条 assistant entry。
   - 最新 user turn 多行内容只首行带用户名，后续内容原样。
   - system 多行事件行为不变。

## 验证方式

- 先运行定向测试观察失败，确认测试能捕获旧行为。
- 修改实现后运行 `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`。
- 必要时补跑 `src/platform/ai/__tests__/promptAssembly.chunks.test.ts`，确认 prompt 分块未被破坏。
