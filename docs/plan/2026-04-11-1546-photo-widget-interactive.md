# 2026-04-11 照片小组件可交互化 — 滑动切换照片

## 用户需求

> 优化照片小组件,支持互动.滑动切换照片

两个核心目标：
1. **滑动切换** — 小组件里可以左右滑动浏览一组精选照片（像 iOS 照片"精选时刻"小组件那样，但带真实手势）
2. **保持既有观感与性能** — Ken Burns 慢镜头 + iOS 风格底部渐变文字保留，非活动页暂停动画，点击空白区 morph 进入 Photos App

## 现状

`src/shell/Widgets/PhotoWidget.tsx`
- 当前只展示一张按"当天索引 % allPhotos.length"挑选的照片
- 永远不可互动，没有 tap handler，没有 swipe gesture
- 布局结构：
  - 绝对定位的 `<img>` 单张照片，GPU Ken Burns 动画
  - 底部 `linear-gradient` 遮罩 + 小标题"回忆" + 日期
- `useIsPageActive()` 用来非活动页暂停动画

`src/shell/Springboard/IconGrid.tsx` 里的 `WidgetSlot`
- 非编辑态：`useLongPress(600ms)` 触发进入编辑态 + 拖拽，`useLongPress` 在 window 上监听 pointermove，父容器 setPointerCapture 不影响它的 move-threshold 取消逻辑
- 编辑态：pointerDown 立即 `stopPropagation` 开始拖拽
- 父层 `Springboard.tsx` 调 `usePageSwipe`，在 pointerdown 时 `setPointerCapture` 处理整页横向 pan

Music 小组件已经是可互动的参考实现：`variant !== 'drawer' && !isEditMode` 决定 `interactive`；按钮 `stopPropagation` 避让 longpress/drag；shell ref + getBoundingClientRect 触发 icon→app morph。

## 关键决策

### D1. 手势路由：在 PhotoWidget 自己 `stopPropagation(pointerdown)`

横向滑动照片 vs 横向翻页——两者都吃水平位移，必须二选一。

**决策**：非编辑态 + 非 drawer 下，PhotoWidget 的 pointerdown 直接 `stopPropagation` + `setPointerCapture`，拿走整条手势序列。

**后果权衡**：
- 负面：PhotoWidget 的可见区域不再响应 600ms longpress 进入编辑态。因为 pointerdown 被拦截，父 `WidgetSlot` 的 longpress 计时器根本不会启动
- 正面：同一页上其它任何小组件/App 图标仍可 longpress 进入编辑态，然后 PhotoWidget 在编辑态下走标准 drag 逻辑（不再 stopPropagation）
- 用户体感几乎无感知——iOS 的真照片 widget 也是 swipe 吃掉触控，进入编辑态靠长按其它图标

### D2. 编辑态开关：订阅 `useSpringboardLayoutStore(s => s.isEditMode)`

跟 MusicWidget 一样：`interactive = variant !== 'drawer' && !isEditMode`
- `interactive === false` 时 pointerDown 不做任何事（不 stopPropagation、不 setPointerCapture），完全让父 `WidgetSlot` 处理 drag
- `onClick` 在编辑态下也不触发 open App

### D3. 照片池来源：`allPhotos` 前 8 张 + 稳定日偏移

- 从 `allPhotos` 里取前 8 张作为 widget 的 "精选"（够滑动、又不至于让图太小看不清）
- 保留"按当天日索引 rotate"的语义，把当天应该显示的那张放在首位，后面按顺序排
- 所有尺寸（2x2/4x2/4x4）都展示同一个照片池，但数量可以按 size 微调：2x2 6 张、4x2 8 张、4x4 12 张

### D4. 手势物理：跟手拖 + 距离/速度二选一 commit

