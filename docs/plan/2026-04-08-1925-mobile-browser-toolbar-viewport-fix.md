# 计划：移动端浏览器工具栏遮挡适配

## 用户需求

用户反馈在部分手机浏览器里，页面并不能真正全屏，浏览器顶部或底部工具栏会挡住一部分系统界面。当前实现依赖 `100dvh` / `100vh`，在这些浏览器中并不总能等于真实可见区域，因此需要让壳层高度跟随实际可见视口。

## 关键决策

1. Fullscreen 模式不再把 `Device` 高度写死成 `100dvh`，改为使用运行时计算出的像素值。
2. `useViewportProfile` 优先读取 `window.visualViewport.width/height`，回退到 `window.innerWidth/innerHeight`，从源头让 profile 表示“用户当前真实能看到的区域”。
3. `visualViewport.resize` 和普通 `window.resize` 继续同时监听，保证地址栏/底栏收起展开时壳层会跟着变。
4. 为 Device 子目录补一份 `AGENTS.md`，记录移动端 fullscreen 高度必须优先走 visual viewport，避免以后又退回 `100vh` 类写法。

## 交付清单

- `src/shell/Device/useViewportProfile.ts`：优先使用 `visualViewport`
- `src/shell/Device/Device.tsx`：fullscreen 用像素宽高而非 `100dvh`
- `src/shell/Device/AGENTS.md`：记录工具栏遮挡相关规范
- `src/shell/Device/__tests__/Device.test.tsx`：更新 fullscreen 断言

## 测试计划

1. `pnpm test`
2. `pnpm build`
3. 验证 fullscreen shell 使用 profile 给出的像素宽高，而不是 `100vw/100dvh`
