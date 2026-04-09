# AssistiveTouch 悬浮球替代 HomeIndicator

## 用户需求

hiPhone 运行在手机浏览器中，底部小白条（HomeIndicator）的上滑手势与系统原生手势栏冲突，导致 app 退出/切换功能无法正常使用。

## 解决方案

移除 HomeIndicator，新增 iOS 风格的 AssistiveTouch 悬浮球作为 app 退出和切换的入口。

## 关键决策

1. **独立 Zustand store** — AssistiveTouch 不是互斥 overlay，需与 ControlCenter 等共存，因此不扩展 uiStateStore
2. **新增 `exitAppToHome()` 动作** — 区别于 `goHome()`（后者无退出动画），新动作设置 `dismissedAppId` + `dismissReason` 触发 AppHost 的下滑退出动画
3. **完全移除 gesture mode** — 没有底部滑动手势后，`presentationMode: 'gesture'` 不再有触发源，相关代码全部清理
4. **LockScreen HomeIndicator 直接移除** — 手机浏览器全屏模式下系统原生提供底部指示条
5. **悬浮球仅在 app 活跃或 switcher 模式时显示** — 桌面无需导航，不显示

## 实施阶段

- Phase 1: 基础设施（store + 新 action）
- Phase 2: AssistiveTouch 组件（球体 + 菜单 + 拖拽吸附）
- Phase 3: 移除 HomeIndicator + gesture 死代码清理
- Phase 4: 测试 + 验证
