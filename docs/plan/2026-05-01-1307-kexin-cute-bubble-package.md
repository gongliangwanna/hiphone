# 可爱信复杂可爱气泡装扮包

## 用户需求
- 用户要一个可以直接上传到可爱信「个性装扮」里的 zip 气泡装扮包。
- 气泡需要“复杂”和“可爱”，不能只是换颜色。
- 不需要我操作浏览器，用户会自己上传测试。

## 关键决策
- 装扮命名为「奶油贴纸」，风格采用奶油纸纹、贴纸胶带、缝线、爱心星星浮层和左右不同轮廓。
- 使用当前已实现的装扮包格式：`manifest.json`、`bubble.html`、`bubble.css`、`bubble.js`、`assets/`。
- 通过 CSS/JS 沙箱绘制气泡，不改聊天背景，不依赖外部网络资源。
- 资源使用包内 SVG 纸纹/蕾丝素材，并通过 `asset("name")` 引用，验证上传解析链路。

## 验证方式
- 用 `zip` 生成最终包。
- 用 `JSZip` 检查 zip 内文件结构。
- 用现有 `parseBubbleSkinPackage` 测试覆盖导入格式兼容性。

## 问题修正记录
- 用户测试后发现短文本气泡过长。
- 根因：沙箱 iframe 会占满消息父容器，而装扮 CSS 里 `.bubble { width: 100%; }` 让可见气泡也被拉满。
- 修正：改为 `width: fit-content`、`max-width: calc(100% - 14px)`，并由 `body.is-mine/is-other` 控制左右对齐。
- 用户继续测试后发现长文本像大卡片，边框和装饰过重。
- 修正：增加 `short/medium/long/tall` 状态。短文本保留贴纸装饰；长文本自动收起大贴纸、缝线、蕾丝和大面积内框，改成更接近聊天气泡的紧凑边框。
- 用户停留在问题页后，运行态证据显示：当前页面加载的是新版 zip，主应用也加载了新版测高逻辑，但短文本 iframe 仍被测成 269/285px。
- 根因：装扮 CSS 使用 `width: fit-content`，在 iframe/flex 环境下会收缩到接近最小内容宽度，中文文本被压成多行，导致 `#bubble.getBoundingClientRect()` 自身高度异常。
- 修正：改为 `width: max-content` + `max-width`。短文本按自然宽度展示，长文本超过上限后正常换行。
- v2 仍复现后继续查框架和包的交界。最小复现显示 `#bubble` 的 computed `display` 变成 `block`，原因是包内 `body { display: flex }` 会把 inline-block 气泡块化成 flex item。
- 修正：包内左右对齐改用 `text-align`，不再让气泡成为 flex item。同时定义 `window.measureBubble()`，配合主框架显式测量钩子。
- 用户打开诊断页后仍看到旧结构中 `#bubble` 高度异常。根因进一步收敛：复杂装饰 DOM 节点放在 `#bubble` 内部，结构容错太差。
- 决策：发布 v3，改成单内容节点结构。所有可爱视觉改由背景、边框和伪元素表达，不再让装饰 DOM 参与布局。
- v3 在应用预览中仍偏高，并且装饰感下降。继续收敛：框架已支持 `measureBubble()`，包应显式以 `#content` 高度反推 `#bubble` 高度，而不是让浏览器根据背景/伪元素/inline-block 自行推断。
- 决策：发布 v4。保持单内容节点，恢复更多背景装饰，但 JS 在每次渲染后同步 `#bubble` 高度为内容高度 + padding + border，`measureBubble()` 也复用该结果。
- 用户测试 v4 后出现文本被裁剪，说明“JS 写高度”会和真实行高/字体加载/iframe 测量时序互相打架。
- 决策：发布 v5，撤掉所有 JS 写高度。气泡高度完全回到 CSS 普通文档流，`measureBubble()` 只读取 `#bubble` 边界，不再修改 DOM。
