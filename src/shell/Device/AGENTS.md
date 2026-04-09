# src/shell/Device/ 规范

## 不变量
1. 手机 fullscreen 壳层的可见宽高必须优先取 `visualViewport`，不能默认把 `100vh` / `100dvh` 当成真实可见区域。
2. fullscreen 模式的根节点尺寸应由 `ViewportProfile` 统一提供，Device 只消费，不自己再推导第二套高度逻辑。

## 踩坑
1. 部分移动端浏览器的顶部/底部工具栏会遮住 `100vh` 内容，看到“底部被挡住”时先检查是不是又绕过了 `visualViewport`。
2. 真机性能排查先开 `?perf=1`，优先看 FPS / long task / top resources，再用 HUD 的隔离开关判断是壁纸、整层 blur 还是毛玻璃在拖慢。
