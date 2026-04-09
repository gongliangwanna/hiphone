# iOS App Switcher 视觉与交互规范参考

> 基于 iOS 17/18 真机观察、Apple HIG、开源逆向工程项目及 WWDC Fluid Interfaces 演讲综合整理。
> 本文档用作 hiPhone AppSwitcher 组件的对标参考。

---

## 1. 整体布局

### 1.1 卡片尺寸

| 属性 | 值 | 说明 |
|------|-----|------|
| 卡片宽度 | **屏幕宽度 × 65-68%** | iPhone 15 Pro (393pt 宽) 上卡片约 256-267pt 宽。不是 70% 也不是 78%，实测偏窄 |
| 卡片高宽比 | **与设备屏幕一致** (9:19.5) | 卡片是屏幕的精确缩小版，不做裁切 |
| 卡片圆角 | **按缩放比例计算** | `deviceCornerRadius × (cardWidth / screenWidth)`。iPhone 15 Pro 圆角 55pt，缩小到 68% 后约 37pt |
| 卡片阴影 | 柔和大面积投影 | `0 20px 60px rgba(0,0,0,0.3)` 级别。没有边框(border)，纯阴影表达层次 |

### 1.2 卡片排列

| 属性 | 值 | 说明 |
|------|-----|------|
| 排列方式 | **水平滚动单行** | 卡片垂直居中于屏幕中段 |
| 卡片间距 | **约 10-12pt** | 卡片间有小间距但不重叠。iOS 7-8 时代有重叠/3D 透视，iOS 13+ 改为平面平铺 |
| 首/末卡片留白 | **(screenWidth - cardWidth) / 2** | 关键：确保第一张和最后一张卡片都能滚动到屏幕正中央 |
| 垂直位置 | **卡片顶部对齐状态栏下方约 80-100pt** | 卡片不是精确垂直居中，而是偏上。底部留出空间给 app 名称/图标和 Home Indicator |

### 1.3 卡片下方标签

| 属性 | 值 | 说明 |
|------|-----|------|
| 结构 | **App 图标 + App 名称** | 水平排列，居中于卡片下方 |
| 图标大小 | **20-22pt** | 小圆角方形，和桌面图标相同资源但缩小 |
| 图标圆角 | **约 5pt** | 保持 iOS continuous corner |
| 名称字号 | **13pt, Medium weight** | SF Pro Text |
| 名称颜色 | **白色，带文字阴影** | `text-shadow: 0 1px 3px rgba(0,0,0,0.5)` |
| 间距 | 图标与名称间 **4-6pt**，卡片底部到标签顶部 **10-12pt** |

---

## 2. 背景

| 属性 | 值 | 说明 |
|------|-----|------|
| 背景层 | **壁纸的模糊暗化版本** | 和桌面相同壁纸，但加了重度模糊和降低亮度 |
| 模糊半径 | **约 25-30px** | 高斯模糊，足够让壁纸完全不可辨认 |
| 亮度降低 | **brightness(0.75-0.80)** | 配合模糊形成深色背景，让卡片白色内容突出 |
| 饱和度 | **saturate(1.1-1.3)** | 略微增加饱和度保持色彩 |
| 过渡 | 进入 switcher 时 **250-300ms ease-out** 淡入 | 不是瞬间出现 |
| 缩放补偿 | `transform: scale(1.1)` | 模糊边缘会透出底层，用稍微放大来遮住 |

---

## 3. 滚动行为

### 3.1 核心原则

iOS App Switcher 的滚动**不使用 CSS scroll-snap**。它是一个完全自定义的惯性滚动系统：

| 属性 | 值 | 说明 |
|------|-----|------|
| 滚动类型 | **自由惯性滚动** | 手指跟踪 1:1，松手后按速度减速 |
| 减速率 | **UIScrollView.DecelerationRate.normal = 0.998** | 这是 iOS 标准减速率，和 Safari 页面滚动手感一致 |
| Snap 吸附 | **无强制吸附** | 松手后自然减速停在任意位置。卡片**不会**强制吸附到中心 |
| 回弹 | **橡皮筋效果** | 滚出边界时有弹性阻尼，松手后弹回。公式：`offset = pow(offset, 0.7)` |
| 横向触摸冲突 | **纵向上滑删除优先** | 一旦检测到纵向位移超过横向，锁定为删除手势 |

