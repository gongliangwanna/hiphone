# 手机端性能排查能力

## 用户需求
- 当前在 Mac 浏览器里交互比较流畅，但在手机浏览器里感觉明显卡顿。
- 在继续压缩图标或优化资源之前，先要有一套排查能力，能够在真机上判断到底是什么在拖慢：资源体积、毛玻璃、整层 blur、动画方式，还是主线程长任务。
- 本轮目标不是直接做性能优化，而是补齐“可观测性”和“隔离开关”。

## 关键决策
1. **做真机可见的性能 HUD**：通过 URL 查询参数 `?perf=1` 打开，避免默认污染正常体验。
2. **HUD 只做排查，不改业务流**：默认关闭，对现有 Device / Springboard / AppHost 行为无影响。
3. **统计分三类**：
   - 帧指标：FPS、平均帧间隔、最差帧、慢帧计数
   - 主线程指标：`longtask` 数量与最长耗时
   - 资源指标：按体积 / 解码大小排序的前几名资源
4. **必须支持隔离实验**：HUD 提供 3 个实时开关，用来判断卡顿是否来自以下代价源：
   - 关闭壁纸
   - 关闭整层桌面 blur
   - 降级毛玻璃（禁用 backdrop-filter）
5. **性能层标记最小侵入**：通过 `data-perf-layer` / `data-perf-backdrop-active` 给高代价层打标，不重写现有架构。
6. **先补纯函数测试**：查询参数解析、帧统计、资源排序、层汇总都做单测；HUD 只补最小集成测试。

## 交付范围
- `src/platform/perf/diagnostics.ts`
- `src/platform/perf/usePerformanceMonitor.ts`
- `src/platform/perf/__tests__/diagnostics.test.ts`
- `src/platform/stores/perfDebugStore.ts`
- `src/shell/PerformanceHUD/PerformanceHUD.tsx`
- `src/shell/PerformanceHUD/__tests__/PerformanceHUD.test.tsx`
- `src/shell/Device/Device.tsx` 集成 HUD 与开关
- `src/system/Material/Material.tsx` 接入“降级毛玻璃”调试开关
- `src/shell/AppHost/AppHost.tsx` / `src/system/Toast/Toast.tsx` / `src/shell/LockScreen/LockScreen.tsx` / `src/shell/StatusBar/StatusBar.tsx` 增加性能标记

## 验收方式
1. 手机访问 `...?perf=1` 时，页面右上角出现性能 HUD。
2. HUD 至少显示：
   - FPS / avg / worst
   - long task 计数
   - top resources
   - active layers / active backdrops
3. 切换 3 个隔离开关后，画面立即生效。
4. `pnpm test` 通过。
5. `pnpm build` 通过。

## 非目标
- 本轮不直接压图标、不改资源格式、不做代码分包。
- 不在本轮引入复杂的远程上报或 profiling 持久化。
