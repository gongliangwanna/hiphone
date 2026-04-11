# Springboard 编辑模式 — 长按拖拽重排 App 布局

**日期**: 2026-04-11
**需求**: 像 iOS 一样长按桌面图标进入编辑模式，支持拖拽重排 App 位置、跨页拖拽、动态创建新页面。不含删除功能。

## 用户需求
1. 长按 App 图标进入编辑模式（图标抖动）
2. 拖拽重排 App 在当前页内的位置
3. 拖到屏幕边缘自动翻页，支持跨页移动
4. 拖到最后一页边缘时创建新页面
5. 退出编辑模式后空页面自动清理
6. 布局持久化（刷新后保持）

## 关键决策
1. **数据模型**: 扁平 `string[]` 存 app ID 顺序，分页通过 `paginate()` 按 20 切分，与现有逻辑一致
2. **手势冲突**: 编辑模式下图标上的 pointer 事件 stopPropagation 阻止冒泡到 pageSwipe，空白区域仍可翻页
3. **抖动动画**: CSS animation 而非 motion library，性能更好
4. **拖拽浮层**: 使用 absolute 定位在 gesture area 内，避免被 overflow:hidden 裁切
5. **坐标系**: DragOverlay 相对于 gesture area 定位，drop zone 计算基于当前页

## 新增文件
- `src/platform/stores/springboardLayoutStore.ts` — 布局持久化 store
- `src/platform/gesture/useLongPress.ts` — 长按手势 hook
- `src/shell/Springboard/useIconDrag.ts` — 图标拖拽核心 hook
- `src/shell/Springboard/DragOverlay.tsx` — 拖拽中浮动图标
- `src/shell/Springboard/jiggle.css` — 抖动动画

## 修改文件
- `src/shell/Springboard/Springboard.tsx` — 集成 layoutStore、editMode、DragOverlay
- `src/shell/Springboard/AppIcon.tsx` — 长按、拖拽事件、jiggle class
- `src/shell/Springboard/usePageSwipe.ts` — 暴露 `goToPage` API
- `src/shell/Springboard/IconGrid.tsx` — 编辑模式布局适配（位移动画）
