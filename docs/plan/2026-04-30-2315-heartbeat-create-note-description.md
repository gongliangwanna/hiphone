# Heartbeat Create Note Description

## 用户需求

用户要求给心跳 AI 的“写备忘录”工具添加描述：

- 不要写重复的备忘录。
- 如果不知道写什么就不要写。
- 如果不知道之前写过什么就先看再写。

## 关键决策

- 修改 `src/platform/ai/heartbeatRegister.ts` 中 `create_note` 工具的 `description`，因为心跳 ReAct 工具列表由这里注册并进入 prompt。
- 保留原有“创建一条备忘录”的能力说明，同时把去重和先查看的行为约束直接放进工具描述，确保模型在选择工具前能看到。
- 增加 `heartbeatRegister` 单测断言这些关键描述存在，防止未来重构时丢失。
- 不改变 `create_note` 的执行逻辑：本次只补工具语义提示，不做内容去重拦截；否则会引入更大的行为变更和误判风险。

## 验证

- 运行 `pnpm vitest run src/platform/ai/__tests__/heartbeatRegister.test.ts`。
