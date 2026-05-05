# src/apps/XingYu 规范

## AI 回复与 memoryStore 粒度

- XingYu 是类似微信的聊天 UI；一次 AI 回复中的多个 `text` item 表示多条聊天气泡。
- 写入 `characterMemoryStore` 时必须和 UI 气泡/action 粒度对齐：多个 `text` item 写成多条 assistant memory entry。
- 禁止把 `reply.rendered` 合并文本直接作为一条 assistant entry 写入；否则 prompt transcript 只能渲染成一条多行消息，后续行不会有独立说话人前缀。
- 单条气泡内部用户主动输入的换行仍保留为同一条 message 的内部文本，不应在 XingYu 层拆分。
