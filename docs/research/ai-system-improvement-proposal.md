# AI 系统改进方案 — 基于调研文档 × 现有系统差距分析

> 调研日期：2026-04-07 ~ 2026-04-11
> 分析日期：2026-04-12
> 修订：2026-04-12 — 砍掉世界书关键词激活引擎（长 context 时代不值得）

## 一、现有系统 vs 调研发现 · 差距总览

| 维度 | 调研结论 | 现状 | 差距等级 |
|------|----------|------|----------|
| **Prompt 组装** | ST 10 阶段流水线，RELATIVE/ABSOLUTE 注入位置 | 4 段字符串拼接，固定顺序 | 🔴 严重 |
| **Token 预算** | 预分配 system → 填充 history → 溢出裁剪 | 零计数，contextWindow/maxTokens 配置字段存在但从未使用 | 🔴 严重 |
| **max_tokens** | 应读取用户配置 | 硬编码 256，aiConfigStore 里的 maxTokens(2048) 被忽略 | 🔴 严重 |
| **时间感知** | {{time}} {{date}} {{weekday}} 宏给角色"锚定在当下" | 无任何宏替换，角色不知道现在几点 | 🟡 中等 |
| **mes_example** | "性价比最高的活人感投入"，ST 调研强调必填 | characterStore 有 messageExamples 字段但 prompt 组装完全忽略 | 🟡 中等 |
| **postHistoryInstructions** | 放在 history 最末尾，确保 LLM 最后读到的指令 | aiConfigStore 和 characterStore 都有字段，但 xingYuDataStore 从未组装 | 🟡 中等 |
| **Persona 注入** | 独立资产，描述"用户以什么身份进入关系" | personaStore 存在但 prompt 里零引用 | 🟡 中等 |
| **多模态上下文** | EV1 用 JSON {type, payload} 统一编码所有消息类型 | 图片/表情消息触发 AI 回复但 LLM 看不到它们（被 type=text 过滤掉） | 🟡 中等 |
| **设备上下文** | 手机天然提供 Layer 0（系统时钟、App 状态、通知） | 未利用，角色不知道用户在用什么 App | 🟡 中等 |
| **Regex 后处理** | 防止"我是 AI"、角色名错误等常见 LLM 失败 | 零后处理 | 🟢 低优 |

### 世界书：为什么不做关键词激活引擎

ST 的关键词触发 → 递归扫描 → sticky/cooldown → token 预算裁剪是为 **2K-8K context 时代**设计的精细 token 管理机制。现状：

- 当前主流模型 context 128K-200K（Claude）, 1M+（Gemini）
- hiPhone 世界书预期规模 10-30 条目，每条几百 token，合计 ~6000 token — 在 128K 里连 5% 都不到
- 关键词匹配存在假阴性（用户换个说法就触发不了），LLM 自身在长 context 中找到相关信息的能力比关键词匹配更准确
- 实现成本高（关键词匹配、递归扫描、sticky/cooldown、概率门、scanDepth），ROI 低

**结论**：世界书保持现有的"全量倾倒 enabled entries"逻辑即可。仅增加一个 **token 上限兜底**（防极端场景），不做关键词引擎。

---

## 二、改进路线（3 个里程碑）

### M1：修骨架 — Prompt Pipeline + Token Budget + 基本功修复

**目标**：把 prompt 组装从散落的字符串拼接变成一个可测试、可扩展的流水线；修复所有"配了但没用"的 bug。

#### S1.1 — 提取 `assemblePrompt()` 纯函数

**现状问题**：prompt 构建逻辑全部内联在 `xingYuDataStore.ts:scheduleAICharacterReply()` 里（L202-236），跟 Zustand action、abort 控制、流式回调等业务逻辑搅在一起。无法单独测试，无法复用。

**改动**：
- 新建 `src/platform/ai/promptAssembly.ts`
- 导出 `assemblePrompt(input): { systemPrompt: string; messages: ChatMessage[]; postHistoryPrompt: string; tokenEstimate: number }`
- Input 包含：character, persona, worldBookChunk, aiConfig, chatHistory, currentTime
- 明确组装顺序：

```
Phase 1 — System block
  ├─ character.systemPrompt（角色级覆盖）
  ├─ aiConfig.systemPrompt（全局覆盖）
  ├─ worldBookChunk（全量 enabled entries，带 token 上限兜底）
  ├─ Baseline（自动生成：You are {name}. + description + personality + scenario）
  ├─ persona description（[关于用户] {persona.name}: {persona.description}）
  └─ messageExamples（[对话示例] <START>...<END> 格式 few-shot）

Phase 2 — Chat history
  ├─ 按时间排序
  ├─ 非文本消息 → 描述性文本（[用户发送了一张图片] / [用户发送了一个表情：😂]）
  └─ 按 token 预算从最旧开始裁剪

Phase 3 — Post-history instructions（LLM 最后读到的内容，影响力最大）
  ├─ character.postHistoryInstructions
  ├─ aiConfig.postHistoryInstructions
  └─ 时间锚定：[当前时间：2026年4月12日 星期六 14:32]
```

