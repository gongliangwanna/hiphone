# 性能 HUD 复制按钮

## 用户需求
- 当前已经有 `?perf=1` 的性能 HUD。
- 现在需要一个复制按钮，能把当前诊断结果快速复制出来，方便用户在手机上直接分享给开发者，不再手抄或截很多图。

## 关键决策
1. 复制内容使用纯文本，保证在聊天、Issue、备注里都能直接粘贴。
2. 文本结构与 HUD 一致，包含：
   - Frame
   - Main Thread
   - Environment
   - Layers
   - Top Resources
   - Isolation 开关状态
3. 优先走 `navigator.clipboard.writeText`；不可用时降级到隐藏 `textarea + execCommand('copy')`。
4. 按钮在 HUD 顶部，复制成功后短暂显示“已复制”，失败显示“复制失败”。
5. 复制文本的组装抽成纯函数，补单测，避免文案结构回归。

## 交付范围
- `src/platform/perf/diagnostics.ts`
  - 新增诊断文本格式化函数
- `src/shell/PerformanceHUD/PerformanceHUD.tsx`
  - 新增复制按钮
  - 新增复制状态反馈
- `src/platform/perf/__tests__/diagnostics.test.ts`
  - 覆盖格式化函数
- `src/shell/PerformanceHUD/__tests__/PerformanceHUD.test.tsx`
  - 覆盖点击复制与按钮反馈

## 验收
1. 打开 `?perf=1` 后，HUD 顶部出现“复制”按钮。
2. 点击后能把当前快照复制到系统剪贴板。
3. 文本中包含 FPS、long tasks、viewport、active layers、top resources、isolation 状态。
4. `pnpm test` 通过。
5. `pnpm build` 通过。
