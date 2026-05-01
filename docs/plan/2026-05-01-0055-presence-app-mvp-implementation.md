# 「在场」App MVP 实施方案

日期: 2026-05-01 00:55

## 用户需求

用户确认按最新设计实现「在场」完整 MVP。

目标产品：

- App 名为「在场」，不是“线下模式”。
- 首页可选择角色和场景。
- 用户可见文案使用「角色」，不写「AI 角色」。
- 角色选择只展示头像和名字，不展示关系、上次活动时间、最近互动等当前没有的数据。
- 场景支持用户自定义输入，也支持预设场景。
- App 内置一批预设背景图；预设场景绑定背景图，自定义场景随机使用一张预设背景图兜底。
- 进入场景后，用户仍用文字输入，但可以输入台词或动作。
- AI 输出是自由小说式现场片段，可以包含动作、眼神、神态、表情、姿态、环境互动和主动行为。
- AI 输出不使用固定 JSON、固定字段或固定动作协议。
- 场景页不使用聊天气泡，不展示“场景笔记”。
- 场景进行中不写入角色长期记忆。
- 用户离开后生成四项总结：`场景`、`发生了什么`、`情绪变化`、`待续事项`。
- 离开确认后：
  - 向角色长期记忆写入一条「在场经历总结」。
  - 保存完整只读「在场记录」，之后可以查看。
- 已完成记录只能查看，不能继续互动；如需延续，只能新建类似场景。

## 范围

本阶段做完整 MVP：

1. 新增内置 App「在场」及桌面入口。
2. 新增 App 状态与持久化记录 store。
3. 新增场景预设与背景图资源。
4. 新增 AI 会话 prompt 与场景内临时 transcript。
5. 新增退出总结和角色记忆写入。
6. 新增首页、场景页、离开总结页、记录列表和记录详情页。
7. 补单测覆盖核心数据流和关键 UI 行为。

本阶段不做：

- 实时背景图生成。
- 语义匹配自定义场景到最合适背景图；V1 自定义场景随机兜底。
- Live2D / 3D / AR。
- 复杂动作协议、工具调用或 JSON 输出。
- 记录继续互动；记录只读。
- 从 XingYu 角色详情跳转「在场」；后续阶段再做。

## 关键决策

1. **App 形态**：使用内置 App，而不是 user app。原因是需要直接访问角色 store、AI session、characterMemoryStore、App catalog 和资源。
2. **appId**：使用 `presence`。
3. **数据持久化**：新增 `presenceStore`，使用 Zustand + `idbStorage`，保存 active session、completed records、recent scenes。
4. **场景内 AI 会话**：使用 `withUserAppContext('presence') + chatWithCharacter(characterId, { persistent:false, appSystemPromptSuffix })`。
5. **记忆写入策略**：场景内所有 `send` / `append` 都使用 `mirror:false` 或依赖 `persistent:false`，确保不实时写入长期记忆；退出时单独 append 一条 summary memory。
6. **AI 输出格式**：不注册工具，不要求 JSON。prompt 明确“不是聊天软件，而是在场景中面对玩家自由互动”。
7. **显示文本**：AI 回复优先使用 `reply.raw`。如果平台 retry 因统一 JSON parser 产生限制，需要为 `presence` 注册宽松 renderer 或避免工具注册，让普通文本可直接通过。
8. **离开总结**：总结调用使用纯 `complete` 或独立非持久 session；输出要求四项文本或 `SKIP`。如果 `SKIP`，不写角色记忆，但仍可保存一条无总结的记录，具体 UI 显示“本次内容较短，未生成总结”。
9. **只读记录**：completed record 保存完整 transcript 和 summary；详情页不展示输入框，不调用 AI。
10. **背景图资源**：先放静态资源到 `public/resource/presence/backdrops/`，每个预设场景一张图；如果资源暂缺，先用本地 CSS 渐变/已有图片占位会削弱设计，因此实现前应准备真实图片资源。

## 数据模型

```ts
export type PresenceSessionStatus =
  | 'active'
  | 'summarizing'
  | 'completed'
  | 'discarded';

export interface PresencePresetScene {
  id: string;
  title: string;
  text: string;
  backdropId: string;
}

export interface PresenceBackdrop {
  id: string;
  title: string;
  imageUrl: string;
  presetSceneId?: string;
}

export interface PresenceTurn {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
}

export interface PresenceSummary {
  scene: string;
  whatHappened: string;
  emotionalShift: string;
  nextThread: string;
}

export interface PresenceSession {
  id: string;
  characterId: string;
  sceneText: string;
  title: string;
  backdropId: string;
  status: PresenceSessionStatus;
  startedAt: number;
  endedAt?: number;
  turns: PresenceTurn[];
  summary?: PresenceSummary;
  error?: string;
}

export interface PresenceRecord {
  id: string;
  characterId: string;
  sceneText: string;
  title: string;
  backdropId: string;
  startedAt: number;
  endedAt: number;
  turns: PresenceTurn[];
  summary: PresenceSummary | null;
  memoryEntryId?: string;
}
```

## 文件拆分

新增目录：

