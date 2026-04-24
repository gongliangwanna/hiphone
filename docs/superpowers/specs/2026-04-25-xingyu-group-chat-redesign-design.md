# 星语群聊优化设计

**日期**: 2026-04-25
**作者**: Brainstorming session（用户 + Claude）
**状态**: 待评审

## 背景与问题

星语 App 的群聊功能存在三个并发问题：

1. **建群报错**：`ChatSettings.tsx:260` 调用的 store 方法名 `createGroup` 不存在（实际名 `createGroupConversation`），点击"发起群聊"必崩。
2. **建群 UX 反直觉**：入口藏在已有 1:1 聊天的"聊天设置"内；底部抽屉同时塞了"群名输入 + 多选成员 + 创建按钮"，群名永远显眼但其实可选。
3. **群聊无 AI 回复**：`scheduleIdolReply` 只 dispatch 给有 `characterId` 的会话或 mock idol；自建群（识别字段：`groupName + groupMemberIds`）落到 else 分支什么都不做。

## 目标

- 修复建群报错
- 重写建群抽屉，单步完成、群名自动生成
- 新增群设置页（仿 QQ 范式）：群头像、群公告、聊天背景、成员管理
- 群聊采用**手动触发回复**机制：输入框上方角色头像横滑条，点谁谁说话；严格串行（一时一人）
- 群消息按渲染后形态写入**所有成员**的 AI 上下文（复用现有 fan-out 模式）

非目标：

- 暴露"清空聊天记录"/"清空 AI 记忆"按钮（YAGNI，本次不做）
- 排队 / 长按头像菜单 / 多角色并发回复
- AI 主动在群里发言（无 idle 触发，纯被动）

## 设计

### 1. 数据模型

`Conversation` 扩展两个字段：

```ts
groupAvatar?: string;        // data URL（压缩后）
groupAnnouncement?: string;  // 群公告文本
// 已有：groupName, groupMemberIds
```

**字段格式约定（重要 / 需要重构）**：所有 character 相关字段统一存**裸 characterId**（无前缀）。当前 `groupMemberIds` 因 ChatSettings 调用方传入的是 `char-${id}`，与 `characterId`、`aiChatParticipants` 的存储格式不一致——需对齐。

`char-` 前缀**只在构造 `Message.senderId` 时拼接**，用于和 `"me"` / legacy mock idol id 在消息层面做命名空间区分。

### 2. 建群抽屉重写

**入口保持不变**：聊天设置 → 发起群聊。

**抽屉布局**（自上而下）：
- 拖拽指示条 + 标题"选择成员" + 关闭 ×
- 已选成员横滑条（≥1 人时显示，每项含 × 取消）
- 搜索框（前端 fuzzy 过滤 `character.name`）
- 联系人多选列表
- 底部 CTA：`完成（N）`，N < 2 时灰掉并显示"至少选择 2 位成员"

**行为**：
- 打开时**预选当前对话角色**（从小星的聊天设置进入 → 小星已勾选；可在已选条 × 取消）
- 群名输入框移除——`createGroupConversation(memberIds)` 内部用成员名拼接生成默认群名（前 3 名 + "等 N 人"兜底）
- 创建后跳转进入新群

**store 改动**：
```ts
createGroupConversation(memberIds: string[]): string
// 不再接受 name 参数，内部自动派生
```

**bug 修复**：`ChatSettings.tsx` 调用点改名 `createGroup` → `createGroupConversation`，并 strip `char-` 前缀后传入。

### 3. 群设置页（QQ 风格）

复用 `chat-settings` 路由——`ChatSettings.tsx` 顶部按 `conv.groupMemberIds?.length > 0` 分叉渲染群版本。

**布局**（自上而下）：

| 区块 | 内容 |
|---|---|
| 成员区 | 头像横滑网格（每行 ~5 个），末尾 `+` 和 `-` 两个按钮 |
| 群信息 | 群头像 / 群聊名称 / 群公告（三个 row item，右侧 chevron） |
| 聊天 | 查找聊天记录 / 设置当前聊天背景 |
| 危险操作 | 删除并退出（红色，居中） |

**成员区交互**：
- `+` → 打开建群抽屉的"追加模式"（不预选当前成员，选完合并到现有 `groupMemberIds`）
- `-` → 进入"删除模式"：所有成员头像左上角浮出红色 ⊖ 徽章，点击单个 → 二次确认 → 移除；点空白 / 退出按钮退出删除模式
- 保护性约束：成员 < 2 时不允许删除，弹 toast"群至少需保留 2 名成员"

**编辑入口**：
- 群名 → iOS 输入弹窗（与 1:1 备注名一致）
- 公告 → 页内展开多行文本框（不开新 route）
- 头像 → 文件选择 → `compressBgImage`（已有工具）→ 写 `groupAvatar`
- 背景 → 复用现有 `backgroundUrl` 逻辑

### 4. 群聊手动触发回复

#### 4.1 头像条 UI

群聊 ChatDetail 的输入框**正上方**插入横滑头像条：

