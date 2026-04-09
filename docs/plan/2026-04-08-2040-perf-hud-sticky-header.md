# 性能 HUD 固定头部

## 用户需求
- 当前性能 HUD 的标题和按钮会跟内容一起向下滚动。
- 需要把 HUD 头部固定住，标题和操作按钮始终可见，只允许内容区滚动。

## 关键决策
1. 不使用整块 `sticky` 叠层方案，直接把 HUD 拆成 `header + scroll body`，结构更稳定。
2. 外层 `aside` 改为 `flex column + overflow-hidden`，避免整个容器产生滚动。
3. 头部独立为 `shrink-0` 区域，内容区独立 `overflow-auto`。
4. 补最小测试，确保头部和内容区分别存在，并且 HUD 根节点不再承载滚动。

## 验收
1. HUD 标题和按钮在长内容下始终可见。
2. 只有内容区滚动，外层 HUD 不滚动。
3. `pnpm test` 通过。
4. `pnpm build` 通过。
