# src/platform/ — 跨层基建

## 边界
- `design-tokens/` — 视觉 token，被所有层消费
- `gesture/` — 手势引擎，只被 shell/GestureLayer 调用
- `perf/` — 性能诊断与观测，不直接改业务行为
- `stores/` — 全局状态，所有层可读，只有 shell 层可写
- `ai/` — AI 对话基建（prompt 组装、回复解析、摘要等），详见 `ai/CLAUDE.md`
- `utils/` — 纯工具函数，无副作用
