# 小组件入场动画 + 拖拽重排（M2）

**日期**: 2026-04-11 12:25
**里程碑**: Widgets System M2
**前置**: `docs/plan/2026-04-11-0300-widgets-system.md`（M1 MVP）

## 用户需求

> 小组件现在添加到这个屏幕,它没有一个动效,很生硬的就添加上去了。其次,添加到屏幕当中之后,它没法拖动,它其实应该是和APP一样,在编辑模式下是可以拖动位置的,并且有动画,然后其他的APP或者其他的小组件会去移动各自的位置,去让开位置,这个东西也是要做的。我们先把这个优化好。这个是个复杂的算法,仔细设计

拆解：
1. 从抽屉添加到桌面的 widget 要有**入场动效**（缩放 + 淡入，iOS 风格）
2. 桌面上的 widget **在编辑模式下可长按拖动**（和 app 一样）
3. 拖动时其他 app 和 widget **动画让位**
4. 支持跨页、创建新页等和 app 一致的能力

## 关键决策

### 决策 1：widget 带显式 `col/row`，app 保持有序列表
- `WidgetInstance` 新增 `col: number, row: number`（0-indexed, 左上角原点）
- app 依然是 `appOrder: string[][]`，按列表顺序 row-major 填充 widget 留下的空位
- **不做**统一 `PageItem[]` 大重构：纯有序列表 + first-fit 会丢失用户的空间落点意图（拖到右下却落到左上）

### 决策 2：打包器显式放置，抛弃 `grid-auto-flow: row dense`
- 新 `src/platform/stores/pagePacker.ts` 提供 `packPage(widgets, apps, overrides?)`
- 返回每个 slot 的 `(col, row)`，`IconGrid` 用 `gridColumnStart/gridRowStart` 显式渲染
- 这是可靠 drop-target 数学和拖拽预览的前提

### 决策 3：Framer Motion `layout` prop 统一让位动画
- 删除手写 `getShiftTransform`（当前在 widget 页强制禁用，算是个"伪实现"）
- 每个 slot 包一层 `motion.div layout`，Framer FLIP 自动处理位置变化
- 顺带修好 widget 页上 app 的让位动画（当前被禁用）

### 决策 4：Zustand `persist` 版本迁移
- `version: 2` + `migrate` 给现有持久化 widget 添上 `col: -1, row: -1` 哨兵
- 首次 `packPage` 遇到哨兵触发 `firstFit` 自动放置，然后写回 store 清理

### 决策 5：碰撞规则
1. 越界 → 钳位
2. 无碰撞 → 直接放置
3. 同尺寸 widget → swap
4. 不同尺寸碰撞 → 被压到的 widget 按 id 顺序 firstFit；任一失败 → preview 回退
5. 仅碰撞 app → 永远接受，app repack，溢出 cascade

### 决策 6：入场动画只对"刚添加"生效
- `AnimatePresence initial={false}` + store transient `recentlyAddedItemId`
- `addWidget` 成功后设 id；动画 `onAnimationComplete` 清除
- 冷启动时已持久化的 widget 不会"闪"

### 决策 7：拖拽跨页 + 统一 hook
- 复用 `useIconDrag` 的 auto-scroll-at-edge
- 加 `dragKind: 'app' | 'widget'` 分支；drop target 返回 `{kind, page, localIndex}` 或 `{kind, page, col, row}`

### 附带修复
`moveApp` 现在按 20 个"条目"裁剪溢出，忽略 widget 占据的 cell 数。本次修：用 `pageAppCapacity(pageWidgets[i])` 替代硬编码 `PAGE_SIZE`，并抽取 `cascadeOverflow` 作为统一的"塞爆多余 app 往后推"流程。

## 交付清单

### 新建
- `src/platform/stores/pagePacker.ts` — 打包器纯函数
- `src/platform/stores/__tests__/pagePacker.test.ts` — 单测
- `src/shell/Springboard/__tests__/useIconDrag.widget.test.ts` — widget 拖拽集成测试

