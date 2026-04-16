# 可爱信消息长按操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add long-press message actions (copy, favorite, quote, forward, multi-select, delete) to XingYu chat with WeChat-style UX.

**Architecture:** Refactor Message type to discriminated union first (Task 1), then build features bottom-up: data layer (favorites/delete/forward in store), then UI components (action bar → quote → multi-select → forward card → pages). ChatDetail.tsx is 1100+ lines so new components are extracted into `components/` and `pages/`.

**Tech Stack:** React 18, Zustand, Motion (framer-motion), lucide-react, TypeScript discriminated unions.

**Spec:** `docs/superpowers/specs/2026-04-16-xingyu-message-actions-design.md`

---

## File Map

**Create:**
- `src/apps/XingYu/components/MessageActionBar.tsx` — long-press popup toolbar
- `src/apps/XingYu/components/QuotePreview.tsx` — input area quote preview bar
- `src/apps/XingYu/components/QuoteBlock.tsx` — in-bubble quote block
- `src/apps/XingYu/components/MultiSelectToolbar.tsx` — bottom toolbar in multi-select mode
- `src/apps/XingYu/components/ForwardCardBubble.tsx` — forward card bubble renderer
- `src/apps/XingYu/pages/ForwardDetail.tsx` — full-screen forward card viewer
- `src/apps/XingYu/pages/ContactSelect.tsx` — full-screen contact picker for forwarding
- `src/apps/XingYu/__tests__/messageActions.test.ts` — store method tests

**Modify:**
- `src/apps/XingYu/data.ts` — Message type → discriminated union, add QuoteRef, ForwardedMsg, Favorite types
- `src/apps/XingYu/xingYuDataStore.ts` — add favorites[], deleteMessages, forwardMessage, forwardMessages, forwardAsCard, addFavorite, addFavorites, removeFavorite; update createUserMsg and sendMessage to support quoteRef
- `src/apps/XingYu/xingYuNavStore.ts` — add 'forward-detail' | 'contact-select' pages, forwardCardMessages, pendingForward state
- `src/apps/XingYu/pages/ChatDetail.tsx` — integrate long-press, quote, multi-select state; wire up new components
- `src/apps/XingYu/XingYuApp.tsx` — register ForwardDetail and ContactSelect pages

---

### Task 1: Refactor Message type to discriminated union

**Files:**
- Modify: `src/apps/XingYu/data.ts:18-45`
- Modify: `src/apps/XingYu/xingYuDataStore.ts` (all Message construction/access sites)
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx` (MsgBubble type narrowing)

- [ ] **Step 1: Rewrite Message types in data.ts**

Replace the current flat `Message` interface and `MsgType` with discriminated union types:

```typescript
// Remove: export type MsgType = 'text' | 'image' | 'sticker' | 'voice' | 'heartbeat_log';
// Remove: export interface Message { ... }

// Add:

export interface QuoteRef {
  msgId: string;
  senderId: string;
  preview: string;
  type: 'text' | 'image' | 'sticker' | 'note' | 'song';
}

export interface ForwardedMsg {
  senderId: string;
  senderName: string;
  type: 'text' | 'image' | 'sticker';
  text?: string;
  imageUrl?: string;
  stickerUrl?: string;
  timestamp: number;
}

interface MessageBase {
  id: string;
  convId: string;
  senderId: string;
  timestamp: number;
  streaming?: boolean;
  proactive?: boolean;
  quoteRef?: QuoteRef;
}

export interface TextMessage extends MessageBase {
  type: 'text';
  text: string;
  noteRef?: { noteId: string; title: string; body: string };
  songRef?: { songId: string; title: string; artist: string; artworkUrl: string };
}

export interface ImageMessage extends MessageBase {
  type: 'image';
  imageUrl: string;
}

export interface StickerMessage extends MessageBase {
  type: 'sticker';
  stickerUrl: string;
  stickerDesc?: string;
}

export interface ForwardCardMessage extends MessageBase {
  type: 'forward_card';
  forwardCard: {
    title: string;
    messages: ForwardedMsg[];
    preview: string[];
  };
}

export interface HeartbeatLogMessage extends MessageBase {
  type: 'heartbeat_log';
  text: string;
}

export type Message = TextMessage | ImageMessage | StickerMessage
  | ForwardCardMessage | HeartbeatLogMessage;

export type MsgType = Message['type'];
```

Also add the Favorite interface:

```typescript
export interface Favorite {
  id: string;
  messageId: string;
  convId: string;
  senderId: string;
  senderName: string;
  type: Message['type'];
  content: {
    text?: string;
    imageUrl?: string;
    stickerUrl?: string;
    noteRef?: TextMessage['noteRef'];
    songRef?: TextMessage['songRef'];
    forwardCard?: ForwardCardMessage['forwardCard'];
  };
  timestamp: number;
  favoritedAt: number;
}
```

- [ ] **Step 2: Fix createUserMsg in xingYuDataStore.ts**

The current `createUserMsg` function creates a flat Message. Update it to work with the union:

```typescript
// Old:
function createUserMsg(
  convId: string,
  type: Message['type'],
  extra: Partial<Message>,
): Message {
  return { id: uid(), convId, senderId: 'me', type, timestamp: Date.now(), ...extra };
}

