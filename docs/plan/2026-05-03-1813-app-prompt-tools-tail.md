# App Prompt / Tools 后置计划

## 用户需求

用户希望暂时不做“当前 app 屏幕上下文”机制，也不改变现有跨 app 记忆和记忆压缩机制。当前只做一件事：调整 prompt 排列，把每个 app 不一样的内容后置，以提升稳定前缀的 KV cache 命中率。

具体诉求：
- 保留现有所有互动进入上下文的能力。
- 保留现有记忆压缩机制。
- 全局系统提示词、角色设定、世界书、用户设定、长期记忆、历史记录尽量放在更靠前的位置。
- app 相关内容后置，包括 app system prompt、回复格式、工具说明、非 tail 工具动态状态。
- 不新增 current surface context registry。

## 关键决策

1. 不改 `characterMemoryStore`、压缩 pipeline、tool registry、app system prompt registry 的外部调用契约。
2. 在 `promptAssembly.ts` 内部拆分两个块：
   - 稳定全局 system block：全局提示词、world book、角色设定、persona。
   - app protocol block：`[当前任务]`、`[回复格式]`、`[可用动作]`、inline `[工具状态]`、legacy sticker format/list。
3. message 顺序调整为：
   - stable system
   - state tail / long-term memory / history transcript / current user turn 之前的历史材料
   - app protocol
   - post-history（时间、device context、sceneHint、tail tool state）
   - current user turn
4. app protocol 仍计入 token 预算，避免后置后历史挤爆上下文。
5. `inspectPrompt` 增加 “App 协议” section，位置在历史记录之后、Post-history 之前。

## 验证

- 先写失败测试确认 app prompt/tools 不再出现在第一段 system，且出现在历史之后。
- 更新既有 chunk 测试以匹配新 section。
- 运行 `pnpm vitest run src/platform/ai/__tests__/promptAssembly.chunks.test.ts`。
- 视情况运行相关 SDK / integration prompt 测试。