- 渲染源：`conv.groupMemberIds`，每个 character 头像 + 名字（小字）
- 高度 ~64px（头像 40 + 名字 12 + padding）
- iOS 风格：圆形头像、名字一行省略
- 首次进入显示一行小提示"点击头像让 ta 说话"，可关（localStorage 标记已读）

#### 4.2 严格串行状态机

模块级 Map 单例（不入 zustand，纯运行时态）：
```ts
const generatingByConv = new Map<string, string>(); // convId → characterId
```

- 任意时刻一个 conv 最多 1 个角色在生成
- 生成中：整条头像条视觉锁定（opacity 0.5、`pointer-events: none`）；正在生成的那个角色头像加流式徽章
- 生成结束（成功 / 失败 / abort）→ 清掉 Map 项 → 头像条恢复
- 用户离开 chat / 切群 / 删群时强制 abort 并清 Map

#### 4.3 回复触发

新增 store action：
```ts
triggerGroupReply(convId: string, characterId: string): void
```

实现复用 `scheduleAICharacterReply` ~90% 代码——重构成接受可选 `characterIdOverride`：
- 1:1 沿用 `conv.characterId`
- 群聊传明确的 `characterId`

流程：
1. 检查 `generatingByConv.has(convId)` → 是则 no-op
2. `generatingByConv.set(convId, characterId)`
3. 现有 AI 管线：placeholder → `chatWithCharacter(characterId, ...)` → `replyToLast({ mirror: false })` → 投递气泡（`senderId = char-${characterId}`）
4. finally：`generatingByConv.delete(convId)`

### 4.4 AI 上下文同步

复用 `_appendMessage` 现有 fan-out 模式。**memoryWriter.ts 改动**：

```ts
// 第 53-63 行 AI-AI fan-out 后追加群组分支
if (conv?.groupMemberIds?.length) {
  for (const memberId of conv.groupMemberIds) {
    const entry = buildMemoryEntry(msg, source, buildCtx(memberId));
    if (entry) useCharacterMemory.getState().append(memberId, entry);
  }
}
```

`deriveCharacterIdFromConv` 增加群分支：群聊 primary 取 `groupMemberIds[0]` 兜底（fan-out 会覆盖所有成员）。

**关键属性**：
- 用户消息 → fan-out 到每个成员的 memoryStore（role=user）
- 角色 X 回复 → 通过 `_appendMessage` 写入时 fan-out 到所有成员；对 X 自己 role=assistant，对其他成员 role=user（带 speakerId 标识发言者）
- 写入内容是 `buildMemoryEntry` 渲染后的**自然语言文本**——符合"render 后再存"的现有约定

### 4.5 系统提示词增强

`promptAssembly.ts` 的 System block 在群聊场景注入一段稳定上下文（变化频率低，KV cache 友好）：

> "你正在群聊中，群成员包含：{names}。请以你自己的身份发言，可以回应其他成员说的话。"

由 `chatWithCharacter` 走 `appSystemPrompt` 入口注入；XingYu 在 register 时检测 conv 类型按需追加。

`{names}` 是稳定列表（成员变化不频繁），放 System block 不破坏 KV cache。

## 实现影响面

**改动文件**：

- `src/apps/XingYu/data.ts` — `Conversation` 扩展 `groupAvatar` / `groupAnnouncement`
- `src/apps/XingYu/xingYuDataStore.ts` — `createGroupConversation` 签名改 + 新增 `triggerGroupReply` + 重构 `scheduleAICharacterReply` 接受 override
- `src/apps/XingYu/pages/ChatSettings.tsx` — 调用点修复 + 群版本分支渲染 + GroupPicker 重写
- `src/apps/XingYu/pages/ChatDetail.tsx` — 群聊场景插入头像条组件
- `src/apps/XingYu/components/GroupMemberStrip.tsx` — 新建（头像条）
- `src/platform/ai/memoryWriter.ts` — fan-out 加群分支 + `deriveCharacterIdFromConv` 群兜底
- `src/platform/ai/promptAssembly.ts` — System block 注入群上下文（或在 XingYu register 中注入）

**测试**：

- 单测 `createGroupConversation` 名字派生 + memberIds 格式
- 单测 `triggerGroupReply` 串行锁
- 单测 `_appendMessage` fan-out 覆盖群所有成员
- 集成：建群流程不报错、头像条点击触发回复、生成中锁定

## 已知风险

1. **memberIds 格式迁移**：本次将 `groupMemberIds` 从 `char-${id}` 改为裸 `${id}`。已存在的 localStorage 群数据需要做迁移（rehydration 时 strip 前缀）；若用户数据已损坏可直接清掉。
2. **promptAssembly 改动需谨慎**：群上下文注入位置必须在 System block，不能进 Post-history（破坏 KV cache，AI/CLAUDE.md 已记录踩坑点）。
3. **AI 回复中其他成员消息的 role 处理**：现有 `buildMemoryEntry` 有处理 AI-AI 的 `currentCharId` 视角翻转——需确认群场景下也正确（每个成员视角下，其他成员发言均为 user role 带 speakerId）。这是必须验证的点，不是改动点。
