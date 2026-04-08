# src/platform/gesture/ — 手势引擎

## 规范
1. 纯函数（velocity.ts / rubberBand.ts / thresholds.ts / springFromVelocity.ts）必须有 100% 测试覆盖
2. 阈值改动必须同步更新测试
3. 橡皮筋公式来源: WebKit UIScrollView 近似 `f(x) = (1 - 1/(x/c + 1)) * c`, `c = containerSize * 0.55`
