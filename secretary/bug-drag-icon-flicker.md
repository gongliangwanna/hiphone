# Bug: 拖拽APP归位后闪烁

## 优先级
P2

## 现象描述
长按APP进入编辑模式后，拖动APP图标，放手后 icon 会有一个动画归位到最近的格子位置。到达最终位置后，会闪烁一下。

## 相关代码区域
- `src/shell/Springboard/useIconDrag.ts` — 拖拽核心逻辑
- `src/shell/Springboard/DragOverlay.tsx` — 拖拽浮层与归位动画
- `src/shell/Springboard/IconGrid.tsx` — 网格渲染与实时预览
