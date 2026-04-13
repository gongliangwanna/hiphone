# 小组件多样式支持 — 以时钟小组件为先

## 用户需求
每个小组件支持多种样式（如时钟 4×4 除了四城模拟钟还有数字表等），放置后可左右滑动切换。首先优化时钟小组件。

## 关键决策

### 1. 样式数据存储
在 `WidgetInstance` 中增加 `styleIndex: number`（默认 0），持久化。Store 版本升至 v3。

### 2. 滑动切换交互
复用 PhotoWidget 的滑动范式（pointer capture + stopPropagation + motion value），改为水平方向。抽取为通用 `StyleCarousel` 组件供所有 widget 复用。

### 3. 时钟样式设计

| 尺寸 | Style 0 | Style 1 | Style 2 |
|------|---------|---------|---------|
| 2×2 | 模拟时钟（现有） | 数字时钟 | 简约数字 |
| 4×2 | 数字+模拟（现有） | 双城时钟 | 经典模拟 |
| 4×4 | 四城世界时钟（现有） | 经典大表盘 | 数字全屏 |

### 4. 手势冲突解决
- `interactive` 为 false 时（edit mode / drawer）禁用滑动
- pointerDown 时 `stopPropagation` 防止 pageSwipe 抢夺
- 长按进入编辑模式时，StyleCarousel 不挡 longPress — 采用 PhotoWidget 同样的策略：非 interactive 时不挂任何 pointer handler

### 5. 样式指示器
在小组件底部显示圆点指示器（仅多于1个样式时），类似 iOS widget style dots。

## 实施步骤

### M1: 基础设施
1. `springboardLayoutStore` — WidgetInstance 加 styleIndex，新增 `setWidgetStyle` action，v3 migration
2. `registry.tsx` — WidgetCatalogEntry 加 styles 元数据
3. `WidgetRenderProps` — 加 styleIndex + onStyleChange
4. `IconGrid.tsx` WidgetSlot — 传递 styleIndex + onStyleChange

### M2: StyleCarousel 组件
1. 水平 strip 布局（flex-row, width = count * 100%）
2. useMotionValue(0) for dragX
3. Pointer capture + stopPropagation
4. 速度/距离 commit 逻辑
5. 橡皮筋边界
6. 圆点指示器

### M3: 时钟小组件多样式
1. 2x2: 模拟 / 数字 / 简约
2. 4x2: 数字英雄 / 双城 / 经典模拟
3. 4x4: 四城 / 大表盘 / 数字全屏
4. 所有样式共享 useLiveTime()

### M4: 测试
1. Store: styleIndex 持久化 + migration
2. StyleCarousel: 滑动切换 + 橡皮筋
3. ClockWidget: 所有 size × style 渲染
