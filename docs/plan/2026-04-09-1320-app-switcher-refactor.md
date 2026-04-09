# AppSwitcher 多任务切换重构方案

## 用户需求

多任务切换存在严重体验问题：
1. 右滑后直接回弹，无法自由浏览卡片
2. 卡片展示位置和大小不正确
3. 操作手感极差，与 iOS 原生质感差距大
4. 屏幕右侧有长方形空白区域无法展示内容

## 问题根因分析

### 1. 滚动回弹 — `scrollSnapType: 'x mandatory'` + `scrollIntoView` 竞态

**旧实现**：
```css
scrollSnapType: 'x mandatory'     /* 浏览器强制吸附 */
scrollPaddingInline: '11%'         /* snap 偏移 */
```
```ts
scrollIntoView({ behavior: 'smooth', inline: 'center' })  /* 程序化滚动 */
```

`mandatory` 意味着每次滚动结束浏览器**必须**将某个 snap point 对齐到视口。当 `scrollIntoView` 的平滑动画运行时，snap 算法同时试图修正最终位置。两者对"中心点在哪"的计算不一致（因为 padding/margin 双重间距），导致反复拉锯 → 用户看到的就是"回弹"。

### 2. 右侧空白 — 双重间距冲突

**旧实现**：
```css
/* 滚动容器 */
scrollPaddingInline: '11%'        /* snap 计算用 */

/* 内层 flex */
marginInline: '11%'               /* 布局用 */
```

`scrollPaddingInline` 告诉浏览器"snap 对齐时从边缘内缩 11%"，但 `marginInline` 在 flex 容器上又额外推入 11%。最后一张卡片的右侧，scroll 物理边界和 flex 布局边界不一致 → 右侧出现空白长方形。

### 3. 动画抖动 — `layout` prop 和 scroll snap 竞态

**旧实现**：
```tsx
<motion.div layout initial={...} animate={...}>
```

`layout` 让 framer-motion 在**每帧**重新测量元素 `getBoundingClientRect()`，计算位置差异后施加 transform 补偿。当 scroll snap 同时在调整滚动位置时，motion 读到的 rect 每帧都在变 → 产生 transform 补偿 → snap 又因为 transform 变化重新计算 → 恶性循环导致抖动。

### 4. 卡片尺寸不一致 — 三重约束冲突

**旧实现**：
```css
flex: '0 0 78%'       /* 百分比宽度 */
minWidth: 286         /* 像素下限 */
maxWidth: 332         /* 像素上限 */
```

在 390px 视口上：78% = 304px，落在 [286, 332] 内，正常。
在 320px 视口上：78% = 249px，**低于** 286px 下限 → 卡片宽度跳到 286px = 89% 视口宽 → 居中偏移，morph 动画 scale 不匹配。

## 关键决策

### D1: `scroll-snap-type: x proximity` 替代 `mandatory`

`proximity` 只在卡片**已经接近** snap point 时才吸附，其余时候让惯性滚动自然减速。iOS 真实多任务切换就是这种自由滚动 + 轻吸附的手感，不会强制回弹。

### D2: 单一间距来源

只在内层 flex 容器上设 `paddingLeft` / `paddingRight`，不再使用 `scrollPaddingInline` 和 `marginInline`。一个来源，一个 DOM 测量结果，snap 算法和布局引擎看到的是同一组数字。

### D3: 移除 `layout` prop

卡片入场动画只用 `initial` / `animate`（opacity + scale + y），不依赖 layout animation。消除了和 scroll 的竞态。

### D4: 视口百分比卡片宽度

```ts
const CARD_WIDTH_RATIO = 0.70;
const cardWidth = Math.round(vw * CARD_WIDTH_RATIO);
// flex: `0 0 ${cardWidth}px`
```

用视口宽度的固定比例计算出像素值，不再有 minWidth/maxWidth 第二套约束。在所有视口下行为一致。同步更新 `AppHost.SWITCHER_SCALE = 0.70`。

### D5: `scrollLeft` 赋值替代 `scrollIntoView`

首次渲染时直接计算目标卡片的 scrollLeft 偏移，同步赋值。不产生动画，不和 snap 竞争。后续用户手动滑动时，snap `proximity` 自然接管。

### D6: 按比例缩放圆角

```ts
const cardBodyRadius = deviceCornerRadius * (cardWidth / 390);
```

卡片是设备屏幕的缩小版，圆角也应按缩放比例缩小，不能直接用全尺寸 `deviceCornerRadius`（会显得过圆）。

### D7: 移除 ResizeObserver 的 SwitcherAppContent

旧实现用 ResizeObserver 监听卡片宽度变化来动态算 scale。现在 cardWidth 从 props 传入，`scale = cardWidth / 390` 是常量，无需监听。

## 变更文件

| 文件 | 改动 |
|------|------|
| `src/shell/AppSwitcher/AppSwitcher.tsx` | 完全重写滚动容器、卡片布局、尺寸计算、初始滚动逻辑 |
| `src/shell/AppHost/AppHost.tsx` | `SWITCHER_SCALE` 从 0.78 改为 0.70 |
| `src/shell/AppSwitcher/AGENTS.md` | 更新为新的布局模型和不变量约定 |

## 验证

- `pnpm test` — 198 tests passed
- `pnpm build` — 构建成功
- 手动验证：
  - 多任务界面可自由横向滑动，无强制回弹
  - 卡片尺寸为视口宽度 70%，居中显示
  - 右侧无空白区域
  - 上滑移除卡片正常
  - 点击卡片回到 app 的 morph 动画正常
