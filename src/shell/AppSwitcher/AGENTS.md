# src/shell/AppSwitcher/ 规范

iOS 18 风格的 app 切换面板。改动前务必读一遍本页。

## 布局模型
- 横向滚动容器使用 `scroll-snap-type: x mandatory`。用户每次滑动的意图是选择一张卡片，最终必须有一张卡片停在屏幕中央。
- 卡片宽度 = `viewportWidth * CARD_WIDTH_RATIO`（0.66），通过 `flex: 0 0 <px>` 固定。不使用百分比 flex-basis + minWidth/maxWidth 的混合模式——会在不同视口下冲突。
- 侧边留白通过内层 flex 容器的 `paddingLeft/paddingRight` 实现（不用 `marginInline`，不用 `scrollPaddingInline`——双重间距会和 snap 算法打架导致回弹 bug）。
- 卡片圆角 = `deviceCornerRadius * (cardWidth / 390)`，按缩放比例计算，不硬编码。
- `SwitcherAppContent` 直接用 `cardWidth / 390` 作为 scale，不再通过 ResizeObserver 监听。

## 不变量
1. **手势 axis 只能由一个驱动**：`dragY` (motion value) 独占 `y` 轴，`animate` prop 里**不能**再写 `y`，否则 AnimatePresence 和 imperative `animate()` 会拔河。
2. **`finishCardDismiss` 返回结构体**：`{ committed, velocity, appId }`。用 `result.velocity * 1000` 作为 spring 初速度（px/ms → px/s）。
3. **卡片高度永远走 ref**：`cardHeightRef.current`。jsdom 的 `getBoundingClientRect().height` 返回 0，必须 `Math.max(height, 200)` 兜底。
4. **不使用 `layout` prop**：motion.div 的 `layout` 会在每帧重测量元素位置，和 scroll-snap 并发导致抖动/瞬移。卡片入场用 `initial/animate`，不依赖 layout animation。
5. **激活卡片必须传完整测量**：`onActivate` payload 是 `{ rect, viewport }`，rect 相对 device-root，viewport 是 device-root 尺寸。
6. **首次滚动用 `scrollLeft` 赋值**：不用 `scrollIntoView`（它和 scroll-snap 会互相抢最终位置），直接计算目标 scrollLeft 同步设置。

## 动效约定
- 入场 stagger：`index * 0.04s` 延迟，只在**首次 render** 时生效（`isFirstRenderRef`）。
- 选中卡 halo：CSS `box-shadow` + `transition`，不用 motion animate。
- 拖拽反馈：`useTransform(dragY, [-320, 0], [0.88, 1])` + `useTransform(dragY, [-280, -80, 0], [0.25, 1, 1])`，只在 `isSelected` 时挂到 style。

## 踩坑
1. **removeApp 不发同步 event**：`finishCardDismiss` commit 后**同步**调用 `removeApp(appId)`。
2. **exit 动画 flies-to-wrong-place**：检查 `AppHost.exitAnimation` 的 `dismissReason === 'card'` 分支。
3. **AppSwitcher 不要读 `dismissedAppId`/`clearDismissedApp`**：这两个字段所有权在 `AppHost`。
4. **SWITCHER_SCALE 必须和 CARD_WIDTH_RATIO 同步**：`AppHost.tsx` 的 `SWITCHER_SCALE` 必须等于 `AppSwitcher.tsx` 的 `CARD_WIDTH_RATIO`（当前 0.66）。改一处必须改另一处。
5. **scroll-snap-type 必须是 mandatory**：用户滑动的目的是选择下一张/上一张卡片，不是停在中间状态。每次滑动结束必须有一张卡片居中。
6. **背景双层模糊**：进入 switcher 时壁纸层和桌面层同时模糊暗化。壁纸层 `blur(25px) brightness(0.78) saturate(1.2)`；桌面层 `blur(18px) brightness(0.6)`。
7. **不要再用 spacer item 做首尾留白**：`gap + width:max-content + dummy flex item` 的组合会让尾部 scroll extent 和 snap 几何再次分叉，首尾留白统一放在内层 flex 的 `paddingLeft/paddingRight`。
8. **DismissGestureSurface 必须是 `touch-action: pan-x`**：`auto` 会让浏览器在方向锁完成前抢走手势，导致上滑 dismiss 在多卡片场景下经常被横向滚动吞掉。
