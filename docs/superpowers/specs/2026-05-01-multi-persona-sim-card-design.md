# 多 persona SIM 卡式数据隔离 — 设计

- **创建日期**: 2026-05-01
- **状态**: 待审 → 实现
- **影响里程碑**: M-Persona

---

## 1. 背景

当前 `personaStore` 已支持多 persona 增删改与切换，但**切换只换名字/头像**，所有聊天、朋友圈、备忘录、桌面布局等共用同一份 IDB 数据。用户预期的是"两台手机、两个不同的人"的语义：对 AI 角色而言 persona-A 和 persona-B 是两个互不认识的陌生人，各自手机里的内容互不可见。

直接给每条记录加 `personaId` 字段会带来大量边界 case；本设计采用**统一 entity 模型**，让 persona 与 character 在数据模型层面对称，从根上消除这些 case。

## 2. 核心原则

**Entity → Phone → Data。** 每个"人"（persona 或 character）都是一个 Entity，每个 Entity 有一台手机，手机里所有数据槽位完全相同。聊天和朋友圈是**世界事件**，由参与者列表决定可见性。

由此推出三层数据：

| 层 | 隔离方式 | 内容 |
|---|---|---|
| **Phone-local** | 按 ownerId 分 IDB 命名空间（registry 模式） | notes, calendar, photos, 桌面布局, 壁纸, Dock, AssistiveTouch, 主题, 已装 user app, sticker 包, bubble skin 包, 皮肤分配, 个人资料 |
| **World events** | 单一全局 store，记录里写参与者；按 participants 过滤可见性 | conversations + messages, moments + likes/comments, character memory（per `(owner, peer)` 双键） |
| **System** | 全局，不分 persona | character 定义, AI 配置, worldbook |

senderId / userId / idolId 命名空间统一为 `persona-{id}` 或 `char-{id}`。`'me'` 这个魔法值彻底从 src 中移除（仅出现在迁移脚本内）。

## 3. Identity 命名空间

新增 `src/platform/identity/` 模块，导出三个工具函数（src 中所有"谁"的判断都必须走这里）：

```typescript
// 当前 active persona 的 senderId（用户当下交互场景使用）
currentPersonaSenderId(): string;          // 'persona-{activeId}'

// 判断某 senderId 是否是"当前手机的主人"。复用现有 usePerspective().selfSenderId
// 即可：isSelfSender(id) === (id === selfSenderId)
isSelfSender(id: string): boolean;

// senderId → 展示名。persona-{id} 走 personaStore；char-{id} 走 characterStore
resolveSenderName(id: string): string;
```

`usePerspective().selfSenderId` 升级返回值：
- `phoneOwnerId === null` 时返回 `currentPersonaSenderId()`（当前是 `'me'` 字面量）
- `phoneOwnerId === charY` 时返回 `'char-{charY}'`（不变）

**严格禁令**：除了用户即时交互（UI 渲染、新建消息时）以外，禁止用 `usePersonaStore.getState().getActivePersona()` 推断"会话对方"。AI 后端流程（heartbeat、压缩、prompt 组装）必须从被处理对象的归属反查 personaId。这是当前代码已存在的潜伏 bug（详见 §6 PR1）。

## 4. 存储面盘点

### 4.1 Phone-local（按 ownerId 隔离）

已经走 EntityStoreRegistry 的 store：

- `notesDataStore` (`src/apps/Notes/notesDataStore.ts`)

PR3 需要把以下 store 也包成 EntityStoreRegistry。具体的 IDB persist 名以代码中实际值为准：

| Store | 文件 |
|---|---|
| `calendarStore` | `src/apps/Calendar/...` |
| `springboardLayoutStore` | `src/platform/stores/springboardLayoutStore.ts` |
| `installedUserAppsStore` | `src/platform/stores/installedUserAppsStore.ts` |
| `assistiveTouchStore` | `src/platform/stores/assistiveTouchStore.ts` |
| `systemStore`（壁纸/主题） | `src/platform/stores/systemStore.ts` |
| `XingYu/stickerStore` | `src/apps/XingYu/stickerStore.ts` |
| `XingYu/bubbleSkinStore` | `src/apps/XingYu/bubbleSkinStore.ts` |
| **新建** `userProfileStore` | 承接当前 `xingYuDataStore.userSettings`（昵称/bio/头像/封面/accentColor） |

每个 store 包成 `EntityStoreRegistry(factory, baseName)` 后，IDB key 为 `{baseName}::{ownerId}`。

ownerId = `persona-{id}` 或 `char-{id}`。当 `phoneOwnerStore.phoneOwnerId === null` 时取 active persona 的 id；否则取 phoneOwnerId 对应的 char。

### 4.2 World events（不分 persona，按参与者过滤）

