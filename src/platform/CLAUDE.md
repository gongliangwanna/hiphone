# src/platform/ — 跨层基建

## 边界
- `design-tokens/` — 视觉 token，被所有层消费
- `gesture/` — 手势引擎，只被 shell/GestureLayer 调用
- `perf/` — 性能诊断与观测，不直接改业务行为
- `stores/` — 全局状态，所有层可读，只有 shell 层可写
- `utils/` — 纯工具函数，无副作用
