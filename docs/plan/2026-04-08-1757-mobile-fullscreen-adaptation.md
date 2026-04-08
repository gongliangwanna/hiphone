# 计划：手机端真全屏与主流机型适配

## 用户需求

用户希望项目继续保持桌面端“电脑里看手机模拟器”的展示方式，同时在手机上支持真全屏展示，并适配主流 iPhone / Android 竖屏机型。当前实现存在固定 `393` 宽度、无 safe-area、Springboard 图标尺寸写死等问题，导致手机端出现黑边、留白和布局裁切。

## 关键决策

1. `Device` 拆成两种壳层模式：
   - `simulator`：桌面端保留居中手机态，按 `430 × 932` 比例等比缩放。
   - `fullscreen`：手机粗指针竖屏且宽度在 `360-430` 之间时启用真全屏。
2. 新增内部 `ViewportProfile` 与 `sizeTier`：
   - `compact`：`width <= 375` 或 `height < 760`
   - `regular`：`376-411` 且 `760-899`
   - `large`：`>= 412` 且 `>= 900`
3. Safe-area 与壳层布局变量统一由 `Device` 根节点输出，`StatusBar`、`LockScreen`、`HomeIndicator`、`Springboard` 读取 CSS 变量，不再各自硬编码顶部/底部偏移。
4. Springboard 保持 4 列、每页 20 图标，不引入纵向滚动；通过 `sizeTier` 收缩 side padding、icon、cell、label、gap 和 dock padding-y 适配短屏。

## 交付清单

- `index.html` 支持 `viewport-fit=cover` 与 `100dvh`
- 新增 `ViewportProfile` / `useViewportProfile` 与布局 metrics
- `Device` 支持 simulator / fullscreen 双模式
- `StatusBar` / `LockScreen` / `HomeIndicator` / `Springboard` 接入 safe-area 与布局变量
- Springboard 图标 / Dock 尺寸改为按 `sizeTier` 输出
- 新增纯函数与组件测试，覆盖视口判定和布局行为

## 测试计划

1. 纯函数测试：
   - `1440×900` -> `simulator`
   - `360×800` -> `fullscreen + compact`
   - `375×812` -> `fullscreen + compact`
   - `390×844` -> `fullscreen + regular`
   - `412×915` -> `fullscreen + large`
   - `430×932` -> `fullscreen + large`
2. 组件测试：
   - `Device` 在 `fullscreen` 下无圆角手机壳、使用全屏尺寸
   - `Device` 在 `simulator` 下保留居中设备态与 safe-area CSS 变量
   - `Springboard` 在不同 `sizeTier` 下应用对应 metrics，而非固定尺寸
3. 集成校验：
   - `pnpm test`
   - `pnpm build`
