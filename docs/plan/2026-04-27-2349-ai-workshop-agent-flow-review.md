# AI 工坊 AGENT 流程复盘计划

## 用户需求

用户要求深度分析当前 AI 工坊的 AGENT 流程，判断哪些地方需要优化。分析范围必须覆盖：

1. 当前 user app 架构。
2. AI 工坊当前 agentic loop 的实现。
3. 已实现的翻译 demo。
4. 翻译 demo 在 `docs/report` 下查出的报告。

最终输出应是流程级优化建议，而不是直接开始重构实现。

## 用户补充需求（2026-04-28）

用户进一步指出以下优化方向需要纳入分析：

1. AI 工坊需要支持**局部修改**，而不是每次都倾向全局改写。
2. 规划模式要参考当前主流 agent 产品的规划方式，现有 `update_plan` 比较简单。
3. user app 的上下文提供不够充分，尤其是 SDK 到底支持哪些能力、哪些能力应该直接用 SDK、哪些需要用户 app 自己实现。
4. 生成结果要更鼓励**多文件结构**，而不是观察到的大量单文件输出。
5. Tailwind 应作为默认样式方案使用，agent prompt / blueprint 需要明确这一点。

## 关键决策

1. 本轮先做代码与文档研究，不改业务代码，避免在没有完整理解前引入新的实现偏差。
2. 以 `src/platform/userApp` 为 user app 架构主线，串联 compiler、sandbox、installer、builtin user apps、SDK、AppScene 注册与启动链路。
3. 以 `src/apps/AIAppBuilder/agent`、`AIAppBuilderApp.tsx`、`aiAppBuilderStore.ts`、`BuilderChat.tsx` 为 AI 工坊 AGENT 主线，重点检查 prompt、工具、解析、循环控制、错误处理、计划状态和 UI 反馈。
4. 以 `src/apps/translate` 和 `src/platform/userApp/builtinUserApps.ts` 为翻译 demo 主线，检查它作为内置 user app 对 SDK 能力、架构边界和真实生成目标的验证价值。
5. 优先阅读相关规格、计划和 release note：AI App Builder V1/V1.5、Translate S1-S5、user app 里程碑文档。
6. 如果 `docs/report` 不存在或未包含翻译 demo 报告，需要在最终结论里单独标注证据缺口，不假设报告内容。
7. 优化建议按优先级组织：短期可补强、下一阶段架构改造、长期 agent 体验与可靠性方向。

## 研究步骤

- [x] 确认报告目录与相关文档位置。
- [x] 梳理 user app 架构与生命周期。
- [x] 梳理翻译 demo 的实现边界和暴露出的 SDK 需求。
- [x] 梳理 AI 工坊 AGENT 当前执行流、工具协议和错误路径。
- [x] 对照翻译 demo 与 agent 生成能力，提出优化建议。
- [x] 补充局部修改、规划模式、SDK 上下文、多文件与 Tailwind 默认策略。
