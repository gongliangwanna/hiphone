# Heartbeat 角色历史签名查看工具计划

## 用户需求

用户希望给角色心跳机制增加一个工具，让角色能查看自己最近 n 条历史签名：

- 工具用于查看当前角色自己的历史签名，而不是用户的签名历史。
- 参数 n 表示最近要查看的历史签名数量。
- 当 n 大于已有历史签名总数时，返回最大历史签名数即可，不报错。
- 推荐查看 5 条；当 n 缺省或非法时默认按 5 条处理。
- `update_signature` 的工具描述需要明确要求角色在更新签名前一定先查看最近签名，避免写重复签名。

## 关键决策

- 工具命名为 `view_own_signature_history`，语义和既有 `view_user_signature_history` 区分清楚。
- 参数形态沿用 heartbeat 统一工具协议：`{n: number}`。
- 执行器读取 `useXYData.getState().characterSignatures[characterId]`，返回当前签名和最近历史签名列表。当前签名不是 history 的一部分，但一起返回能避免模型把当前签名重复设置一次。
- 该工具是只读工具，需要加入 heartbeat agent 的 read-only action 列表，避免被写入心跳活动日志。
- 更新 `heartbeatRegister` 工具描述和 appSystemPrompt 约束，强化“更新签名前先查看最近签名”的行为。
- 添加 focused 单测覆盖默认 n=5、n 超过历史数量、无历史记录、注册表工具列表和描述。

## 实施步骤

1. 在 `heartbeatTools.ts` 添加 `view_own_signature_history` 分发和执行函数。
2. 在 `heartbeatRegister.ts` 注册新工具，并更新 `update_signature` 的描述和自主行为约束。
3. 在 `heartbeatAgent.ts` 把新工具标记为只读，并补活动 detail 文案。
4. 添加/更新 Vitest 测试。
5. 运行 heartbeat 相关测试验证。