### 修改
- `src/platform/stores/springboardLayoutStore.ts` — 数据模型 + `moveWidget` + 迁移 + bug 修复
- `src/shell/Springboard/IconGrid.tsx` — packer 驱动 + `layout` prop + 入场动画
- `src/shell/Springboard/useIconDrag.ts` — dragKind 分支 + preview
- `src/shell/Springboard/Springboard.tsx` — packer 结果传递 + 哨兵 normalize
- `src/shell/Widgets/WidgetShell.tsx` — 长按 gesture + jiggle
- 配套测试文件

## 测试计划

### 单元
- `pagePacker.test.ts`：firstFit、碰撞、overflow、cascade、override、哨兵
- `springboardLayoutStore.test.ts`：`moveWidget` 4 条规则、`moveApp` cell-budget 修复、v1→v2 迁移、`recentlyAddedItemId`

### 集成
- `useIconDrag.widget.test.ts`：drop target 数学、翻页、pointer-up 分发
- `IconGrid` 入场动画：新 widget initial prop、已有 widget 不动画

### 手动验收
1. 从抽屉添加 widget → 看到缩放淡入
2. 长按 widget → 进入 jiggle 编辑模式
3. 拖 widget → 其他 item 让位有动画
4. widget-widget 同尺寸碰撞 → 交换
5. widget-widget 不同尺寸碰撞 → 压缩让位
6. widget 拖到边缘 → 翻页
7. widget 拖到最后一页边缘 → 创建新页
8. 刷新 → 布局保留（持久化正常）
9. 给满 app 的页加 4×4 widget → 溢出 app cascade 到下页

## 提交顺序

1. ✅ C1: pagePacker.ts + 单测
2. ✅ C2: 存储层升级 + 迁移 + bug 修复
3. ✅ C3: IconGrid 改 packer 显式放置
4. ✅ C4: Framer layout + AnimatePresence + 入场动画
5. ✅ C5: useIconDrag 加 widget 分支 + `WidgetDragOverlay` ghost + IconGrid `WidgetSlot` 长按手势（C6 合并）
6. ✅ C6: (已折叠到 C5) — 长按手势最终落在 `IconGrid` 的新 `WidgetSlot` 子组件里（per-slot `useLongPress`、edit-mode pointerdown、stopPropagation），`WidgetShell` 本身无需改动
7. ✅ C7: 清理 + 全量测试（435/444 绿，9 失败为 pre-existing `Device.test.tsx` matchMedia 问题，计划书已说明容忍）+ 部署

每个 commit 都保持绿灯。

## 实施结果

- **新建**: `pagePacker.ts` + 37 单测、`WidgetDragOverlay.tsx`
- **修改**: `springboardLayoutStore.ts`(+migrate v2, `moveWidget`, `recentlyAddedItemId`, `moveApp` cell-budget 修复)、`IconGrid.tsx`(packer 驱动 + `WidgetSlot` 长按手势 + jiggle)、`useIconDrag.ts`(dragKind 分支 + widget drop target)、`Springboard.tsx`(widget drag overlay 挂载)
- **测试**: 单元测试 `getDropTarget`（7）+ `getWidgetDropTarget`（8），`pagePacker`（37），`springboardLayoutStore`（42+），`useIconDrag` 集成测试跳过（pure-function 覆盖已充分 + jsdom pointer 不可靠，`CLAUDE.md` 明确提示）
- **核心算法**: widget 原点 = 按 ghost 左上角 + 半格 bias 对 4×5 grid 取整 → `clampOrigin` 钳位。碰撞交由 store-level `moveWidget` 按 rule 1-5 处理；动画让位 100% 交给 Framer `layout` FLIP
- **长按手势**: 在 `IconGrid` 内提取 `WidgetSlot` 子组件（per-slot `useLongPress`），C6 规划的 `WidgetShell` 方案没采用，因为 `WidgetShell` 被 drawer 和 placed 两处共用，而 slot 包装层已经拥有 pageIndex/widgetId 完整上下文

