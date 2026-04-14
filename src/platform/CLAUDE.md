# src/platform/ — 跨层基建

## 边界
- `design-tokens/` — 视觉 token，被所有层消费
- `gesture/` — 手势引擎，只被 shell/GestureLayer 调用
- `perf/` — 性能诊断与观测，不直接改业务行为
- `stores/` — 全局状态，所有层可读，只有 shell 层可写
- `hooks/` — 跨层 React hook（如 `usePerspective`）
- `ai/` — AI 对话基建（prompt 组装、回复解析、摘要等），详见 `ai/CLAUDE.md`
- `storage/` — IDB 持久化（idbStorage, idbRecordStorage, entityStoreRegistry）
- `utils/` — 纯工具函数，无副作用

## 查手机 / 多实体数据规范

详见 `docs/architecture/multi-entity-data.md`。

- **禁止** 硬编码 `senderId === 'me'` 判断消息归属，应使用 `usePerspective().isSelf(senderId)`
- **禁止** 硬编码 `idolId === 'me'` 判断朋友圈归属，同上
- `promptAssembly.ts` 中的 `'me'` 语义例外（那里 `'me'` 始终代表玩家，不受视角切换影响）
- `phoneOwnerStore` 不持久化，仅限 session 内有效
