# App 打开/关闭动效优化

**日期**: 2026-04-09  
**状态**: 已完成

## 用户需求

优化 app 打开和关闭的动效，使其更接近真实 iOS 的表现。

## 调研结论（iOS 实现方式）

### 打开动效（图标 → 全屏）
1. 从图标的屏幕位置开始，icon snapshot 放大到全屏
2. 同时动画: scale、translate（图标中心→屏幕中心）、cornerRadius（图标圆角→0）、opacity（0.8→1）
3. 使用非弹跳 spring（critically damped），感知时长 ~0.5s
4. 背景 Springboard 略微缩小（~0.96）并变暗，产生层深感
5. iOS 使用 app 启动屏截图作为动画载体

### 关闭动效（全屏 → 图标）
1. **反向回到图标位置**，不是简单下滑
2. 比打开稍快（~0.35-0.4s），用更紧的 spring
3. cornerRadius 从 0 恢复到图标圆角
4. 末尾 ~30% 时间内 opacity 衰减到 0

### Spring 参数
- 打开: `spring(duration: 0.5, bounce: 0)` ≈ stiffness ~250, damping ~32, mass 1
- 关闭: `spring(duration: 0.4, bounce: 0)` ≈ stiffness ~320, damping ~36, mass 1（现有 criticalDamped）

## 当前问题分析

| # | 问题 | 当前值 | 正确值 |
|---|------|--------|--------|
| 1 | 初始 borderRadius 过大 | `100` | `~13.5px`（icon 60px × 22.5%） |
| 2 | 初始 opacity 从 0 开始，导致 "凭空出现" 感 | `0` | `0.7-0.8` |
| 3 | 视口宽高硬编码 390/844 | 硬编码 | `viewportProfile.width/height` |
| 4 | 关闭动效不回图标位置 | 向下滑出 `y: viewportHeight` | 缩回到记录的 icon origin |
| 5 | 打开/关闭用相同 spring | 都用 criticalDamped | 打开用稍柔和的 appLaunch spring |
| 6 | 缺少背景效果 | 无 | Springboard 缩小 0.96 + opacity 降低 |

## 关键决策

1. **新增 `appLaunch` spring preset**: stiffness 250, damping 32, mass 1 — 比 criticalDamped 更柔和，更接近 iOS 打开感
2. **关闭动效回到 icon 位置**: store 中已保存 `appOrigin`，将在 `exitAppToHome` 中保留此数据供 exit animation 使用
3. **Icon borderRadius 使用 CSS 变量 `--radius-icon`**: AppIcon 已使用此变量，AppHost 也应引用同一值确保一致性；但 framer-motion 需要具体数值，因此从 springboardMetrics 计算: `iconSize * 0.2267`（iOS squircle 比例 10/57 ≈ 0.2267... 简化为 22.5%）
4. **Springboard 背景缩放**: 在 Device.tsx 中通过 appRuntimeStore 状态控制 Springboard 容器的 scale/opacity 过渡
5. **保留 exit origin 数据**: exitAppToHome 不再清除 appOrigin，改为在 clearDismissedApp 时清除

## 实施步骤

1. ✅ 在 motion.ts 新增 `appLaunch` / `appClose` spring preset
2. ✅ 修复 AppHost initialAnimation（borderRadius、opacity、使用 viewport 尺寸）
3. ✅ 修改 exitAppToHome，保留 appOrigin 供关闭动效使用
4. ✅ 实现关闭回到 icon 位置的 exit animation
5. ✅ 为打开/关闭分别使用不同的 spring transition
6. ✅ 添加 Springboard 背景缩放/变暗效果
7. ✅ AppIcon 坐标系修正（device-root 相对坐标）
8. ✅ Exit transition 嵌入 exit prop 内部
9. ✅ 关闭时形状从矩形渐变为正方形（clipPath inset 算法）
10. ✅ 关闭时截图→icon 交叉淡入淡出
11. ✅ icon 落点轻微回弹（appClose spring: damping ratio ~0.77）
12. ✅ 切到多任务时无缩小消失动画（visibility:hidden 代替 unmount）
13. ✅ App 打开速度提升 50%（appLaunch stiffness 250→500）

## 关键算法：矩形→正方形形变

使用 `clipPath: inset()` + `scale` 实现 GPU 加速的形状渐变：

```
元素尺寸: vpWidth × vpHeight (如 390×844)
目标: 从完整矩形变为正方形 icon

scale: 1 → iconWidth/vpWidth (如 0.154)
  - 缩放后宽度: 390×0.154 = 60px ✓
  - 缩放后高度: 844×0.154 = 130px ✗ (需要裁剪)

clipPath: inset(0px 0px) → inset(Ypx 0px Ypx 0px)
  - Y = (vpHeight - vpWidth) / 2 = 227px
  - 裁剪后可见高度: (844 - 454) × 0.154 = 60px ✓

clipPath round R:
  - 初始: deviceCornerRadius (直接等于视觉圆角)
  - 结束: iconRadius / scale (元素空间值, 缩放后等于 iconRadius)
```
