# 2026-04-18 2140 — 性能悬浮球 FPS 曲线

## 用户需求

> 优化我们设置里开发者工具里的性能悬浮球。悬浮球可以支持查看帧率图，能够看最近一段时间的帧率曲线。

## 现状

- `src/platform/perf/usePerformanceMonitor.ts`：每帧 `requestAnimationFrame` 采样 frame delta，保留最近 120 个，每 750ms 用 `summarizeFrameDeltas` 生成一次 `FrameStats`（fps / avgFrameMs / worstFrameMs / slow24 / slow40）。
- `src/shell/PerformanceHUD/PerformanceHUD.tsx`：悬浮球显示当前 fps；点击展开 panel 只有文字 stats，没有历史信息。

## 关键决策

1. **历史粒度**：每 750ms 采样周期产出一个 `FpsSample`（仅用本周期的 deltas 算 fps，不是滚动平均），避免相邻点高度相关。
2. **窗口长度**：保留 60 个样本 ≈ 45s 观察窗（刚好覆盖"打开某页 → 翻几下 → 关闭"的完整交互）。
3. **渲染方式**：内联 SVG polyline + 面积填充，不引三方图表库。宽 200px × 高 40px。
4. **参考线**：在 30fps 画一条 dashed 水平线，让帧率掉落一眼可见。
5. **颜色**：曲线颜色跟随当前 FPS 色（与悬浮球一致的绿/黄/红规则），不给每段上色（视觉噪声大、成本高）。
6. **panel 宽度**：从 `w-40` 放到 `w-56`（224px）容纳曲线，文字 stats 保留。

## 变更范围

- `src/platform/perf/usePerformanceMonitor.ts`：新增 `historyRef` + `intervalDeltasRef`，`PerfSnapshot` 增加 `history: FpsSample[]`。
- `src/platform/perf/diagnostics.ts`：新增 `FpsSample` 类型。
- `src/shell/PerformanceHUD/PerformanceHUD.tsx`：在展开 panel 内加 `<FpsSparkline>` 组件。
- 测试：`usePerformanceMonitor` 和 `PerformanceHUD` 各补一条断言。

## 非目标

- 不做帧率录制 / 导出。
- 不做带时间轴刻度的"完整图表"。
- 不改变现有 stats 字段与布局排序。