- `dragX` 用 `useMotionValue`，每帧手指位移直接写入（1:1 跟手）
- 超出首/尾用 `rubberBand` 橡皮筋（复用 `@/platform/gesture/rubberBand`）
- pointerup 时用 `velocity` + `projection` 决定落点（复用 `@/platform/gesture/velocity` 和 `projection`）
- 距离阈值：`abs(dx) > widgetWidth * 0.25` 则 commit
- 速度阈值：`abs(vx) > 0.3 px/ms` 则 commit（走 projection 方式也行，先用简化规则）
- 动画用 `animate(dragX, target, { type: 'spring', ...spring.smooth, velocity: vx*1000 })`

### D5. tap vs swipe 判定

手指抬起时：如果位移 < 6px 且时间 < 300ms → 视为 tap，触发 open Photos App（morph 原点用 `WidgetShell` 的 bounding rect，与 MusicWidget 完全对称）

### D6. 渲染结构：横向 strip + CSS `transform: translateX`

- 外层：`overflow: hidden`（继承自 WidgetShell）
- 内层：`flex` 横向条 width = `photos.length * 100%`，每张照片 100% 宽
- 用 `motion/react` `style={{ x: dragX }}` 跟手
- 每张照片都是 `<img>`，`object-fit: cover`，无 Ken Burns；只在 **当前展示的那张** 上加 Ken Burns 动画（避免 N 张同时 GPU transform）
- 当前索引切换时，旧的 Ken Burns 停止 → 新的 Ken Burns 启动。用 `data-active` 选择器 + CSS `animation-play-state`

### D7. 状态与回弹

- `currentIndex`：活跃照片索引，`useState`
- `dragX`：motion value，非拖拽时等于 `-currentIndex * widgetWidth`
- widget 宽度通过 `useRef<HTMLDivElement>` + `ResizeObserver` 取，不假定固定值（不同手机屏不同尺寸）
- 无障碍：左右两个隐藏按钮（`sr-only`，或 `aria-label`）做 keyboard 访问

### D8. 文案叠加层

底部渐变 + 相簿小标签 + 日期 → 保留，但日期跟随 `currentIndex` 变化。每张照片的 caption 是 `${year}年${month}月${day}日`，`album` 维持"回忆"/"精选"（按 size 微调）。

## 交付清单

### 代码
1. **重写** `src/shell/Widgets/PhotoWidget.tsx`
   - 新增 interactive state：currentIndex, dragX motion value
   - 新增 pointerdown/move/up handlers + setPointerCapture
   - 横向 strip 渲染结构
   - Ken Burns 动画只作用于当前索引
   - tap → openApp('photos', origin)
   - 分页小点指示器 (bottom-center，2x2 隐藏或收成 3 点简版)
   - useMemo 初始化照片池，基于当天日偏移
2. **不改** `WidgetShell`，继续用 forwardRef
3. **不改** `registry.tsx`（签名不变）

### 文档
- 本计划 md
- `src/shell/Widgets/` 新增或更新说明（注释在文件头）

### 测试
- 扩展 `src/shell/Widgets/__tests__/widgets.test.tsx`：
  - 照片 widget 在每档 size 都能渲染（已有）
  - 在非编辑态、非 drawer variant 下，给 widget-photo 发送 pointerdown + pointermove + pointerup，断言 currentIndex 切到下一张（通过 caption 文案断言）
  - tap（无 significant 位移）触发 `openApp('photos', ...)`
  - 编辑态下 pointerdown 不 stopPropagation、不切照片、不 openApp
  - drawer 预览不响应滑动
  - WidgetShell no-backdrop-filter 不变（已有循环覆盖）

## 测试计划

1. `pnpm vitest run src/shell/Widgets/__tests__/widgets.test.tsx` 必须全绿
2. 手测 Cloudflare Pages 部署后：
   - 小组件首屏渲染不破
   - 手指左右滑小组件 → 照片跟手移动，松开吸附到最近索引
   - 轻点小组件 → 打开 Photos App，出现 icon morph
   - 长按页面上任一 App 图标 → 进入编辑态 → 拖动照片小组件换位 → 位置生效
   - 2x2/4x2/4x4 三档都要验
3. 性能：swipe 小组件时 springboard 不应抖（stopPropagation 的直接作用是让 usePageSwipe 根本没进场）