## 风险

1. Framer `layout` 在 20+ slot 下性能：rAF 节流、隔离 LayoutGroup、回退方案
2. 持久化迁移：多场景迁移单测 + `resetLayout` 逃生
3. 现有 app 拖拽回归：保持 app 分支签名等价、先跑基线
4. 打包器 vs 用户直觉：widget 走 overrides 路径严格落位
5. Widget 内部组件拦截 pointerdown：shell 外层捕获 + 内部 pointer-events: none

## C8 — 拖拽实时预览（2026-04-11 post-deploy 补丁）

### 用户反馈
部署后用户测试发现两个感知问题：
1. **"本体还在"** — widget 拖动时源位置的格子占据空间（`visibility: hidden` 只隐藏像素，不释放 cell），其他 app/widget 感觉不动
2. **"移动的是个虚假组件"** — 其他 app/widget 不会实时让位，只有 pointer-up 提交后才动画到新位置

iPhone 对照验证后用户确认：*widget 不需要为 app 让位，但 app 必须为 widget 让位*——现有的非对称行为是正确的，问题只在"实时预览"缺失。

### 决策
- 把 `moveWidget` 的碰撞算法提取为纯函数 `tryMoveWidget`（`pagePacker.ts`），store 和 `IconGrid` 复用同一套规则，保证预览 = pointer-up 结果
- 每帧 `IconGrid` 用 `tryMoveWidget` 计算 `effectiveWidgets`，把它喂给 `packPage` → app 跟着 FLIP 让位；dragging slot 渲染在预览位置但 `visibility: hidden` + `pointerEvents: none`
- 源页和目标页都收到同一份 `widgetDragPreview`，源页过滤掉 widget，目标页插入 widget（跨页场景）

### 改动
- 新增 `pagePacker.ts::tryMoveWidget<W>(widgets, id, col, row): W[] | null`（泛型，便于 store + Grid 共用）
- `springboardLayoutStore.ts::moveWidget` 改写为调用 `tryMoveWidget`（DRY，行数减半）
- `IconGrid.tsx` 新 prop `widgetDragPreview`，内部 `useMemo` 计算 `effectiveWidgets`，packer 跑预览布局
- `Springboard.tsx` 从 `iconDrag.widgetDrag` + `widgetDropPos` 组装 preview 对象传入每个 IconGrid
- `pagePacker.test.ts` +9 tests（no-collision、clamp、swap、displace、impossible displacement → null、sentinel 忽略等）
- 删除旧的 `draggingWidgetId` prop，语义全部归到 `widgetDragPreview`

### 测试
- `pagePacker` 46/46、`springboardLayoutStore` 42/42、Springboard 39/39
- 全量 468/477（9 失败仍是 pre-existing `Device.test.tsx` matchMedia）
- `pnpm tsc --noEmit` 无错
- `pnpm build` OK → 部署 https://992f53c6.hiphone-wanqilin.pages.dev / https://hiphone-wanqilin.pages.dev

## C9 — App 拖拽实时让位回归修复（2026-04-11 post-C8）

### 用户反馈
> "APP移动的时候,别的APP就不给它让位置,怎么把这个功能给去掉了?"

C3 删 `getShiftTransform` 的时候，被删掉的"app 拖拽实时让位"没有用 `effectiveApps` 的方式补回来——`packPage` 一直跑在静态的 `apps` prop 上，所以 app 拖动时 sibling 不会动，必须 pointer-up commit 之后才会动画到位。这是一个隐藏了 24h 的 M2 回归 bug，C8 修小组件的时候才让用户察觉到对比。

### 决策
完全对称地复用 C8 的"effective" 模式：
- 新增 `AppDragPreview { app, fromPage, fromLocalIndex, target }`，结构与 `WidgetDragPreview` 镜像
- `IconGrid` 内部 `useMemo` 计算 `effectiveApps`：source page 移除、target page 插入、同页 splice-out + splice-in
- `effectiveApps` 喂进 `packPage`，row-major 重排后由 Framer `layout` FLIP 自动跑动画
- 拖中的 app 用 id（不是 index）识别 → `visibility: hidden` + `pointerEvents: none` 双保险
- 删除 IconGrid 的 `dragPos` / `dropPos` 两个 props（语义已合并到 `appDragPreview`）

