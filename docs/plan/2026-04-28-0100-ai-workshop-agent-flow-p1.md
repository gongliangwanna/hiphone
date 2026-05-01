# AI 工坊 AGENT 流程优化 P1 实施计划

## 用户需求

在完成当前 AI 工坊 AGENT 流程复盘后，用户要求提交已有文档并开始开发。新增开发方向包括：

1. 支持局部修改，而不是每次倾向全局重写。
2. 规划模式要参考主流 agent 的规划模式，不能只停留在简单 TODO。
3. user app 上下文要更充分，尤其是 SDK 支持哪些能力、哪些应直接用 SDK、哪些应由 user app 自己实现。
4. 生成结果要更鼓励多文件结构，而不是大量单文件。
5. Tailwind 应作为默认样式方案。

## 本阶段目标

本阶段做 P1 小步闭环，不一次性重构完整 planning UX：

1. **完成门禁**：`finish` 前强制全量检查，未通过时继续把诊断喂回 agent，不允许 ready。
2. **检查语义修正**：`compile_check` 在发现 errors 时返回 `ok:false`，UI 和模型都能识别草稿未通过。
3. **entry 缺失检查**：全量检查时校验 `manifest.entry` 文件存在且可编译。
4. **局部编辑工具**：新增 `replace_text`、`replace_range`、`append_to_file`，减少全文件重写。
5. **能力上下文工具**：新增 `read_capability`，让 agent 按需读取 SDK、沙箱、多文件、Tailwind、翻译 blueprint 等说明。
6. **Prompt 更新**：默认 Tailwind + CSS 变量、多文件 scaffold、先研究/计划再修改、局部修改优先。
7. **终止即时反馈**：停止按钮必须立即退出 `generating` 状态，且终止后的旧请求不能继续写入草稿/聊天。刷新页面后恢复出的 `generating` 属于残留状态，必须自动转回 `idle`，否则没有可 abort 的 controller。

## 关键决策

1. 不改现有全局 AI / heartbeat / XingYu 工具链，保持 AI 工坊 agent 私有工具面。
2. 兼容当前已有未提交的 provider generation 参数改动；不回滚用户已有工作。
3. 局部编辑工具先用安全的文本/行级操作，不做 AST 编辑，避免引入复杂 parser。
4. `read_capability` 先用静态内置手册，后续可拆成独立 markdown/blueprint 文件。
5. 规划模式本阶段先在 prompt 和 plan 内容要求上加强；真正的 `research/clarify/plan/approve/execute/review` 状态机留到 P2。

## 文件影响

- `src/apps/AIAppBuilder/agent/builderTools.ts`
- `src/apps/AIAppBuilder/agent/builderAgent.ts`
- `src/apps/AIAppBuilder/agent/builderAgentPrompt.ts`
- `src/apps/AIAppBuilder/AIAppBuilderApp.tsx`
- `src/apps/AIAppBuilder/BuilderChat.tsx`
- `src/apps/AIAppBuilder/aiAppBuilderStore.ts`
- `src/apps/AIAppBuilder/__tests__/AIAppBuilderApp.test.tsx`
- `src/apps/AIAppBuilder/__tests__/aiAppBuilderStore.test.ts`
- `src/apps/AIAppBuilder/agent/__tests__/builderTools.test.ts`
- `src/apps/AIAppBuilder/agent/__tests__/builderAgent.test.ts`

## 验证计划

1. `npm test -- src/apps/AIAppBuilder/agent`
2. `npm test -- src/apps/AIAppBuilder/__tests__ src/apps/AIAppBuilder/agent src/platform/userApp/__tests__/translate.sandbox.test.ts src/platform/userApp/__tests__/builtinUserApps.test.ts`
3. `npm run typecheck`