#### S1.2 — Token 估算 + 预算管理

- 新建 `src/platform/ai/tokenEstimator.ts`
- 简单估算规则：1 个中文字 ≈ 2 token / 1 个英文单词 ≈ 1.3 token（误差 10-15%，够用，不需要 tiktoken）
- `assemblePrompt` 里按 `contextWindow - maxTokens - systemEstimate` 计算 history 可用 budget，超出从最旧消息裁剪
- 世界书 token 上限兜底：`worldInfoBudgetPercent * contextWindow`（默认 25%），超出则按 order 从低到高裁剪

#### S1.3 — 修复 maxTokens 硬编码

- `providers.ts` 里 `max_tokens: 256` 改成从参数读取
- `streamChat()` 签名增加 `maxTokens?: number` 参数
- `scheduleAICharacterReply()` 传入 `aiConfig.maxTokens`

#### S1.4 — 宏替换

在 `assemblePrompt` 最后阶段对整个 system prompt + post-history 做一次全局替换：

| 宏 | 替换为 |
|---|-------|
| `{{char}}` | character.name |
| `{{user}}` | persona.name |
| `{{time}}` | 当前时间 HH:MM |
| `{{date}}` | 当前日期 YYYY年MM月DD日 |
| `{{weekday}}` | 星期X |
| `{{iso_date}}` | ISO 格式 |

让 messageExamples、systemPrompt 里的 `{{user}}` / `{{char}}` 等模板变量终于能正常工作。

#### S1.5 — 非文本消息上下文化

当前：图片/表情消息触发 `scheduleIdolReply()` 但 LLM 的 history 里看不到（被 `type === 'text'` 过滤）。

改成：history 构建时把非文本消息映射为描述性文本：
- `type: 'image'` → `"[用户发送了一张图片]"`
- `type: 'sticker'` → `"[用户发送了一个表情：${stickerEmoji}]"`

**测试**：
- `assemblePrompt` 纯函数，100% 单测覆盖
- tokenEstimator 单测
- maxTokens 传参测试
- 宏替换 snapshot 测试
- 非文本消息映射测试

**预期效果**：
- 角色终于知道"现在几点、今天星期几、对面叫什么"
- messageExamples 生效 → 说话风格更稳定
- postHistoryInstructions 生效 → "最后一句话"影响力最大
- 回复不再被硬编码 256 token 截断
- 长对话不再无限膨胀超出 context window
- 发图片/表情后 AI 不再答非所问

---

### M1.5：记忆压缩 — 基于 context 使用率的自动摘要

**目标**：当聊天记录逼近 context 预算时，自动把旧消息压缩为摘要，而不是直接丢弃。

> M1 的裁剪是兜底（不超 context window），压缩是增强（不丢失记忆）。

#### 触发机制

按 **context 使用比例** 触发，不按消息数：

```
historyTokens / historyBudget > summarizeThreshold（默认 0.8）
  → 将前半段消息调 LLM 压缩为 ~500 token 摘要
  → 摘要作为 history 的第一条 system message 注入
  → 后半段保留原文
```

`aiConfigStore.summarizeAfter` 字段改名为 `summarizeThreshold`（类型从 number 改为 0-1 的比例值，默认 0.8）。

#### 摘要存储

- `Conversation` 增加 `summary?: string` 字段
- 摘要持久化到 conversation 级别，不用每次重新生成
- 下次 assemblePrompt 时如果 summary 存在，注入为 history 开头的 `[之前的对话摘要]` 块

#### 摘要 prompt 设计

```
请将以下对话内容压缩为一段简洁的摘要（不超过500字）。
保留：关键事实、用户提到的重要信息、角色做出的承诺或约定、情感状态变化。
丢弃：日常寒暄、重复话题、无实质内容的回复。
```

#### 成本控制

- 只在 threshold 被触发时生成一次，之后 summary 缓存在 conversation 上
- 新消息累积到再次触发阈值时，追加摘要（在旧 summary 基础上增量更新）
- 后台静默执行，不阻塞用户发消息

---

### M2：活人感增强

**目标**：利用设备上下文 + 回复后处理，让角色从"能聊天"变成"活着"。

> 注：原 M2（世界书激活引擎）已砍掉。原 M3 提升为 M2。

#### S2.1 — 设备上下文注入

手机天然是活人感 Layer 0 的完美提供者：

