# 计划：桌面居中展示，壳层保持长方形

## 用户需求

用户澄清：要去掉的是屏幕边框的弧度，不是取消桌面端的居中展示。最终目标应为：

- 桌面端继续居中展示设备区域，不铺满整个窗口
- 手机端继续全屏展示
- 所有场景都不使用圆角边框，统一为长方形

## 关键决策

1. 恢复 `simulator / fullscreen` 双模式：
   - `simulator`：桌面端居中矩形展示
   - `fullscreen`：手机端矩形全屏展示
2. `shellMode` 判定恢复到粗指针竖屏 `360-430` 宽度走 `fullscreen`，其余走 `simulator`
3. 壳层 `borderRadius` 固定为 `0`
4. 已实现的 safe-area 与 Springboard size-tier 适配保留，不回退

## 交付清单

- `ViewportProfile` 恢复桌面/手机两种壳层模式
- `Device` 恢复桌面居中矩形展示
- 对应测试改为验证：
  - 桌面端是居中矩形设备态
  - 手机端是矩形全屏态
  - 两者都没有圆角

## 测试计划

1. `viewportProfile` 纯函数测试覆盖桌面 `simulator` 与手机 `fullscreen`
2. `Device` 组件测试覆盖桌面居中壳层和手机全屏壳层
3. `pnpm test`
4. `pnpm build`