### 3.2 Web 实现建议

由于浏览器原生 `overflow-x: auto` 的 `scroll-snap-type: mandatory` 手感太硬，建议：

- 使用 `scroll-snap-type: x proximity` 而非 `mandatory` — 只在接近时轻吸附
- 或完全放弃 CSS scroll-snap，用 pointer events + motion value 自己实现惯性滚动（最贴近 iOS 原生，但实现成本高）
- 如果用 CSS scroll：确保 `sideInset = (viewportWidth - cardWidth) / 2`，保证边缘卡片可居中

---

## 4. 手势与动画

### 4.1 进入 Switcher

| 阶段 | 动画 | 说明 |
|------|------|------|
| 背景淡入 | opacity 0→1, **250ms ease-out** | 模糊壁纸层 |
| 卡片入场 | 从下方滑入 `y: 20→0`，`opacity: 0→1`，`scale: 0.97→1` | 弹簧动画 |
| 入场错开 | 每张卡片延迟 **30-40ms** | `index * 0.035s`，营造逐张飞入的层次感 |
| 弹簧参数 | `response: 0.45, dampingFraction: 0.85` | 即 `stiffness ≈ 195, damping ≈ 23.7` |

### 4.2 上滑删除卡片

**关键：所有卡片都可以上滑删除，不只是"选中"的那张。**

| 阶段 | 行为 | 说明 |
|------|------|------|
| 跟手 | `deltaY` 直接映射到 `translateY` | 向上为负值，1:1 跟手，无阻尼 |
| 向下拖 | **无效** | `Math.min(deltaY, 0)`，不允许向下拖 |
| 缩放反馈 | `scale: dragY [-300, 0] → [0.92, 1]` | 上拉越多越缩小 |
| 透明度反馈 | `opacity: dragY [-250, -50, 0] → [0, 1, 1]` | 接近消失时淡出 |
| 决策阈值 | **投影 (projection) 判定** | `projected = position + velocity × 499`。投影位置超过卡片高度 35% 即 commit |
| commit 动画 | 飞向屏幕上方 `y: -viewportHeight` | 临界阻尼弹簧 (dampingRatio ≈ 1.0)，**速度继承**手指释放速度 |
| cancel 动画 | 弹回 `y: 0` | 交互弹簧 (stiffness: 400, damping: 40)，同样继承释放速度 |
| 删除后 | 剩余卡片向删除位置**滑动填充** | 平滑过渡，不是跳变 |

### 4.3 速度继承 (Velocity Propagation)

**这是 iOS 动效的灵魂，hiPhone 最需要关注的细节：**

```
// 手指释放时的速度 (px/ms)
releaseVelocity = computeVelocity(samples)  // 滑动窗口速度计算

// 传给弹簧动画 (motion 库用 px/s)
animate(value, target, {
  type: 'spring',
  stiffness: 320,
  damping: 36,
  velocity: releaseVelocity * 1000  // px/ms → px/s
})
```

