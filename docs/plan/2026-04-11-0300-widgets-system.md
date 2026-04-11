# 桌面小组件系统 — Widgets System

**日期**: 2026-04-11 03:00
**状态**: M1 MVP 完成（S1–S5）

## 用户需求

> 现在我们来添加这个小组件功能，在我们 APP 编辑模式里面，我们现在左边是完成，左上角是完成，右上角是编辑，我们把完成移到右上角，编辑移到左上角，那么编辑改成小组件，点击小组件之后，这个屏幕下方就会拉起一个抽屉，这个抽屉当中的话就会有各种 iOS 小组件，比如说当前的日历啊，就不是就显示时间的呀，时间小组件，然后还有时间日期节假日的小组件，然后天气小组件，音乐播放小组件之类的东西，你可以设计几个，然后小组件就可以从下方抽屉拖到上面去，然后摆放在上面的 APP 之间，这个需要参考苹果的设计，比如说你有两个的四个的之类的，当然也有图片小组件，OK，我们做一个这样的系统。

拆解：
1. 编辑模式按钮位置对调：**完成**移到右上角，**编辑**移到左上角
2. 左上角按钮改名为 **小组件**，点击后从屏幕下方拉起**抽屉**
3. 抽屉内展示多个类 iOS 小组件候选：**时间**、**日期+节假日**、**天气**、**音乐播放**、**照片**
4. 支持苹果的 **2×2 / 4×2 / 4×4** 三种规格
5. 小组件可从抽屉拖到桌面，摆放在 app 之间
6. 视觉与交互参考苹果设计

## 关键决策

### 1. 统一 Slot 模型：app 与 widget 共用一个页面布局

**现状**: `springboardLayoutStore.appOrder` 是 `string[][]`（每页 ≤ 20 个 app id）。

**新模型**: 每一页从"字符串 app id 数组"升级为 **Slot 数组**：

```ts
type SlotItem =
  | { type: 'app'; id: string }
  | { type: 'widget'; id: string; kind: WidgetKind; size: WidgetSize };

type WidgetSize = '2x2' | '4x2' | '4x4';
type WidgetKind = 'clock' | 'date' | 'weather' | 'music' | 'photo';

type Page = SlotItem[];
```

每个 slot 占据固定的网格单元数：
- `app` / `2x2` / `4x2` / `4x4` 分别占用 **1 / 4 / 8 / 16** 个 cell（其中 1 cell = 1 个 app 槽位）

**页面容量**: 仍然按 `4 cols × 5 rows = 20 cells` 计。一页最多放下的小组件：1 个 4×4 + 1 个 4×1 剩余空间填 app，或 4 个 2×2 + 2 列 app 等。

### 2. 渲染策略：CSS Grid + `grid-column`/`grid-row` span

- 页面容器改为 `display: grid; grid-template-columns: repeat(4, 1fr); grid-auto-rows: <rowStep>px;`
- App icon 默认 span 1×1
- Widget 按 size 设置对应的 column span + row span
- **流式布局**: DOM 顺序即渲染顺序（左到右、上到下），浏览器自然处理占位与换行
- 为了让跨多列的 widget 不换行错位，采用 `grid-auto-flow: row dense`，让后续小 icon 填充剩余空位（类似 iOS 的"卡住空位"行为）

### 3. 抽屉组件：复用底部 sheet 交互模式

- 新建 `src/shell/WidgetDrawer/WidgetDrawer.tsx`
- 采用 `Material variant="chrome"` 毛玻璃背景
- 从底部弹出，初始 70% 高度，可手动拖拽缩放
- 顶部：拖拽条 + 分类横滑（时钟 / 日期 / 天气 / 音乐 / 照片）
- 内容：当前分类下的 widget 预览卡片（按 2×2 / 4×2 / 4×4 分组）
- **参考 iOS**: 视觉风格同 iOS Widget Gallery

### 4. 拖拽接入现有 `useIconDrag` 手势链

- Widget 在 Springboard 上的拖拽复用 `useIconDrag` 逻辑，仅扩展 `DragPosition` 含 `slot` 尺寸信息
- 从 Drawer 拖到 Springboard 的跨容器拖拽：
  - DrawerItem `onPointerDown` 启动拖拽，创建 `pendingWidgetPlacement` 状态
  - 手指移动到 Drawer 顶部拖拽条以上时，Drawer 自动收起并将拖拽移交给 Springboard 的 drop handler
  - 松开时在 `dropPos` 对应 slot 插入新 widget（并把被覆盖的 cells 推后）

**MVP 简化**: 首版**先实现"从抽屉点击即添加到当前页面第一个能容纳的空位"**，桌面内拖拽排序留到 S5 完善。这样可以优先交付可见的核心体验，避免前置把复杂拖拽系统一次性做完。

### 5. Widget 组件库：内容驱动 + 静态样式

