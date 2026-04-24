---
milestone: M5 (pending)
parent: docs/plan/2026-04-12-1720-m1.5-memory-compression.md
prereq: M4.1 accepted (character-level memoryStore 已上线)
status: spec
---

# 角色记忆系统重构 — 情感连续性 + 记忆连续性

## 概述

当前的 `summarizer.ts` 把历史压成一段第一人称散文塞回 history，用来续写长对话。实际运行暴露四类连续性断裂：

1. **忘事**（压缩后具体细节糊掉：名字、生日、约定、偏好）
2. **情感跳变**（压缩后关系基调/亲密感回到"初次见面"）
3. **人设漂移**（长对话内容把角色原本的性格特征冲淡）
4. **关系演进缺失**（称呼、阶段不随互动变化）

根因是"一个自由文本 summary 同时承担多种不同衰减规律的信息"——客观事实、关系状态、角色自我一致性、情绪轨迹被塞进同一个 blob，互相覆盖互相稀释。

本次重构把记忆拆成多个有各自衰减规律的层，用多次并发 LLM 调用分别更新，注入时按 KV-cache 稳定度排布。

**核心设计目标：像真人一样。** 具体表现为：
- 长期事实不遗忘且可演化（链式更新）
- 关系状态慢变、有惯性、不实时抖动
- 人设永远是稳定锚点
- 情感/印象深刻的瞬间被专门"钉住"

## 本期做 / 不做

**做：**
- 新增 `CharacterMemoryState`（per-character 的结构化状态表）
  - 关系模型（定性 + 内部 affinity 计算）
  - 事实链（6 种 subject，支持 append 演化）
  - OpenLoops（未闭环的约定/挖的坑）
  - Highlights（印象深刻的瞬间）
  - EpisodicSummary（第一人称散文，含"最近基调"段）
- `characterMemoryStore` 原始流保留，`MemoryEntry.compressed=true` 语义变更
- 压缩 pipeline 重写：3 次并发 LLM 调用（Pass A/B/C）+ 事务性写回
- `promptAssembly` 的 state 注入层改造
- 触发机制保持不变（threshold 自动 + 手动）

**不做（明确推迟）：**
- app 级 MemoryPolicy 分桶（狼人杀"女巫"游戏态污染问题）—— 出问题再补
- 重要性衰减的周期性清理 job —— 等 Highlights 溢出再做
- 用户可见的"记忆查看器"UI —— M4.1 已推迟
- 向量检索 / RAG —— 明确不做（用户约束）
- Chat 时 multi-step agent 查记忆 —— 明确不做（用户约束）
- BC9 独立的"情绪曲线层"、BC10 场景态、BC11 周期模式、BC12 角色成长
- 跨角色的心智理论级隐私建模（peer 秘密的"A 知道 B 的事，B 是否该知道 A 知道"）

## 用户需求

**来自对话的关键引述：**

> "主要目标是情感的连续性和记忆的连续性。核心目标是像真人一样。"

> "我无法接受引入 embedding，或者让 AI 聊天时让 AI 变成 agent 多步去查历史记忆。"

> "压缩是可以多次调用 API 的，不局限为一次。"

> "机制还是我们原来的触发机制啊，手动 + 自动。"

> "事实应该是链式的，也就是说你可以加也可以在某一条记录后面加新的记录，这样 AI 就能知道事实的变化。"

> "我怕 AI 会把记忆误认为是当前状态，比如亲密度 100，聊了很多轮聊分手了，这个 100 的亲密度不能实时变化（也不应该实时变化），会影响 AI 的正常反应吗？"

> "短期是记得的……中期会压缩一下，不记得所有细节，长期只记得让自己印象深刻的点。除了事实外，印象深刻、让角色出乎意料、或者获取到正反馈的点也需要记录下来。"

## 关键决策

| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| D1 | 记忆粒度 | 继续角色级（沿用 M4.1） | "AI 是一个人" |
| D2 | 存储形态 | 原始流 + 结构化状态双轨 | 原始流永不删；状态层是"结构化共识"；两者独立事务写 |
| D3 | 事实演化 | **链式** append（同主题按时间串起） | 真人既记"现在"也记"以前"，演化轨迹本身是信息 |
| D4 | 事实主体维度 | 6 类：`user` / `character` / `shared` / `peer` / `meta` / `other` | 区分"关于谁"，peer 是手机里其他 AI 角色一等公民 |
| D5 | 关系模型注入 | 去硬数字、只注入定性 + 时间前缀 + disclaimer | 防 LLM 把滞后的内部状态误当 ground truth |
| D6 | affinity 更新时机 | 只在压缩 Pass B 里，不实时 | 真人关系感变化是"回头看"才意识到的，且成本可控 |
| D7 | 压缩调用数 | 3 次 API，**并发** | Pass A/B/C 输入互相独立，`Promise.all` 壁钟 ≈ 1 次 |
| D8 | 压缩触发 | 沿用现有（threshold + 手动） | 不引入新触发点，架构简单 |
| D9 | OpenLoops | 独立层，非 fact 链 | "未闭环的约定"语义不同于事实，且需要"关闭"操作 |
| D10 | Highlights | 独立层，不参与再压缩 | 长期记忆里的"钉子"，对抗 episodic 的自然衰减 |
| D11 | 三档记忆 | 不做物理分层，用衰减规律表达 | Raw=短期 / EpisodicSummary 滚动再压=中期渐糊 / Facts+Highlights=长期 |
| D12 | 游戏态污染 | 不特殊处理 | "先不管"；出问题再加 AppMemoryPolicy |

## 架构总览

```
┌──────────────────────────────────────────────────────────────┐
│              System Prompt（KV-cache 稳定区）                 │
├──────────────────────────────────────────────────────────────┤
│ L1 人设锁        CharacterCard + WorldBook       ← 不变       │
│                                                               │
│ L2 关系模型      定性 stage / 称呼 / boundaries               │
│                  / inJokes / 带时间戳和 disclaimer            │
│                                                               │
│ L3 事实册        6 种 subject 的链式事实                      │
│                  按 subject 分段渲染                          │
│                                                               │
│ L4 OpenLoops     未闭环的坑                                   │
│                                                               │
│ L5 Highlights    印象深刻的瞬间                               │
├──────────────────────────────────────────────────────────────┤
│              History                                          │
├──────────────────────────────────────────────────────────────┤
│ L6 情节摘要      第一人称散文（含"最近基调"段）                │
│ L7 原始缓冲      最近 N 条未压缩 MemoryEntry                  │
├──────────────────────────────────────────────────────────────┤
│              Post-history（高频变化，cache line 之下）         │
│              设备上下文 / 当前时间                             │
├──────────────────────────────────────────────────────────────┤
│              Disclaimer（整个记忆块尾部）                      │
│              "以上为上次整理印象，以近期对话为准"               │
└──────────────────────────────────────────────────────────────┘
```

## 数据结构

### CharacterMemoryState（新增，per-character 一条）

```ts
interface CharacterMemoryState {
  characterId: string;

  relationship: RelationshipState;
  factChains: FactChain[];
  openLoops: OpenLoop[];
  highlights: Highlight[];
  episodicSummary: EpisodicSummary | null;

  lastCompressedAt: number;
}

interface RelationshipState {
  affinity: number;                    // 0–100，内部计算值，不直接注入 prompt
  stage: string;                       // 定性：'陌生' | '熟人' | '朋友' | '密友' | '恋人' | 自定义
  addressToUser: string;               // 角色对用户的称呼（初始 = persona.name）
  boundaries: Boundary[];
  inJokes: InJoke[];
  lastUpdatedAt: number;
}

interface Boundary {
  topic: string;                       // "前任"
  reason: string;                      // "她曾经提起时沉默半天"
  severity: 'soft' | 'hard';           // soft=换话题即可；hard=不能提
}

interface InJoke {
  content: string;                     // "晚安时提'做个关于馒头的梦'"
  context: string;                     // "馒头是她的猫"
  createdAt: number;
}

interface FactChain {
  id: string;
  key?: string;                        // "job" / "favorite_food"；可选
  subject: FactSubject;
  peerCharacterId?: string;            // 仅 subject='peer' 时必填
  peerName?: string;                   // 渲染用
  entries: FactNode[];
  createdAt: number;
  updatedAt: number;
}

type FactSubject =
  | 'user'          // 关于用户本人 / 用户生活圈
  | 'character'     // 关于我（本角色）自己的一致性锚点
  | 'shared'        // 我和用户共同经历
  | 'peer'          // 我认识的其他 AI 角色
  | 'meta'          // 对话/互动偏好
  | 'other';        // 未归类兜底

interface FactNode {
  id: string;
  content: string;                     // "2025.6 换到字节"
  at: number;                          // 发生时间戳（借自 sourceEntry.createdAt）
  private?: true;                      // 共同秘密，群聊/AI-AI 渲染时过滤
  sourceEntryIds?: string[];           // 追溯到原 MemoryEntry
  createdAt: number;
}

interface OpenLoop {
  id: string;
  topic: string;                       // "她答应给我看新领的狗"
  promisedBy: 'user' | 'character';
  createdAt: number;
  status: 'open' | 'closed' | 'expired';
  closedAt?: number;
  sourceEntryIds?: string[];
}

interface Highlight {
  id: string;
  content: string;                     // "那次她生日我说错话她没生气反而笑了"
  categories: HighlightCategory[];
  weight: number;                      // 0–1，LLM 给
  at: number;                          // 发生时间戳
  sourceEntryIds?: string[];
  createdAt: number;
}

type HighlightCategory =
  | 'striking'        // 印象深刻
  | 'surprise'        // 角色没预期到
  | 'positive'        // 正反馈
  | 'turning_point';  // 关系转折

interface EpisodicSummary {
  content: string;                     // 第一人称散文（含"最近基调"段）
  version: number;                     // 递增
  coveringUpTo: number;                // 已吸收到 entry.createdAt
  lastUpdatedAt: number;
}
```

