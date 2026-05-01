# 可爱信任意 CSS/JS 气泡运行时原型

## 用户需求

用户希望自定义气泡可以开放任意 CSS/JS，不要做太大的限制。前一轮通过 image generation 明确了目标：气泡要能真正重绘，能做胶带、纸张、角标、玻璃高光、星点、特殊结构，而不是只换颜色。

## 关键决策

1. 使用 sandbox iframe 作为自由运行时。
   - CSS/JS 在 iframe 内自由控制气泡 DOM。
   - 主应用不直接 `eval` 用户代码。
   - iframe 只接收当前消息文本、左右方向和少量上下文。

2. 先做内置 `sandbox` 示例装扮。
   - 不先做上传器。
   - 示例验证 `bubble.html/css/js` 这种装扮包模型能否画出更有差异的气泡。

3. 聊天背景不参与装扮。
   - 背景仍由聊天设置单独控制。
   - sandbox 只负责气泡内部。

4. 富内容先回退原生渲染。
   - 含引用块等 React 子组件时，iframe 无法直接渲染 React 节点。
   - 本阶段 sandbox 只接管普通文本消息。

5. 轻边界，不重限制。
   - iframe 使用 `sandbox="allow-scripts"`，不给 `allow-same-origin`。
   - 不给完整聊天记录、主存储、主 DOM。
   - 代码可以自由操作 iframe 内 DOM 和动画。

## 验收

- 新增一个内置 CSS/JS 示例气泡。
- 切换到该气泡后，普通文本气泡由 iframe 渲染。
- 气泡能体现结构差异，而不只是换色。
- 普通原生气泡仍可用。
- 相关单测和 TypeScript 通过。
