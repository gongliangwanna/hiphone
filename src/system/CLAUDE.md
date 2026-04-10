# src/system/ — System Components 原子库

## 规范
1. 只做无业务的原子组件，不包含任何 app 逻辑
2. `Material` 是 `backdrop-filter` 的唯一合法出口，其他组件不得直接写 `backdrop-filter`
3. 所有组件必须支持 className 覆盖（通过 `cn()` 合并）
4. 组件的视觉 token 通过 CSS 变量 / Tailwind class 消费，不硬编码颜色/字号

## 踩坑记录
1. **WheelPicker 的 scrollTop 在 jsdom 中不生效**: jsdom 不支持真实的 scroll 行为（scrollTo/scrollTop 赋值不触发 scroll 事件），所以 WheelPicker 的 scroll-snap + 选中检测无法在 vitest 中完整测试。测试覆盖渲染和 props 传递，滚动交互依赖手动验证。