### MemoryEntry（保留，语义微调）

```ts
interface MemoryEntry {
  id: string;
  characterId: string;
  role: 'user' | 'assistant' | 'system';
  speakerId: string;
  content: string;
  source: MemorySource;
  createdAt: number;
  compressed?: true;                   // 语义变更：已被状态层吸收，不再注入
}
```

**语义变更**：`compressed:true` 不再表示"被替换成 system summary 条目"；它现在只是"这条原始消息已被状态层吸收，prompt 注入时过滤掉"。原始消息永不删。

压缩不再写 `role:'system'` 的 `[长期记忆]` 条目到流里。流只存原始消息。

### IDB Schema

| 表名 | 主键 | 内容 | 状态 |
|---|---|---|---|
| `memory-entries` | `id` | `MemoryEntry[]` | 已有，保留 |
| `memory-state` | `characterId` | `CharacterMemoryState` | **新增** |

## 压缩 Pipeline

### 触发（不变）

- **自动**：`characterMemoryStore.append()` post-hook；当 `!compressed` 部分的 token 估算超过 `contextWindow * summarizeThreshold` → 触发
- **手动**：设置里"整理记忆"按钮 → 触发
- per-characterId 的 in-flight Promise map 去重（复用 `characterMemoryCompression.ts:27-42`）
- 异步 `queueMicrotask`，不阻塞回复

### 3 个并发 Pass

```
压缩触发（一批 !compressed entries + 当前 state）
  ↓
Promise.all([
  Pass A — 结构抽取（facts/openLoops/inJokes）
  Pass B — 关系更新
  Pass C — 叙事提炼（episodicSummary + highlights）
])
  ↓
全部成功 → 事务性写入:
  • memory-entries: 批量 set compressed=true
  • memory-state: 覆盖更新
任一失败 → 整体放弃，entries 保持未压，等下次触发
```

### Pass A — 结构抽取

**输入**：
- `state.factChains`（active 链，带 subject + key + 最近 entry）
- `state.openLoops`（status='open'）
- `state.relationship.inJokes`
- `peers`：此角色已知的其他 AI 角色列表 `{id, name}[]`
- `messages`：待压消息批

**输出 JSON**：
```ts
{
  factAdds: Array<{ content: string; subject: FactSubject; key?: string;
                    peerCharacterId?: string; at: number; private?: boolean }>;
  factAppends: Array<{ chainId: string; content: string; at: number; private?: boolean }>;
  loopsOpened: Array<{ topic: string; promisedBy: 'user' | 'character' }>;
  loopsClosed: Array<{ loopId: string }>;
  jokeAdds: Array<{ content: string; context: string }>;
}
```

