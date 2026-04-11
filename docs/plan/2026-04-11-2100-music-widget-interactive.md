# 2026-04-11 音乐小组件可交互化 & 美化

## 用户需求

> 我们来优化音乐小组件,可互动,美观好看.

两个目标：
1. **可互动** — 小组件不再只是展示，播放/暂停、上一首/下一首都可以直接在桌面上操作；空白区点击应该像 iOS 一样打开音乐 App
2. **美观** — 视觉更精致，与 iOS 17+ Now Playing widget 观感对齐，增加动效而不伤性能

## 现状

`src/shell/Widgets/MusicWidget.tsx`

- 三档尺寸 2x2 / 4x2 / 4x4，纯展示
- 背景是专辑封面高斯模糊 + 压暗遮罩（已有 `translateZ + will-change + contain:paint` 的性能优化，不要破坏）
- `MusicWidgetBody` 被 `memo` 包住，只在 songId / isPlaying / size 变化时重渲染
- `ProgressBarLive` 是唯一订阅 `progress` 的叶子节点，15Hz 更新只改 `right:` 百分比
- 播放/暂停/上下首图标都是静态 `lucide-react` 图标，未绑定事件
- 小组件点击后不触发任何业务动作

`src/shell/Springboard/IconGrid.tsx` 中的 `WidgetSlot`
- 非编辑态：600ms longpress 触发进入编辑 + 拖拽
- 编辑态：pointerDown 立即开始拖拽（`stopPropagation` 避免 page swipe 抢手势）
- 编辑态的按钮如果 `stopPropagation` 会让 drag 不从按钮位置起手 —— 需要直接在小组件里感知 isEditMode，编辑态下禁用按钮

## 关键决策

### 1. 编辑态/预览态感知不走 registry 接口扩展

需要避免按钮在编辑态"吃掉"拖拽手势，并避免 drawer 预览里误点播放。候选方案：
- 方案 A：扩展 `WidgetRenderProps` 增加 `interactive` 字段，`IconGrid` 传 `!isEditMode`
- 方案 B：小组件直接订阅 `useSpringboardLayoutStore(s => s.isEditMode)`，`variant === 'drawer'` 就关闭交互

选 B。理由：
- 不动 registry 接口，其他 4 个 widget 免改
- `isEditMode` 切换频率极低，订阅成本可忽略
- 小组件本来就知道自己是 placed 还是 drawer（已有 `variant`）
- 维护成本更低

### 2. 空白区点击打开 Music App

使用 `useAppRuntimeStore(s => s.openApp)` + `WidgetShell` 的 ref 测量 `getBoundingClientRect`，得到 `AppOrigin`，触发标准 icon→app 动画。

注意点：
- `WidgetShell` 已经 `forwardRef`，但当前没被 MusicWidget 消费，要拉过来
- 按钮点击必须 `stopPropagation()`，避免 bubble 到最外层触发打开
- 编辑态 / drawer 一律不触发 `openApp`

### 3. 按钮手势避让

按钮的 `onPointerDown` 必须 `stopPropagation()`，否则会：
- 非编辑态：被 `WidgetSlot` 的 `longPress.onPointerDown` 捕获，按住 600ms 会进入编辑态
- 编辑态：被 `handleEditPointerDown` 捕获，立刻触发拖拽

`onClick` 也 `stopPropagation()`，防止外层 open-app 处理器命中。

### 4. 动效与性能

保留现有 3 层渲染架构（背景模糊层 / 遮罩层 / 内容层），只在内容层加小动效：

- **EQ 指示器**：3 根竖条 CSS `@keyframes` 变高度，只在 `isPlaying && isActive` 时播放（offscreen 暂停 → 不吃 GPU）。大小 8–12px，位于艺术家名右侧或标题左前。
- **4x4 黑胶旋转**：专辑封面 `animation: rotate 20s linear infinite`，`animationPlayState` 跟 `isPlaying && isActive` 绑定。
- **按钮按压反馈**：`motion.button whileTap={{ scale: 0.86 }}`，spring 用 `design-tokens/motion` 里的 `snappy`。
- **封面阴影与高光**：增加 inset 高光 + 更强的投影让封面有物理感。