```typescript
function buildDeviceContext(): string {
  const activeApp = useAppRuntimeStore.getState().activeAppId;
  const hour = new Date().getHours();
  const timeOfDay = hour < 6 ? '深夜' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上';
  
  const lines = [`[设备状态]`];
  lines.push(`时段：${timeOfDay}`);
  if (activeApp) lines.push(`用户当前在使用：${appDisplayName(activeApp)}`);
  // 未来可扩展：天气数据、音乐播放状态、电量等
  return lines.join('\n');
}
```

注入位置：Phase 3（post-history），在时间锚定旁边。让角色知道"现在是晚上，用户刚从地图切过来"。

#### S2.2 — Regex 后处理

在 LLM 回复写入 store 之前做一遍替换：

```typescript
const REPLY_FILTERS: [RegExp, string][] = [
  // 防止角色自称 AI
  [/我(是|只是)(一个?)?(人工智能|AI|语言模型|机器人|虚拟助手)/g, '我'],
  // 防止 markdown 代码块（聊天 App 里不该出现）
  [/```[\s\S]*?```/g, ''],
  // 防止 markdown 标题
  [/^#{1,6}\s/gm, ''],
  // 防止 markdown 粗体包裹整句
  [/^\*\*(.+)\*\*$/gm, '$1'],
];
```

可扩展为角色级配置（角色卡里加 `replyFilters` 字段），但 Phase 1 先用全局硬编码。

#### S2.3 — 设备上下文自动注入天气数据

M1 完成后，设备上下文可以直接从 weatherStore 读取当前天气：

```typescript
const weather = useWeatherStore.getState().data;
if (weather) {
  lines.push(`当前天气：${weather.current.temperature}° ${getCondition(weather.current.weatherCode).label}`);
}
```

角色就能自然地说"外面下雨了记得带伞"，零额外 API 成本。

---

### M3：结构化输出 + 多模态回复（远期）

**目标**：参考 EV1 的 JSON 输出合约，让 AI 不只回文字。

#### S3.1 — JSON 输出协议

```typescript
interface AIReply {
  messages: Array<
    | { type: 'text'; content: string }
    | { type: 'sticker'; emoji: string }
    | { type: 'action'; description: string }  // *叹气*、*微笑* 等动作描述
  >;
  mood?: string;           // 当前情绪，可用于头像表情切换
}
```

- system prompt 里加 JSON schema 指令
- 回复解析：先尝试 JSON.parse，失败 fallback 为纯文本（不做 keyword fallback 双通道，EV1 教训）
- 一条 AI 回复可以拆成多条气泡（text + sticker + action 组合）

#### S3.2 — 消息类型锁定

EV1 教训："schema 三重定义" 是因为没有在第一天锁定 message union type。

```typescript
// Day 1 锁死，后续只能 additive
type MessageType = 'text' | 'image' | 'sticker' | 'voice' | 'action' | 'system';
```

---

## 三、优先级和依赖关系

```
M1（骨架修复）→ M1.5（记忆压缩）→ M2（活人感）→ M3（结构化输出）
   ↑ ✅ 已完成       ↑ 依赖 M1 的 token 预算体系
                                    ↑ 依赖 M1 的 Phase 3 注入点
                                                       ↑ 独立，需要 prompt pipeline
```

### 执行顺序

| 阶段 | 工作量 | 用户可感知变化 | 状态 |
|------|--------|--------------|------|
| **M1** Prompt Pipeline + Token Budget + 基本功修复 | 中 | 回复不截断、角色知道时间/用户名、长对话不崩 | ✅ 已完成 |
| **M1.5** 记忆压缩（按 context 使用率触发摘要） | 中 | 长对话不丢失早期记忆 | ✅ 已完成 |
| **M2-S2.1** 环境上下文（天气+时段） | 小 | 角色知道外面什么天气、现在什么时段 | ✅ 已完成 |
| **M2-S2.2** Regex 后处理 | 极小 | 不再"我是一个 AI" | ✅ 已完成 |
| **M3** 结构化 JSON 输出 + 多消息投递 | 中 | AI 像真人一样发多条短消息 | ✅ 已完成 |

---

## 四、不做清单

根据调研中的反面教训和长 context 时代的判断：

1. **不搞世界书关键词激活引擎** — 128K+ context 下全量倾倒 + token 上限兜底足够，关键词匹配的假阴性比 LLM 自身的 context retrieval 更差
2. **不搞递归扫描 / sticky / cooldown** — 同上，复杂度高 ROI 低
3. **不搞关键词 fallback 双通道**（EV1 教训）— 要么 JSON 合约要么纯文本
4. **不搞 20 条消息上限**（EV1 教训）— 批量回复是 spam 行为
5. **不搞 tiktoken 精确 token 计数** — 前端没有高效 tokenizer，估算够用
6. **不搞 vector 检索** — 需要后端，当前场景不需要
7. **不搞角色卡 PNG 元数据嵌入** — JSON import/export 够用
8. **不搞 automationId / triggers** — 设备上下文注入比脚本化触发器更自然
