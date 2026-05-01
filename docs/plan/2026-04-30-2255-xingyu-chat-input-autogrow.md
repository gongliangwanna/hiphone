# 可爱信聊天输入框自适应高度计划

## 用户需求

用户反馈：可爱信聊天页的输入框无论输入多少次文本都只有一行，应当随输入内容自适应变高，最多显示 10 行。

## 当前问题

`src/apps/XingYu/pages/ChatDetail.tsx` 的发送区域使用原生 `<input>`，单行输入框无法展示多行文本，也无法通过 `Shift+Enter` 保留换行。现有 `handleSend` 依赖 `inputRef.current.value` 读取移动端 IME 的实时值，这个能力需要在改成多行控件后继续保留。

## 关键决策

1. 将聊天输入控件从 `<input>` 替换为 `<textarea>`，保留 iOS 风格圆角输入容器和 44px 图标触控区。
2. 用 `scrollHeight` 驱动 textarea 自增长：内容少时保持单行，内容增加时增高，最大高度限制为 10 行，超过后在输入框内部滚动。
3. 保留 `Enter` 发送、`Shift+Enter` 换行；发送后清空内容并重置高度。
4. 不引入任何 `visualViewport`、键盘高度变量、focus/blur 监听等键盘避让逻辑，遵守 `src/shell/Device/AGENTS.md` 中已经记录的回退结论。
5. 增加 focused UI 测试，锁定 textarea 存在、多行输入、10 行高度上限和发送行为。
6. 视觉 follow-up：单行态需要保持原输入框的 40px 胶囊高度，文字在输入框内垂直居中；自增长只从第二行开始显著增高。

## 实施步骤

1. 修改 `ChatDetail.tsx` 的输入 ref 类型、自动高度计算函数和输入控件 markup。
2. 新增/补充 `ChatDetail` 组件测试，覆盖多行 textarea 与发送。
3. 运行可爱信相关测试，必要时运行类型检查。

## 验收标准

1. 输入多行文本时输入框高度随内容增加，不再固定为单行。
2. 输入框最多展示 10 行内容，超过后 textarea 内部滚动。
3. `Enter` 仍发送消息，`Shift+Enter` 可换行。
4. 发送后输入框回到单行高度。
