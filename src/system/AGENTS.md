# src/system/ 规范

## 不变量
1. App 顶部安全区由 Shell 统一提供，统一消费 `--app-safe-top`，禁止业务 App 自己计算状态栏高度。
2. 全屏 App 必须先经过 `AppScreen`，再在内容区内组合 `NavBar`、`List` 等系统组件。
3. 导航标题统一使用 `system/NavBar`，大标题与普通导航栏都不能把状态栏高度写死在 App 内。

## 踩坑
1. 如果页面标题遮住时间、电量，优先检查是不是绕过了 `AppScreen`，或者又在 App 内手写了 `calc(var(--status-top-padding) + 36px)`。
