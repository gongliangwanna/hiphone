# 聊天气泡自定义能力调研

## 结论

主流聊天 App 的气泡自定义不是“随意重绘”，而是围绕几类受控参数做组合：

- 气泡颜色：单色、上下渐变、自由渐变、深浅模式适配。
- 聊天背景：纯色、插画、照片、图案纹理、透明度/亮度。
- 主题包：气泡颜色 + 背景 + 输入框/强调色一起变化。
- 作用范围：全局默认、单个会话、双方同步或仅本机可见。
- 装饰增强：角落贴纸、头像框、字体大小、关键词动画、发送时 bubble effect。
- 资产市场：内置主题、付费主题、可分享主题链接或装扮商城。

## 竞品观察

### Telegram

- 支持自定义 Cloud Theme，可分享、同步。
- 主题可包含聊天背景。
- 官方 ThemeSettings 支持 outgoing message colors，一到四个颜色分别代表纯色、线性渐变、自由渐变。
- 支持 animated message color gradient。

### WhatsApp

- Chat themes 方向是“预设主题 + 自定义气泡颜色 + 背景/壁纸”。
- 可全局应用，也可单个聊天应用。
- 个性化主要是本机可见，不影响对方。

### Messenger / Instagram DM

- 支持按会话改 theme、color、gradient。
- 主题会改变背景和气泡颜色。
- 一些主题附带 word effects，关键词触发动画。
- Messenger 主题/颜色会影响输入框颜色，部分变化双方可见。

### LINE

- 支持聊天壁纸：插画、颜色、照片。
- 支持字体大小。
- 支持关闭背景动画。
- LINE 主题更偏整 App 界面，包括背景和按钮，可购买、下载、轮换。

### Amino

- 有 Chat Bubbles 作为付费能力。
- 自定义重点不是代码，而是在可定制气泡的角落添加 sticker/emoji。
- 支持管理、开关、排序已有气泡。

### Apple Messages

- 不提供长期换皮肤式气泡主题。
- 提供发送时 effects：bubble effects、screen effects、text effects、formatting。

## 对可爱信的启发

1. 第一优先级不是“更多花气泡”，而是“主题包”。
   - 单独气泡很容易丑。
   - 应该把气泡、聊天背景、输入框强调色、时间戳背景一起作为一个 skin。

2. 内置样式应克制。
   - 参考 WhatsApp/Telegram：浅色背景 + 低饱和气泡 + 轻微渐变/纹理。
   - 不要做大面积粉、绿、紫渐变。

3. 用户上传应分层。
   - P0：上传背景图/纹理图，调透明度、亮度、气泡颜色。
   - P1：上传 CSS，但限制到 Shadow DOM 或受控变量。
   - P2：上传 JS，必须 sandbox iframe + AST 返回。

4. 支持范围建议：
   - 全局默认装扮。
   - 单个会话覆盖。
   - 仅文本气泡先支持。
   - 图片/表情/转发卡片保持系统样式。

5. 装饰能力可以比 CSS 更有价值。
   - 角落贴纸、边框、尾巴形状、纸张纹理、背景图案，比开放任意代码更安全，也更像 QQ/Amino 的装扮心智。

## 建议下一版内置气泡

- 默认蓝：保留。
- 白绿 WhatsApp-like：淡绿色 outgoing，白色 incoming，浅纹理背景。
- Telegram 夜色：深色背景，蓝紫低饱和 outgoing，灰黑 incoming。
- LINE 插画：背景插画为主，气泡保持干净白/浅色。
- 信纸：不要黄底满纹理，改成白色半透明纸张 + 极浅纸纹 + 细边框。
- 像素/游戏：只作为趣味项，避免默认推荐。

## 可支持性判断

- 气泡颜色/渐变：可以支持，成本低。
- 背景图/壁纸/纹理：可以支持，已有聊天背景压缩逻辑可复用。
- 每个会话单独主题：可以支持，Conversation 增加 skin override。
- 角贴/边框/尾巴：可以支持，用受控 JSON 渲染。
- 字体大小/文字颜色：可以支持，但必须做对比度校验。
- 关键词动画：可以支持，建议独立 message effects 引擎。
- CSS 上传：可以支持，但必须隔离和限制。
- JS 上传：能支持，但应后置，必须 sandbox。

## 来源

- Telegram Custom Cloud Themes: https://core.telegram.org/themes
- Telegram ThemeSettings: https://core.telegram.org/constructor/themeSettings
- WhatsApp Chat Themes coverage: https://www.macrumors.com/2025/02/14/whatsapp-rolls-out-chat-themes-colorful-bubbles/
- Messenger theme/color help: https://www.facebook.com/help/messenger-app/1604688606495911
- LINE chat customization help: https://help.line.me/line/smartphone//sp?contentId=20005811
- LINE themes help: https://help.line.me/line?contentId=20000192
- Amino Chat Bubbles: https://support.aminoapps.com/hc/en-us/articles/360025982173-Chat-Bubbles
- Apple iMessage effects: https://support.apple.com/en-us/104970