// New — remove this function, replace call sites with inline construction.
// Each sendMessage/sendImageMessage/sendStickerMessage already knows its type,
// so construct the specific variant directly. For example in sendMessage:
//   const msg: TextMessage = { id: uid(), convId, senderId: 'me', type: 'text', text, timestamp: Date.now() };
```

Update each caller of `createUserMsg`:
- `sendMessage` → construct `TextMessage` directly
- `sendNoteMessage` → construct `TextMessage` with `noteRef`
- `sendSongMessage` → construct `TextMessage` with `songRef`
- `sendImageMessage` → construct `ImageMessage` directly
- `sendStickerMessage` → construct `StickerMessage` directly

- [ ] **Step 3: Fix all Message field access sites**

The discriminated union means `msg.text` is only valid after narrowing to `TextMessage | HeartbeatLogMessage`. Key spots to fix:

In `xingYuDataStore.ts`:
- `collectCharacterHistory` (line ~60): access `m.text`, `m.imageUrl`, `m.stickerDesc` — guard with type checks
- `triggerCompression` (line ~254): `m.text || ...` — guard with `m.type === 'text' ? m.text : ...`
- `scheduleAICharacterReply` (line ~468-513): Message construction already uses correct types
- The `lastMsgTextLen` in ChatDetail reads `msg.text` — guard with type check

In `ChatDetail.tsx` `MsgBubble` (line ~770):
- The `hasContent` check already uses `msg.type === 'text' && !!msg.text` etc. — these naturally narrow. Just verify the type guard logic handles the new `forward_card` type (add it to `hasContent`).
- Add rendering branch for `msg.type === 'forward_card'` (will be done in Task 7).

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors.

- [ ] **Step 5: Commit**

```bash
git add src/apps/XingYu/data.ts src/apps/XingYu/xingYuDataStore.ts src/apps/XingYu/pages/ChatDetail.tsx
git commit -m "refactor(XingYu): convert Message to discriminated union type"
```

---

### Task 2: Add store methods — favorites, deleteMessages, forward

**Files:**
- Modify: `src/apps/XingYu/xingYuDataStore.ts:94-154` (interface), `563+` (implementation)
- Create: `src/apps/XingYu/__tests__/messageActions.test.ts`

- [ ] **Step 1: Write tests for the new store methods**

Create `src/apps/XingYu/__tests__/messageActions.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { useXYData } from '../xingYuDataStore';
import type { TextMessage, ImageMessage, Favorite } from '../data';

// Reset store between tests
beforeEach(() => {
  useXYData.setState({
    messages: [],
    conversations: [],
    favorites: [],
  });
});

describe('deleteMessages', () => {
  it('removes specified messages by id', () => {
    const msg1: TextMessage = { id: 'm1', convId: 'c1', senderId: 'me', type: 'text', text: 'hello', timestamp: 1 };
    const msg2: TextMessage = { id: 'm2', convId: 'c1', senderId: 'me', type: 'text', text: 'world', timestamp: 2 };
    const msg3: TextMessage = { id: 'm3', convId: 'c1', senderId: 'other', type: 'text', text: 'hi', timestamp: 3 };
    useXYData.setState({ messages: [msg1, msg2, msg3] });

    useXYData.getState().deleteMessages(['m1', 'm3']);

    expect(useXYData.getState().messages).toHaveLength(1);
    expect(useXYData.getState().messages[0]!.id).toBe('m2');
  });
});

describe('addFavorite', () => {
  it('adds a text message to favorites', () => {
    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'idol1', type: 'text', text: 'hello', timestamp: 1000 };
    useXYData.getState().addFavorite(msg, 'Test User');

    const favs = useXYData.getState().favorites;
    expect(favs).toHaveLength(1);
    expect(favs[0]!.messageId).toBe('m1');
    expect(favs[0]!.content.text).toBe('hello');
    expect(favs[0]!.senderName).toBe('Test User');
  });

  it('does not add duplicate favorites', () => {
    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'idol1', type: 'text', text: 'hello', timestamp: 1000 };
    useXYData.getState().addFavorite(msg, 'User');
    useXYData.getState().addFavorite(msg, 'User');

    expect(useXYData.getState().favorites).toHaveLength(1);
  });
});

describe('addFavorites', () => {
  it('batch adds multiple messages to favorites', () => {
    const msg1: TextMessage = { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'one', timestamp: 1 };
    const msg2: ImageMessage = { id: 'm2', convId: 'c1', senderId: 'b', type: 'image', imageUrl: 'url', timestamp: 2 };
    useXYData.getState().addFavorites([msg1, msg2], (id) => id === 'a' ? 'Alice' : 'Bob');

    expect(useXYData.getState().favorites).toHaveLength(2);
  });
});

describe('removeFavorite', () => {
  it('removes a favorite by id', () => {
    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'hi', timestamp: 1 };
    useXYData.getState().addFavorite(msg, 'A');
    const favId = useXYData.getState().favorites[0]!.id;
    useXYData.getState().removeFavorite(favId);

    expect(useXYData.getState().favorites).toHaveLength(0);
  });
});

describe('forwardMessage', () => {
  it('copies a text message to target conversation', () => {
    const conv = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });

    const msg: TextMessage = { id: 'm1', convId: 'c1', senderId: 'idol1', type: 'text', text: 'forwarded', timestamp: 1 };
    useXYData.getState().forwardMessage(msg, 'c2');

    const msgs = useXYData.getState().messages.filter((m) => m.convId === 'c2');
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.type).toBe('text');
    expect((msgs[0] as TextMessage).text).toBe('forwarded');
    expect(msgs[0]!.senderId).toBe('me');
  });
});