每个 widget 是一个纯展示组件，从对应 store 读取数据：
- `ClockWidget` — 读 `useClock`（已有）
- `DateWidget` — 用 `new Date()` 显示月日周，节假日 MVP 可先留 placeholder 文案
- `WeatherWidget` — 读 `weatherStore`（若存在，否则 fallback 到 mock）
- `MusicWidget` — 读 `musicDataStore.currentTrack`
- `PhotoWidget` — 从 `photosStore` 取第一张近期照片，没有则默认占位

每个 widget 根据传入的 `size` 做内部响应式布局（小的只显示时间，大的显示更多信息 — 参考苹果 Widget 尺寸梯度）。

### 6. StatusBar 按钮位置调整

按用户要求将编辑模式下的按钮 **左右对调**，且把"编辑"改为"小组件"，点击后 dispatch 一个新的 action `openWidgetDrawer()`。

## 交付清单

### S1 — StatusBar 按钮调整 + Drawer 状态
- [x] 计划文档
- [ ] `springboardLayoutStore` 新增 `isWidgetDrawerOpen` + `openWidgetDrawer/closeWidgetDrawer`
- [ ] `StatusBar.tsx`: 小组件 (左) + 完成 (右)
- [ ] 测试: 点击小组件按钮触发 `isWidgetDrawerOpen=true`

### S2 — Slot 数据模型升级
- [ ] 在 `springboardLayoutStore` 定义 `SlotItem` 与 `PageSlots` 类型
- [ ] 持久化字段 `appOrder` → `pageSlots` 类型迁移（保留向后兼容：老数据转为 `{type: 'app', id}`）
- [ ] `resolveOrderedPages` 升级为返回 `SlotItem[][]`
- [ ] 新增 `addWidget(page, kind, size)` / `removeWidget(page, widgetId)` action
- [ ] 单测: migration 与 addWidget 占用 cell 数正确

### S3 — Widget 组件库
- [ ] `src/shell/Widgets/` 目录
  - [ ] `WidgetShell.tsx` — 通用容器（圆角、毛玻璃 via Material、padding、shadow）
  - [ ] `ClockWidget.tsx`
  - [ ] `DateWidget.tsx`
  - [ ] `WeatherWidget.tsx`
  - [ ] `MusicWidget.tsx`
  - [ ] `PhotoWidget.tsx`
  - [ ] `registry.ts` — `WidgetKind → React component` 映射
- [ ] 每个 widget 支持 `size: '2x2'|'4x2'|'4x4'` prop，根据 size 改变内容密度

### S4 — IconGrid 升级为 SlotGrid
- [ ] 改造 `IconGrid.tsx` → `SlotGrid.tsx`（保留对 app 的处理）
- [ ] Widget slot 渲染 `<Widget>` 组件并设置 grid span
- [ ] 编辑模式下 widget 也 jiggle + 左上角红色"−"移除按钮
- [ ] 单测: slot 布局对 (app + widget 混合) 正确

### S5 — WidgetDrawer 组件
- [ ] `src/shell/WidgetDrawer/WidgetDrawer.tsx`
- [ ] 从底部弹出的 motion sheet（高度 70vh）
- [ ] 顶部 tab 切换 widget 分类
- [ ] 点击 widget 预览卡 → `addWidget(currentPage, kind, size)` → 关闭抽屉
- [ ] 单测: 渲染 + 点击触发添加

### S6 — 桌面内 widget 拖拽（扩展 useIconDrag）
- [ ] `DragPosition` 增加 `span: {cols, rows}` 字段
- [ ] drop 目标计算时需要考虑 widget 占位大小（不能放到页边缘导致越界）
- [ ] widget 与 app 互相推挤
- [ ] 单测: 混合拖拽

## 里程碑拆分

| 里程碑 | 范围 | 本 Plan |
|--------|------|---------|
| **M1 MVP** | S1 → S5（含点击抽屉直接添加）| ✅ 本次交付 |
| M2 | S6 桌面内拖拽重排 | 留待后续 |
| M3 | Widget 个性化（主题色、数据源切换）| 留待后续 |

## 文件改动

| 文件 | 动作 |
|------|------|
| `src/shell/StatusBar/StatusBar.tsx` | 按钮位置对调 + 改名"小组件" |
| `src/platform/stores/springboardLayoutStore.ts` | Slot 模型 + drawer state + addWidget |
| `src/shell/Springboard/IconGrid.tsx` | 改造为 slot 渲染 |
| `src/shell/Widgets/*` | 新建 widget 组件库 |
| `src/shell/WidgetDrawer/*` | 新建抽屉组件 |
| `src/shell/Device/Device.tsx` | 组合 WidgetDrawer 到 shell |

## 测试计划

1. StatusBar 按钮单测: 左右位置 + onClick
2. Store 单测: `addWidget` 占位、迁移、persistence
3. Widget 渲染单测: 每个 widget 的 3 个 size 变体
4. WidgetDrawer 单测: 渲染 + 添加 widget
5. IconGrid slot 布局单测: 混合场景
6. E2E: 编辑模式 → 点击小组件 → 抽屉弹出 → 选中 widget → 出现在桌面