| Store | 改造点 |
|---|---|
| `xingYuDataStore.conversations + messages` | 字段不变。`'me'` 全部 rewrite 为 `persona-{id}` |
| `xingYuDataStore.moments + interactions + favorites` | 同上 |
| `characterMemoryStore.entries` | **从 `Record<charId, MemoryEntry[]>` 改为 `Record<${charId}::${peerId}, MemoryEntry[]>`** |
| `memoryStateStore.records` | **从 `Record<charId, ...>` 改为 `Record<${charId}::${peerId}, ...>`** |

`userSettings` 从 `xingYuDataStore` 拆出，迁入 phone-local 的 `userProfileStore`。

### 4.3 System（不动）

`characterStore`, `aiConfigStore`, `worldBookStore` 保持单一全局存储。

## 5. 'me' → persona-id 重构清单

扫描结果共 80+ 处。按风险分级：

### 5.1 🔴 高危（PR1 优先修，独立于多 persona 上线）

下面这些点用 `getActivePersona()` 当"会话对方"，多 persona 一启用就会跨 persona 污染数据：

```
src/platform/ai/heartbeatRegister.ts:191-192
src/platform/ai/heartbeatAgent.ts:174
src/platform/ai/characterMemoryCompression.ts:109
src/platform/ai/aiChatEngine.ts:137
src/platform/userApp/sdk/ai.ts:446
src/platform/ai/memoryWriter.ts:141
src/apps/Presence/presenceAi.ts:141
src/apps/Settings/pages/PromptViewerPage.tsx:191
```

修复手法：所有这些调用都引入显式 `personaId` 入参（来自被处理 conversation / memory entry 的归属），调用链上溯回归属源头。`getActivePersona()` 仅在用户当下交互入口（写新消息时）使用。

### 5.2 🟡 中（PR2 写入源头）

```
src/apps/XingYu/xingYuDataStore.ts (L701, 770, 784, 794, 801, 808, 1234) — sendXxx 写 senderId
src/apps/XingYu/xingYuDataStore.ts:842, 888                              — toggleLike/addComment 默认 userId
src/apps/XingYu/xingYuDataStore.ts:878                                   — addMoment idolId
src/apps/XingYu/xingYuDataStore.ts:1303                                  — likedBy: ['me']
src/apps/XingYu/pages/ChatDetail.tsx:191                                 — 构造 sender 对象
src/apps/Gomoku/gomokuMemory.ts:33, 62                                   — speakerId
src/apps/Gomoku/gomokuAiSession.ts:199                                   — speakerId
src/platform/userApp/sdk/storage.ts:29 + perspective.ts:14               — phoneOwner null 时返回 'me'
src/platform/userApp/sdk/ai.ts:374                                       — speakerId fallback
src/platform/userApp/migrations.ts:39                                    — 仅在 PR2 之前的 legacy migration 中存在
```

### 5.3 🟢 低（PR2 同 PR 内做完，纯字面量替换）

```
src/platform/ai/buildMemoryEntry.ts (L66, 67, 114)
src/platform/ai/memoryWriter.ts:118
src/platform/ai/heartbeatRegister.ts:39
src/platform/ai/heartbeatTools.ts (L247, 597, 656)
src/platform/ai/promptAssembly.ts:251
src/platform/ai/characterMemoryCompression.ts:63
src/platform/hooks/usePerspective.ts:15
+ XingYu UI: ChatListTab, MomentCard, ChatSearch, ChatDetail, ContactSelect,
  ForwardDetail, IdolProfile, InteractionList — 大量 === 'me' 比较
```

替换为 `isSelfSender(id, perspective)`。

### 5.4 默认值清理

```
src/apps/XingYu/data.ts:273              ME 常量 — 删除
src/apps/XingYu/xingYuDataStore.ts:759   userSettings 默认 nickname '小星星' — 改成从 persona.name 取
src/platform/stores/personaStore.ts:31   DEFAULT_PERSONA — id 从 'default' 改为 'persona-default'
```

## 6. Cutover 计划

每个 PR 单独发车、单独验证。

### PR1 — 修复"会话对方"误用 active persona 的潜伏 bug

不引入多 persona 任何能力，但修第 5.1 节列出的高危点。引入 `ConversationContext` 概念：每次 heartbeat / compression / prompt-build dispatch 时显式传 personaId（暂时仍只有 default persona，但代码语义正确）。上线后单 persona 行为无变化，但数据流从此可信。

### PR2 — 'me' 替换 + IDB 一次性迁移

- 全代码 `'me'` 字面量替换为 identity 模块调用
- 引入 `dbSchemaVersionStore`，启动时检测版本并执行迁移（详见 §7）
- DEFAULT_PERSONA.id 从 `'default'` 改为 `'persona-default'`
- ME 常量删除
- 完成后系统仍是单 persona，但所有 key/value 已是新格式

