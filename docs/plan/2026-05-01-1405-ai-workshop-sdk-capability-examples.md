# AI 工坊 SDK 能力文档补充示例

## 用户需求

- AI 工坊给模型的 SDK 文档不能只列能力名。
- 每个 SDK 都应该像 `sdk.storage` 一样给出具体使用示例，帮助模型少猜 API。
- 示例需要覆盖导入方式、函数签名、适用场景和常见错误，便于模型按需查 `read_capability`。

## 关键决策

- 保留 system prompt 的总纲定位，只放 SDK 模块总览和按需查询指引，不把所有示例塞进 system prompt。
- 将 `read_capability` 扩展为细粒度 topic：`sdk.storage`、`sdk.ai`、`sdk.hooks`、`sdk.nav`、`sdk.toast`、`sdk.banner`、`sdk.motion`、`sdk.perspective`、`sdk.services`、`sdk.ui`、`sdk.react`。
- 每个 SDK topic 都写成“用途 / 导出 / 最小示例 / 常见错误”的结构。
- 兼容旧 topic：`storage`、`ai`、`motion` 继续可用，避免旧 prompt 或已有生成流程突然失效。
- 同时移除 prompt 中已经过期的“25 轮工具调用上限”描述。
- 增加测试，确保 capability 列表包含细粒度 topic，且关键 SDK topic 都包含示例代码。
