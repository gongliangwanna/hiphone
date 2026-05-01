# 开发者工具导出 AI 工坊提示词和 SDK 文档

## 用户需求

- 在「设置 > 开发者工具」里提供一个一键导出入口。
- 导出内容包含 AI 工坊当前使用的 agent system prompt 和 SDK / sandbox / styling / demo 等能力文档。
- 开发者可以把导出的 Markdown 交给 Codex，用同一套约束在外部开发 hiPhone user app。

## 关键决策

- 导出格式使用 Markdown，文件名带日期，例如 `ai-workshop-codex-kit-2026-05-01.md`。
- 导出内容必须复用 AI 工坊运行时的真实 prompt / capability 文档源，避免设置页导出和 agent 实际提示词漂移。
- 将 capability topic 读取能力从 `builderTools.ts` 中抽出为可复用导出函数：工具执行和开发者导出共用同一份 topic map。
- 开发者工具只负责触发下载和 toast 反馈，不复制文档内容。
- 加单测覆盖导出包内容和 Developer Tools 下载按钮行为。