### PR3 — Phone-local stores 按 owner 隔离

- §4.1 列表所有 store 包成 EntityStoreRegistry
- 写 `useXxxStore<T>(selector)` 风格的 hook（详见 §8）
- `userProfileStore` 新建并迁入 userSettings
- 每个 store 加单测：切换 ownerId 时数据切换正确

### PR4 — Memory 双键彻底落地

- `characterMemoryStore` / `memoryStateStore` 改为 `(charId, peerId)` 双键
- 所有压缩 pipeline、heartbeat tools 改成 `(char, peer)` 维度调度
- 所有 callsite 显式传 peerId

### PR5 — Settings persona CRUD + 切换

- `Settings/pages/PersonaPage` 增加新建、删除、设为默认、切换 UI
- 切换 active persona 时 React 子树重订阅（依赖 PR3 的 hook 模式）
- 切换不影响 phoneOwnerStore（保持当前查谁就查谁）
- 删除规则：不能删 active persona、不能删最后一个 persona

### PR6 — E2E 测试 + 边界场景

- 双 persona 平行流测试
- 迁移幂等测试
- 群聊 / char-char / 朋友圈跨 persona 可见性测试

## 7. IDB 迁移脚本

启动时跑一次（schema version < N 才执行）。**幂等**：再跑一次结果不变。

### Pass A — 字面量 rewrite

```
xingYuDataStore:
  messages[*].senderId         : 'me' → 'persona-default'
  moments[*].idolId            : 'me' → 'persona-default'
  moments[*].likedBy[*]        : 'me' → 'persona-default'
  moments[*].comments[*].userId: 'me' → 'persona-default'
  interactions[*].userId       : 'me' → 'persona-default'
  favorites[*].senderId        : 'me' → 'persona-default'

characterMemoryStore.entries[*][*].speakerId: 'me' → 'persona-default'

user-app appStorage 所有 key 中 ':owner:me:' → ':owner:persona-default:'
```

### Pass B — Memory key reshape

`characterMemoryStore.entries: Record<charId, MemoryEntry[]>` 重塑为 `Record<${charId}::${peerId}, MemoryEntry[]>`。

针对每个 char-Y 的旧 stream，使用 cursor 算法分流：

```
let cursor = 'persona-default';
for entry of oldStream:
    if entry.role === 'user':
        cursor = entry.speakerId;       // 已 rewrite 过
    bucket[`${charY}::${cursor}`].push(entry);
```

效果：当前生产数据中 99% entries 流入 `${charY}::persona-default`。char-char 对话和群聊中其他参与者的发言段自然分流。群聊场景下 char-Y 自己的 assistant 回复按 cursor 归属，可能微偏，但群聊信息量小、可接受。

`memoryStateStore`：每条 `records[charId]` 整体 rename 为 `records[${charId}::persona-default]`（早期数据中只有一个 persona，无需拆分）。

### Pass C — userSettings 拆出

```
读取 xingYuDataStore.userSettings → 写入 userProfileStore::persona-default
删除 xingYuDataStore.userSettings 字段
```

### 失败处理

任何 Pass 抛错：捕获，schema version 不前进，下次启动重试。错误写入 console + perfDebugStore（开发者面板可见）。生产环境若多次失败，提供"重置应用数据"出口（保留角色卡和 AI 配置，清掉 phone-local + memory）。

## 8. Phone-local hook 编写规范

写进 `src/platform/CLAUDE.md` 作为 invariant：

```typescript
// 1. Registry 在模块顶层创建一次
const notesRegistry = new EntityStoreRegistry(createNotesStore, 'hiPhone-notes');

// 2. 暴露为 hook，内部按当前手机主人取 store
export function useNotesStore<T>(selector: (s: NotesState) => T): T {
  const ownerId = useCurrentPhoneOwnerId();
  // useCurrentPhoneOwnerId 内部：phoneOwnerId !== null ? `char-${phoneOwnerId}` : currentPersonaSenderId()
  const store = notesRegistry.getStore(ownerId);
  return useStore(store, selector);
}

// 3. 命令式访问（事件回调内）
export function notesActions(ownerId?: string) {
  const id = ownerId ?? currentPhoneOwnerId();
  return notesRegistry.getStore(id).getState();
}
```

切 active persona 时 `useCurrentPhoneOwnerId()` 返回值变 → React 重订阅 → UI 自动刷新。

## 9. Heartbeat 分轨

`heartbeatRegister` 当前维护 `Map<charId, schedule>`。改成：

```typescript
type PairKey = `${string}::${string}`;     // ${charId}::${peerId}
type Schedule = Map<PairKey, ScheduledTick>;
```

规则：

