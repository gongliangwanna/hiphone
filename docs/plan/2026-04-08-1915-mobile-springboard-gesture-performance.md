# 计划：移动端 Springboard 手势性能优化

## 用户需求

用户在真机上继续感受到主屏左右翻页有卡顿，希望进一步优化移动端滑动体验。结合现有实现与公开资料，当前瓶颈更可能来自 Web 自定义手势主线程处理、过宽的 `touch-action: none` 接管范围，以及拖拽期间 Dock 毛玻璃带来的额外合成开销，而不是简单的“浏览器锁帧”。

## 关键决策

1. 不改分页交互语义，继续保留当前 `usePageSwipe` 的物理参数与边界回弹，仅优化输入和渲染路径。
2. 将 `touch-action` 从全局 `.device-root` 收窄到具体手势层：
   - Springboard 横向分页区域使用 `pan-y`
   - LockScreen 纵向解锁区域使用 `pan-x`
3. Springboard 拖拽进行中临时关闭 Dock 的 `backdrop-filter`，释放后立即恢复，优先降低移动端合成层压力。
4. `Material` 增加显式关闭 backdrop filter 的能力，由 Dock 按交互状态调用，保持材质组件仍然是唯一出口。
5. 新增测试覆盖：
   - Material 在降级模式下不输出 `backdrop-filter`
   - Springboard 拖拽中 Dock 进入降级材质，释放后恢复
   - Springboard / LockScreen 手势面具备方向性 `touch-action`

## 交付清单

- `src/styles/global.css`：去掉全局 `touch-action: none`
- `src/system/Material/Material.tsx`：支持关闭 backdrop filter
- `src/shell/Springboard/usePageSwipe.ts`：暴露拖拽边界状态
- `src/shell/Springboard/Dock.tsx`：拖拽中降级材质
- `src/shell/Springboard/Springboard.tsx`：为手势面增加 `pan-y`
- `src/shell/LockScreen/LockScreen.tsx`：为解锁面增加 `pan-x`
- 相关测试与目录规范补充

## 测试计划

1. `pnpm test`
2. `pnpm build`
3. 组件测试验证：
   - 拖拽中 Dock 去掉 blur，释放后恢复
   - Springboard 手势层 `touch-action: pan-y`
   - LockScreen 根层 `touch-action: pan-x`