describe('forwardAsCard', () => {
  it('creates a forward_card message in target conversation', () => {
    const conv = { id: 'c2', idolId: 'idol2', lastMsg: '', lastTime: 0, unread: 0 };
    useXYData.setState({ conversations: [conv] });

    const msgs: TextMessage[] = [
      { id: 'm1', convId: 'c1', senderId: 'a', type: 'text', text: 'hello', timestamp: 1 },
      { id: 'm2', convId: 'c1', senderId: 'me', type: 'text', text: 'world', timestamp: 2 },
    ];
    useXYData.getState().forwardAsCard(msgs, 'c2', '我和 A 的聊天记录', (id) => id === 'a' ? 'A' : '我');

    const created = useXYData.getState().messages.filter((m) => m.convId === 'c2');
    expect(created).toHaveLength(1);
    expect(created[0]!.type).toBe('forward_card');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/apps/XingYu/__tests__/messageActions.test.ts`
Expected: FAIL — methods don't exist yet.

- [ ] **Step 3: Implement store methods**

In `xingYuDataStore.ts`, add to the `XingYuDataState` interface:

```typescript
favorites: Favorite[];
addFavorite: (msg: Message, senderName: string) => void;
addFavorites: (msgs: Message[], getSenderName: (senderId: string) => string) => void;
removeFavorite: (id: string) => void;
deleteMessages: (msgIds: string[]) => void;
forwardMessage: (msg: Message, targetConvId: string) => void;
forwardMessages: (msgs: Message[], targetConvId: string) => void;
forwardAsCard: (msgs: Message[], targetConvId: string, title: string, getSenderName: (senderId: string) => string) => void;
```

Add initial state `favorites: [],` in the create block.

Implement each method in the store body:

```typescript
deleteMessages: (msgIds) => {
  const idSet = new Set(msgIds);
  set((s) => ({
    messages: s.messages.filter((m) => !idSet.has(m.id)),
  }));
},

addFavorite: (msg, senderName) => {
  set((s) => {
    if (s.favorites.some((f) => f.messageId === msg.id)) return s;
    const fav: Favorite = {
      id: uid(),
      messageId: msg.id,
      convId: msg.convId,
      senderId: msg.senderId,
      senderName,
      type: msg.type,
      content: {
        text: msg.type === 'text' ? msg.text : msg.type === 'heartbeat_log' ? msg.text : undefined,
        imageUrl: msg.type === 'image' ? msg.imageUrl : undefined,
        stickerUrl: msg.type === 'sticker' ? msg.stickerUrl : undefined,
        noteRef: msg.type === 'text' ? msg.noteRef : undefined,
        songRef: msg.type === 'text' ? msg.songRef : undefined,
        forwardCard: msg.type === 'forward_card' ? msg.forwardCard : undefined,
      },
      timestamp: msg.timestamp,
      favoritedAt: Date.now(),
    };
    return { favorites: [...s.favorites, fav] };
  });
},

addFavorites: (msgs, getSenderName) => {
  set((s) => {
    const existingIds = new Set(s.favorites.map((f) => f.messageId));
    const newFavs = msgs
      .filter((m) => !existingIds.has(m.id))
      .map((msg): Favorite => ({
        id: uid(),
        messageId: msg.id,
        convId: msg.convId,
        senderId: msg.senderId,
        senderName: getSenderName(msg.senderId),
        type: msg.type,
        content: {
          text: msg.type === 'text' ? msg.text : msg.type === 'heartbeat_log' ? msg.text : undefined,
          imageUrl: msg.type === 'image' ? msg.imageUrl : undefined,
          stickerUrl: msg.type === 'sticker' ? msg.stickerUrl : undefined,
          noteRef: msg.type === 'text' ? msg.noteRef : undefined,
          songRef: msg.type === 'text' ? msg.songRef : undefined,
          forwardCard: msg.type === 'forward_card' ? msg.forwardCard : undefined,
        },
        timestamp: msg.timestamp,
        favoritedAt: Date.now(),
      }));
    return { favorites: [...s.favorites, ...newFavs] };
  });
},

removeFavorite: (id) => {
  set((s) => ({ favorites: s.favorites.filter((f) => f.id !== id) }));
},

forwardMessage: (msg, targetConvId) => {
  const now = Date.now();
  let newMsg: Message;
  let preview: string;
  switch (msg.type) {
    case 'text':
      newMsg = { id: uid(), convId: targetConvId, senderId: 'me', type: 'text', text: msg.text, timestamp: now, noteRef: msg.noteRef, songRef: msg.songRef };
      preview = msg.noteRef ? `[备忘录] ${msg.noteRef.title}` : msg.songRef ? `[音乐] ${msg.songRef.title}` : msg.text.slice(0, 60);
      break;
    case 'image':
      newMsg = { id: uid(), convId: targetConvId, senderId: 'me', type: 'image', imageUrl: msg.imageUrl, timestamp: now };
      preview = '[图片]';
      break;
    case 'sticker':
      newMsg = { id: uid(), convId: targetConvId, senderId: 'me', type: 'sticker', stickerUrl: msg.stickerUrl, stickerDesc: msg.stickerDesc, timestamp: now };
      preview = '[表情]';
      break;
    case 'forward_card':
      newMsg = { id: uid(), convId: targetConvId, senderId: 'me', type: 'forward_card', forwardCard: msg.forwardCard, timestamp: now };
      preview = '[聊天记录]';
      break;
    default:
      return;
  }
  set((s) => ({
    messages: [...s.messages, newMsg],
    conversations: s.conversations.map((c) =>
      c.id === targetConvId ? { ...c, lastMsg: preview, lastTime: now } : c,
    ),
  }));
},

forwardMessages: (msgs, targetConvId) => {
  const now = Date.now();
  const newMsgs: Message[] = msgs.map((msg, i) => {
    const ts = now + i;
    switch (msg.type) {
      case 'text':
        return { id: uid(), convId: targetConvId, senderId: 'me', type: 'text' as const, text: msg.text, timestamp: ts, noteRef: msg.noteRef, songRef: msg.songRef };
      case 'image':
        return { id: uid(), convId: targetConvId, senderId: 'me', type: 'image' as const, imageUrl: msg.imageUrl, timestamp: ts };
      case 'sticker':
        return { id: uid(), convId: targetConvId, senderId: 'me', type: 'sticker' as const, stickerUrl: msg.stickerUrl, stickerDesc: msg.stickerDesc, timestamp: ts };
      case 'forward_card':
        return { id: uid(), convId: targetConvId, senderId: 'me', type: 'forward_card' as const, forwardCard: msg.forwardCard, timestamp: ts };
      default:
        return { id: uid(), convId: targetConvId, senderId: 'me', type: 'text' as const, text: '[转发消息]', timestamp: ts };
    }
  });
  const lastPreview = `[转发] ${msgs.length}条消息`;
  set((s) => ({
    messages: [...s.messages, ...newMsgs],
    conversations: s.conversations.map((c) =>
      c.id === targetConvId ? { ...c, lastMsg: lastPreview, lastTime: now + msgs.length } : c,
    ),
  }));
},

forwardAsCard: (msgs, targetConvId, title, getSenderName) => {
  const now = Date.now();
  const forwarded: ForwardedMsg[] = msgs.map((m) => ({
    senderId: m.senderId,
    senderName: getSenderName(m.senderId),
    type: (m.type === 'forward_card' ? 'text' : m.type) as 'text' | 'image' | 'sticker',
    text: m.type === 'text' ? m.text : m.type === 'forward_card' ? '[聊天记录]' : undefined,
    imageUrl: m.type === 'image' ? m.imageUrl : undefined,
    stickerUrl: m.type === 'sticker' ? m.stickerUrl : undefined,
    timestamp: m.timestamp,
  }));
  const preview = forwarded.slice(0, 4).map((f) => {
    const name = f.senderName;
    const content = f.text || (f.imageUrl ? '[图片]' : '[表情]');
    return `${name}: ${content.slice(0, 20)}`;
  });
  const cardMsg: ForwardCardMessage = {
    id: uid(),
    convId: targetConvId,
    senderId: 'me',
    type: 'forward_card',
    forwardCard: { title, messages: forwarded, preview },
    timestamp: now,
  };
  set((s) => ({
    messages: [...s.messages, cardMsg],
    conversations: s.conversations.map((c) =>
      c.id === targetConvId ? { ...c, lastMsg: '[聊天记录]', lastTime: now } : c,
    ),
  }));
},
```

Import `Favorite`, `ForwardedMsg`, `ForwardCardMessage` from `./data` at the top of xingYuDataStore.ts.

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/apps/XingYu/__tests__/messageActions.test.ts`
Expected: All PASS.

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/apps/XingYu/__tests__/messageActions.test.ts src/apps/XingYu/xingYuDataStore.ts src/apps/XingYu/data.ts
git commit -m "feat(XingYu): add favorites, deleteMessages, forward store methods"
```

---

### Task 3: Update nav store for new pages

**Files:**
- Modify: `src/apps/XingYu/xingYuNavStore.ts`

- [ ] **Step 1: Add new state and methods to xingYuNavStore**

```typescript
import type { Message, ForwardedMsg } from './data';

interface XingYuNavState {
  // ... existing fields ...
  forwardCardMessages: ForwardedMsg[] | null;
  pendingForward: { msgs: Message[]; mode: 'single' | 'batch' | 'merge' } | null;

  // ... existing methods ...
  openForwardDetail: (messages: ForwardedMsg[]) => void;
  closeForwardDetail: () => void;
  openContactSelect: (msgs: Message[], mode: 'single' | 'batch' | 'merge') => void;
  closeContactSelect: () => void;
}
```

Add initial state values:
```typescript
forwardCardMessages: null,
pendingForward: null,
```

Add methods:
```typescript
openForwardDetail: (messages) => set({ page: 'forward-detail', forwardCardMessages: messages }),
closeForwardDetail: () => set({ page: 'chat-detail', forwardCardMessages: null }),
openContactSelect: (msgs, mode) => set({ page: 'contact-select', pendingForward: { msgs, mode } }),
closeContactSelect: () => set({ page: 'chat-detail', pendingForward: null }),
```

Update `reset` to include new fields:
```typescript
reset: () => set({ ..., forwardCardMessages: null, pendingForward: null }),
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/apps/XingYu/xingYuNavStore.ts
git commit -m "feat(XingYu): add forward-detail and contact-select nav state"
```

---

### Task 4: MessageActionBar component

**Files:**
- Create: `src/apps/XingYu/components/MessageActionBar.tsx`
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx` (integrate into MsgBubble)

- [ ] **Step 1: Create MessageActionBar component**

Create `src/apps/XingYu/components/MessageActionBar.tsx`:

```typescript
import { memo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Bookmark, Reply, Share, Grid2x2, Trash2 } from 'lucide-react';
import type { Message } from '../data';

type ActionType = 'copy' | 'favorite' | 'quote' | 'forward' | 'multiSelect' | 'delete';

interface ActionItem {
  type: ActionType;
  icon: typeof Copy;
  label: string;
}

function getActions(msg: Message): ActionItem[] {
  const actions: ActionItem[] = [];

  // Copy: only text and text-with-noteRef/songRef
  if (msg.type === 'text') {
    actions.push({ type: 'copy', icon: Copy, label: '复制' });
  }

  // Always: favorite, except heartbeat_log
  actions.push({ type: 'favorite', icon: Bookmark, label: '收藏' });

  // Quote: text, image, sticker, noteRef/songRef — NOT forward_card
  if (msg.type !== 'forward_card') {
    actions.push({ type: 'quote', icon: Reply, label: '引用' });
  }

  // Forward: all except heartbeat_log (already filtered out upstream)
  actions.push({ type: 'forward', icon: Share, label: '转发' });

  // Multi-select: always
  actions.push({ type: 'multiSelect', icon: Grid2x2, label: '多选' });

  // Delete: always
  actions.push({ type: 'delete', icon: Trash2, label: '删除' });

  return actions;
}

interface Props {
  msg: Message;
  position: 'above' | 'below';
  isMine: boolean;
  onAction: (type: ActionType, msg: Message) => void;
  onClose: () => void;
}

export const MessageActionBar = memo(function MessageActionBar({
  msg,
  position,
  isMine,
  onAction,
  onClose,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null);
  const actions = getActions(msg);

  // Close on outside click
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay registration to avoid the long-press pointerup from closing immediately
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handler);
    };
  }, [onClose]);

  return (
    <motion.div
      ref={barRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
      style={{
        display: 'flex',
        background: '#3A3A3C',
        borderRadius: 12,
        padding: '6px 2px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        [position === 'above' ? 'marginBottom' : 'marginTop']: 4,
        justifyContent: isMine ? 'flex-end' : 'flex-start',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
      }}
    >
      {actions.map((action) => (
        <button
          key={action.type}
          type="button"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '6px 10px',
            gap: 4,
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
          }}
          onClick={() => onAction(action.type, msg)}
        >
          <action.icon size={20} strokeWidth={1.8} color="#fff" />
          <span style={{ color: '#fff', fontSize: 10 }}>{action.label}</span>
        </button>
      ))}
    </motion.div>
  );
});

export type { ActionType };
```

- [ ] **Step 2: Integrate long-press into ChatDetail MsgBubble**

In `ChatDetail.tsx`, add these imports:

```typescript
import { useLongPress } from '@/platform/gesture/useLongPress';
import { MessageActionBar, type ActionType } from '../components/MessageActionBar';
import { useToastStore } from '@/system';
```

Add state to the `ChatDetail` function body (after existing useState calls):

```typescript
const [actionMenuMsg, setActionMenuMsg] = useState<Message | null>(null);
const [menuPosition, setMenuPosition] = useState<'above' | 'below'>('above');
```

Add handler:

```typescript
const handleMessageAction = useCallback((type: ActionType, msg: Message) => {
  setActionMenuMsg(null);
  switch (type) {
    case 'copy':
      if (msg.type === 'text') {
        navigator.clipboard.writeText(msg.noteRef ? msg.noteRef.title + '\n' + msg.noteRef.body : msg.text);
        useToastStore.getState().show('已复制');
      }
      break;
    case 'favorite':
      // Will be wired in Task 6
      useToastStore.getState().show('已收藏');
      break;
    case 'quote':
      // Will be wired in Task 5
      break;
    case 'forward':
      // Will be wired in Task 8
      break;
    case 'multiSelect':
      // Will be wired in Task 6
      break;
    case 'delete':
      // Will be wired in Task 6
      break;
  }
}, []);
```

Pass `actionMenuMsg`, `setActionMenuMsg`, `menuPosition`, `setMenuPosition`, and `handleMessageAction` to `MsgBubble` via props. In MsgBubble, use `useLongPress` to trigger the menu:

```typescript
const longPress = useLongPress((e) => {
  // Determine position: if bubble is in top half of viewport, show below; otherwise above
  const rect = (e.target as HTMLElement).closest('[data-msg-bubble]')?.getBoundingClientRect();
  const viewportMid = window.innerHeight / 2;
  onLongPress(msg, rect && rect.top < viewportMid ? 'below' : 'above');
});
```

Wrap the bubble content div with `longPress` handlers and render `MessageActionBar` with `AnimatePresence` when `actionMenuMsg?.id === msg.id`.

- [ ] **Step 3: Run type check and dev server visual verification**

Run: `npx tsc --noEmit`
Run: `pnpm dev` and test long-pressing a message in the browser.
Expected: Action bar appears above/below the message on long press.

- [ ] **Step 4: Commit**

```bash
git add src/apps/XingYu/components/MessageActionBar.tsx src/apps/XingYu/pages/ChatDetail.tsx
git commit -m "feat(XingYu): add long-press MessageActionBar"
```

---

### Task 5: Quote — QuotePreview + QuoteBlock + send logic

**Files:**
- Create: `src/apps/XingYu/components/QuotePreview.tsx`
- Create: `src/apps/XingYu/components/QuoteBlock.tsx`
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx` (quote state, render QuotePreview, pass quoteRef to sendMessage)
- Modify: `src/apps/XingYu/xingYuDataStore.ts` (sendMessage accepts optional quoteRef)

- [ ] **Step 1: Create QuotePreview component**

Create `src/apps/XingYu/components/QuotePreview.tsx`:

```typescript
import { memo } from 'react';
import { Reply, X } from 'lucide-react';
import type { Message } from '../data';
import { T } from '../theme';

function getPreviewText(msg: Message): string {
  switch (msg.type) {
    case 'text':
      if (msg.noteRef) return `[备忘录] ${msg.noteRef.title}`;
      if (msg.songRef) return `[音乐] ${msg.songRef.title}`;
      return msg.text.slice(0, 40);
    case 'image': return '[图片]';
    case 'sticker': return '[贴纸]';
    case 'forward_card': return '[聊天记录]';
    default: return '';
  }
}

interface Props {
  msg: Message;
  senderName: string;
  onClose: () => void;
}

export const QuotePreview = memo(function QuotePreview({ msg, senderName, onClose }: Props) {
  return (
    <div
      style={{
        background: T.card,
        borderRadius: 10,
        padding: '8px 12px',
        margin: '0 12px 4px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: T.shadow1,
      }}
    >
      <Reply size={14} strokeWidth={2.2} color={T.accent} style={{ flexShrink: 0 }} />
      <span
        style={{
          flex: 1,
          fontSize: 12,
          color: T.textSecondary,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {senderName}: {getPreviewText(msg)}
      </span>
      <button type="button" onClick={onClose} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        <X size={14} strokeWidth={2} color={T.textMuted} />
      </button>
    </div>
  );
});

export { getPreviewText };
```

- [ ] **Step 2: Create QuoteBlock component**

Create `src/apps/XingYu/components/QuoteBlock.tsx`:

```typescript
import { memo } from 'react';
import type { QuoteRef } from '../data';

interface Props {
  quoteRef: QuoteRef;
  isMine: boolean;
  senderName: string;
  onTap: (msgId: string) => void;
}

export const QuoteBlock = memo(function QuoteBlock({ quoteRef, isMine, senderName, onTap }: Props) {
  return (
    <button
      type="button"
      onClick={() => onTap(quoteRef.msgId)}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: isMine ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.06)',
        borderRadius: 8,
        padding: '6px 10px',
        marginBottom: 6,
        cursor: 'pointer',
        border: 'none',
      }}
    >
      <div style={{ fontSize: 11, color: isMine ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)', fontWeight: 500 }}>
        {senderName}
      </div>
      <div
        style={{
          fontSize: 12,
          color: isMine ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.5)',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
        }}
      >
        {quoteRef.preview}
      </div>
    </button>
  );
});
```

- [ ] **Step 3: Update sendMessage to accept quoteRef**

In `xingYuDataStore.ts`, update the `sendMessage` signature and implementation:

```typescript
// Interface:
sendMessage: (convId: string, text: string, quoteRef?: QuoteRef) => void;

// Implementation:
sendMessage: (convId, text, quoteRef) => {
  const msg: TextMessage = {
    id: uid(),
    convId,
    senderId: 'me',
    type: 'text',
    text,
    timestamp: Date.now(),
    ...(quoteRef ? { quoteRef } : {}),
  };
  set((s) => ({
    messages: [...s.messages, msg],
    conversations: s.conversations.map((c) =>
      c.id === convId ? { ...c, lastMsg: text, lastTime: Date.now(), unread: 0 } : c,
    ),
  }));
  scheduleIdolReply(convId, get);
},
```

Import `QuoteRef`, `TextMessage` from `./data`.

- [ ] **Step 4: Wire quote into ChatDetail**

In `ChatDetail.tsx`:
- Add `quoteMsg` state: `const [quoteMsg, setQuoteMsg] = useState<Message | null>(null);`
- In `handleMessageAction`, `case 'quote'`: set `setQuoteMsg(msg);`
- Render `QuotePreview` above the input area when `quoteMsg` is set
- Update `handleSend` to build `QuoteRef` from `quoteMsg` and pass to `sendMessage`:

```typescript
const handleSend = useCallback(() => {
  // ... existing dedup logic ...
  const text = liveValue.trim();
  if (!text || !activeChatId) return;

  let finalText = text;
  let ref: QuoteRef | undefined;
  if (quoteMsg) {
    const preview = getPreviewText(quoteMsg);
    ref = {
      msgId: quoteMsg.id,
      senderId: quoteMsg.senderId,
      preview,
      type: quoteMsg.type === 'text' && quoteMsg.noteRef ? 'note' : quoteMsg.type === 'text' && quoteMsg.songRef ? 'song' : quoteMsg.type as QuoteRef['type'],
    };
    // AI-visible format
    finalText = `[引用: ${preview}] ${text}`;
    setQuoteMsg(null);
  }

  sendMessage(activeChatId, finalText, ref);
  setInput('');
  setPickerMode('none');
  if (inputRef.current) inputRef.current.value = '';
}, [input, activeChatId, sendMessage, quoteMsg]);
```

- In MsgBubble, render `QuoteBlock` above the message text when `msg.quoteRef` exists. Use the scroll-to-message pattern (existing `scrollToMessageId` mechanism) to jump to the quoted message.

- [ ] **Step 5: Run type check and visual verification**

Run: `npx tsc --noEmit`
Run: `pnpm dev` — test quoting a message.

- [ ] **Step 6: Commit**

```bash
git add src/apps/XingYu/components/QuotePreview.tsx src/apps/XingYu/components/QuoteBlock.tsx src/apps/XingYu/pages/ChatDetail.tsx src/apps/XingYu/xingYuDataStore.ts
git commit -m "feat(XingYu): add quote (reply) with preview bar and in-bubble block"
```

---

### Task 6: Multi-select mode + favorite/delete wiring

**Files:**
- Create: `src/apps/XingYu/components/MultiSelectToolbar.tsx`
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx`

- [ ] **Step 1: Create MultiSelectToolbar component**

Create `src/apps/XingYu/components/MultiSelectToolbar.tsx`:

```typescript
import { memo } from 'react';
import { Share, LayoutGrid, Bookmark, Trash2 } from 'lucide-react';
import { T } from '../theme';

interface Props {
  selectedCount: number;
  onBatchForward: () => void;
  onMergeForward: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}

export const MultiSelectToolbar = memo(function MultiSelectToolbar({
  selectedCount,
  onBatchForward,
  onMergeForward,
  onFavorite,
  onDelete,
}: Props) {
  const disabled = selectedCount === 0;
  const items = [
    { icon: Share, label: '逐条转发', onClick: onBatchForward, danger: false },
    { icon: LayoutGrid, label: '合并转发', onClick: onMergeForward, danger: false },
    { icon: Bookmark, label: '收藏', onClick: onFavorite, danger: false },
    { icon: Trash2, label: '删除', onClick: onDelete, danger: true },
  ];

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.95)',
        borderTop: `0.5px solid ${T.separator}`,
        padding: '12px 16px',
        paddingBottom: 'max(12px, calc(var(--safe-bottom, 0px) + 12px))',
        display: 'flex',
        justifyContent: 'space-around',
      }}
    >
      {items.map((item) => (
        <button
          key={item.label}
          type="button"
          disabled={disabled}
          onClick={item.onClick}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            background: 'none',
            border: 'none',
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.35 : 1,
          }}
        >
          <item.icon
            size={22}
            strokeWidth={1.8}
            color={item.danger ? '#FF3B30' : T.accent}
          />
          <span style={{ fontSize: 11, color: item.danger ? '#FF3B30' : T.accent }}>
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
});
```

- [ ] **Step 2: Integrate multi-select into ChatDetail**

Add state:
```typescript
const [multiSelectMode, setMultiSelectMode] = useState(false);
const [selectedMsgIds, setSelectedMsgIds] = useState<Set<string>>(new Set());
```

In `handleMessageAction`:
- `case 'multiSelect'`: `setMultiSelectMode(true); setSelectedMsgIds(new Set([msg.id]));`
- `case 'favorite'`: call `addFavorite(msg, senderName)` and show toast
- `case 'delete'`: `if (confirm('确定删除这条消息？')) { deleteMessages([msg.id]); }`

Toggle selection handler:
```typescript
const toggleMsgSelection = useCallback((msgId: string) => {
  setSelectedMsgIds((prev) => {
    const next = new Set(prev);
    if (next.has(msgId)) next.delete(msgId);
    else next.add(msgId);
    return next;
  });
}, []);
```

Exit multi-select:
```typescript
const exitMultiSelect = useCallback(() => {
  setMultiSelectMode(false);
  setSelectedMsgIds(new Set());
}, []);
```

MultiSelectToolbar handlers:
```typescript
const handleMultiDelete = useCallback(() => {
  if (selectedMsgIds.size === 0) return;
  if (confirm(`确定删除 ${selectedMsgIds.size} 条消息？`)) {
    deleteMessages([...selectedMsgIds]);
    exitMultiSelect();
  }
}, [selectedMsgIds, deleteMessages, exitMultiSelect]);

const handleMultiFavorite = useCallback(() => {
  const msgs = allConvMessages.filter((m) => selectedMsgIds.has(m.id));
  addFavorites(msgs, getSenderName);
  useToastStore.getState().show(`已收藏 ${msgs.length} 条`);
  exitMultiSelect();
}, [selectedMsgIds, allConvMessages, addFavorites, exitMultiSelect]);
```

UI changes in JSX:
- Header: when `multiSelectMode`, show "已选择 N 条" title and "取消" button
- MsgBubble row: when `multiSelectMode`, prepend a checkbox circle (iOS-style: empty circle or blue circle with SVG checkmark)
- Bottom: when `multiSelectMode`, replace input area with `<MultiSelectToolbar />`

- [ ] **Step 3: Run type check and visual verification**

Run: `npx tsc --noEmit`
Run: `pnpm dev` — test multi-select: enter via long-press → multi-select, check/uncheck messages, batch favorite, batch delete.

- [ ] **Step 4: Commit**

```bash
git add src/apps/XingYu/components/MultiSelectToolbar.tsx src/apps/XingYu/pages/ChatDetail.tsx
git commit -m "feat(XingYu): add multi-select mode with batch favorite and delete"
```

---

### Task 7: ForwardCardBubble + ForwardDetail page

**Files:**
- Create: `src/apps/XingYu/components/ForwardCardBubble.tsx`
- Create: `src/apps/XingYu/pages/ForwardDetail.tsx`
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx` (MsgBubble renders forward_card)
- Modify: `src/apps/XingYu/XingYuApp.tsx` (register ForwardDetail page)

- [ ] **Step 1: Create ForwardCardBubble**

Create `src/apps/XingYu/components/ForwardCardBubble.tsx`:

```typescript
import { memo } from 'react';
import { MessageSquare } from 'lucide-react';
import type { ForwardCardMessage } from '../data';
import { T } from '../theme';

interface Props {
  msg: ForwardCardMessage;
  isMine: boolean;
  onTap: () => void;
}

export const ForwardCardBubble = memo(function ForwardCardBubble({ msg, isMine, onTap }: Props) {
  const { forwardCard } = msg;
  return (
    <button
      type="button"
      onClick={onTap}
      style={{
        borderRadius: 18,
        background: T.card,
        boxShadow: T.shadow1,
        border: `1px solid ${T.border}`,
        overflow: 'hidden',
        width: 230,
        textAlign: 'left',
        cursor: 'pointer',
        marginLeft: isMine ? 'auto' : undefined,
      }}
    >
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.textPrimary, marginBottom: 8 }}>
          {forwardCard.title}
        </div>
        {forwardCard.preview.map((line, i) => (
          <div
            key={i}
            style={{
              fontSize: 12,
              color: T.textSecondary,
              marginBottom: 3,
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {line}
          </div>
        ))}
      </div>
      <div
        style={{
          padding: '8px 14px',
          borderTop: `0.5px solid ${T.separator}`,
          fontSize: 11,
          color: T.textMuted,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <MessageSquare size={12} strokeWidth={2} color={T.textMuted} />
        聊天记录
      </div>
    </button>
  );
});
```

- [ ] **Step 2: Create ForwardDetail page**

Create `src/apps/XingYu/pages/ForwardDetail.tsx`:

```typescript
import { ChevronLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useXYNav } from '../xingYuNavStore';
import { T } from '../theme';
import type { ForwardedMsg } from '../data';
import { formatChatTime } from '../data';

export function ForwardDetail() {
  const messages = useXYNav((s) => s.forwardCardMessages);
  const close = useXYNav((s) => s.closeForwardDetail);

  if (!messages) return null;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: 'rgba(248,246,249,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <div className="flex items-center px-2" style={{ height: 44 }}>
          <motion.button
            className="flex items-center gap-1"
            onClick={close}
            whileTap={{ opacity: 0.5 }}
          >
            <ChevronLeft size={24} strokeWidth={2} color={T.accent} />
            <span style={{ fontSize: 16, color: T.accent }}>返回</span>
          </motion.button>
          <span className="flex-1 text-center" style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
            聊天记录
          </span>
          <div style={{ width: 60 }} />
        </div>
      </div>

      {/* Messages list */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-6">
        {messages.map((msg, i) => {
          const showTime = i === 0 || msg.timestamp - messages[i - 1]!.timestamp > 15 * 60_000;
          return (
            <div key={i} style={{ marginBottom: 12 }}>
              {showTime && (
                <div className="py-2 text-center">
                  <span style={{ fontSize: 11, color: T.textMuted }}>{formatChatTime(msg.timestamp)}</span>
                </div>
              )}
              <div style={{ marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: T.accent }}>{msg.senderName}</span>
              </div>
              <div style={{ fontSize: 15, color: T.textPrimary, lineHeight: 1.5 }}>
                {msg.text && msg.text}
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="" style={{ maxWidth: '60%', borderRadius: 12, marginTop: 4 }} />
                )}
                {msg.stickerUrl && (
                  <img src={msg.stickerUrl} alt="" style={{ width: 120, height: 120, objectFit: 'contain' }} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Register pages in XingYuApp.tsx**

Add imports:
```typescript
import { ForwardDetail } from './pages/ForwardDetail';
```

Add rendering in the page switch:
```typescript
{page === 'forward-detail' && <ForwardDetail />}
```

- [ ] **Step 4: Render ForwardCardBubble in MsgBubble**

In `ChatDetail.tsx` MsgBubble, add a branch for `msg.type === 'forward_card'`:

```typescript
import { ForwardCardBubble } from '../components/ForwardCardBubble';
```

In MsgBubble's `hasContent` check, add: `|| msg.type === 'forward_card'`.

In the rendering section (after the sticker/image/text branches), add:

```typescript
{msg.type === 'forward_card' && (
  <ForwardCardBubble
    msg={msg}
    isMine={isMine}
    onTap={() => {
      useXYNav.getState().openForwardDetail(msg.forwardCard.messages);
    }}
  />
)}
```

- [ ] **Step 5: Run type check and visual verification**

Run: `npx tsc --noEmit`
Run: `pnpm dev` — verify forward card renders correctly (will need to test after Task 8 creates actual forward cards).

- [ ] **Step 6: Commit**

```bash
git add src/apps/XingYu/components/ForwardCardBubble.tsx src/apps/XingYu/pages/ForwardDetail.tsx src/apps/XingYu/XingYuApp.tsx src/apps/XingYu/pages/ChatDetail.tsx
git commit -m "feat(XingYu): add forward card bubble and detail view page"
```

---

### Task 8: ContactSelect page + forward wiring

**Files:**
- Create: `src/apps/XingYu/pages/ContactSelect.tsx`
- Modify: `src/apps/XingYu/XingYuApp.tsx` (register page)
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx` (wire forward actions)

- [ ] **Step 1: Create ContactSelect page**

Create `src/apps/XingYu/pages/ContactSelect.tsx`:

```typescript
import { useState, useMemo } from 'react';
import { ChevronLeft, Search } from 'lucide-react';
import { motion } from 'motion/react';
import { useXYNav } from '../xingYuNavStore';
import { useXYData } from '../xingYuDataStore';
import { getIdol } from '../data';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Avatar } from '../components/Avatar';
import { T } from '../theme';
import { useToastStore } from '@/system';

export function ContactSelect() {
  const pendingForward = useXYNav((s) => s.pendingForward);
  const close = useXYNav((s) => s.closeContactSelect);
  const conversations = useXYData((s) => s.conversations);
  const forwardMessage = useXYData((s) => s.forwardMessage);
  const forwardMessages = useXYData((s) => s.forwardMessages);
  const forwardAsCard = useXYData((s) => s.forwardAsCard);
  const characters = useCharacterStore((s) => s.characters);
  const activeChatId = useXYNav((s) => s.activeChatId);
  const userSettings = useXYData((s) => s.userSettings);
  const [search, setSearch] = useState('');

  // Build list of conversations to forward to (exclude current)
  const targets = useMemo(() => {
    return conversations
      .filter((c) => c.id !== activeChatId && !c.aiChatParticipants)
      .map((c) => {
        let name = c.groupName || c.remarkName || '';
        let avatar = '';
        if (c.characterId) {
          const ch = characters.find((ch) => ch.id === c.characterId);
          name = name || ch?.name || '?';
          avatar = ch?.avatar?.trim() || '/resource/avatars/preset-01.jpg';
        } else {
          const idol = getIdol(c.idolId);
          name = name || idol?.name || '?';
          avatar = idol?.avatar || '';
        }
        return { convId: c.id, name, avatar };
      })
      .filter((t) => !search || t.name.includes(search));
  }, [conversations, activeChatId, characters, search]);

  const getSenderName = (senderId: string): string => {
    if (senderId === 'me') return userSettings.nickname || '我';
    const charId = senderId.replace(/^char-/, '');
    const ch = characters.find((c) => c.id === charId);
    if (ch) return ch.name;
    const idol = getIdol(senderId);
    return idol?.name || senderId;
  };

  const handleSelect = (targetConvId: string, targetName: string) => {
    if (!pendingForward) return;
    const { msgs, mode } = pendingForward;
    switch (mode) {
      case 'single':
        forwardMessage(msgs[0]!, targetConvId);
        useToastStore.getState().show(`已转发给 ${targetName}`);
        break;
      case 'batch':
        forwardMessages(msgs, targetConvId);
        useToastStore.getState().show(`已逐条转发 ${msgs.length} 条给 ${targetName}`);
        break;
      case 'merge': {
        const title = `聊天记录`;
        forwardAsCard(msgs, targetConvId, title, getSenderName);
        useToastStore.getState().show(`已合并转发给 ${targetName}`);
        break;
      }
    }
    close();
  };

  if (!pendingForward) return null;

  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: T.bg }}>
      {/* Header */}
      <div
        className="shrink-0"
        style={{
          backgroundColor: 'rgba(248,246,249,0.8)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: `0.5px solid ${T.separator}`,
        }}
      >
        <div className="flex items-center px-2" style={{ height: 44 }}>
          <motion.button
            className="flex items-center gap-1"
            onClick={close}
            whileTap={{ opacity: 0.5 }}
          >
            <ChevronLeft size={24} strokeWidth={2} color={T.accent} />
            <span style={{ fontSize: 16, color: T.accent }}>取消</span>
          </motion.button>
          <span className="flex-1 text-center" style={{ fontSize: 16, fontWeight: 600, color: T.textPrimary }}>
            选择联系人
          </span>
          <div style={{ width: 60 }} />
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '8px 16px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: T.card,
            borderRadius: T.r.sm,
            padding: '8px 12px',
            border: `1px solid ${T.border}`,
          }}
        >
          <Search size={16} color={T.textMuted} />
          <input
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 14, color: T.textPrimary }}
            placeholder="搜索联系人"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Contact list */}
      <div className="scrollbar-hide min-h-0 flex-1 overflow-y-auto">
        {targets.map((t) => (
          <motion.button
            key={t.convId}
            className="flex w-full items-center gap-3 px-4"
            style={{ height: 56, background: 'transparent', border: 'none', textAlign: 'left' }}
            onClick={() => handleSelect(t.convId, t.name)}
            whileTap={{ backgroundColor: T.cardHover }}
          >
            <Avatar src={t.avatar} size={40} ringIndex={0} />
            <span style={{ fontSize: 16, color: T.textPrimary }}>{t.name}</span>
          </motion.button>
        ))}
        {targets.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: T.textMuted, fontSize: 14 }}>
            没有可转发的联系人
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register ContactSelect in XingYuApp.tsx**

Add import and rendering:
```typescript
import { ContactSelect } from './pages/ContactSelect';

// In the page switch:
{page === 'contact-select' && <ContactSelect />}
```

- [ ] **Step 3: Wire forward actions in ChatDetail**

In `handleMessageAction`, `case 'forward'`:
```typescript
case 'forward':
  useXYNav.getState().openContactSelect([msg], 'single');
  break;
```

In multi-select toolbar handlers:
```typescript
const handleBatchForward = useCallback(() => {
  const msgs = allConvMessages.filter((m) => selectedMsgIds.has(m.id));
  useXYNav.getState().openContactSelect(msgs, 'batch');
  exitMultiSelect();
}, [selectedMsgIds, allConvMessages, exitMultiSelect]);

const handleMergeForward = useCallback(() => {
  const msgs = allConvMessages.filter((m) => selectedMsgIds.has(m.id));
  useXYNav.getState().openContactSelect(msgs, 'merge');
  exitMultiSelect();
}, [selectedMsgIds, allConvMessages, exitMultiSelect]);
```

- [ ] **Step 4: Run type check and full visual verification**

Run: `npx tsc --noEmit`
Run: `pnpm dev` — test full flow:
1. Long-press → forward → select contact → message appears in target chat
2. Multi-select → batch forward → select contact
3. Multi-select → merge forward → select contact → card appears → tap card → detail view

- [ ] **Step 5: Commit**

```bash
git add src/apps/XingYu/pages/ContactSelect.tsx src/apps/XingYu/XingYuApp.tsx src/apps/XingYu/pages/ChatDetail.tsx
git commit -m "feat(XingYu): add contact select page and wire forward actions"
```

---

### Task 9: Final integration and polish

**Files:**
- Modify: `src/apps/XingYu/pages/ChatDetail.tsx`

- [ ] **Step 1: Verify all action flows work end-to-end**

Test each flow in the browser:

1. **Copy**: Long-press text → 复制 → toast "已复制", text in clipboard
2. **Favorite**: Long-press → 收藏 → toast "已收藏"
3. **Quote**: Long-press → 引用 → preview bar appears → type reply → send → bubble shows quote block → tap block → scroll to original
4. **Forward (single)**: Long-press → 转发 → contact list → select → message appears in target
5. **Multi-select**: Long-press → 多选 → checkboxes appear → select messages → bottom toolbar
6. **Multi-select batch forward**: Select → 逐条转发 → contact → messages sent individually
7. **Multi-select merge forward**: Select → 合并转发 → contact → card appears → tap → detail view
8. **Multi-select favorite**: Select → 收藏 → toast "已收藏 N 条"
9. **Multi-select delete**: Select → 删除 → confirm → messages removed
10. **Delete (single)**: Long-press → 删除 → confirm → removed

- [ ] **Step 2: Fix any issues found during testing**

Address bugs, layout issues, or edge cases discovered in Step 1.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, including new messageActions tests.

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(XingYu): complete message long-press actions integration"
```

---

### Task 10: Deploy

- [ ] **Step 1: Build**

Run: `pnpm build`
Expected: No build errors.

- [ ] **Step 2: Deploy to Cloudflare Pages**

Run: `npx -y wrangler pages deploy dist --project-name mini-iphone --commit-dirty=true`

- [ ] **Step 3: Verify on production**

Open https://mini-iphone.pages.dev/ and test long-press actions on a chat message.