- char-Y 跟 persona-A 有过实际对话（`entries['char-Y::persona-A']` 非空）→ 注册一条心跳轨道
- 切到 persona-B 后第一次跟 char-Y 聊天 → 自动注册 `char-Y::persona-B` 轨道
- 删除 persona-X 时 → 清掉所有 `*::persona-X` 轨道
- 心跳 fire 时显式传 peerId 给 prompt 组装层（**禁止读 getActivePersona**）
- 后台 persona 心跳继续跑；token 成本通过心跳间隔调控

token 成本估算：char 数 × 实际产生过对话的 persona 数。一个有 5 char、2 persona 都聊过的用户，活跃 pair 最多 10 条轨道，相对单 persona 翻倍但可控。

## 10. UI 设计

### 10.1 Persona 切换入口

仅在 `Settings → 用户身份`。与之前讨论一致，不做 Control Center 或锁屏入口。

PersonaPage 增加：
- 新建按钮：填写名字、头像、描述（人设）
- 长按某项 → 编辑 / 删除
- 点选 → 切为 active
- active persona 标记（√）
- 删除规则灰显（不能删 active、不能删最后一个）

### 10.2 切换反馈

切换瞬间播一个轻微动画（受影响子树整体淡出再淡入），让"换手机"动作有视觉感知。状态栏不显示 persona 名（保持 iOS 简洁），但 Settings 首屏头像/名字会变。

### 10.3 phoneOwner 不联动

切 persona 不重置 phoneOwnerStore。如果你正在查 char-Y 手机，切完 persona 仍在 char-Y 手机（只是回到自己手机后看到的是新 persona 的数据）。

## 11. 测试策略

`src/__tests__/persona/`：

| 测试 | 验证 |
|---|---|
| `migration.test.ts` | Pass A/B/C 在多种历史数据形态下正确；幂等；char-char 流分流；群聊 cursor 归属 |
| `dual-persona-isolation.test.ts` | A 跟 char-Y 聊完，切 B 后 entries/memoryState 全空；切回 A 看到原历史 |
| `cross-phone-view.test.ts` | A 状态下查 char-Y 手机，看到含 A、B 两条聊天列表项 |
| `heartbeat-routing.test.ts` | char-Y 心跳分别 fire 时写入正确的 (char, persona) 桶；不污染另一桶 |
| `me-substitution.test.ts` | 全 src 跑 grep 断言无 `'me'` 字面量残留（除迁移脚本目录） |
| `phoneowner-persona-decoupling.test.ts` | 切 persona 不重置 phoneOwnerId |
| `group-chat-visibility.test.ts` | A 创建的群 B 在自己手机看不见，但查群内 char 手机能看见 |
| `phonelocal-store-switching.test.ts` | 切 persona 时 notes/calendar/桌面布局等 store 立即切换 |

E2E (Playwright)：
- 双 persona 平行流：建 B → 跟 char-Y 说"我叫鲍勃" → 切 A → 跟 char-Y 验证 char-Y 不知道你叫鲍勃
- 老数据升级：用旧版 IDB fixture 启动，验证升级后所有历史数据可读

## 12. 错误处理 / 边界

- 迁移失败：见 §7
- 切到不存在的 persona id：fallback `persona-default`
- 删除 active persona：UI 阻止
- 删除最后一个 persona：UI 阻止
- phone-local registry 拿不到 ownerId（race）：抛错，不允许默默写到错的桶
- 历史 user-app 自定义存储中含 `:owner:me:` 的 key：迁移脚本统一改写

## 13. Non-goals

- **跨 persona 数据搬移**：不支持把 A 的数据"复制"到 B
- **persona 间 SSO / 共享账号**：不存在该概念
- **Lock screen 切换 / Control Center 切换**：仅 Settings 内
- **后台 persona 暂停心跳**：保持运行，token 通过间隔调控
- **persona 维度的 AI 配置覆盖**：API key 等仍全局

## 14. 风险

| 风险 | 缓解 |
|---|---|
| Pass B cursor 算法在群聊中归属轻微偏差 | 已知接受。生产数据群聊占比小，prompt 端有 speakerId 兜底 |
| PR3 改动多个 store 的 hook 接口，可能漏改 callsite | TypeScript + 全文 grep 双重检查；CI 加 lint 规则禁止 import 旧 store 直接对象 |
| 新 persona 切换体验卡顿（IDB 加载） | 切换时 phone-local stores 并行 lazy load；首次切换可见 spinner |
| Heartbeat token 成本增加 | 默认间隔不变；提供"后台 persona 间隔倍率"高级设置 |

---

## 决议历史

- 2026-05-01：定模型为 SIM 卡式 + 统一 entity 抽象（用户拍板）
- 2026-05-01：persona 切换入口仅放 Settings（用户选 C）
- 2026-05-01：识别 §5.1 高危潜伏 bug，独立为 PR1 优先发车
- 2026-05-01：memory 双键 (owner, peer) 模型，覆盖 char-char 和 persona-char 两种关系
