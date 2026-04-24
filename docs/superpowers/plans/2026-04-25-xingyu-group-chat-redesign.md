# 星语群聊优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复星语建群崩溃、重写建群 / 群设置 UX、新增群聊"手动触发回复"机制（输入框上方头像横滑条，点谁谁说话），并把群消息按渲染后形态写入所有成员的 AI 上下文。

**Architecture:** 数据层扩展 `Conversation` 群字段；store 层新增 `triggerGroupReply` + 把 `scheduleAICharacterReply` 重构成接受 `characterIdOverride`；memoryWriter 的 AI-AI fan-out 加群分支；UI 层拆 `GroupSettings.tsx` + `GroupMemberStrip.tsx`；建群抽屉简化成"单步选人 + 自动派生群名"。SDK 层给 `ChatOptions` 加 `appSystemPromptSuffix` 以 KV-cache-safe 方式注入群上下文。

**Tech Stack:** React + Zustand + TypeScript + Vitest + motion/react + lucide-react；`pnpm test` 跑单测 / `pnpm build` 跑 tsc + vite 构建。

**Spec:** `docs/superpowers/specs/2026-04-25-xingyu-group-chat-redesign-design.md`

---

## File Structure

**Modified:**

| 文件 | 改动范围 |
|---|---|
| `src/apps/XingYu/data.ts` | `Conversation` 加 `groupAvatar` / `groupAnnouncement` |
| `src/apps/XingYu/xingYuDataStore.ts` | `createGroupConversation` 签名换；新增 `triggerGroupReply` / `updateGroupSettings` / `addGroupMembers` / `removeGroupMember`；`scheduleAICharacterReply` 改成接受 `characterIdOverride` |
| `src/platform/ai/memoryWriter.ts` | fan-out 加 `groupMemberIds` 分支；`deriveCharacterIdFromConv` 群兜底 |
| `src/platform/userApp/sdk/ai.ts` | `ChatOptions` 加 `appSystemPromptSuffix`；拼接到 `frozenAppSystemPrompt` |
| `src/apps/XingYu/pages/ChatSettings.tsx` | 顶层按 `conv.groupMemberIds?.length > 0` 分叉渲染群版；`createGroup` → `createGroupConversation` + strip 前缀 bug 修复；`GroupPicker` 重写（单步 + 预选 + 搜索） |
| `src/apps/XingYu/pages/ChatDetail.tsx` | 群聊场景输入框上方插入 `<GroupMemberStrip>` |

**Created:**

| 文件 | 职责 |
|---|---|
| `src/apps/XingYu/components/GroupMemberStrip.tsx` | 输入框上方的群成员头像横滑条；串行锁 UI；点击回调 |
| `src/apps/XingYu/components/GroupSettings.tsx` | 群设置页 QQ 风格渲染（成员网格 + 群信息 rows + 退出） |
| `src/apps/XingYu/components/GroupAnnouncementEditor.tsx` | 群公告页内展开多行编辑器 |
| `src/apps/XingYu/__tests__/group-chat.test.ts` | 建群 / 触发回复 / 串行锁 / 成员管理单测 |
| 扩展 `src/platform/ai/__tests__/memoryWriter.test.ts` | 群聊 fan-out 覆盖所有成员 |

---

## Task 1: 数据模型扩展

**Files:**
- Modify: `src/apps/XingYu/data.ts:118-136`

- [ ] **Step 1: 扩展 `Conversation` 接口**

把 `src/apps/XingYu/data.ts` 里 `Conversation` 接口改成：

```ts
export interface Conversation {
  id: string;
  idolId: string;
  characterId?: string;
  lastMsg: string;
  lastTime: number;
  unread: number;
  backgroundUrl?: string;
  remarkName?: string;
  /** 用户创建的群聊名称 */
  groupName?: string;
  /** 用户创建的群聊成员裸 characterId 数组（无 char- 前缀） */
  groupMemberIds?: string[];
  /** 群头像（data URL，压缩后 base64） */
  groupAvatar?: string;
  /** 群公告文本 */
  groupAnnouncement?: string;
  aiChatParticipants?: [string, string];
}
```

- [ ] **Step 2: 运行 typecheck**

Run: `pnpm typecheck`
Expected: 0 errors（只加字段，不动旧逻辑）

- [ ] **Step 3: Commit**

```bash
git add src/apps/XingYu/data.ts
git commit -m "feat(xingyu): extend Conversation with groupAvatar + groupAnnouncement"
```

---

## Task 2: store — `createGroupConversation` 签名重写 + 自动派生群名

**Files:**
- Modify: `src/apps/XingYu/xingYuDataStore.ts:142-143, 857-870`
- Modify: `src/apps/XingYu/data.ts` (XingYuDataState interface signature)
- Test: `src/apps/XingYu/__tests__/group-chat.test.ts` (create)

- [ ] **Step 1: 写失败测试**

创建 `src/apps/XingYu/__tests__/group-chat.test.ts`：

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