**关键 prompt 约束**：
- 同主题的新变化请 **append 到已有链**；只有全新话题才建新链
- `peer` 仅指**本手机里其他 AI 角色**；普通人名归 `user` 生活圈
- 游戏/roleplay 内的临时身份（如"他是女巫"）**不要**抽成事实
- 判断一条消息是"关于谁"：from user / about user → `user`；角色自表 → `character`；双方都涉及 → `shared`

### Pass B — 关系更新

**输入**：
- `state.relationship`（全部字段）
- `messages`：待压消息批

**输出 JSON**：
```ts
{
  affinityDelta: number;               // 可正可负，一次压缩 [-20, +20]
  stageChange?: string;                // 只在明确信号下设置
  addressChange?: string;              // 只在明确信号下设置
  boundaryAdds: Boundary[];
  boundaryRemoves: string[];           // 按 topic 移除
}
```

**关键 prompt 约束**：
- stage 迁移需要**明确对话信号**（如"我们在一起吧""我们分手"），不靠 affinity 数值推
- affinity 打分参考最近一批的整体情感强度，而非任意单句
- 游戏/roleplay 里的情感（如狼人杀里互相怀疑）**不计入真实关系**

### Pass C — 叙事提炼

**输入**：
- `state.episodicSummary.content`（作为 previousSummary）
- `messages`：待压消息批

**输出**（结构化 JSON）：
```ts
{
  summary: string;                     // 新版第一人称散文，含"最近基调"段
  highlights: Array<{
    content: string;
    categories: HighlightCategory[];
    weight: number;                    // 0-1
    at: number;                        // 对应最相关的 message.createdAt
  }>;
}
```

**summary prompt 要求**：
- 第一人称视角（"我"指角色）
- 结构：`[叙事段] ... [最近基调] ...`
- 字数：`contextWindow * 0.3`（同现有约束，修正：用 token 估算而非字符数，见下文"已知问题修正"）

**highlights prompt 要求**：每批最多挑 3 个"值得记一辈子"的瞬间：
- 情感张力特别高
- 角色没预期到（surprise）
- 用户明确表达欣赏/依赖/喜爱（positive）
- 关系明显转折（turning_point）
- 权重 0-1：1 = 绝不能忘；< 0.3 不值得记

### 写回事务

全部 3 个 Pass 成功后：
1. `factAdds` → 每个建新 FactChain 并塞初始 entry
2. `factAppends` → 对应 chain.entries append
3. `loopsOpened` → 推入 `openLoops`
4. `loopsClosed` → 标 status='closed' + closedAt
5. `jokeAdds` → `relationship.inJokes` append
6. `affinityDelta` → 叠加到 `affinity`（clamp 0-100）；`stageChange` / `addressChange` / boundaries 按输出更新
7. `summary` → 覆盖 `episodicSummary`；`highlights` append
8. Highlights 总数 > 上限（默认 30）→ 按 `weight × recency` 排序裁剪
9. 批量 `UPDATE memory_entries SET compressed=true WHERE id IN (...)`
10. `memory-state` 整体覆盖

失败回滚：任何一步抛错 → 全部不提交，原 state 保持；entries 仍为 `!compressed`，下次触发时连同新消息一起再压。

### 去重锁 & 并发

- per-characterId in-flight Promise map（沿用现有实现）
- 同一角色不会并发两轮压缩
- 一轮压缩内部的 Pass A/B/C 是并发（`Promise.all`）

## Prompt 注入（promptAssembly 改造）

### System 尾部渲染（L2–L5）

```
[当前关系]（截至 {lastUpdatedAt:date}）
阶段：{stage}
她叫你："{addressToUser}"
敏感话题：
  · {boundary.topic}（{severity=='hard' ? '硬避' : '软避'}；{boundary.reason}）
  · ...
我们之间的梗：
  · {inJoke.content}（{inJoke.context}）
  · ...

[已知事实]
关于你:
  {factChain[subject=user] 每条渲染为: '{key}:' + 每个 entry 一行 '(at) content'}
关于我:
  {factChain[subject=character] 同上}
我们共同:
  {factChain[subject=shared] 同上}
关于其他角色:
  关于 {peerName}:
    {factChain[subject=peer, peerCharacterId=X] 同上}
对话偏好:
  {factChain[subject=meta] 同上}
其他:
  {factChain[subject=other] 同上}

[待闭环的约定]
  · {topic}（{promisedBy='user' ? '她答应' : '我答应'}，{createdAt 相对描述}）
  · ...

[印象深刻的时刻]
  · ({at:date}) {content}
  · ...（按 weight × recency 排序，top K）

---
以上为上次整理时的印象（{lastCompressedAt:date}）；若近期对话内容与之不符，以对话为准——对话是当前实时事实。
```

