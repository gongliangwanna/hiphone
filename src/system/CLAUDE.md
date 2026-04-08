# src/system/ — System Components 原子库

## 规范
1. 只做无业务的原子组件，不包含任何 app 逻辑
2. `Material` 是 `backdrop-filter` 的唯一合法出口，其他组件不得直接写 `backdrop-filter`
3. 所有组件必须支持 className 覆盖（通过 `cn()` 合并）
4. 组件的视觉 token 通过 CSS 变量 / Tailwind class 消费，不硬编码颜色/字号