- `src/apps/Presence/PresenceApp.tsx`
- `src/apps/Presence/presenceStore.ts`
- `src/apps/Presence/presenceTypes.ts`
- `src/apps/Presence/presenceScenes.ts`
- `src/apps/Presence/presenceAi.ts`
- `src/apps/Presence/presenceMemory.ts`
- `src/apps/Presence/components/CharacterPicker.tsx`
- `src/apps/Presence/components/ScenePicker.tsx`
- `src/apps/Presence/components/SceneHero.tsx`
- `src/apps/Presence/components/FragmentStream.tsx`
- `src/apps/Presence/components/LeaveSummarySheet.tsx`
- `src/apps/Presence/components/PresenceRecordList.tsx`
- `src/apps/Presence/components/PresenceRecordDetail.tsx`
- `src/apps/Presence/__tests__/presenceStore.test.ts`
- `src/apps/Presence/__tests__/presenceAi.test.ts`
- `src/apps/Presence/__tests__/presenceMemory.test.ts`
- `src/apps/Presence/__tests__/PresenceApp.test.tsx`

集成点：

- `src/apps/registerBuiltins.ts` 注册 `presence`。
- `src/platform/appCatalog.ts` 增加桌面图标。
- 如需自定义 App 图标，新增 `public/resource/icons/popular-cn/presence.svg` 或使用系统图标资源。
- 背景图新增到 `public/resource/presence/backdrops/`。

## 核心流程

### 1. 首页

状态：

- `selectedCharacterId`
- `sceneText`
- `selectedPresetSceneId`
- `selectedBackdropId`

行为：

- 默认选第一个角色。
- 没有角色时展示空态，引导去角色系统创建/导入角色。
- 点预设场景时填充 sceneText，并使用该预设绑定背景。
- 用户手动编辑 sceneText 后，保留自定义文本；如果没有明确选预设，则随机选择一个背景。
- 点「进入场景」创建 `PresenceSession` 并进入 active view。
- 首页底部提供「在场记录」入口。

### 2. 场景页

行为：

- 展示背景图、角色头像/名、场景句子。
- `FragmentStream` 展示 turns：
  - assistant: 小说式片段。
  - user: `你：...` 的轻量叙事行。
- 输入框 placeholder：`说点什么，或写下你的动作…`
- 发送时：
  1. 本地 append user turn。
  2. 调 `requestPresenceReply`。
  3. 本地 append assistant turn。
  4. 不写 `characterMemoryStore`。
- AI 忙时禁用发送；失败时保留用户输入和错误状态，可重试。

### 3. AI prompt

`presenceAi.ts` 负责构建会话 suffix：

```text
[在场模式]
你现在不是在聊天软件里回复消息。
你正处在以下场景中，和玩家面对面互动。
场景：{sceneText}

请以你的角色身份自然回应玩家。你可以说话，也可以做任何符合角色、关系和场景的合理行为。
你可以描写动作、眼神、表情、神态、姿态、距离变化、环境互动、沉默、停顿和主动提议。
不需要遵循固定 JSON 或字段格式。优先输出自然、连贯、有现场感的小说式片段。
当非语言描写有助于现场感时，可以使用括号；但括号不是强制格式。
不要把自己描述成正在发消息，也不要提到聊天软件界面。
不要替玩家决定重大动作、想法或感受；可以描写你观察到的玩家行为，并等待玩家回应。
```

实现要点：

- session 使用 `persistent:false`，让角色长期记忆作为快照进入 prompt，但场景 turns 留在 session buffer。
- 每轮 `send(userText, { mirror:false })`。
- 使用 `reply.raw` 作为显示文本，避免 default renderer 加上角色名前缀后破坏小说式体验。

### 4. 离开总结

用户点「离开」：

- 若 turns 为空或只有极短内容，展示确认：`本次内容较短，可直接丢弃或保存记录`。
- 否则进入总结页，调用 `summarizePresenceSession`。

总结 prompt 输出四项：

```text
请把以下「在场」场景互动总结为一条角色长期记忆。

要求：
- 只记录对未来继续扮演该角色有用的信息。
- 不要逐句复述。
- 只输出四项：场景、发生了什么、情绪变化、待续事项。
- 不要输出“记忆价值”。
- 如果本次互动没有实质内容，输出：SKIP。
- 不要编造 transcript 中没有的信息。
```

确认「保存并离开」：

1. 如果 summary 非空且不是 `SKIP`，调用 `rememberPresenceSummary` 写入角色记忆。
2. 保存 `PresenceRecord`。
3. 清空 active session。
4. 返回首页或记录详情页。

### 5. 记忆写入

`presenceMemory.ts` 单独封装：

```ts
export function rememberPresenceSummary(input: {
  characterId: string;
  summary: PresenceSummary;
  sceneText: string;
  startedAt: number;
  endedAt: number;
}): MemoryEntry | null;
```

写入内容示例：

```text
[在场经历总结]
时间：2026-05-01 00:18
场景：雨夜的便利店门口，角色撑伞等用户。
发生了什么：用户走近后解释自己迟到，角色把伞偏向用户，并把热饮递给用户。
情绪变化：气氛从轻微不满转为柔和。
待续事项：下次如果会迟到，用户应提前告诉角色。
```