### History 顶部渲染（L6）

```
[长期记忆]
{episodicSummary.content}
```

然后按时间序拼 `MemoryEntry where !compressed`。

### 跨场景过滤（隐私/group 语义）

- 群聊 / AI-AI 聊天场景渲染时：`FactNode.private === true` 的事实节点**不注入**
- （具体对应哪些 context flags 在实现时补；本期先实现标志位，过滤逻辑 M5.1 可增强）

### KV-cache 注意

- L1–L5 都放 system block，KV-cache 友好度高
- **注意**：L2–L5 每次压缩会变一次；但压缩频率低（阈值触发），两次压缩之间的大量普通对话里 system block 稳定 → 仍能命中 cache
- L6（episodicSummary）在 history 里，每次压缩也会变，但 history 本来就在 cache line 之下，不影响

## 防漂移机制

三层防御应对"状态滞后于对话"问题：

### 1. 去硬数字，只注入定性（核心）

- `affinity` 不渲染到 prompt，只作内部计算
- 渲染 `stage / addressToUser / boundaries / inJokes` 等定性内容
- 数字的"确定性暗示"被移除 → LLM 不会把 affinity 当 ground truth

### 2. 时间前缀

- system 里所有状态块都加"截至 {lastUpdatedAt} 的印象"前缀
- LLM 明确知道这是历史快照，非当下

### 3. Disclaimer

记忆块统一尾注：
> "以上为上次整理时的印象；若近期对话内容与之不符，以对话为准——对话是当前实时事实。"

告诉 LLM 优先级规则：**history 中最近消息覆盖 system 中的状态**。

### 4. 惯性保护（stage 不抖动）

- `stage` 迁移需要 LLM 判定"明确对话信号"，不靠 affinity 数值阈值自动触发
- 吵架不会自动变"分手"；只有明确的分手对话才会
- 真人关系标签本就有惯性——这个设计是特性不是 bug

### 5. 最近基调段

- `episodicSummary` 里专门有一段"最近基调"
- 即使 `relationship` 还没更新，最近基调段已经反映出最近几天的情绪曲线
- LLM 读到能调整回复语气

## 衰减规律

- **原始缓冲 (L7)**：随时间被吸收进状态层；`compressed=true` 之后不再注入 prompt
- **事实 (L3)**：不衰减，链式 append
- **OpenLoops (L4)**：关闭后标 status='closed'，渲染时过滤；超时可标 'expired'（本期不做超时自动判定）
- **Highlights (L5)**：不参与再压缩；新 append；总数 > 上限按 `weight × recency` 裁剪低权重
- **情节摘要 (L6)**：每次压缩由 LLM 从 `previousSummary + 新内容` 重写；细节随轮次自然糊化 → 形成"中期渐糊"
- **关系 (L2)**：慢变；每次压缩只做一次 patch

## 迁移策略

- 新角色：`memory-state[characterId]` 为 null，第一次压缩时初始化
- 现有用户（已有 M4.1 记忆流）：
  - state 初始化：`relationship` 默认值，其余空列表，`episodicSummary=null`
  - 现有 `role:'system', compressed:true` 的 `[长期记忆]` 条目一次性迁移到 `state.episodicSummary.content`，然后从 entries 流中移除（或标记一个迁移标志避免重复读取）
  - 迁移在首次启动时幂等执行

## 已知问题修正（对比现有 summarizer.ts）

| 问题 | 现状 | 修正 |
|---|---|---|
| charLimit 单位错配 | `contextWindow * 0.3` 当字数传给 prompt，但 contextWindow 是 token | Pass C 的输出约束改用 token 估算（复用 `tokenEstimator`），prompt 里写"不超过 X token"给 LLM（或换算为字符时乘系数） |
| max_tokens 写死 | 历史 compression 调用用 user `aiConfig.maxTokens` | 继续遵守（现状已合规）|
| 角色标签二元假设 | `characterName` / `userName` 单值 | Pass A/B/C 多参与者场景下用 `speakerId → name` 映射；single-char 场景保持兼容 |
| 多模态被拍平 | `contentToText` 丢 URL、sticker | 本期不做 multimodal；但 buildMemoryEntry 保留占位文本（如 `[图片 url]`），压缩后散文里可能仍保留 URL |
| System role 夹 history 中段 | 当前压缩写 `role:'system'` 条目进流 | 本期**停止写**，流只存原始消息；summary 进 state 层 |

