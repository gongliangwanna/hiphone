# 经历结束标记

## 用户需求

用户要求 `[经历]` 块需要显式增加 `[经历结束]`。目标是让 prompt 历史中的经历有清晰块边界，避免后续历史内容被模型误读为经历正文的一部分。

## 当前问题

`src/platform/ai/heartbeatVirtualWorldStory.ts` 生成 `heartbeat_log` 时只写：

```txt
[经历]
时间跨度：...

正文
```

没有结束标记。进入 memoryStore 后，后续 transcript 会继续拼接其他历史行，边界只依赖下一条时间戳，不够显式。

## 关键决策

1. 在经历 heartbeat log 的末尾追加独立一行 `[经历结束]`。
2. 不改变 `[自主活动记录]` 或普通 `heartbeat_log` 的格式。
3. `buildMemoryEntry` 对以 `[经历]` 开头的内容继续保持原样透传；结束标记由生成源头负责写入。
4. 单测覆盖成功生成后 memory 文本包含并以结束标记收尾。

## 验证方式

- 先更新 `heartbeatVirtualWorldStory.test.ts`，观察旧实现失败。
- 修改实现后运行：
  - `src/platform/ai/__tests__/heartbeatVirtualWorldStory.test.ts`
  - `src/platform/ai/__tests__/buildMemoryEntry.test.ts`
