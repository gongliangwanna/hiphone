# 可爱信上传气泡装扮包

## 用户需求

用户希望完成“上传装扮包”。前置方向已经确定：允许较自由的 CSS/JS，但通过 sandbox iframe 隔离，不让装扮代码直接运行在可爱信主页面里。

## 关键决策

1. 第一版只支持 zip 装扮包。
   - zip 内包含 `manifest.json`、`bubble.html`、`bubble.css`、`bubble.js` 和可选 `assets/*`。
   - 不先支持单独上传 CSS/JS 多文件，因为 zip 更接近最终分发形式。

2. 上传后的装扮保存到 `bubbleSkinStore.customSkins`。
   - 用户刷新后仍可用。
   - 可删除自定义装扮。

3. 装扮包默认走 sandbox 渲染。
   - 主应用只传当前消息上下文。
   - 不传完整聊天记录、store、主 DOM。
   - 图片资源转为 data URL，放进 `ctx.assets`，CSS 也支持 `asset("name")` 占位符。

4. 继续不改聊天背景。
   - 装扮包只影响文本气泡本身。

## 装扮包格式

```txt
my-bubble.zip
  manifest.json
  bubble.html
  bubble.css
  bubble.js
  assets/
    paper.png
```

`manifest.json` 示例：

```json
{
  "id": "my-paper",
  "name": "我的纸条",
  "description": "自定义 CSS/JS 气泡",
  "entryHtml": "bubble.html",
  "entryCss": "bubble.css",
  "entryJs": "bubble.js",
  "accentColor": "#a46a34",
  "minHeight": 46,
  "assets": {
    "paper": "assets/paper.png"
  }
}
```

CSS 中可用：

```css
#bubble {
  background-image: asset("paper");
}
```

JS 中可用：

```js
window.renderBubble = function (ctx) {
  const root = document.getElementById('bubble');
  root.textContent = ctx.text;
};
```

## 验收

- 装扮页可以选择 zip 文件。
- zip 解析成功后出现在“我的上传”列表。
- 点击上传装扮后可应用到预览和聊天页普通文本气泡。
- 可删除上传装扮。
- 相关单测和 TypeScript 检查通过。

## 修正记录

- 用户测试「奶油贴纸」后发现短文本气泡高度被拉长。
- 根因不是 zip 解析，而是 sandbox iframe 的测高策略使用了 `documentElement.scrollHeight`。iframe 一旦被设置成较大高度，`documentElement.scrollHeight` 会包含当前视口高度，导致高度只能变大或保持，不能按真实内容缩回。
- 改为优先测量 `#bubble` 或 body 里的非脚本元素边界，并在装扮代码更新时把高度重置回 `minHeight`。
- 后续 v2 仍复现，说明框架还需要给复杂装扮一个显式测量出口：如果装扮包定义 `window.measureBubble()`，sandbox 优先使用它返回的高度，再回退到 DOM 边界测量。
