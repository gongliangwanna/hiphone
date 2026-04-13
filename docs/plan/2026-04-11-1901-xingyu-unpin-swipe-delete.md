# 心语（XingYu）信箱：去置顶 + 左滑删除 + 通讯录驱动入口

## 用户原始需求（verbatim）
> 去掉这个心云里面的置顶功能，所有的消息都不置顶，然后呢，所有消息像微信一样，我们这消息列表，不是就是信箱列表里面，我们每一个信箱我们往左滑，就可以有一个删除按钮，就可以把这个消息给这个会话给删掉。对，然后我们不是有通讯录吗？我们通讯录这里面的角色只只要我们和他聊过天，那么他们就会出现在出现在这个信箱列表当中。

## 任务拆解
1. **去掉置顶** — 信箱（ChatListTab）所有会话按时间倒序排列，没有置顶行为，也没有置顶图标。
2. **左滑删除** — 信箱每一行支持横向手势：向左拖拽露出红色"删除"按钮，点击即可把该会话从信箱里移除。行为参考 WeChat / iOS Mail：
   - 阈值：滑动距离 > 40px 时开启半露（snap 到 -88px，按钮完全可见），否则回弹。
   - 同一时刻只允许一行处于"展开"状态，切换目标时自动收起上一个。
   - 点击列表其他地方（或滚动列表）时也应收起已展开的行。
   - 点删除按钮 → 立刻从 store 移除该 conv 及其 messages，并中断可能在途的 AI 流。
3. **通讯录驱动入口** — 通讯录里的角色只要聊过天就会出现在信箱：
   - 用户创建的 character：沿用 `ensureCharacterConversation` 现有流程。
   - 旧 mock idol（陆星辰、林知夏…）：本次新增 `ensureIdolConversation(idolId)`，保证从通讯录点开时会创建（或复用）一条 mock 会话；这样删除后从通讯录再点，仍能重新出现在信箱。
   - 通讯录页面（ContactsTab）新增一个"偶像"section，展示 `IDOLS` 列表并挂载到 `ensureIdolConversation`。

## 关键决策

### DEC-1：不做二级确认（Swipe 直接点 Delete 就删）
iOS Mail 也是一次点击就删除，再提供撤销是另一项工作量。本次就做"滑出按钮 → 点击即删"，不插 `window.confirm`、不做 Toast Undo。如果将来需要撤销，可以再加一个"最近删除"暂存区。

### DEC-2：手势实现用 motion value + ref，不经 React state
项目规范（`src/CLAUDE.md` 踩坑 3 & 4）：每帧 60fps 的位移必须走 motion value，state 仅在阶段边界更新。`useRef` 存 isDragging，避免 React 异步更新导致 pointerUp 读到过期值。

### DEC-3：一行展开状态用 `openRowId` 顶层 state 管理
多行互斥展开：ChatListTab 持 `openRowId`，ConvRow 从 props 读自己是否展开。点击另一行会覆盖 openRowId，已展开的那一行收到 `isOpen=false` 后回弹。点击空白或滚动列表也清空 `openRowId`。

### DEC-4：Drag 命中逻辑和 Tap 命中互斥
ConvRow 是 `<button>`，原先 onClick 直接 openChat。现在要支持拖拽，必须：
- 拖拽距离 > 10px 后标记 `didDragRef.current = true`，pointerUp 时若 didDrag 则抑制点击。
- 拖拽时 `touchAction: 'pan-y'` 仍允许竖向滚动；横向走我们自己的监听（`touchAction: 'pan-y'` + pointer events）。

### DEC-5：deleteConversation 必须清理 AI 流 & 定时器
`xingYuDataStore` 里 `replyTimers` / `aiControllers` 是 module-level 的 Map，删 conv 时要对应 `clearTimeout` + `AbortController.abort()`，否则 AI 还会给已被删的会话推消息。

### DEC-6：seed IDOLS 也出现在 ContactsTab
原先 ContactsTab 只显示 `useCharacterStore` 里的 user character。用户要求"通讯录里的角色"能重新出现在信箱，意味着通讯录应该是"所有可聊对象"的超集。把 mock `IDOLS`（7 位）作为第二个 section 显示，title 用"推荐偶像"，和用户自建 "我的角色" 分开。

## 文件改动清单

| 文件 | 改动 |
|------|------|
| `src/apps/XingYu/data.ts` | 移除 `Conversation.pinned` 字段；删 `SEED_CONVS` 里的 `pinned: true`。 |
| `src/apps/XingYu/xingYuDataStore.ts` | 新增 `deleteConversation(convId)` 和 `ensureIdolConversation(idolId)`；`deleteConversation` 内部清理 timer/controller。 |
| `src/apps/XingYu/tabs/ChatListTab.tsx` | 去掉 pin 排序和 Pin 图标；加 `openRowId` 状态；`ConvRow` 改写为可横向拖拽 + 右侧删除按钮。 |
| `src/apps/XingYu/tabs/ContactsTab.tsx` | 新增 "推荐偶像" section 显示 IDOLS；点击用 `ensureIdolConversation` + `openChat`。 |

## 验收
- [ ] `pnpm tsc --noEmit` 通过
- [ ] `pnpm test` 通过
- [ ] `pnpm build` 通过
- [ ] 手动：信箱没有置顶；左滑任意一行，露出删除；点击删除，该 conv 消失；再点通讯录里对应偶像 → 会话重新出现在信箱。
- [ ] 手动：左滑一行展开，再左滑另一行，前一行自动收起。
- [ ] 手动：点击空白或滚动列表，已展开的行回弹。