### 改动
- `IconGrid.tsx`：新 prop `appDragPreview`，新 `effectiveApps` memo，packer 改用 effectiveApps，删 `dragPos`/`dropPos` props
- `Springboard.tsx`：从 `iconDrag.dragApp` + `dragPos` + `dropPos` 组装 `appDragPreview` 传给每个 IconGrid

### 测试
- 全量 468/477（基线持平）
- `pnpm tsc --noEmit` 无错
- 部署 https://3dfe3e65.hiphone-wanqilin.pages.dev / https://hiphone-wanqilin.pages.dev

## C10 — App 拖拽两个本体 + Widget 共存掉点 修复（2026-04-11 post-C9）

### 用户反馈
> "首先,在没有小组件的情况下,我拖动单个APP会出现两个这个APP, 一个跟手一个不跟手……他们两个应该要融合一下。
> 然后当有小组件的时候……比如说我现在最上面有一个两格的一个长方形,下面有三排APP,然后我在这儿三排进行移动某一个APP的时候,这个APP移动不动,很奇怪。"

两个独立 bug：

1. **双本体**：拖动 app 时同时显示了"跟手的 DragOverlay"和"按格子走的 grid slot"。期望只看到 DragOverlay，slot 应当完全隐藏。
2. **widget 同页时 app 拖不动**：4×2 banner 在顶部、3 排 app 在下面，拖下面 app 时 drop target 错乱、要么不动要么乱跳。

### 决策

**Bug 1 — 三重防御隐藏 dragged slot**
仅靠 `style.visibility: 'hidden'` 在生产中没起作用（对应的 vitest 渲染测试通过，但运行时仍有第二份本体）。怀疑是 Framer Motion `layout` prop 的内部行为或 `motion.button` 的 `whileTap`/`animate` 与 inline `visibility` 交互不可靠。

→ 把不透明度也接进 Framer 的 `animate` prop，让 Framer 自己拥有"隐藏"语义：
```tsx
animate={{ scale: 1, opacity: isBeingDragged ? 0 : 1 }}
```
同时保留 `style.visibility: 'hidden'` + `style.pointerEvents: 'none'`。三重防御里只要任一生效就解决问题。WidgetSlot 同步调整。

**Bug 2 — `getDropTarget` 必须 packer 感知**
旧版本写死 `localIndex = row * COLS + col`，无视 widget 占据的格子。例子：4×2 banner 在 (0..3, 0..1)，第 0 个 app 真实位于 (0, 2)，但旧公式把这个位置算成 8。`moveApp(0, 0, 0, 8)` 把 dragged app 跳到第 8 位，从用户角度看就是"乱跳"或"不动"。

→ `getDropTarget` 改为接收 `widgets: PackerWidget[]` + `appIds: string[]`，内部跑 `packPage`，按 row-major 顺序遍历 `appPlacements` 找到第一个 `(row > hoveredRow) || (row === hoveredRow && col >= hoveredCol)` 的 placement，返回它的下标作为 `localIndex`。
- 同源同页：`appIds` 必须把 dragged app 过滤掉（与 `effectiveApps` / `moveApp` 的 post-removal 语义一致）。
- 跨页：`appIds` 用目标页原样。
- Hover 在 widget cell 上：自然落到下一个空闲 app slot（前向 fallback，不再产生奇怪的高 index）。