速度归一化公式 (参考 [Daniel Gauthier](https://danielgauthier.me/2020/02/27/vctransitions2.html)):
```
normalizedVelocity = gestureVelocity / distanceToTarget
```

### 4.4 点击卡片回到 App

| 阶段 | 动画 | 说明 |
|------|------|------|
| 卡片定位 | 测量点击卡片在 device-root 中的 rect | `getBoundingClientRect()` 相对 device-root |
| Morph 动画 | 卡片位置→全屏，`scale: cardWidth/screenWidth → 1` | 弹簧动画，从卡片 rect 放大到全屏 |
| 其他卡片 | **快速淡出** `opacity → 0, duration: 0.16s` | 让 morph 独占画面 |
| 圆角 | 从 `cardBodyRadius` → `0` (全屏无圆角) | 跟随 scale 动画同步过渡 |

### 4.5 退出 Switcher（回桌面）

| 触发 | 行为 |
|------|------|
| 点击卡片外空白区域 | 所有卡片缩小+淡出，背景模糊层淡出，回到桌面 |
| AssistiveTouch 回桌面 | 同上 |

---

## 5. 视觉细节清单

### 必须有 ✓
- [x] 卡片无边框，纯阴影
- [x] 卡片圆角按缩放比例计算
- [x] 壁纸模糊暗化背景
- [x] App 图标 + 名称在卡片下方居中
- [x] 首末卡片可滚到屏幕中央
- [x] 所有卡片都可上滑删除
- [x] 删除动画：向上飞出 + 缩小 + 淡出
- [x] 取消动画：弹回原位（带速度继承）
- [x] 卡片内容是 App 真实截图的缩放版
- [x] 入场有逐张错开的弹簧动画

### 当前 hiPhone 缺失 ✗
- [ ] 卡片宽度应为 65-68% 而非 70%（当前偏宽）
- [ ] 卡片间距应为 10-12pt 而非 14px（当前偏宽）
- [ ] 卡片应偏上放置，不是精确垂直居中（底部需要给标签和留白）
- [ ] 点击空白区域回桌面时缺少卡片退出动画
- [ ] 删除最后一张卡片后应自动回到桌面
- [ ] 状态栏在 switcher 中应保持可见（当前被卡片遮住）
- [ ] 缺少卡片删除后剩余卡片的补位滑动动画

---

## 6. 弹簧参数速查

| 场景 | stiffness | damping | mass | 备注 |
|------|-----------|---------|------|------|
| 卡片入场 | 195 | 24 | 1 | smooth, 有轻微回弹 |
| 删除飞出 | 320 | 36 | 1 | 临界阻尼，无回弹 |
| 取消弹回 | 400 | 40 | 1 | 交互级，快速归位 |
| morph 放大 | 280 | 28 | 1 | smooth，和页面转场一致 |
| 背景淡入 | N/A | N/A | N/A | CSS transition 250ms ease-out |

SwiftUI 转换公式 (参考 [Nathan Gitter: Building Fluid Interfaces](https://medium.com/@nathangitter/building-fluid-interfaces-ios-swift-9732bb934bf5)):
```
stiffness = pow(2 * π / response, 2)
damping   = 4 * π * dampingFraction / response
```

---

## 7. 投影 (Projection) 判定公式

iOS 使用 UIScrollView 的减速率来预测手势终点位置：

```typescript
function project(position: number, velocity: number, deceleration = 0.998) {
  const factor = deceleration / (1 - deceleration)  // ≈ 499
  return position + velocity * factor
}
```

参考来源：
- [Building Fluid Interfaces — Nathan Gitter](https://medium.com/@nathangitter/building-fluid-interfaces-ios-swift-9732bb934bf5)
- UIScrollView.DecelerationRate.normal.rawValue = 0.998

---

## 8. 橡皮筋 (Rubber Banding) 公式

当滚动超出边界时的阻尼效果：

```typescript
function rubberBand(offset: number, dimension: number, coefficient = 0.55) {
  return (1 - (1 / (offset * coefficient / dimension + 1))) * dimension
}
```

或简化版：`dampedOffset = pow(offset, 0.7)`

---

## 参考来源

- [Building Fluid Interfaces — Nathan Gitter (Medium)](https://medium.com/@nathangitter/building-fluid-interfaces-ios-swift-9732bb934bf5) — iOS 手势物理学、投影公式、橡皮筋、弹簧参数
- [Mastering VC Transitions Part 2 — Daniel Gauthier](https://danielgauthier.me/2020/02/27/vctransitions2.html) — 速度阈值 300pt/s、速度归一化、commit/cancel 判定
- [SwiftUI App Switcher (GitHub)](https://github.com/crafterm/swiftui-app-switcher) — SwiftUI 实现参考
- [Demystifying UIKit Spring Animations (Medium)](https://medium.com/ios-os-x-development/demystifying-uikit-spring-animations-2bb868446773) — UISpringTimingParameters 数学
- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) — 8pt 网格、安全区域
- [Apple HIG: Multitasking](https://developer.apple.com/design/human-interface-guidelines/multitasking) — 多任务设计原则
- [iOS Design Guidelines — Ivo Mynttinen](https://ivomynttinen.com/blog/ios-design-guidelines/) — 字体、间距、组件尺寸
- [Horizontal Scrolling Card UI (Envato Tuts+)](https://webdesign.tutsplus.com/horizontal-scrolling-card-ui-flexbox-and-css-grid--cms-41922t) — Web 端水平滚动卡片实现
- [React Native Snap Carousel](https://github.com/meliorence/react-native-snap-carousel) — 卡片轮播参考：snapToAlignment: center, 卡片宽度 80% 视口
