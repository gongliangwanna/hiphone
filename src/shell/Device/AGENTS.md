# src/shell/Device/ 规范

## 不变量
1. 手机 fullscreen 壳层的可见宽高必须优先取 `visualViewport`，不能默认把 `100vh` / `100dvh` 当成真实可见区域。
2. fullscreen 模式的根节点尺寸应由 `ViewportProfile` 统一提供，Device 只消费，不自己再推导第二套高度逻辑。

## 踩坑
1. 部分移动端浏览器的顶部/底部工具栏会遮住 `100vh` 内容，看到"底部被挡住"时先检查是不是又绕过了 `visualViewport`。
2. 真机性能排查先开 `?perf=1`，优先看 FPS / long task / top resources，再用 HUD 的隔离开关判断是壁纸、整层 blur 还是毛玻璃在拖慢。
3. **键盘避让已明确放弃, 不要再加回来**。2026-04-11 连续做过 6 轮键盘避让尝试 (见 `docs/plan/2026-04-11-1546-chat-keyboard-fix.md` + `docs/plan/2026-04-11-1823-keyboard-counter-scroll.md`), 全部被用户否决, 最终回退到"什么都不做"的基线, 详见 `docs/plan/2026-04-11-1849-revert-keyboard-optimizations.md`。结论: iOS Safari web 的原生 `scrollToRevealFocusedElement` 是可接受的默认行为, 点输入框 → 键盘弹起 → iOS 自动 scroll 把焦点 input 推进可视区。不要再监听 `visualViewport.resize/scroll` 或 `focusin/focusout` 写 `--keyboard-height` / transform, 也不要在 ChatDetail 之类的页面加 `paddingBottom: var(--keyboard-height)`。如果需求真的回来, 必须先在 plan 文档里记录"为什么这次和上 6 次不一样"。