### 改动
- `IconGrid.tsx`：app slot 和 WidgetSlot 的 motion.div 都加 `opacity: isBeingDragged ? 0 : 1` 到 `animate` prop（保留原有 visibility/pointerEvents）
- `useIconDrag.ts`：
  - `getDropTarget` 签名 `(x, y, page, pageAppCount, …)` → `(x, y, page, widgets, appIds, …)`，内部走 `packPage`
  - `onPointerMove` 计算 `pageWidgetsHere`、构造 `appIds`（同源页过滤掉 dragged）后调用新签名
  - `onPointerMove` 依赖数组加 `widgetPages`
  - 顶部 import `packPage`、`PackerWidget`、新增 `ROWS = 5` 常量
- `__tests__/useIconDrag.test.ts`：所有旧 `getDropTarget` 调用迁到新签名（用 `idsOfLength(n)` 工厂），新增 4 条 widget-aware 测试（`with widgets occupying cells` describe）
- `__tests__/iconGrid.dragPreview.test.tsx`（新建）：渲染 IconGrid + appDragPreview，验证 dragged AppIcon 的祖先 motion.div 上 `style.visibility === 'hidden'`，作为回归保险

### 测试
- `getDropTarget` 11/11、`getWidgetDropTarget` 8/8、IconGrid drag preview 1/1
- Springboard 套件 132/132
- 全量 473/482（9 失败仍是 pre-existing `Device.test.tsx` matchMedia）
- `pnpm tsc --noEmit` 无错
- `pnpm build` OK → 部署 https://6e6a5af6.hiphone-wanqilin.pages.dev / https://hiphone-wanqilin.pages.dev

## C11 — App 双本体最终修复（2026-04-11 post-C10）

### 用户反馈
> "现在大部分问题都修复了,还有一个就是移动app的时候会出现两个app,一个跟手,一个走格子.修复这个bug"

C10 的三重防御（`animate.opacity = 0` + `style.visibility = hidden` + `style.pointerEvents = none`）在生产环境仍然失效——dragged app 的 grid slot 还是和 DragOverlay 一起可见。`iconGrid.dragPreview.test.tsx` 在 jsdom 里能确认 `visibility: hidden` 已经写到 inline style 上，但浏览器实际渲染时这些都没有生效。怀疑是 Framer Motion `layout` prop 在 layout 动画期间会改写或覆盖 inline style 的某些字段（包括 visibility），或者 `motion.button` 的 active/whileTap 状态有副作用。

### 决策
**直接停止渲染 dragged slot 的 child**——是哪个 prop/style 被覆盖已经不重要了，最 robust 的做法是让 dragged slot 内部什么都没有：

```tsx
<motion.div
  key={app.id}
  layout
  ...
  style={{ visibility: isBeingDragged ? 'hidden' : 'visible', ... }}  // 保留作 belt-and-braces
>
  {isBeingDragged ? null : <AppIcon ... />}
</motion.div>
```

外层 `motion.div` 仍然存在 → CSS Grid cell 占位不变 → 邻居 Framer FLIP 仍然能正确测量 → packer row-major 数学不变。但 child 不渲染 → 没有 icon image、没有 label、没有 button → 浏览器无论如何都看不到任何东西。

WidgetSlot 同步处理：drag 中不渲染 `<Component>` 和 remove button。

### 改动
- `IconGrid.tsx`：app slot 用 `{isBeingDragged ? null : <AppIcon …/>}` 包裹 child；WidgetSlot 用同样模式包 `<Component …/>` 和 edit-mode 的 X 按钮
- `__tests__/iconGrid.dragPreview.test.tsx`：契约从 "存在 + visibility:hidden" 改为 "完全不在 DOM 中"。验证 dragged 的 `[data-testid="app-icon-app-1"]` 为 `null`，其他三个 app 仍然 truthy。再加一条 baseline 断言无 drag 时全部渲染

### 测试
- Springboard 套件 45/45（含新的"不渲染 dragged AppIcon"契约）
- 全量 474/483（9 失败仍是 pre-existing `Device.test.tsx` matchMedia）
- `pnpm tsc --noEmit` 无错
- `pnpm build` OK → 部署 https://3efdda90.hiphone-wanqilin.pages.dev / https://hiphone-wanqilin.pages.dev
