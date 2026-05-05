# src/platform/ai 规范

## Prompt transcript 渲染

- `[历史记录]` 里的说话人标签属于一条 memory entry / 消息块，不属于每一行文本。
- 连续发送的多条消息必须是多个 memory entry；渲染时每条都带自己的 `[HH:MM] 说话人：`。
- 多行内容必须只在首行渲染 `[HH:MM] 说话人：`，后续换行和空行保持原样。
- 禁止把空行渲染成 `我：`、`用户：` 等空发言；这会污染上下文并让模型学习错误格式。
- `system` entry 只在首行带 `[HH:MM]`，不补说话人标签。

## 经历

- 经历块必须以 `[经历]` 开头，并以独立一行 `[经历结束]` 收尾。
- 结束标记由 `heartbeatVirtualWorldStory` 写入源头负责，不要在 transcript 渲染层临时补。

## OpenRouter 厂商路由

- `aiConfigStore.openRouterProviderSlug` 是 OpenRouter 内部厂商选择的唯一配置源；空字符串表示默认路由。
- 当该字段为 `cerebras` 等 slug 时，请求体必须写入 `provider.only = [slug]` 且 `provider.allow_fallbacks = false`，表示只允许该厂商，失败直接报错。
- 非 OpenRouter provider 必须忽略该字段，不能把 OpenRouter 专属 `provider` 对象发给 SiliconFlow 或 custom 端点。
- 新增绕过 `chatComplete` 的直接 `fetch('/chat/completions')` 路径时，必须复用 `buildOpenRouterProviderRouting`，否则会出现 UI 已选择厂商但请求仍默认路由的漏配。