## 测试策略

### 单元测试

- `characterMemoryCompression.test.ts` 重写：
  - 触发条件（token 阈值、手动）
  - 并发 3 个 Pass 的成功路径
  - 任一 Pass 失败 → 回滚，entries 保持未压
  - 去重锁（同一角色并发触发只跑一次）
- `factChainOperations.test.ts`：
  - adds（新建链）
  - appends（按 chainId 追加）
  - 超长链的渲染
  - 多 subject 的分段渲染
- `openLoops.test.ts`：open / close 状态切换
- `highlights.test.ts`：append + 超量裁剪（weight × recency）
- `relationshipUpdate.test.ts`：affinity clamp、stage 只在明确信号下变
- `promptInjection.test.ts`：
  - system 尾部 6 段渲染顺序
  - private fact 在群聊 context 下被过滤
  - lastUpdatedAt 时间前缀正确
  - disclaimer 存在

### 集成测试（mock LLM 响应）

- 完整 compression 走一遍；比对 state 前后 diff
- 边界：空 messages、没 previousSummary、极长批次
- 迁移：从 M4.1 的 `[长期记忆]` system 条目迁到 state

### 手工验收（打 bug bash）

- 长对话下 4 个核心痛点 (A/B/C/E) 是否明显改善
- 压缩延迟是否可接受（壁钟）
- 成本是否在预期（约 1.5–2× 现状）

## 12 个 Bad Case 对账

| # | 场景 | 是否覆盖 | 落点 |
|---|---|---|---|
| BC1 挖的坑 | ✅ | `openLoops` 层 |
| BC2 角色自一致 | ✅ | `fact.subject='character'` |
| BC3 共同经历 | ✅ | `fact.subject='shared'` + `FactNode.at` |
| BC4 时间锚 | ✅ | `FactNode.at` |
| BC5 meta 偏好 | ✅ | `fact.subject='meta'` |
| BC6 敏感话题原因 | ✅ | `Boundary{reason, severity}` |
| BC7 梗/暗号 | ✅ | `relationship.inJokes[]` |
| BC8 秘密 | ✅ | `FactNode.private` + 渲染过滤 |
| BC9 情绪轨迹 | ⚠️ 部分 | `episodicSummary` 的"最近基调"段 |
| BC10 场景态 | ❌ | session 层，不归记忆系统 |
| BC11 周期模式 | ❌ | 延后 |
| BC12 角色成长 | ❌ | 延后 |
| 游戏态污染（女巫） | ⚠️ 不防 | 先不管；Pass A prompt 里有"不抽游戏身份"的轻量约束 |

## 开放问题

1. **Highlights 上限值** 设多少合适？初设 30；实际运行观察是否够用
2. **Peer 列表从哪取**：本期 Pass A 需要"此角色认识的 peers"列表——初步从"过去有共同 AI-AI 聊天 / 群聊 session 的角色集合"计算；如果集合为空则 LLM 只能建新 peer 链
3. **OpenLoops 超时**：多久算 expired？本期不自动判定；靠 Pass A 每次检查 + LLM 判断 closed
4. **affinity 初值 / stage 初值**：新角色是 50 / '陌生' 还是按角色卡声明？初步按配置字段默认值，角色卡可选覆盖
5. **压缩时的 provider 选择**：沿用用户配置的 chat provider；Pass A 结构输出要 JSON mode / function calling，需要 provider 能力检测
6. **迁移失败**的降级策略：能否只保留旧 `[长期记忆]`（作为 `episodicSummary.content`）并接受部分信息损失？—— 是

## 后续工作（M5.x）

- 用户可见"记忆查看器"UI（查看、编辑、删除 state 各层）
- Highlights 按对话场景的 top-K 选择（避免无脑 top 30 全注入）
- AppMemoryPolicy（如果游戏态污染真成问题）
- 跨角色隐私的 mental-theory 级建模
