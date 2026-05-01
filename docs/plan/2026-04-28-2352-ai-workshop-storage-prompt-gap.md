# AI 工坊 Storage 提示词缺口排查计划

## 用户需求

用户指出 `/Users/wanqilin/Downloads/ai-app-draft-598d.zip` 是 AI 工坊生成的 user app。前一轮排查发现 app 把 `@hiphone/storage.get()` 当同步函数使用，导致返回桌面重新挂载后读取失败并可能覆盖旧数据。本轮需要检查 AI 工坊提供给执行 agent 的提示词/能力文档，判断是否没有把 `@hiphone/storage` 是异步 API、以及初始化持久化数据时不能立即把空初始态写回这类关键约束告诉 agent。

## 关键决策

1. 重点检查 `src/apps/AIAppBuilder/agent/builderAgentPrompt.ts` 和 `builderTools.ts` 的 `read_capability` 文档，而不是普通 user app SDK 实现，因为问题出在 AI 工坊生成代码的上游提示。
2. 若确认提示词只写了 `get/set` 但没有 Promise/await 语义和 hydrate guard，则补齐 agent system prompt 与 storage capability 文档。
3. 增加测试约束，防止后续 AI 工坊 prompt 回退为模糊的 `get/set` 描述。
4. 不改用户 zip 内源码；zip 是生成结果样本，真正修复应在 AI 工坊提示和能力手册。

## 排查步骤

1. 阅读 AI 工坊 agent system prompt，确认 SDK surface 中 storage 的描述。
2. 阅读 `read_capability({topic:'storage'})` 返回文本，确认是否有异步、hydration、回桌面重挂载等说明。
3. 阅读相关测试，补充 prompt/capability 的断言。
4. 运行 AI 工坊 agent/tool 相关测试。
5. 输出结论：这个生成 bug 是否由提示信息缺失导致，以及改了哪些约束。

## 排查结论

1. `builderAgentPrompt.ts` 原先只写了 `@hiphone/storage: get(key) / set(key, value) — per-owner KV`，没有说明这些 API 全部返回 Promise，也没有禁止在 `useState` initializer 中同步读取。
2. `builderTools.ts` 的 `read_capability({topic:'storage'})` 原先只说明 per-owner/global 语义，没有告诉执行 agent：返回桌面会导致 user app remount、普通 `useState` 会重置、hydrate 完成前自动保存空数组/空对象会覆盖旧数据。
3. 这能解释 `ai-app-draft-598d.zip` 中的生成结果：`const saved = get(STORAGE_KEY)` 把 Promise 当同步值解析，初始态变成 `[]`；首个 `useEffect` 又把 `[]` 写回 storage，导致重新进 app 时看起来“数据丢了”。
4. 本轮已把异步 storage、hydrate-before-save、直接保存结构化值、返回桌面 remount 这些约束写进 system prompt 和 storage capability，并用测试固定。
