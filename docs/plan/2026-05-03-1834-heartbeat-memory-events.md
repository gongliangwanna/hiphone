# Heartbeat Memory Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace heartbeat's LLM-written autonomous activity diary with deterministic, tool-owned memory event rendering.

**Architecture:** Heartbeat tools will return both `observation` for the current ReAct loop and optional `memoryEvents` for persistent memory. `heartbeatAgent` will collect those events in execution order and write one `heartbeat_log` containing factual records instead of making an extra summary LLM call.

**Tech Stack:** TypeScript, Vitest, Zustand stores, existing XingYu `heartbeat_log` memory mirroring.

---

## 用户需求

用户确认：
- 去掉“自主活动日记”总结。
- 心跳工具和 AI 工具回复渲染一样，需要有“渲染到上下文”的能力。
- `memoryEvents` 由程序确定性转换，不由大模型生成。
- 读到空页、失败、没有更多内容等业务结果也可以记录；系统噪声如 JSON 解析失败、API 失败、中断不写入角色记忆。
- AI-AI、AI 和玩家聊天记录仍沿用现有完整聊天记录，不额外重复一份长 transcript。

## 文件结构

- Modify: `src/platform/ai/heartbeatTools.ts`
  - 扩展 `ToolResult`，新增 `memoryEvents?: string[]`。
  - 每个工具按执行结果渲染事实事件。
  - `chat_with_character` 只记录“我主动找某某聊天”，不重复完整聊天记录。
- Modify: `src/platform/ai/heartbeatAgent.ts`
  - 收集 `result.memoryEvents`。
  - 删除活动日记总结 LLM 调用。
  - 将 memory events 写入一条 `heartbeat_log`。
- Test: `src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts`
  - 断言心跳不再做 summary LLM 调用。
  - 断言工具 memory events 落入 `heartbeat_log` 和 memoryStore。
- Test: `src/platform/ai/__tests__/heartbeatNotesTools.test.ts`
  - 断言 `view_notes`、`create_note` 的 `memoryEvents`。
- Test: existing heartbeat signature / agent tests
  - 更新旧的调用次数假设。

## Tasks

### Task 1: RED — heartbeat agent 不再调用 summary LLM

- [ ] 在 `heartbeatAgent.e2e.test.ts` 中改写现有 full ReAct 测试：`view_user_signature -> send_message -> done` 后只应调用 3 次 `chatComplete`，不再需要第 4 次 summary mock。
- [ ] 新增断言：如果工具返回 memory event，最终写入的 `heartbeat_log` 包含事实事件文本。
- [ ] 运行 `pnpm vitest run src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts --testNamePattern "full ReAct"`，预期失败，失败点是当前实现仍调用第 4 次 summary。

### Task 2: RED — notes 工具返回确定性 memoryEvents

- [ ] 在 `heartbeatNotesTools.test.ts` 中为 `view_notes` 增加断言：读到备忘录时 `memoryEvents` 包含标题和正文。
- [ ] 为 `view_notes` 空列表增加断言：`memoryEvents` 记录“我查看了备忘录，发现还没有写过备忘录”。
- [ ] 为 `create_note` 增加断言：`memoryEvents` 包含创建的标题和正文。
- [ ] 运行 `pnpm vitest run src/platform/ai/__tests__/heartbeatNotesTools.test.ts`，预期失败，失败点是 `memoryEvents` 尚不存在。

### Task 3: GREEN — ToolResult 支持 memoryEvents

- [ ] 在 `heartbeatTools.ts` 中扩展接口：

```ts
export interface ToolResult {
  observation: string;
  done: boolean;
  memoryEvents?: string[];
}
```

- [ ] 给 notes 工具补最小 memory event 渲染。
- [ ] 对 moments、signature、unread、character list 等工具补确定性渲染，格式统一为 `[自主活动]\n...`。
- [ ] 运行 notes 测试，预期通过。

### Task 4: GREEN — heartbeat agent 写事实流水

- [ ] 在 `heartbeatAgent.ts` 的工具执行循环里收集 `result.memoryEvents`。
- [ ] 删除 summary LLM 调用和 `ACTION_LABELS`/`formatActionDetail` 的依赖逻辑。
- [ ] 有 memory events 时，写入一条 `heartbeat_log`：

```text
[自主活动开始]
我开始了一次自主活动。

[自主活动]
...
```

- [ ] 没有 memory events 时不写 `heartbeat_log`。
- [ ] 运行 heartbeat agent e2e，预期通过。

### Task 5: 回归验证

- [ ] 运行：

```bash
pnpm vitest run src/platform/ai/__tests__/heartbeatAgent.e2e.test.ts src/platform/ai/__tests__/heartbeatNotesTools.test.ts src/platform/ai/__tests__/heartbeatSignatureTools.test.ts
```

- [ ] 运行：

```bash
pnpm vitest run src/platform/ai/__tests__/promptAssembly.chunks.test.ts src/platform/userApp/sdk/__tests__/ai.session.test.ts
```

- [ ] 运行：

```bash
pnpm tsc --noEmit
```

## 关键决策

1. `memoryEvents` 是工具 executor 的程序渲染，不走 LLM。
2. `observation` 继续服务 ReAct 循环，不承担长期记忆职责。
3. `heartbeat_log` 继续作为隐藏消息进入 memoryStore，复用现有 UI 隐藏和记忆镜像逻辑。
4. 活动事件仍可能被现有压缩机制吸收；本次不改压缩主架构。
5. 不重复记录 AI-AI 完整对话 transcript，因为已有聊天链路完整落盘。