describe('createGroupConversation', () => {
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        { id: 'xiaoxing', name: '小星', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'yueyue',   name: '月月', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'aria',     name: 'Aria', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({ conversations: [], messages: [] });
  });

  it('stores bare characterIds without char- prefix', () => {
    const convId = useXYData.getState().createGroupConversation(['xiaoxing', 'yueyue']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['xiaoxing', 'yueyue']);
  });

  it('auto-derives group name from first 3 member names', () => {
    const convId = useXYData.getState().createGroupConversation(['xiaoxing', 'yueyue', 'aria']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupName).toBe('小星、月月、Aria');
  });

  it('adds 等 N 人 suffix when more than 3 members', () => {
    useCharacterStore.setState({
      characters: [
        ...useCharacterStore.getState().characters,
        { id: 'c4', name: '小四', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'c5', name: '小五', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    const convId = useXYData.getState().createGroupConversation(['xiaoxing', 'yueyue', 'aria', 'c4', 'c5']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupName).toBe('小星、月月、Aria 等 5 人');
  });

  it('strips char- prefix if caller passes prefixed ids', () => {
    const convId = useXYData.getState().createGroupConversation(['char-xiaoxing', 'char-yueyue']);
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['xiaoxing', 'yueyue']);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/apps/XingYu/__tests__/group-chat.test.ts`
Expected: FAIL — 当前 `createGroupConversation(name, memberIds)` 签名不对

- [ ] **Step 3: 改 store 签名 + 实现自动命名**

`src/apps/XingYu/xingYuDataStore.ts:142` 接口声明改：

```ts
/** 创建用户自建群聊（裸 characterId 数组；无需传群名，自动派生），返回 convId */
createGroupConversation: (memberIds: string[]) => string;
```

`src/apps/XingYu/xingYuDataStore.ts:857-870` 实现改：

```ts
createGroupConversation: (memberIds) => {
  const stripped = memberIds.map((id) =>
    id.startsWith('char-') ? id.slice('char-'.length) : id,
  );
  const name = deriveGroupName(stripped);
  const convId = `c-group-${uid()}`;
  const conv: Conversation = {
    id: convId,
    idolId: convId,
    lastMsg: '',
    lastTime: Date.now(),
    unread: 0,
    groupName: name,
    groupMemberIds: stripped,
  };
  set({ conversations: [conv, ...get().conversations] });
  return convId;
},
```

在文件顶部（紧邻其它 helper 的位置，~第 240 行 `buildStickerBubble` 之上或之下）加：

```ts
function deriveGroupName(memberIds: string[]): string {
  const chars = useCharacterStore.getState().characters;
  const names = memberIds
    .map((id) => chars.find((c) => c.id === id)?.name ?? '未知')
    .filter(Boolean);
  if (names.length === 0) return '新群聊';
  const head = names.slice(0, 3).join('、');
  if (memberIds.length > 3) return `${head} 等 ${memberIds.length} 人`;
  return head;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/apps/XingYu/__tests__/group-chat.test.ts -t createGroupConversation`
Expected: PASS 4/4

- [ ] **Step 5: Commit**

```bash
git add src/apps/XingYu/data.ts src/apps/XingYu/xingYuDataStore.ts src/apps/XingYu/__tests__/group-chat.test.ts
git commit -m "feat(xingyu): createGroupConversation auto-derives name + strips char- prefix"
```

---

## Task 3: store — 群设置相关 action

**Files:**
- Modify: `src/apps/XingYu/xingYuDataStore.ts` (interface + impl)
- Test: `src/apps/XingYu/__tests__/group-chat.test.ts` (extend)

- [ ] **Step 1: 写失败测试**

在 `group-chat.test.ts` 末尾追加：

```ts
describe('group settings mutations', () => {
  let convId: string;
  beforeEach(() => {
    useCharacterStore.setState({
      characters: [
        { id: 'a', name: 'A', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'b', name: 'B', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'c', name: 'C', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({ conversations: [], messages: [] });
    convId = useXYData.getState().createGroupConversation(['a', 'b']);
  });

  it('updateGroupSettings changes avatar / announcement / name', () => {
    useXYData.getState().updateGroupSettings(convId, {
      groupAvatar: 'data:image/png;base64,xxx',
      groupAnnouncement: '今天开会',
      groupName: '技术组',
    });
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupAvatar).toBe('data:image/png;base64,xxx');
    expect(conv.groupAnnouncement).toBe('今天开会');
    expect(conv.groupName).toBe('技术组');
  });

  it('addGroupMembers appends new ids and dedupes', () => {
    useXYData.getState().addGroupMembers(convId, ['c', 'a']); // 'a' already member
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['a', 'b', 'c']);
  });

  it('removeGroupMember strips an id', () => {
    useXYData.getState().addGroupMembers(convId, ['c']);
    useXYData.getState().removeGroupMember(convId, 'b');
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['a', 'c']);
  });

  it('removeGroupMember refuses to drop below 2 members', () => {
    expect(() => useXYData.getState().removeGroupMember(convId, 'a')).toThrow(
      /至少/,
    );
    const conv = useXYData.getState().conversations.find((c) => c.id === convId)!;
    expect(conv.groupMemberIds).toEqual(['a', 'b']); // unchanged
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/apps/XingYu/__tests__/group-chat.test.ts -t "group settings mutations"`
Expected: FAIL — 方法都不存在

- [ ] **Step 3: 加接口声明**

`src/apps/XingYu/xingYuDataStore.ts` 在 `XingYuDataState` 接口里 `createGroupConversation` 下面加：

```ts
/** 更新群头像 / 公告 / 名称（任意子集） */
updateGroupSettings: (
  convId: string,
  patch: Partial<Pick<Conversation, 'groupAvatar' | 'groupAnnouncement' | 'groupName'>>,
) => void;
/** 追加群成员（去重） */
addGroupMembers: (convId: string, memberIds: string[]) => void;
/** 移除单个群成员；群成员 < 2 时抛错 */
removeGroupMember: (convId: string, memberId: string) => void;
```

- [ ] **Step 4: 写实现**

在 `createGroupConversation` 之后插入：

```ts
updateGroupSettings: (convId, patch) => {
  set({
    conversations: get().conversations.map((c) =>
      c.id === convId && c.groupMemberIds ? { ...c, ...patch } : c,
    ),
  });
},

addGroupMembers: (convId, newIds) => {
  const stripped = newIds.map((id) =>
    id.startsWith('char-') ? id.slice('char-'.length) : id,
  );
  set({
    conversations: get().conversations.map((c) => {
      if (c.id !== convId || !c.groupMemberIds) return c;
      const merged = Array.from(new Set([...c.groupMemberIds, ...stripped]));
      return { ...c, groupMemberIds: merged };
    }),
  });
},

removeGroupMember: (convId, memberId) => {
  const conv = get().conversations.find((c) => c.id === convId);
  if (!conv?.groupMemberIds) return;
  if (conv.groupMemberIds.length <= 2) {
    throw new Error('至少需保留 2 名成员');
  }
  set({
    conversations: get().conversations.map((c) =>
      c.id === convId && c.groupMemberIds
        ? { ...c, groupMemberIds: c.groupMemberIds.filter((id) => id !== memberId) }
        : c,
    ),
  });
},
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/apps/XingYu/__tests__/group-chat.test.ts -t "group settings"`
Expected: PASS 4/4

- [ ] **Step 6: Commit**

```bash
git add src/apps/XingYu/xingYuDataStore.ts src/apps/XingYu/__tests__/group-chat.test.ts
git commit -m "feat(xingyu): add updateGroupSettings + addGroupMembers + removeGroupMember"
```

---

## Task 4: memoryWriter — 群聊 fan-out 到所有成员

**Files:**
- Modify: `src/platform/ai/memoryWriter.ts:53-63, 113-121`
- Test: `src/platform/ai/__tests__/memoryWriter.test.ts` (extend)

- [ ] **Step 1: 写失败测试**

在 `src/platform/ai/__tests__/memoryWriter.test.ts` 末尾追加：

```ts
describe('_appendMessage — group fan-out', () => {
  beforeEach(() => {
    useCharacterMemory.setState({ entries: {} } as any);
    useCharacterStore.setState({
      characters: [
        { id: 'a', name: 'A', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'b', name: 'B', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'c', name: 'C', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({
      conversations: [{
        id: 'c-group-x',
        idolId: 'c-group-x',
        lastMsg: '', lastTime: 0, unread: 0,
        groupName: 'G',
        groupMemberIds: ['a', 'b', 'c'],
      }],
      messages: [],
    });
  });

  it('user text fans out to every group member as role=user', () => {
    _appendMessage({
      id: 'm1', convId: 'c-group-x', senderId: 'me',
      type: 'text', text: 'hi everyone', timestamp: 1000,
    }, 'xingyu');
    for (const memberId of ['a', 'b', 'c']) {
      const entries = useCharacterMemory.getState().getAll(memberId);
      expect(entries).toHaveLength(1);
      expect(entries[0]!.role).toBe('user');
      expect(entries[0]!.content).toBe('hi everyone');
    }
  });

  it('member A reply fans out with role=assistant for A, role=user for B/C', () => {
    _appendMessage({
      id: 'm2', convId: 'c-group-x', senderId: 'char-a',
      type: 'text', text: 'hello', timestamp: 2000,
    }, 'xingyu');
    expect(useCharacterMemory.getState().getAll('a')[0]!.role).toBe('assistant');
    expect(useCharacterMemory.getState().getAll('b')[0]!.role).toBe('user');
    expect(useCharacterMemory.getState().getAll('c')[0]!.role).toBe('user');
    expect(useCharacterMemory.getState().getAll('b')[0]!.speakerId).toBe('char-a');
  });
});
```

顶部 import 确保有：`import { _appendMessage } from '../memoryWriter';`、`import { useCharacterMemory } from '../characterMemoryStore';`、`import { useCharacterStore } from '@/platform/stores/characterStore';`、`import { useXYData } from '@/apps/XingYu/xingYuDataStore';`

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/platform/ai/__tests__/memoryWriter.test.ts -t "group fan-out"`
Expected: FAIL — 当前群聊无 primary，fan-out 未触发

- [ ] **Step 3: 改 `_appendMessage` 和 `deriveCharacterIdFromConv`**

`src/platform/ai/memoryWriter.ts:53-63` 替换成：

```ts
// ── 3. AI-AI fan-out 或 群聊 fan-out ──
const conv = useXYData.getState().conversations.find((c) => c.id === msg.convId);

if (conv?.aiChatParticipants?.length) {
  for (const otherId of conv.aiChatParticipants) {
    if (otherId === primaryCharId) continue;
    const entryForOther = buildMemoryEntry(msg, source, buildCtx(otherId));
    if (entryForOther) {
      useCharacterMemory.getState().append(otherId, entryForOther);
    }
  }
} else if (conv?.groupMemberIds?.length) {
  for (const memberId of conv.groupMemberIds) {
    if (memberId === primaryCharId) continue; // primary already written above
    const entryForMember = buildMemoryEntry(msg, source, buildCtx(memberId));
    if (entryForMember) {
      useCharacterMemory.getState().append(memberId, entryForMember);
    }
  }
}
```

`deriveCharacterIdFromConv` (第 113 行) 加群分支：

```ts
function deriveCharacterIdFromConv(convId: string): string | null {
  if (convId.startsWith('c-char-')) {
    return convId.slice('c-char-'.length);
  }
  const conv = useXYData.getState().conversations.find((c) => c.id === convId);
  if (conv?.aiChatParticipants?.length) return conv.aiChatParticipants[0]!;
  if (conv?.groupMemberIds?.length) return conv.groupMemberIds[0]!;
  if (conv?.characterId) return conv.characterId;
  return null;
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm test src/platform/ai/__tests__/memoryWriter.test.ts`
Expected: ALL PASS（老测试不该破）

- [ ] **Step 5: Commit**

```bash
git add src/platform/ai/memoryWriter.ts src/platform/ai/__tests__/memoryWriter.test.ts
git commit -m "feat(ai): memoryWriter fans out group messages to every member"
```

---

## Task 5: SDK — `ChatOptions.appSystemPromptSuffix`

**Files:**
- Modify: `src/platform/userApp/sdk/ai.ts:239-254, 348-352`
- Test: 既有 e2e 测试可验证拼接（或新增小测试）

- [ ] **Step 1: 扩展 `ChatOptions` 接口**

`src/platform/userApp/sdk/ai.ts:239-254` 把接口改成：

```ts
export interface ChatOptions {
  persistent?: boolean;
  signal?: AbortSignal;
  onParseFailure?: (info: { raw: string; attempts: number }) => void;
  /**
   * Per-session suffix appended to the frozen appSystemPrompt.
   *
   * Caller 用来注入会话级稳定上下文（如群聊成员名单）。保持在 System
   * block 里对 KV cache 友好——只要 suffix 在一次 session 里不变就行。
   */
  appSystemPromptSuffix?: string;
}
```

- [ ] **Step 2: 把 suffix 拼到 frozenAppSystemPrompt**

`src/platform/userApp/sdk/ai.ts:348-352` 替换：

```ts
const frozenAppSystemPrompt: string | undefined = (() => {
  const base = capturedAppId
    ? (getAppSystemPrompt(capturedAppId)?.() ?? undefined)
    : undefined;
  const suffix = options.appSystemPromptSuffix?.trim();
  if (suffix) {
    return base ? `${base}\n\n${suffix}` : suffix;
  }
  return base;
})();
```

- [ ] **Step 3: typecheck + 跑已有 AI 测试**

Run: `pnpm typecheck && pnpm test src/platform/ai/ src/platform/userApp/`
Expected: all green（新增字段可选，不应破旧测）

- [ ] **Step 4: Commit**

```bash
git add src/platform/userApp/sdk/ai.ts
git commit -m "feat(ai): ChatOptions.appSystemPromptSuffix concatenated to System block"
```

---

## Task 6: store — `scheduleAICharacterReply` 接受 override + 新增 `triggerGroupReply`

**Files:**
- Modify: `src/apps/XingYu/xingYuDataStore.ts:61-67, 302-555`（加 characterId 参数 + 群锁 + 成员列表 suffix）

- [ ] **Step 1: 写失败测试（串行锁 + 触发回复写入所有成员上下文）**

在 `group-chat.test.ts` 末尾追加：

```ts
describe('triggerGroupReply', () => {
  beforeEach(() => {
    // Minimal AI config so API-key early-exit triggers error bubble
    // instead of network call. We're testing the lock + dispatch shape,
    // not the LLM integration.
    useAIConfigStore.setState({ apiKey: '', endpoint: '', model: '' } as any);
    useCharacterStore.setState({
      characters: [
        { id: 'a', name: 'A', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
        { id: 'b', name: 'B', avatar: '', description: '', personality: '', scenario: '', systemPrompt: '', postHistoryInstructions: '', messageExamples: [], firstMessage: '' },
      ],
    } as any);
    useXYData.setState({ conversations: [], messages: [] });
  });

  it('triggerGroupReply writes an error bubble when API key missing (smoke)', () => {
    const convId = useXYData.getState().createGroupConversation(['a', 'b']);
    useXYData.getState().triggerGroupReply(convId, 'a');
    const msgs = useXYData.getState().messages.filter((m) => m.convId === convId);
    expect(msgs.length).toBe(1);
    expect(msgs[0]!.senderId).toBe('char-a');
    expect((msgs[0] as any).text).toMatch(/未配置 AI 服务/);
  });

  it('triggerGroupReply no-ops when characterId not in members', () => {
    const convId = useXYData.getState().createGroupConversation(['a', 'b']);
    useXYData.getState().triggerGroupReply(convId, 'stranger');
    const msgs = useXYData.getState().messages.filter((m) => m.convId === convId);
    expect(msgs).toHaveLength(0);
  });
});
```

Top of file add: `import { useAIConfigStore } from '@/platform/stores/aiConfigStore';`

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm test src/apps/XingYu/__tests__/group-chat.test.ts -t triggerGroupReply`
Expected: FAIL — `triggerGroupReply` 未定义

- [ ] **Step 3: 重构 `scheduleAICharacterReply` 接受 `characterIdOverride`**

`src/apps/XingYu/xingYuDataStore.ts` ~第 302 行，把函数签名改：

```ts
function scheduleAICharacterReply(
  convId: string,
  get: () => XingYuDataState,
  characterIdOverride?: string,
) {
  // Abort any in-flight request for this conversation
  const prev = aiSessions.get(convId);
  if (prev) {
    prev.controller.abort();
    prev.session.abort();
  }

  const conv = get().conversations.find((c) => c.id === convId);
  if (!conv) return;

  // Resolve which character is speaking this turn.
  const characterId = characterIdOverride ?? conv.characterId;
  if (!characterId) return;
```

然后把函数体里所有 `conv.characterId` / `characterId` 局部变量的**用法**替换成刚定义的 `characterId`。具体涉及的行（相对当前文件）：
- 第 314 行 `if (!conv?.characterId) return;` → 删除，已经由上面 guard 替代
- 第 322 行 `const senderId = \`char-${conv.characterId}\`;` → 改为 `const senderId = \`char-${characterId}\`;`
- 第 346 行 `const characterId = conv.characterId;` → **删除（会 shadow 已声明的）**
- 第 388 行 `withUserAppContext(XINGYU_APP_ID, () =>` 括号内 `chatWithCharacter(characterId, ...)` 保持不变（用的就是外层 characterId）

把 `chatWithCharacter(characterId, { ... })` 调用里添加群场景的 suffix：

```ts
// Build group-context suffix when this is a group conversation.
const groupSuffix: string | undefined = conv.groupMemberIds?.length
  ? (() => {
      const chars = useCharacterStore.getState().characters;
      const names = conv.groupMemberIds
        .map((id) => chars.find((c) => c.id === id)?.name ?? '未知')
        .join('、');
      return `你正在群聊「${conv.groupName ?? names}」中，群成员包含：${names}。请以你自己的身份发言，可以回应其他成员说的话。`;
    })()
  : undefined;

const sessionInstance = withUserAppContext(XINGYU_APP_ID, () =>
  chatWithCharacter(characterId, {
    persistent: true,
    signal: controller.signal,
    appSystemPromptSuffix: groupSuffix,
    onParseFailure: () => {
      showFailureBubble('[AI 回复失败] 回复格式错误,已重试 3 次');
    },
  }),
);
```

- [ ] **Step 4: 新增 `triggerGroupReply` + 串行锁**

文件顶部 `aiSessions` 之后加：

```ts
/** 群聊手动触发回复时的串行锁：convId → 正在生成的 characterId */
const generatingByConv = new Map<string, string>();

export function _isGroupReplyGenerating(convId: string): string | null {
  return generatingByConv.get(convId) ?? null;
}
```

在 `XingYuDataState` 接口里 `createGroupConversation` 附近加：

```ts
/** 群聊手动触发某角色回复；若该 conv 已有角色在生成则 no-op */
triggerGroupReply: (convId: string, characterId: string) => void;
```

在 `createGroupConversation` 的实现下方加：

```ts
triggerGroupReply: (convId, characterId) => {
  const conv = get().conversations.find((c) => c.id === convId);
  if (!conv?.groupMemberIds?.includes(characterId)) return;
  if (generatingByConv.has(convId)) return;
  generatingByConv.set(convId, characterId);
  // scheduleAICharacterReply wraps the real work in a finally that will
  // clear the lock. We hook onto aiSessions teardown below by reading
  // whether this conv is still tracked.
  scheduleAICharacterReply(convId, get, characterId);
},
```

然后在 `scheduleAICharacterReply` 的 `.finally()` block 末尾（第 ~550 行）加：

```ts
.finally(() => {
  const entry = aiSessions.get(convId);
  if (entry && entry.session === sessionInstance) {
    aiSessions.delete(convId);
  }
  // Release the group-reply lock if held (no-op for 1:1)
  if (generatingByConv.get(convId) === characterId) {
    generatingByConv.delete(convId);
  }
})
```

注意：对**没 apikey 的早退分支**（当前第 ~343 行）也要放锁，否则 trigger→早退→锁永远停。改成：

```ts
if (!aiConfig.apiKey) {
  const errText = '[未配置 AI 服务] 请到 设置 → AI 服务 填写 API Key';
  const errMsg: Message = { id: uid(), convId, senderId, type: 'text', text: errText, timestamp: now };
  _appendMessage(errMsg, 'xingyu');
  if (generatingByConv.get(convId) === characterId) generatingByConv.delete(convId);
  return;
}
```

（同时把裸 setState 改成 `_appendMessage` 统一写路径；这样错误气泡也会走 fan-out，测试断言"群里每个成员都能收到这条"才成立——本测试只看 messages 数组所以 _appendMessage 的 fan-out 不影响）

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm test src/apps/XingYu/__tests__/group-chat.test.ts`
Expected: ALL PASS

同时跑 `pnpm test src/apps/XingYu/__tests__/xingyu-via-memoryStore.test.ts` 确认老测试没破。

- [ ] **Step 6: Commit**

```bash
git add src/apps/XingYu/xingYuDataStore.ts src/apps/XingYu/__tests__/group-chat.test.ts
git commit -m "feat(xingyu): triggerGroupReply + serial lock + group system-prompt suffix"
```

---

## Task 7: 组件 `GroupMemberStrip`

**Files:**
- Create: `src/apps/XingYu/components/GroupMemberStrip.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/apps/XingYu/components/GroupMemberStrip.tsx
import { motion } from 'motion/react';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from './Avatar';
import { T } from '../theme';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

interface Props {
  memberIds: string[];
  /** null = unlocked; characterId = that member is generating */
  generatingId: string | null;
  onTapMember: (characterId: string) => void;
}

export function GroupMemberStrip({ memberIds, generatingId, onTapMember }: Props) {
  const characters = useCharacterStore((s) => s.characters);
  const locked = generatingId !== null;

  return (
    <div
      className="shrink-0"
      style={{
        padding: '8px 12px 6px',
        backgroundColor: T.overlay,
        borderTop: `0.5px solid ${T.separator}`,
        opacity: locked ? 0.55 : 1,
        pointerEvents: locked ? 'none' : 'auto',
      }}
    >
      <div
        className="scrollbar-hide flex gap-3 overflow-x-auto"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {memberIds.map((id) => {
          const ch = characters.find((c) => c.id === id);
          const isGenerating = generatingId === id;
          return (
            <motion.button
              key={id}
              className="flex shrink-0 flex-col items-center"
              style={{ width: 52 }}
              whileTap={locked ? undefined : { scale: 0.92 }}
              onClick={() => !locked && onTapMember(id)}
              disabled={locked}
            >
              <div className="relative">
                <Avatar src={ch?.avatar?.trim() || CHAR_FALLBACK_AVATAR} size={40} ringIndex={0} />
                {isGenerating && (
                  <motion.div
                    className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full"
                    style={{ width: 16, height: 16, backgroundColor: T.accent, color: '#fff', fontSize: 10 }}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                  >
                    …
                  </motion.div>
                )}
              </div>
              <span
                className="mt-1 w-full truncate text-center"
                style={{ fontSize: 10, color: T.textSecondary, lineHeight: 1.1 }}
              >
                {ch?.name ?? '未知'}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/apps/XingYu/components/GroupMemberStrip.tsx
git commit -m "feat(xingyu): add GroupMemberStrip (horizontal avatar strip with serial-lock UI)"
```

---

## Task 8: 在 ChatDetail 里挂上 `GroupMemberStrip`

**Files:**
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx`（输入框上方插入；读取串行锁状态）

- [ ] **Step 1: 导入和订阅锁状态**

文件顶部已有的 import 旁加：

```tsx
import { GroupMemberStrip } from '../components/GroupMemberStrip';
import { _isGroupReplyGenerating } from '../xingYuDataStore';
```

组件体内（例如 `const isGroup = peer?.isGroup ?? false;` 那行之后）：

```tsx
// Group manual-reply serial lock — re-read each render; xingYuDataStore.messages
// changes on every reply event which already triggers a ChatDetail re-render,
// so polling via getState() here is correct in practice.
const generatingMemberId = conv?.groupMemberIds ? _isGroupReplyGenerating(conv.id) : null;
const triggerGroupReply = useXYData((s) => s.triggerGroupReply);
```

- [ ] **Step 2: 在输入框**之前**插入 strip**

找到 `{/* ── Quote preview bar (above input) ── */}` 那个 JSX（~第 747 行）。在它**之前**插入：

```tsx
{conv?.groupMemberIds?.length && !multiSelectMode && !isViewingOther ? (
  <GroupMemberStrip
    memberIds={conv.groupMemberIds}
    generatingId={generatingMemberId}
    onTapMember={(characterId) => triggerGroupReply(conv.id, characterId)}
  />
) : null}
```

- [ ] **Step 3: typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: 0 errors / build success

- [ ] **Step 4: Commit**

```bash
git add src/apps/XingYu/pages/ChatDetail.tsx
git commit -m "feat(xingyu): wire GroupMemberStrip into group ChatDetail"
```

---

## Task 9: 拆出 `GroupSettings` 组件（QQ 风格）

**Files:**
- Create: `src/apps/XingYu/components/GroupSettings.tsx`

- [ ] **Step 1: 写组件**

```tsx
// src/apps/XingYu/components/GroupSettings.tsx
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Plus, Minus, X, Search, Image as ImageIcon } from 'lucide-react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from './Avatar';
import { T, springs } from '../theme';
import type { Conversation } from '../data';

const CHAR_FALLBACK_AVATAR = '/resource/avatars/preset-01.jpg';

interface Props {
  conv: Conversation;
  onOpenPicker: (mode: 'add' | 'initial') => void;  // 触发父组件打开建群抽屉（追加模式）
  onCompressImage: (file: File) => Promise<string>; // 复用父组件里 compressBgImage
}

export function GroupSettings({ conv, onOpenPicker, onCompressImage }: Props) {
  const closeChatSettings = useXYNav((s) => s.closeChatSettings);
  const openChatSearch = useXYNav((s) => s.openChatSearch);
  const deleteConv = useXYData((s) => s.deleteConversation);
  const updateGroup = useXYData((s) => s.updateGroupSettings);
  const removeMember = useXYData((s) => s.removeGroupMember);
  const updateConvSettings = useXYData((s) => s.updateConversationSettings);
  const characters = useCharacterStore((s) => s.characters);

  const [deleteMode, setDeleteMode] = useState(false);
  const [showNameEditor, setShowNameEditor] = useState(false);
  const [showAnnouncementEditor, setShowAnnouncementEditor] = useState(false);
  const [nameDraft, setNameDraft] = useState(conv.groupName ?? '');
  const [announcementDraft, setAnnouncementDraft] = useState(conv.groupAnnouncement ?? '');
  const groupAvatarRef = useRef<HTMLInputElement>(null);
  const bgRef = useRef<HTMLInputElement>(null);

  const memberIds = conv.groupMemberIds ?? [];

  const handleRemove = (id: string) => {
    try {
      removeMember(conv.id, id);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const handleGroupAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await onCompressImage(file);
      updateGroup(conv.id, { groupAvatar: url });
    } catch (err) { console.warn(err); }
  };

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const url = await onCompressImage(file);
      updateConvSettings(conv.id, { backgroundUrl: url });
    } catch (err) { console.warn(err); }
  };

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2.5 px-2"
        style={{ height: 56, backgroundColor: T.overlay, borderBottom: `0.5px solid ${T.separator}` }}>
        <motion.button style={{ width: 36, height: 36 }} onClick={closeChatSettings} whileTap={{ scale: 0.85 }}>
          <ChevronLeft size={22} strokeWidth={2.2} color={T.accent} />
        </motion.button>
        <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>群聊设置</span>
      </div>

      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-8">
        {/* ── 成员区 ── */}
        <section className="mb-4 rounded-2xl p-4" style={{ backgroundColor: T.card, boxShadow: T.shadow2 }}>
          <div className="mb-3 flex items-center justify-between">
            <span style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary }}>
              群成员（{memberIds.length}）
            </span>
            {deleteMode && (
              <button onClick={() => setDeleteMode(false)} style={{ fontSize: 13, color: T.accent }}>完成</button>
            )}
          </div>
          <div className="grid grid-cols-5 gap-3">
            {memberIds.map((id) => {
              const ch = characters.find((c) => c.id === id);
              return (
                <motion.button
                  key={id}
                  className="relative flex flex-col items-center"
                  onClick={() => deleteMode && handleRemove(id)}
                  whileTap={{ scale: 0.92 }}
                >
                  <Avatar src={ch?.avatar?.trim() || CHAR_FALLBACK_AVATAR} size={44} ringIndex={0} />
                  {deleteMode && (
                    <div className="absolute -top-1 -left-1 flex items-center justify-center rounded-full"
                      style={{ width: 18, height: 18, backgroundColor: '#FF3B30' }}>
                      <Minus size={12} strokeWidth={3} color="#fff" />
                    </div>
                  )}
                  <span className="mt-1 w-full truncate text-center" style={{ fontSize: 10, color: T.textSecondary }}>
                    {ch?.name ?? '未知'}
                  </span>
                </motion.button>
              );
            })}
            {!deleteMode && (
              <>
                <motion.button className="flex flex-col items-center" onClick={() => onOpenPicker('add')} whileTap={{ scale: 0.92 }}>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 44, height: 44, border: `1px dashed ${T.border}` }}>
                    <Plus size={18} color={T.textMuted} />
                  </div>
                  <span className="mt-1" style={{ fontSize: 10, color: T.textSecondary }}>添加</span>
                </motion.button>
                {memberIds.length > 2 && (
                  <motion.button className="flex flex-col items-center" onClick={() => setDeleteMode(true)} whileTap={{ scale: 0.92 }}>
                    <div className="flex items-center justify-center rounded-full"
                      style={{ width: 44, height: 44, border: `1px dashed ${T.border}` }}>
                      <Minus size={18} color={T.textMuted} />
                    </div>
                    <span className="mt-1" style={{ fontSize: 10, color: T.textSecondary }}>移除</span>
                  </motion.button>
                )}
              </>
            )}
          </div>
        </section>

        {/* ── 群信息 rows ── */}
        <section className="mb-4 rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, boxShadow: T.shadow2 }}>
          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => groupAvatarRef.current?.click()}>
            <span style={{ fontSize: 15, color: T.textPrimary }}>群头像</span>
            <div className="flex items-center gap-2">
              {conv.groupAvatar ? (
                <img src={conv.groupAvatar} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'cover' }} />
              ) : (
                <ImageIcon size={18} color={T.textMuted} />
              )}
              <ChevronRight size={16} color={T.textMuted} />
            </div>
          </button>
          <input ref={groupAvatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleGroupAvatarUpload} />
          <div style={{ height: 0.5, backgroundColor: T.separator, marginLeft: 16 }} />

          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => setShowNameEditor(true)}>
            <span style={{ fontSize: 15, color: T.textPrimary }}>群聊名称</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, color: T.textMuted, maxWidth: 160 }} className="truncate">
                {conv.groupName ?? '未命名'}
              </span>
              <ChevronRight size={16} color={T.textMuted} />
            </div>
          </button>
          <div style={{ height: 0.5, backgroundColor: T.separator, marginLeft: 16 }} />

          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => setShowAnnouncementEditor(true)}>
            <span style={{ fontSize: 15, color: T.textPrimary }}>群公告</span>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 13, color: T.textMuted, maxWidth: 160 }} className="truncate">
                {conv.groupAnnouncement || '未设置'}
              </span>
              <ChevronRight size={16} color={T.textMuted} />
            </div>
          </button>
        </section>

        {/* ── 聊天 rows ── */}
        <section className="mb-4 rounded-2xl overflow-hidden" style={{ backgroundColor: T.card, boxShadow: T.shadow2 }}>
          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => openChatSearch(conv.id)}>
            <div className="flex items-center gap-2.5">
              <Search size={18} color={T.textMuted} />
              <span style={{ fontSize: 15, color: T.textPrimary }}>查找聊天记录</span>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </button>
          <div style={{ height: 0.5, backgroundColor: T.separator, marginLeft: 16 }} />

          <button className="flex w-full items-center justify-between px-4 py-3" onClick={() => bgRef.current?.click()}>
            <div className="flex items-center gap-2.5">
              <ImageIcon size={18} color={T.textMuted} />
              <span style={{ fontSize: 15, color: T.textPrimary }}>设置当前聊天背景</span>
            </div>
            <ChevronRight size={16} color={T.textMuted} />
          </button>
          <input ref={bgRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgUpload} />
        </section>

        {/* ── 危险操作 ── */}
        <button
          className="flex w-full items-center justify-center rounded-2xl py-3"
          style={{ backgroundColor: T.card, color: '#FF3B30', fontSize: 15, fontWeight: 600, boxShadow: T.shadow2 }}
          onClick={() => {
            if (confirm('确认删除并退出这个群聊？')) {
              deleteConv(conv.id);
              closeChatSettings();
            }
          }}
        >
          删除并退出
        </button>
      </div>

      {/* 群名编辑浮层 */}
      <AnimatePresence>
        {showNameEditor && (
          <motion.div
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setShowNameEditor(false)}
          >
            <motion.div
              className="rounded-2xl bg-white p-5"
              style={{ width: 280, backgroundColor: T.card }}
              initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              transition={springs.gentle}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12, color: T.textPrimary }}>修改群名</div>
              <input
                className="w-full bg-transparent outline-none"
                style={{ fontSize: 14, color: T.textPrimary, padding: '8px 10px', borderRadius: 8, border: `1px solid ${T.border}` }}
                value={nameDraft} onChange={(e) => setNameDraft(e.target.value)}
                maxLength={30} autoFocus
              />
              <div className="mt-4 flex gap-2">
                <button onClick={() => setShowNameEditor(false)} className="flex-1 rounded-lg py-2"
                  style={{ backgroundColor: T.bg, fontSize: 14, color: T.textSecondary }}>取消</button>
                <button onClick={() => {
                  updateGroup(conv.id, { groupName: nameDraft.trim() || conv.groupName });
                  setShowNameEditor(false);
                }} className="flex-1 rounded-lg py-2"
                  style={{ background: T.accentGrad, color: '#fff', fontSize: 14, fontWeight: 600 }}>保存</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 群公告编辑浮层 */}
      <AnimatePresence>
        {showAnnouncementEditor && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col"
            style={{ backgroundColor: T.bg }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={springs.gentle}
          >
            <div className="flex shrink-0 items-center justify-between px-4" style={{ height: 52, borderBottom: `0.5px solid ${T.separator}` }}>
              <button onClick={() => setShowAnnouncementEditor(false)} style={{ fontSize: 14, color: T.textSecondary }}>取消</button>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.textPrimary }}>群公告</span>
              <button onClick={() => {
                updateGroup(conv.id, { groupAnnouncement: announcementDraft });
                setShowAnnouncementEditor(false);
              }} style={{ fontSize: 14, fontWeight: 600, color: T.accent }}>保存</button>
            </div>
            <textarea
              className="min-h-0 flex-1 resize-none bg-transparent p-4 outline-none"
              style={{ fontSize: 15, lineHeight: 1.5, color: T.textPrimary }}
              value={announcementDraft} onChange={(e) => setAnnouncementDraft(e.target.value)}
              placeholder="输入群公告..." autoFocus maxLength={500}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/apps/XingYu/components/GroupSettings.tsx
git commit -m "feat(xingyu): add GroupSettings component (QQ-style members + info + leave)"
```

---

## Task 10: `ChatSettings.tsx` 顶层分叉 + 建群抽屉重写

**Files:**
- Modify: `src/apps/XingYu/pages/ChatSettings.tsx`

- [ ] **Step 1: Bug 修复 + 顶层分叉**

`ChatSettings.tsx` 大改，给出完整替换版本（保持原有 1:1 section 0/1/2 逻辑，把 section 3 `GroupPicker` 单步化，加顶部群分叉）。为避免巨大 diff，分两步：

**先改 bug + 分叉**。找到这些行做精确替换：

第 20 行：
```ts
const createGroup = useXYData((s) => s.createGroupConversation);
```
改为：
```ts
const createGroupConversation = useXYData((s) => s.createGroupConversation);
```

在 `if (!conv) return null;` 之后插入分叉：

```tsx
// Group conversations get a completely different settings page.
if (conv.groupMemberIds && conv.groupMemberIds.length > 0) {
  return (
    <GroupSettings
      conv={conv}
      onOpenPicker={() => setShowGroupPicker(true)}
      onCompressImage={compressBgImage}
    />
  );
}
```

顶部新增 import：
```ts
import { GroupSettings } from '../components/GroupSettings';
```

找到 `onCreate` 回调里的 `const convId = createGroup(name, memberIds);`（第 260 行）改为：

```ts
onCreate={(memberIds) => {
  const convId = createGroupConversation(memberIds);
  setShowGroupPicker(false);
  openChat(convId);
}}
```

- [ ] **Step 2: 重写 `GroupPicker` 函数签名 + UX**

找到 `function GroupPicker({ onClose, onCreate }: ...)`（~第 302 行）整个函数体替换：

```tsx
function GroupPicker({
  onClose,
  onCreate,
  preselectCharacterId,
}: {
  onClose: () => void;
  onCreate: (memberIds: string[]) => void;
  preselectCharacterId?: string;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(preselectCharacterId ? [preselectCharacterId] : []),
  );
  const [query, setQuery] = useState('');
  const characters = useCharacterStore((s) => s.characters);

  const contacts = useMemo(() => {
    return characters
      .map((c) => ({
        id: c.id,
        name: c.name,
        avatar: c.avatar?.trim() || CHAR_FALLBACK_AVATAR,
      }))
      .filter((c) => !query.trim() || c.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [characters, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedArr = Array.from(selected);
  const canCreate = selected.size >= 2;

  const handleCreate = () => {
    if (!canCreate) return;
    onCreate(selectedArr);
  };

  return (
    <motion.div className="absolute inset-0 z-50 flex flex-col">
      <div className="absolute inset-0" onClick={onClose} />
      <motion.div
        className="mt-auto flex flex-col"
        style={{
          backgroundColor: T.bg,
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
          maxHeight: '85%',
        }}
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      >
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full" style={{ backgroundColor: T.separator }} />
        </div>
        <div className="flex items-center justify-between px-5 pb-3">
          <span style={{ fontSize: 16, fontWeight: 700, color: T.textPrimary }}>选择成员</span>
          <motion.button onClick={onClose} whileTap={{ scale: 0.9 }} style={{ width: 28, height: 28 }}>
            <X size={18} strokeWidth={2} color={T.textMuted} />
          </motion.button>
        </div>

        {/* 已选横滑条 */}
        {selectedArr.length > 0 && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto px-5 pb-2">
            {selectedArr.map((id) => {
              const c = characters.find((ch) => ch.id === id);
              return (
                <div key={id} className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}` }}>
                  <Avatar src={c?.avatar?.trim() || CHAR_FALLBACK_AVATAR} size={22} ringIndex={0} />
                  <span style={{ fontSize: 12, color: T.textPrimary }}>{c?.name ?? '?'}</span>
                  <button onClick={() => toggle(id)}><X size={12} color={T.textMuted} /></button>
                </div>
              );
            })}
          </div>
        )}

        {/* 搜索框 */}
        <div className="px-5 pb-2">
          <div className="flex items-center gap-2 rounded-lg px-3"
            style={{ backgroundColor: T.card, height: 36, border: `1px solid ${T.border}` }}>
            <Search size={14} color={T.textMuted} />
            <input
              className="min-w-0 flex-1 bg-transparent outline-none"
              style={{ fontSize: 13, color: T.textPrimary }}
              placeholder="搜索联系人"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 联系人列表 */}
        <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-5">
          {contacts.map((c) => {
            const isSelected = selected.has(c.id);
            return (
              <motion.button
                key={c.id}
                className="flex w-full items-center gap-3"
                style={{ padding: '10px 0', borderBottom: `0.5px solid ${T.separator}` }}
                onClick={() => toggle(c.id)}
                whileTap={{ scale: 0.97 }}
              >
                <Avatar src={c.avatar} size={40} ringIndex={0} />
                <span className="flex-1 text-left" style={{ fontSize: 15, fontWeight: 500, color: T.textPrimary }}>
                  {c.name}
                </span>
                <div className="flex items-center justify-center rounded-full"
                  style={{
                    width: 22, height: 22,
                    backgroundColor: isSelected ? T.accent : 'transparent',
                    border: isSelected ? 'none' : `1.5px solid ${T.border}`,
                  }}>
                  {isSelected && <Check size={14} strokeWidth={3} color="#fff" />}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* 底部 CTA */}
        <div className="px-5 pt-3 pb-6">
          <motion.button
            className="flex w-full items-center justify-center"
            style={{
              height: 44, borderRadius: T.r.md,
              background: canCreate ? T.accentGrad : T.border,
              color: canCreate ? '#fff' : T.textMuted,
              fontSize: 15, fontWeight: 600,
            }}
            onClick={handleCreate}
            whileTap={canCreate ? { scale: 0.97 } : undefined}
          >
            完成（{selected.size}）
          </motion.button>
          {selected.size < 2 && (
            <p className="mt-2 text-center" style={{ fontSize: 11, color: T.textMuted }}>
              至少选择 2 位成员
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
```

- [ ] **Step 3: 调用点传 `preselectCharacterId`**

把 `<GroupPicker ... />` 的 JSX 改成传入当前会话角色作为预选：

```tsx
<GroupPicker
  preselectCharacterId={conv.characterId}
  onClose={() => setShowGroupPicker(false)}
  onCreate={(memberIds) => {
    const convId = createGroupConversation(memberIds);
    setShowGroupPicker(false);
    openChat(convId);
  }}
/>
```

- [ ] **Step 4: typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: 0 errors / build 成功

- [ ] **Step 5: 手动验证（dev server）**

- Run: `pnpm dev`
- 打开星语，进任意 1:1 聊天 → 聊天设置 → 发起群聊
- 验证：
  - 抽屉打开时当前角色**已勾选**
  - 底部 CTA 显示"完成（1）"且灰掉
  - 点另一个联系人 → CTA 亮起显示"完成（2）"
  - 点完成 → 跳进新群（名字自动为"角色A、角色B"）不再报 `createGroup is not a function`

- [ ] **Step 6: Commit**

```bash
git add src/apps/XingYu/pages/ChatSettings.tsx
git commit -m "fix(xingyu): createGroup crash + rewrite GroupPicker (single-step + preselect + search)"
```

---

## Task 11: 从 ChatSettings 进入群 → 渲染 GroupSettings 流程验证

**Files:**
- Modify（如需）: `src/apps/XingYu/pages/ChatSettings.tsx`

- [ ] **Step 1: 手动验证**

dev 里创建一个群 → 点群聊顶栏进聊天设置 → 应看到 `GroupSettings` 的 QQ 风格版本（成员网格 + 群信息 rows + 删除退出按钮）。

- 点成员网格的"+"：弹出建群抽屉，**不预选**当前成员；可搜索、多选；点"完成"调 `addGroupMembers` 追加。
- 这里要在 `ChatSettings.tsx` 里给 `GroupSettings` 的 `onOpenPicker` 传 mode 信息，抽屉通过 `preselectCharacterId={undefined}` 追加模式。

**Adjust onCreate based on mode**: 当 `GroupSettings` 触发 picker 时应调用 `addGroupMembers`，不是 `createGroupConversation`。在 `ChatSettings.tsx` 增加状态：

```tsx
const [pickerMode, setPickerMode] = useState<'create' | 'add' | null>(null);
const addGroupMembers = useXYData((s) => s.addGroupMembers);
// ...替换原来的 showGroupPicker boolean state:
// setShowGroupPicker(true) → setPickerMode('create')
// setShowGroupPicker(false) → setPickerMode(null)
```

`GroupSettings` 的 `onOpenPicker` callback 改为 `() => setPickerMode('add')`。

`<GroupPicker />` 的 `onCreate` 分支：

```tsx
<GroupPicker
  preselectCharacterId={pickerMode === 'create' ? conv.characterId : undefined}
  onClose={() => setPickerMode(null)}
  onCreate={(memberIds) => {
    if (pickerMode === 'add') {
      addGroupMembers(conv.id, memberIds);
    } else {
      const convId = createGroupConversation(memberIds);
      openChat(convId);
    }
    setPickerMode(null);
  }}
/>
```

`AnimatePresence` 的条件改为 `{pickerMode && (...)}`。

- [ ] **Step 2: 跑现有测试确保没破**

Run: `pnpm test`
Expected: ALL GREEN

- [ ] **Step 3: Commit**

```bash
git add src/apps/XingYu/pages/ChatSettings.tsx
git commit -m "feat(xingyu): GroupSettings wires picker in 'add' mode to addGroupMembers"
```

---

## Task 12: rehydration migration — 已有 `char-` 前缀的群数据

**Files:**
- Modify: `src/apps/XingYu/xingYuDataStore.ts:1133-1164` (onRehydrateStorage)

- [ ] **Step 1: 加 strip 迁移**

在 `onRehydrateStorage` 回调里（rehydrate 完 moments/messages 之后、sync 启动之前）加：

```ts
// Migration: groupMemberIds 早期版本可能带 char- 前缀；对齐成裸 id
const currentState = useXYData.getState();
const needsMigration = currentState.conversations.some(
  (c) => c.groupMemberIds?.some((id) => id.startsWith('char-')),
);
if (needsMigration) {
  useXYData.setState({
    conversations: currentState.conversations.map((c) =>
      c.groupMemberIds
        ? {
            ...c,
            groupMemberIds: c.groupMemberIds.map((id) =>
              id.startsWith('char-') ? id.slice('char-'.length) : id,
            ),
          }
        : c,
    ),
  });
}
```

- [ ] **Step 2: typecheck**

Run: `pnpm typecheck`
Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add src/apps/XingYu/xingYuDataStore.ts
git commit -m "feat(xingyu): migrate legacy groupMemberIds to bare characterId on rehydrate"
```

---

## Task 13: 最终集成验证

**Files:** (none — verification only)

- [ ] **Step 1: 全量测试**

Run: `pnpm test`
Expected: ALL GREEN

- [ ] **Step 2: 构建**

Run: `pnpm build`
Expected: 成功，无 tsc 错误

- [ ] **Step 3: Dev smoke**

Run: `pnpm dev`，端到端跑完：
1. 1:1 聊天 → 聊天设置 → 发起群聊（抽屉带当前角色预选）→ 搜索过滤 → 加至少一个再点完成 → 跳进新群
2. 新群 → 点顶栏进群聊设置（QQ 风格）→ 改群名 / 改头像 / 写群公告 / 改背景
3. 成员网格点 "+"（追加抽屉不预选）/ "-"（进入删除模式 → 点成员带红⊖）
4. 返回聊天 → 输入一句"在吗" → 输入框上方出现成员头像条 → 点某头像 → 该角色开始流式回复 → 生成中整条头像条半透明锁定 → 回完解锁
5. 同一群里 B 再说话 → B 的上下文里能看到 A 的发言（靠 fan-out，不直接验证但行为正常即通过）
6. 群少于 2 人时触发移除成员 → 看到 alert "至少需保留 2 名成员"
7. 删除并退出 → 群从列表消失

- [ ] **Step 4: Commit（仅当前面有漏改补丁）**

如果 smoke 出问题补完再 commit。OK 则收工。

---

## 自查清单

- [x] Spec §1（数据模型）→ Task 1
- [x] Spec §2（建群抽屉）→ Task 10（GroupPicker 重写）
- [x] Spec §3（群设置页）→ Task 9 + Task 10（ChatSettings 分叉）+ Task 11（picker add 模式）
- [x] Spec §4.1（头像条 UI）→ Task 7
- [x] Spec §4.2（严格串行状态机）→ Task 6 + Task 7（strip 锁 UI）+ Task 8（消费锁）
- [x] Spec §4.3（回复触发）→ Task 6（`triggerGroupReply` + `characterIdOverride`）
- [x] Spec §4.4（AI 上下文 fan-out）→ Task 4
- [x] Spec §4.5（系统提示词增强）→ Task 5（SDK 通道）+ Task 6（XingYu 调用点拼 suffix）
- [x] Spec "已知风险" §1 数据迁移 → Task 12
