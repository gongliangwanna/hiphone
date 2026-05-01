# AI 工坊 Agent 轮次限制与文件状态丢失修复计划

## 用户需求

用户反馈两类问题：

1. 去掉当前 AI 工坊 agent 的 25 轮限制，避免复杂生成在未完成时被强制中断。
2. 确认并修复超过 25 轮后手动输入“继续”，模型调用 `write_file` 后再 `list_files` 却看不到文件的问题。

## 关键判断

1. 25 轮限制来自 `src/apps/AIAppBuilder/agent/builderAgent.ts` 的 `MAX_ITERATIONS = 25` 和固定 `for` 循环；可以改成无限循环，由 `finish`、解析失败和用户停止按钮负责退出。
2. 文件丢失不是模型问题，而是 V1.1 多草稿 store 引入 canonical `drafts[id].files` 与 mirror `draftFiles` 后，builder tool 只写了 mirror。随后 UI 追加 tool-call/chat turn 时会通过 `patchActive` 从 canonical draft 重建 mirror，于是刚写入的 mirror 文件被空的 canonical files 覆盖。
3. 修复应让 `write_file`、`delete_file`、局部修改工具写入 canonical draft 和 active mirror，保持 list/compile/install/持久化视角一致。

## 实施范围

- `src/apps/AIAppBuilder/agent/builderAgent.ts`
- `src/apps/AIAppBuilder/agent/builderTools.ts`
- `src/apps/AIAppBuilder/agent/__tests__/builderAgent.test.ts`
- `src/apps/AIAppBuilder/agent/__tests__/builderTools.test.ts`

## 验证计划

1. 增加测试复现：active draft 中 `write_file` 后追加聊天事件，文件仍然存在且 `list_files` 能看到。
2. 增加测试确认 agent 不再因为 25 轮上限退出。
3. 运行 `npm test -- src/apps/AIAppBuilder/agent src/apps/AIAppBuilder/__tests__`。
4. 运行 `npm run typecheck`。