动画只用 `transform` 和 `opacity`，不触发 layout / paint。`willChange: transform` 仅在 isActive 时开，offscreen 时降为 `auto`。

### 5. 图标统一走 lucide-react

按 memory + src/CLAUDE.md 的要求，所有图标从 `lucide-react` 导入：
- `Play` / `Pause`（填充白色）
- `SkipBack` / `SkipForward`（填充白色）
- `Music` 占位（无歌曲时）

### 6. 各尺寸布局

**2x2 小号**
```
┌─────────────┐
│ [art]  ▶   │   ← 专辑封面 + 悬浮 play/pause（圆形按钮）
│            │
│ Title      │
│ Artist ♬♫♬ │   ← EQ 条跟随艺术家名
│ ═════──    │   ← 进度条
└─────────────┘
```

**4x2 中号**
```
┌──────────────────────────────────┐
│ [art]  Title                    │
│ [art]  Artist ♬♫♬               │
│ [art]  ═══════──── 1:23 / 3:45  │
│ [art]  ⏮    ▶/⏸    ⏭           │
└──────────────────────────────────┘
```

**4x4 大号**
```
┌──────────────────────┐
│                      │
│       ◉ [art]        │ ← 可旋转（isPlaying 时）
│      (vinyl)         │
│                      │
│    Title (center)    │
│    Artist ♬♫♬        │
│                      │
│  ═══════════──       │
│  1:23       3:45     │
│                      │
│   ⏮    ▶/⏸    ⏭     │
└──────────────────────┘
```

### 7. 空态（no song）

无歌曲时：
- 背景降级为现有的紫黑渐变
- 中间一个大号 Music 图标 + "未在播放"
- 点击整件打开音乐 App
- 按钮隐藏（没东西可操作）

## 实施步骤

1. 重写 `src/shell/Widgets/MusicWidget.tsx`
   - 新增订阅：`isEditMode`、`togglePlay` / `skipNext` / `skipPrev`、`openApp`
   - `WidgetShell` 拉 ref，`onClick` 取 rect 打开 App
   - 提取 `ControlButton` 小组件（封装 stopPropagation + whileTap）
   - 提取 `EqualizerBars` 小组件（CSS keyframes + `isActive && isPlaying` 控制 playState）
   - 重写 `SmallMusic` / `MediumMusic` / `LargeMusic`，按上表布局
2. 保留 `MusicWidgetBody` memo + `ProgressBarLive` 的 15Hz 隔离
3. 新 widget 里任何 `<style>` keyframes 用 scoped `<style>` 标签（跟 PhotoWidget 一样）
4. 测试：
   - `src/shell/Widgets/__tests__/widgets.test.tsx` 已覆盖三档渲染，跑一遍确保不挂
   - 新增一个小 case：放置态下点击播放按钮会调用 `togglePlay`
5. `pnpm build` + `pnpm test` 双验
6. 按 CLAUDE.md 部署流程推到 Cloudflare Pages

## 风险 & 缓解

- **长按进入编辑态被按钮吃掉** → 按钮只在 `!isEditMode && variant !== 'drawer'` 时挂 onPointerDown stopPropagation；编辑态按钮变哑巴（纯视觉），长按正常传递到 WidgetSlot
- **openApp 依赖 AppOrigin 测量** → 用 WidgetShell ref + `getBoundingClientRect()`，和 AppIcon 的做法一致
- **动画在 offscreen 页面吃 GPU** → `useIsPageActive()` 控制 `animationPlayState`，和 PhotoWidget / ProgressBarLive 策略一致
- **Zustand selector 返回新引用** → 订阅的都是标量字段，没有数组/对象派生

## 不在本次范围

- 歌词展示、下一首预览、队列面板 —— 留给 Now Playing / Music App 本体
- 小组件的 AI 推荐 / 动态色提取 —— 视觉已经够丰富，不过度设计
- 4x4 加滚动歌词 —— 性能开销大，放弃
