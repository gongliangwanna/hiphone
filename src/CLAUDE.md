# src/ 全局规范

## 踩坑记录
1. **jsdom 不支持 PointerEvent 的 `setPointerCapture`**: vitest.setup.ts 中做了 polyfill。如果测试中手势行为异常，先检查这个 polyfill 是否覆盖了你用到的 API。
2. **`backdrop-filter` 字面量只在 `system/Material/` 中允许**: 其他位置必须使用 `<Material>` 组件。
3. **手势瞬态数据不经 React state**: 每帧 60fps 的位移/速度用 motion value / ref，React state 只在手势阶段边界更新。
4. **手势组件必须用 ref 而非 state 管理 isDragging**: React state 更新是异步的，同步 fireEvent 测试中 pointerDown 的 state 还没生效就到了 pointerUp。用 `useRef` 存储 isDragging。

## 规范
- 所有组件使用 Tailwind utility 优先，避免 inline style（动画除外）
- 动画 spring 参数只能从 `@/platform/design-tokens/motion` import
- 交互元素命中区 ≥44px，使用 `<HitArea>` 包裹