写入字段：

- `role: 'system'`
- `speakerId: 'system'`
- `source: 'app:presence'`
- 不设置 `compressed:true`

### 6. 在场记录

首页「在场记录」进入记录列表：

- 空态：`还没有在场记录`
- 列表项：背景缩略图、角色头像、角色名、标题、完成时间。

记录详情：

- 显示背景、角色、场景、时间。
- 显示 transcript。
- 显示四项总结。
- 显示 `只读` 标签。
- 不显示输入框。
- 可提供 `再次进入类似场景`，创建新 session，复制角色、场景文本和背景，不复用旧 record。

## 视觉方案

遵循最新 imagegen 预览：

- 首页主流程优先：选择角色、选择场景、进入场景。
- 角色选择是头像 + 名字，不做信息密集卡。
- 场景预设用小缩略图 tile，便于说明背景来源。
- 场景页主视觉占上方，片段流占中下方，输入固定底部。
- 片段流不是气泡；assistant 段落用轻玻璃/纸张质感，user 行轻量展示。
- 离开总结页用 iOS sheet 或全页 panel。
- 记录详情页无输入条，用 `只读` 标签强化不可继续互动。

## 测试计划

### 单测

- `presenceStore`
  - 创建 session。
  - append user/assistant turn。
  - complete session 后生成 record。
  - discard session 不生成 memory。
  - completed record 只读，不存在 append 行为。
- `presenceAi`
  - prompt suffix 包含“不是聊天软件”“场景”“自由小说式片段”。
  - 不包含 JSON/固定字段要求。
  - `requestPresenceReply` 使用非持久/不 mirror 规则。
- `presenceMemory`
  - 写入 `characterMemoryStore` 的 source 为 `app:presence`。
  - role/speakerId 为 system。
  - 内容包含四项摘要。
- `PresenceApp`
  - 角色列表只渲染头像和名字。
  - 预设场景填充 sceneText 和 backdrop。
  - 自定义场景能进入场景。
  - 场景页没有“场景笔记”。
  - 记录详情没有输入框和发送按钮。

### 回归验证

- `pnpm vitest run src/apps/Presence`
- `pnpm vitest run src/platform/ai/__tests__/characterMemoryStore.test.ts`
- `pnpm typecheck`

### 视觉验证

实现后启动 dev server，用 Playwright 检查：

- 桌面有「在场」图标。
- 首页布局在手机 viewport 不溢出。
- 场景页文本不被输入栏遮挡。
- 记录详情页无输入栏。

## 阶段拆解

### S1：数据与注册

- 新增 `Presence` 目录、类型、预设场景、背景图清单。
- 新增 `presenceStore` 和测试。
- 注册 App 与桌面图标。

验收：

- 桌面出现「在场」。
- store 单测通过。

### S2：首页与场景页静态闭环

- 实现首页角色选择、场景输入、预设场景。
- 实现场景页静态 UI、片段流、输入区。
- 不接 AI，先用本地 fake reply 打通 UI 状态。

验收：

- 用户能进入场景并看到背景、角色、场景文本。
- 角色列表只显示头像和名字。

### S3：AI 场景会话

- 实现 `presenceAi.ts`。
- 接入 `chatWithCharacter` 非持久会话。
- 发送用户输入并展示 AI 自由文本。
- 错误、忙碌、重试状态。

验收：

- 场景内互动不会写入 `characterMemoryStore`。
- AI 输出不要求 JSON。

### S4：离开总结与记忆写入

- 实现总结 prompt。
- 实现离开总结页。
- 实现 `presenceMemory.ts`。
- 保存 record。

验收：

- 保存离开后只写一条角色记忆。
- summary 为 `SKIP` 时不写记忆。
- record 仍按规则保存或提示可丢弃。

### S5：记录列表/详情与 polish

- 实现「在场记录」列表。
- 实现只读详情页。
- 实现「再次进入类似场景」。
- 样式打磨、空态、边界状态。

验收：

- 记录可查看但不能继续互动。
- 详情页没有输入框。

### S6：测试与验收

- 补齐单测。
- 运行相关 Vitest 和 typecheck。
- 浏览器视觉检查。
- 修复溢出、空态和错误状态。

## 风险与处理

- **SDK parse retry 污染记忆**：当前 `chatWithCharacter` 在 parse failure 时可能写 memoryStore，即使 `mirror:false`。由于 presence 不注册工具、普通文本应不触发 parse failure；测试需要覆盖“普通文本不会 parse fail”。如仍有风险，需要为 presence 设计绕过统一 parser 的纯文本调用路径。
- **总结失败**：保留 active session 和错误信息，允许重试、丢弃或仅保存无总结记录。
- **无角色**：首页显示空态，不允许进入场景。
- **背景图资源不足**：先准备 5 张预设图，避免自定义场景没有视觉承托。
- **记录过大**：V1 不裁剪 transcript；后续可按条数或字符数限制记录保存量。
