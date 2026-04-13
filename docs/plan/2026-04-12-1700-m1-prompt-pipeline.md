# 2026-04-12 M1：Prompt Pipeline + Token Budget + 基本功修复

## 用户需求

> 开工（执行 docs/research/ai-system-improvement-proposal.md 中的 M1 方案）

修复 AI 系统的骨架问题：prompt 组装、token 预算、maxTokens 硬编码、宏替换、messageExamples/postHistoryInstructions/persona 注入、非文本消息上下文化。

## 现状

`xingYuDataStore.ts:scheduleAICharacterReply()` L202-236 内联了全部 prompt 构建逻辑：
- 4 段字符串拼接（character.systemPrompt → aiConfig.systemPrompt → worldBook → baseline）
- history 只取 `type === 'text'`，图片/表情被过滤掉但仍触发 AI 回复
- `providers.ts:138` 硬编码 `max_tokens: 256`，aiConfig.maxTokens(2048) 被忽略
- temperature/topP/frequencyPenalty/presencePenalty 全部被忽略
- messageExamples、postHistoryInstructions、persona 三个字段存在于 store 但从未注入 prompt
- 零 token 计数，contextWindow 配置字段从未参与计算
- 零宏替换，角色不知道现在几点

## 关键决策

### D1. assemblePrompt 是纯函数

`src/platform/ai/promptAssembly.ts` 导出一个无副作用的纯函数：

```typescript
function assemblePrompt(input: PromptInput): PromptOutput
```

不读任何 store（所有数据通过参数传入），方便 100% 单测。调用方（xingYuDataStore）负责从各 store 读取数据传入。

### D2. 三阶段组装顺序

```
Phase 1 — System block
  1. character.systemPrompt
  2. aiConfig.systemPrompt
  3. worldBookChunk
  4. Baseline (auto: You are {name}. + description + personality + scenario)
  5. Persona ([关于用户] {name}: {description})
  6. messageExamples ([对话示例] <START>...<END>)
  7. Baseline 收尾指令

Phase 2 — Chat history
  - 所有消息类型都纳入（text → 原文, image → "[用户发送了一张图片]", sticker → "[用户发送了一个表情：{emoji}]"）
  - 按 token 预算从最旧消息裁剪：budget = contextWindow - maxTokens - systemEstimate

Phase 3 — Post-history instructions (作为最后一条 system message)
  1. character.postHistoryInstructions
  2. aiConfig.postHistoryInstructions
  3. 时间锚定 [当前时间：2026年4月12日 星期六 14:32]
```

### D3. Token 估算策略

简单规则，不需要 tiktoken：
- 中文字：每字 ≈ 2 token
- 英文/ASCII：每 4 字符 ≈ 1 token
- 误差 10-15%，预留 10% 安全边距

### D4. 宏替换在组装末尾做一次

对 systemPrompt 和 postHistoryPrompt 做全局替换：
- `{{char}}` → character.name
- `{{user}}` → persona.name
- `{{time}}` → HH:MM
- `{{date}}` → YYYY年MM月DD日
- `{{weekday}}` → 星期X

messageExamples 里的 `{{user}}` / `{{char}}` 因此自动生效。

### D5. streamChat 签名扩展

```typescript
// Before
streamChat(conn, messages, onToken, signal)
// After — 增加 generationParams
streamChat(conn, messages, onToken, signal, generationParams?)
// generationParams: { maxTokens, temperature, topP, frequencyPenalty, presencePenalty }
```

所有参数从 aiConfigStore 读取并传入。

### D6. postHistoryInstructions 的实现方式

作为 chat history 之后的最后一条 `role: 'system'` message 注入。这样：
- 它是 LLM 最后读到的指令，注意力最强
- 时间锚定放在这里，角色每次回复都能感知到"现在几点"

## 交付清单

1. **新建** `src/platform/ai/tokenEstimator.ts` — estimateTokens(text) 纯函数
2. **新建** `src/platform/ai/promptAssembly.ts` — assemblePrompt() 纯函数
3. **修改** `src/platform/ai/providers.ts` — streamChat 增加 generationParams
4. **修改** `src/apps/XingYu/xingYuDataStore.ts` — scheduleAICharacterReply 用 assemblePrompt + 传参
5. **新建** `src/platform/ai/__tests__/promptAssembly.test.ts` — 纯函数单测
6. 本 plan md

## 测试计划

1. `pnpm vitest run src/platform/ai/__tests__/promptAssembly.test.ts` 全绿
2. `pnpm vitest run` 全局全绿
3. `pnpm typecheck` 无错
4. `pnpm build` + deploy
