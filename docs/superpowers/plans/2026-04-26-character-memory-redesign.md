# 角色记忆系统重构 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用结构化状态层（事实链 / 关系模型 / OpenLoops / Highlights / 情节摘要）替代当前的单一 summary blob 压缩，实现情感连续性 + 记忆连续性。

**Architecture:** 新增 `CharacterMemoryState`（per-character IDB 状态表），压缩 pipeline 用 3 次并发 LLM 调用（结构抽取 / 关系更新 / 叙事提炼）分别更新各状态层；原始 `MemoryEntry` 流不删，`compressed:true` 改为"已被状态层吸收"语义；`promptAssembly` 从 state 渲染 system 块。

**Tech Stack:** Zustand v4 (state stores), IndexedDB (持久化), vitest, TypeScript。

**Spec:** `docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md`

---

## 文件结构

**新建：**
- `src/platform/ai/memoryStateTypes.ts` — 状态层全部类型定义
- `src/platform/ai/memoryStateStore.ts` — Zustand store + IDB 同步
- `src/platform/ai/memoryStateMutations.ts` — 纯函数：把 pass 输出 patch 到 state
- `src/platform/ai/memoryStateRender.ts` — 渲染状态层为 system 提示文本
- `src/platform/ai/compressionPassA.ts` — 事实 / OpenLoops / inJokes 抽取
- `src/platform/ai/compressionPassB.ts` — 关系更新
- `src/platform/ai/compressionPassC.ts` — 情节摘要 + Highlights
- `src/platform/ai/compressionPipeline.ts` — `Promise.all` 编排 + 事务性写入
- `src/platform/ai/memoryStateMigration.ts` — 旧 `[长期记忆]` system entry 迁移
- 对应 `src/platform/ai/__tests__/*.test.ts`

**修改：**
- `src/platform/storage/idbStorage.ts` — DB v6，新增 `MEMORY_STATE_STORE`
- `src/platform/storage/idbRecordStorage.ts` — 增 put/load/delete state 记录
- `src/platform/ai/characterMemoryCompression.ts` — `doCompression` 替换为新 pipeline
- `src/platform/ai/promptAssembly.ts` — `renderMemoryToTranscript` 改为读 state

---

## 约定

- 提交格式 `feat(memory): ...` / `test(memory): ...` / `refactor(memory): ...`
- 每个任务结束 commit 一次（小步前进）
- 测试用 vitest；mock LLM 直接 `vi.spyOn(adapter, 'method')`
- 不要在 commit 里写 "Co-Authored-By"（项目无此约定，参考最近 commit）

---

## Task 1: 类型定义

**Files:**
- Create: `src/platform/ai/memoryStateTypes.ts`
- Test: `src/platform/ai/__tests__/memoryStateTypes.test.ts`

- [ ] **Step 1: 写类型定义文件**

```ts
// src/platform/ai/memoryStateTypes.ts
/**
 * 角色记忆状态层 — 结构化的"长期记忆"。
 *
 * MemoryEntry（原始流）不变；本模块定义压缩 pipeline 的产物：事实链、
 * 关系模型、OpenLoops、Highlights、情节摘要。状态独立于具体 App，
 * 与 characterMemoryStore 一起构成完整的角色记忆。
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md
 */

export type FactSubject =
  | 'user'
  | 'character'
  | 'shared'
  | 'peer'
  | 'meta'
  | 'other';

export interface FactNode {
  id: string;
  content: string;
  at: number;
  private?: true;
  sourceEntryIds?: string[];
  createdAt: number;
}

export interface FactChain {
  id: string;
  key?: string;
  subject: FactSubject;
  peerCharacterId?: string;
  peerName?: string;
  entries: FactNode[];
  createdAt: number;
  updatedAt: number;
}

export interface Boundary {
  topic: string;
  reason: string;
  severity: 'soft' | 'hard';
}

export interface InJoke {
  content: string;
  context: string;
  createdAt: number;
}

export interface RelationshipState {
  affinity: number;
  stage: string;
  addressToUser: string;
  boundaries: Boundary[];
  inJokes: InJoke[];
  lastUpdatedAt: number;
}

export interface OpenLoop {
  id: string;
  topic: string;
  promisedBy: 'user' | 'character';
  createdAt: number;
  status: 'open' | 'closed' | 'expired';
  closedAt?: number;
  sourceEntryIds?: string[];
}

export type HighlightCategory =
  | 'striking'
  | 'surprise'
  | 'positive'
  | 'turning_point';

export interface Highlight {
  id: string;
  content: string;
  categories: HighlightCategory[];
  weight: number;
  at: number;
  sourceEntryIds?: string[];
  createdAt: number;
}

export interface EpisodicSummary {
  content: string;
  version: number;
  coveringUpTo: number;
  lastUpdatedAt: number;
}

export interface CharacterMemoryStateRecord {
  characterId: string;
  relationship: RelationshipState;
  factChains: FactChain[];
  openLoops: OpenLoop[];
  highlights: Highlight[];
  episodicSummary: EpisodicSummary | null;
  lastCompressedAt: number;
}

export const HIGHLIGHTS_LIMIT = 30;
export const AFFINITY_INITIAL = 50;
export const STAGE_INITIAL = '陌生';

export function makeInitialState(characterId: string, addressToUser = '你'): CharacterMemoryStateRecord {
  return {
    characterId,
    relationship: {
      affinity: AFFINITY_INITIAL,
      stage: STAGE_INITIAL,
      addressToUser,
      boundaries: [],
      inJokes: [],
      lastUpdatedAt: 0,
    },
    factChains: [],
    openLoops: [],
    highlights: [],
    episodicSummary: null,
    lastCompressedAt: 0,
  };
}
```

- [ ] **Step 2: 写 smoke test 验证导出与默认值**

```ts
// src/platform/ai/__tests__/memoryStateTypes.test.ts
import { describe, it, expect } from 'vitest';
import {
  makeInitialState,
  HIGHLIGHTS_LIMIT,
  AFFINITY_INITIAL,
  STAGE_INITIAL,
} from '../memoryStateTypes';

describe('memoryStateTypes', () => {
  it('makeInitialState 返回结构完整的空 state', () => {
    const s = makeInitialState('char-1');
    expect(s.characterId).toBe('char-1');
    expect(s.relationship.affinity).toBe(AFFINITY_INITIAL);
    expect(s.relationship.stage).toBe(STAGE_INITIAL);
    expect(s.relationship.addressToUser).toBe('你');
    expect(s.factChains).toEqual([]);
    expect(s.openLoops).toEqual([]);
    expect(s.highlights).toEqual([]);
    expect(s.episodicSummary).toBeNull();
    expect(s.lastCompressedAt).toBe(0);
  });

  it('addressToUser 可以自定义', () => {
    const s = makeInitialState('char-1', '小明');
    expect(s.relationship.addressToUser).toBe('小明');
  });

  it('常量值合理', () => {
    expect(HIGHLIGHTS_LIMIT).toBeGreaterThan(0);
    expect(AFFINITY_INITIAL).toBeGreaterThanOrEqual(0);
    expect(AFFINITY_INITIAL).toBeLessThanOrEqual(100);
  });
});
```

- [ ] **Step 3: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateTypes.test.ts`
Expected: 3 tests pass

- [ ] **Step 4: 提交**

```bash
git add src/platform/ai/memoryStateTypes.ts src/platform/ai/__tests__/memoryStateTypes.test.ts
git commit -m "feat(memory): add memory state type definitions"
```

---

## Task 2: IDB schema 升级到 v6

**Files:**
- Modify: `src/platform/storage/idbStorage.ts`
- Test: 沿用现有 `__tests__/characterMemoryStore.persistence.test.ts` 验证升级后旧表仍存在

- [ ] **Step 1: 阅读 `idbStorage.ts` 的 v5 升级路径**

Run: `cat src/platform/storage/idbStorage.ts | head -90`

确认 `onupgradeneeded` 的写法（多版本 guarded create 模式）。

- [ ] **Step 2: 修改 `idbStorage.ts`，加 v6 + MEMORY_STATE_STORE**

```ts
// 在 idbStorage.ts 顶部常量区
const DB_VERSION = 6;  // 改自 5

// AI character memory state (added in v6)
export const MEMORY_STATE_STORE = 'characterMemoryState';
```

`onupgradeneeded` 末尾追加：

```ts
      // v6: AI character memory STATE (per-character, keyed by characterId).
      if (!db.objectStoreNames.contains(MEMORY_STATE_STORE)) {
        db.createObjectStore(MEMORY_STATE_STORE, { keyPath: 'characterId' });
      }
```

- [ ] **Step 3: 跑现有持久化测试，确认升级不破坏旧表**

Run: `pnpm vitest run src/platform/ai/__tests__/characterMemoryStore.persistence.test.ts`
Expected: 全部 pass（无 regressions）

- [ ] **Step 4: 提交**

```bash
git add src/platform/storage/idbStorage.ts
git commit -m "feat(storage): bump IDB to v6 with MEMORY_STATE_STORE"
```

---

## Task 3: idbRecordStorage 加 state 持久化函数

**Files:**
- Modify: `src/platform/storage/idbRecordStorage.ts`
- Test: `src/platform/storage/__tests__/idbRecordStorage.memoryState.test.ts`

- [ ] **Step 1: 写测试**

先确认是否已有 `__tests__` 目录：

Run: `ls src/platform/storage/__tests__ 2>/dev/null || mkdir -p src/platform/storage/__tests__`

```ts
// src/platform/storage/__tests__/idbRecordStorage.memoryState.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  putMemoryState,
  loadMemoryState,
  loadAllMemoryStates,
  deleteMemoryState,
} from '../idbRecordStorage';
import { makeInitialState } from '@/platform/ai/memoryStateTypes';

describe('idbRecordStorage — memoryState', () => {
  beforeEach(async () => {
    // fake-indexeddb 在每个测试间共享，需手动清理
    const all = await loadAllMemoryStates();
    for (const s of all) await deleteMemoryState(s.characterId);
  });

  it('put + load 单条', async () => {
    const s = makeInitialState('char-1');
    await putMemoryState(s);
    const loaded = await loadMemoryState('char-1');
    expect(loaded).toEqual(s);
  });

  it('load 不存在的 characterId 返回 null', async () => {
    const loaded = await loadMemoryState('nonexistent');
    expect(loaded).toBeNull();
  });

  it('loadAll 返回多条', async () => {
    await putMemoryState(makeInitialState('char-1'));
    await putMemoryState(makeInitialState('char-2'));
    const all = await loadAllMemoryStates();
    expect(all).toHaveLength(2);
    expect(all.map((s) => s.characterId).sort()).toEqual(['char-1', 'char-2']);
  });

  it('put 覆盖同 characterId', async () => {
    await putMemoryState(makeInitialState('char-1'));
    const updated = makeInitialState('char-1');
    updated.relationship.affinity = 80;
    await putMemoryState(updated);
    const loaded = await loadMemoryState('char-1');
    expect(loaded?.relationship.affinity).toBe(80);
  });

  it('delete 后 load 返回 null', async () => {
    await putMemoryState(makeInitialState('char-1'));
    await deleteMemoryState('char-1');
    expect(await loadMemoryState('char-1')).toBeNull();
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/platform/storage/__tests__/idbRecordStorage.memoryState.test.ts`
Expected: FAIL with "putMemoryState is not exported"

- [ ] **Step 3: 实现持久化函数**

在 `src/platform/storage/idbRecordStorage.ts` 末尾追加：

```ts
// ---------------------------------------------------------------------------
// Character memory state
// ---------------------------------------------------------------------------

import type { CharacterMemoryStateRecord } from '@/platform/ai/memoryStateTypes';
import { MEMORY_STATE_STORE } from './idbStorage';

export async function putMemoryState(state: CharacterMemoryStateRecord): Promise<void> {
  if (!hasIDB) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MEMORY_STATE_STORE, 'readwrite');
    tx.objectStore(MEMORY_STATE_STORE).put(state);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[idbRecord] putMemoryState failed:', e);
  }
}

export async function loadMemoryState(
  characterId: string,
): Promise<CharacterMemoryStateRecord | null> {
  if (!hasIDB) return null;
  try {
    const db = await getDB();
    return await new Promise<CharacterMemoryStateRecord | null>((resolve, reject) => {
      const tx = db.transaction(MEMORY_STATE_STORE, 'readonly');
      const req = tx.objectStore(MEMORY_STATE_STORE).get(characterId);
      req.onsuccess = () => resolve((req.result as CharacterMemoryStateRecord | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[idbRecord] loadMemoryState failed:', e);
    return null;
  }
}

export async function loadAllMemoryStates(): Promise<CharacterMemoryStateRecord[]> {
  if (!hasIDB) return [];
  try {
    const db = await getDB();
    return await new Promise<CharacterMemoryStateRecord[]>((resolve, reject) => {
      const tx = db.transaction(MEMORY_STATE_STORE, 'readonly');
      const req = tx.objectStore(MEMORY_STATE_STORE).getAll();
      req.onsuccess = () => resolve(req.result as CharacterMemoryStateRecord[]);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn('[idbRecord] loadAllMemoryStates failed:', e);
    return [];
  }
}

export async function deleteMemoryState(characterId: string): Promise<void> {
  if (!hasIDB) return;
  try {
    const db = await getDB();
    const tx = db.transaction(MEMORY_STATE_STORE, 'readwrite');
    tx.objectStore(MEMORY_STATE_STORE).delete(characterId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('[idbRecord] deleteMemoryState failed:', e);
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run src/platform/storage/__tests__/idbRecordStorage.memoryState.test.ts`
Expected: 5 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/storage/idbRecordStorage.ts src/platform/storage/__tests__/idbRecordStorage.memoryState.test.ts
git commit -m "feat(storage): add memoryState persistence helpers"
```

---

## Task 4: memoryStateStore（Zustand + IDB 同步）

**Files:**
- Create: `src/platform/ai/memoryStateStore.ts`
- Test: `src/platform/ai/__tests__/memoryStateStore.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/platform/ai/__tests__/memoryStateStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import {
  useMemoryState,
  loadMemoryStateFromIdb,
  startMemoryStateIdbSync,
  stopMemoryStateIdbSync,
  _resetMemoryStateForTests,
} from '../memoryStateStore';
import { loadMemoryState } from '@/platform/storage/idbRecordStorage';

describe('memoryStateStore', () => {
  beforeEach(async () => {
    await _resetMemoryStateForTests();
  });

  it('getOrInit 不存在时创建初始 state', () => {
    const s = useMemoryState.getState().getOrInit('char-1');
    expect(s.characterId).toBe('char-1');
    expect(s.relationship.affinity).toBe(50);
  });

  it('getOrInit 已存在时返回原 state', () => {
    const a = useMemoryState.getState().getOrInit('char-1');
    a.relationship.affinity = 80;
    useMemoryState.getState().set('char-1', a);
    const b = useMemoryState.getState().getOrInit('char-1');
    expect(b.relationship.affinity).toBe(80);
  });

  it('set 触发 IDB 写入', async () => {
    startMemoryStateIdbSync();
    try {
      const s = useMemoryState.getState().getOrInit('char-1');
      s.relationship.affinity = 75;
      useMemoryState.getState().set('char-1', s);
      await new Promise((r) => setTimeout(r, 10));
      const persisted = await loadMemoryState('char-1');
      expect(persisted?.relationship.affinity).toBe(75);
    } finally {
      stopMemoryStateIdbSync();
    }
  });

  it('loadMemoryStateFromIdb 还原 state', async () => {
    startMemoryStateIdbSync();
    const s = useMemoryState.getState().getOrInit('char-1');
    s.relationship.affinity = 90;
    useMemoryState.getState().set('char-1', s);
    await new Promise((r) => setTimeout(r, 10));
    stopMemoryStateIdbSync();

    useMemoryState.setState({ states: {} });
    await loadMemoryStateFromIdb();
    expect(useMemoryState.getState().get('char-1')?.relationship.affinity).toBe(90);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateStore.test.ts`
Expected: FAIL — module 不存在

- [ ] **Step 3: 实现 store**

```ts
// src/platform/ai/memoryStateStore.ts
/**
 * Per-character memory state — structured storage for fact chains,
 * relationship model, open loops, highlights, episodic summary.
 *
 * Companion to characterMemoryStore (raw entry stream). Compression
 * pipeline reads entries + state, writes patches back to state via
 * memoryStateMutations. promptAssembly reads state for system-tail
 * rendering.
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md
 */

import { create } from 'zustand';
import {
  putMemoryState,
  loadAllMemoryStates,
  deleteMemoryState,
} from '@/platform/storage/idbRecordStorage';
import {
  type CharacterMemoryStateRecord,
  makeInitialState,
} from './memoryStateTypes';

interface MemoryStateStore {
  states: Record<string, CharacterMemoryStateRecord>;
  get: (characterId: string) => CharacterMemoryStateRecord | undefined;
  getOrInit: (characterId: string, addressToUser?: string) => CharacterMemoryStateRecord;
  set: (characterId: string, state: CharacterMemoryStateRecord) => void;
  remove: (characterId: string) => void;
  clearAll: () => void;
}

export const useMemoryState = create<MemoryStateStore>((set, get) => ({
  states: {},

  get(characterId) {
    return get().states[characterId];
  },

  getOrInit(characterId, addressToUser) {
    const existing = get().states[characterId];
    if (existing) return existing;
    const fresh = makeInitialState(characterId, addressToUser);
    set((s) => ({ states: { ...s.states, [characterId]: fresh } }));
    return fresh;
  },

  set(characterId, state) {
    set((s) => ({ states: { ...s.states, [characterId]: state } }));
  },

  remove(characterId) {
    set((s) => {
      const next = { ...s.states };
      delete next[characterId];
      return { states: next };
    });
  },

  clearAll() {
    set({ states: {} });
  },
}));

// ════════════════════════════════════════════════════════════════════════════
// IDB sync
// ════════════════════════════════════════════════════════════════════════════

let unsubscribe: (() => void) | null = null;

export async function loadMemoryStateFromIdb(): Promise<void> {
  const records = await loadAllMemoryStates();
  const grouped: Record<string, CharacterMemoryStateRecord> = {};
  for (const r of records) grouped[r.characterId] = r;
  useMemoryState.setState({ states: grouped });
}

export function startMemoryStateIdbSync(): void {
  if (unsubscribe) return;
  let prev = useMemoryState.getState().states;
  unsubscribe = useMemoryState.subscribe((s) => {
    const next = s.states;
    const allIds = new Set([...Object.keys(prev), ...Object.keys(next)]);
    for (const id of allIds) {
      const p = prev[id];
      const n = next[id];
      if (n && n !== p) void putMemoryState(n);
      else if (!n && p) void deleteMemoryState(id);
    }
    prev = next;
  });
}

export function stopMemoryStateIdbSync(): void {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
}

export async function _resetMemoryStateForTests(): Promise<void> {
  stopMemoryStateIdbSync();
  const ids = Object.keys(useMemoryState.getState().states);
  useMemoryState.setState({ states: {} });
  for (const id of ids) await deleteMemoryState(id);
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateStore.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/memoryStateStore.ts src/platform/ai/__tests__/memoryStateStore.test.ts
git commit -m "feat(memory): add Zustand store with IDB sync for character memory state"
```

---

## Task 5: 状态层 mutator 纯函数

**Files:**
- Create: `src/platform/ai/memoryStateMutations.ts`
- Test: `src/platform/ai/__tests__/memoryStateMutations.test.ts`

为每个 pass 的输出写"应用到 state"的纯函数。pass 函数本身（task 6/7/8）只负责调 LLM；应用 patch 在这里。

- [ ] **Step 1: 写测试（Pass A 应用）**

```ts
// src/platform/ai/__tests__/memoryStateMutations.test.ts
import { describe, it, expect } from 'vitest';
import { applyPassAResult, applyPassBResult, applyPassCResult } from '../memoryStateMutations';
import { makeInitialState } from '../memoryStateTypes';

describe('applyPassAResult', () => {
  it('factAdds 创建新链', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [{ content: '用户叫小明', subject: 'user', at: 1000 }],
      factAppends: [],
      loopsOpened: [],
      loopsClosed: [],
      jokeAdds: [],
    });
    expect(next.factChains).toHaveLength(1);
    expect(next.factChains[0]!.subject).toBe('user');
    expect(next.factChains[0]!.entries[0]!.content).toBe('用户叫小明');
    expect(next.factChains[0]!.entries[0]!.at).toBe(1000);
  });

  it('factAppends 加到现有链尾', () => {
    let s = makeInitialState('char-1');
    s = applyPassAResult(s, {
      factAdds: [{ content: '在腾讯', subject: 'user', key: 'job', at: 1000 }],
      factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [],
    });
    const chainId = s.factChains[0]!.id;
    s = applyPassAResult(s, {
      factAdds: [],
      factAppends: [{ chainId, content: '换到字节', at: 2000 }],
      loopsOpened: [], loopsClosed: [], jokeAdds: [],
    });
    expect(s.factChains[0]!.entries).toHaveLength(2);
    expect(s.factChains[0]!.entries[1]!.content).toBe('换到字节');
  });

  it('factAppends 不存在的 chainId 被忽略', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [],
      factAppends: [{ chainId: 'fake', content: 'x', at: 1 }],
      loopsOpened: [], loopsClosed: [], jokeAdds: [],
    });
    expect(next.factChains).toHaveLength(0);
  });

  it('loopsOpened 推入 openLoops', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [], factAppends: [],
      loopsOpened: [{ topic: '答应给我看新狗', promisedBy: 'user' }],
      loopsClosed: [], jokeAdds: [],
    });
    expect(next.openLoops).toHaveLength(1);
    expect(next.openLoops[0]!.status).toBe('open');
    expect(next.openLoops[0]!.topic).toBe('答应给我看新狗');
  });

  it('loopsClosed 标 status=closed + closedAt', () => {
    let s = makeInitialState('char-1');
    s = applyPassAResult(s, {
      factAdds: [], factAppends: [],
      loopsOpened: [{ topic: 'x', promisedBy: 'user' }],
      loopsClosed: [], jokeAdds: [],
    });
    const loopId = s.openLoops[0]!.id;
    s = applyPassAResult(s, {
      factAdds: [], factAppends: [], loopsOpened: [],
      loopsClosed: [{ loopId }], jokeAdds: [],
    });
    expect(s.openLoops[0]!.status).toBe('closed');
    expect(s.openLoops[0]!.closedAt).toBeGreaterThan(0);
  });

  it('jokeAdds 加到 inJokes', () => {
    const s = makeInitialState('char-1');
    const next = applyPassAResult(s, {
      factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [],
      jokeAdds: [{ content: '说馒头', context: '她的猫' }],
    });
    expect(next.relationship.inJokes).toHaveLength(1);
  });
});

describe('applyPassBResult', () => {
  it('affinityDelta 累加并 clamp 0-100', () => {
    let s = makeInitialState('char-1');
    s.relationship.affinity = 90;
    s = applyPassBResult(s, { affinityDelta: 20, boundaryAdds: [], boundaryRemoves: [] });
    expect(s.relationship.affinity).toBe(100);

    s = applyPassBResult(s, { affinityDelta: -150, boundaryAdds: [], boundaryRemoves: [] });
    expect(s.relationship.affinity).toBe(0);
  });

  it('stageChange / addressChange 直接覆盖', () => {
    const s = makeInitialState('char-1');
    const next = applyPassBResult(s, {
      affinityDelta: 0,
      stageChange: '恋人',
      addressChange: '小明哥',
      boundaryAdds: [], boundaryRemoves: [],
    });
    expect(next.relationship.stage).toBe('恋人');
    expect(next.relationship.addressToUser).toBe('小明哥');
  });

  it('boundaryAdds 追加；boundaryRemoves 按 topic 删除', () => {
    let s = makeInitialState('char-1');
    s = applyPassBResult(s, {
      affinityDelta: 0,
      boundaryAdds: [
        { topic: '前任', reason: 'X', severity: 'hard' },
        { topic: '体重', reason: 'Y', severity: 'soft' },
      ],
      boundaryRemoves: [],
    });
    expect(s.relationship.boundaries).toHaveLength(2);

    s = applyPassBResult(s, {
      affinityDelta: 0,
      boundaryAdds: [],
      boundaryRemoves: ['体重'],
    });
    expect(s.relationship.boundaries).toHaveLength(1);
    expect(s.relationship.boundaries[0]!.topic).toBe('前任');
  });
});

describe('applyPassCResult', () => {
  it('summary 写入 episodicSummary，version 递增', () => {
    let s = makeInitialState('char-1');
    s = applyPassCResult(s, { summary: 'v1', highlights: [] }, 1000);
    expect(s.episodicSummary?.content).toBe('v1');
    expect(s.episodicSummary?.version).toBe(1);
    expect(s.episodicSummary?.coveringUpTo).toBe(1000);

    s = applyPassCResult(s, { summary: 'v2', highlights: [] }, 2000);
    expect(s.episodicSummary?.version).toBe(2);
    expect(s.episodicSummary?.coveringUpTo).toBe(2000);
  });

  it('highlights append + 超量按 weight×recency 裁剪', () => {
    let s = makeInitialState('char-1');
    // 用 31 条填充；权重低的会被裁掉
    const lowWeight = Array.from({ length: 31 }, (_, i) => ({
      content: `low-${i}`,
      categories: ['striking' as const],
      weight: 0.1,
      at: 1000 + i,
    }));
    s = applyPassCResult(s, { summary: '', highlights: lowWeight }, 9999);
    expect(s.highlights).toHaveLength(30);

    // 加一条高权重的，最低权重最老的应该被挤掉
    s = applyPassCResult(s, {
      summary: '',
      highlights: [{ content: 'TOP', categories: ['turning_point'], weight: 1.0, at: 99999 }],
    }, 99999);
    expect(s.highlights).toHaveLength(30);
    expect(s.highlights.some((h) => h.content === 'TOP')).toBe(true);
  });

  it('lastCompressedAt 更新', () => {
    let s = makeInitialState('char-1');
    s = applyPassCResult(s, { summary: '', highlights: [] }, 5000);
    expect(s.lastCompressedAt).toBe(5000);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateMutations.test.ts`
Expected: FAIL — module 不存在

- [ ] **Step 3: 实现 mutator**

```ts
// src/platform/ai/memoryStateMutations.ts
/**
 * Pure functions that apply LLM pass output to a CharacterMemoryStateRecord.
 *
 * Kept separate from the pass functions themselves so the LLM I/O is
 * isolated from state-shape logic and the latter is trivially testable.
 */

import { uid } from '@/platform/utils/uid';
import {
  type CharacterMemoryStateRecord,
  type FactChain,
  type FactSubject,
  type Boundary,
  type HighlightCategory,
  HIGHLIGHTS_LIMIT,
} from './memoryStateTypes';

// ---------------------------------------------------------------------------
// Pass A: structural extraction (facts / openLoops / inJokes)
// ---------------------------------------------------------------------------

export interface PassAResult {
  factAdds: Array<{
    content: string;
    subject: FactSubject;
    key?: string;
    peerCharacterId?: string;
    peerName?: string;
    at: number;
    private?: boolean;
    sourceEntryIds?: string[];
  }>;
  factAppends: Array<{
    chainId: string;
    content: string;
    at: number;
    private?: boolean;
    sourceEntryIds?: string[];
  }>;
  loopsOpened: Array<{
    topic: string;
    promisedBy: 'user' | 'character';
    sourceEntryIds?: string[];
  }>;
  loopsClosed: Array<{ loopId: string }>;
  jokeAdds: Array<{ content: string; context: string }>;
}

export function applyPassAResult(
  state: CharacterMemoryStateRecord,
  result: PassAResult,
): CharacterMemoryStateRecord {
  const now = Date.now();
  let factChains = state.factChains;
  let openLoops = state.openLoops;
  let inJokes = state.relationship.inJokes;

  // factAdds → 新建 chain
  if (result.factAdds.length) {
    const newChains: FactChain[] = result.factAdds.map((a) => ({
      id: uid(),
      key: a.key,
      subject: a.subject,
      peerCharacterId: a.peerCharacterId,
      peerName: a.peerName,
      entries: [
        {
          id: uid(),
          content: a.content,
          at: a.at,
          private: a.private ? true : undefined,
          sourceEntryIds: a.sourceEntryIds,
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    }));
    factChains = [...factChains, ...newChains];
  }

  // factAppends → 追加到已有 chain
  if (result.factAppends.length) {
    const byId = new Map(factChains.map((c) => [c.id, c]));
    let mutated = false;
    for (const ap of result.factAppends) {
      const c = byId.get(ap.chainId);
      if (!c) continue;
      const updated: FactChain = {
        ...c,
        entries: [
          ...c.entries,
          {
            id: uid(),
            content: ap.content,
            at: ap.at,
            private: ap.private ? true : undefined,
            sourceEntryIds: ap.sourceEntryIds,
            createdAt: now,
          },
        ],
        updatedAt: now,
      };
      byId.set(ap.chainId, updated);
      mutated = true;
    }
    if (mutated) factChains = Array.from(byId.values());
  }

  // loopsOpened
  if (result.loopsOpened.length) {
    openLoops = [
      ...openLoops,
      ...result.loopsOpened.map((l) => ({
        id: uid(),
        topic: l.topic,
        promisedBy: l.promisedBy,
        createdAt: now,
        status: 'open' as const,
        sourceEntryIds: l.sourceEntryIds,
      })),
    ];
  }

  // loopsClosed
  if (result.loopsClosed.length) {
    const closedSet = new Set(result.loopsClosed.map((l) => l.loopId));
    openLoops = openLoops.map((l) =>
      closedSet.has(l.id) ? { ...l, status: 'closed', closedAt: now } : l,
    );
  }

  // jokeAdds
  if (result.jokeAdds.length) {
    inJokes = [
      ...inJokes,
      ...result.jokeAdds.map((j) => ({
        content: j.content,
        context: j.context,
        createdAt: now,
      })),
    ];
  }

  return {
    ...state,
    factChains,
    openLoops,
    relationship: { ...state.relationship, inJokes, lastUpdatedAt: now },
  };
}

// ---------------------------------------------------------------------------
// Pass B: relationship update
// ---------------------------------------------------------------------------

export interface PassBResult {
  affinityDelta: number;
  stageChange?: string;
  addressChange?: string;
  boundaryAdds: Boundary[];
  boundaryRemoves: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function applyPassBResult(
  state: CharacterMemoryStateRecord,
  result: PassBResult,
): CharacterMemoryStateRecord {
  const r = state.relationship;
  const affinity = clamp(r.affinity + result.affinityDelta, 0, 100);
  const stage = result.stageChange ?? r.stage;
  const addressToUser = result.addressChange ?? r.addressToUser;

  let boundaries = r.boundaries;
  if (result.boundaryRemoves.length) {
    const rem = new Set(result.boundaryRemoves);
    boundaries = boundaries.filter((b) => !rem.has(b.topic));
  }
  if (result.boundaryAdds.length) {
    boundaries = [...boundaries, ...result.boundaryAdds];
  }

  return {
    ...state,
    relationship: {
      ...r,
      affinity,
      stage,
      addressToUser,
      boundaries,
      lastUpdatedAt: Date.now(),
    },
  };
}

// ---------------------------------------------------------------------------
// Pass C: episodic summary + highlights
// ---------------------------------------------------------------------------

export interface PassCResult {
  summary: string;
  highlights: Array<{
    content: string;
    categories: HighlightCategory[];
    weight: number;
    at: number;
    sourceEntryIds?: string[];
  }>;
}

export function applyPassCResult(
  state: CharacterMemoryStateRecord,
  result: PassCResult,
  coveringUpTo: number,
): CharacterMemoryStateRecord {
  const now = Date.now();
  const prevVersion = state.episodicSummary?.version ?? 0;

  const newHighlights = result.highlights.map((h) => ({
    id: uid(),
    content: h.content,
    categories: h.categories,
    weight: h.weight,
    at: h.at,
    sourceEntryIds: h.sourceEntryIds,
    createdAt: now,
  }));

  let combined = [...state.highlights, ...newHighlights];
  if (combined.length > HIGHLIGHTS_LIMIT) {
    // 按 weight × recency_decay 排序，保留 top HIGHLIGHTS_LIMIT。
    // recency_decay = at / now（越新越接近 1）
    const score = (h: typeof combined[number]): number =>
      h.weight * (h.at / now);
    combined = [...combined]
      .sort((a, b) => score(b) - score(a))
      .slice(0, HIGHLIGHTS_LIMIT);
  }

  return {
    ...state,
    episodicSummary: {
      content: result.summary,
      version: prevVersion + 1,
      coveringUpTo,
      lastUpdatedAt: now,
    },
    highlights: combined,
    lastCompressedAt: coveringUpTo,
  };
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateMutations.test.ts`
Expected: 11 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/memoryStateMutations.ts src/platform/ai/__tests__/memoryStateMutations.test.ts
git commit -m "feat(memory): add pure mutators for compression pass results"
```

---

## Task 6: 状态层渲染（system tail）

**Files:**
- Create: `src/platform/ai/memoryStateRender.ts`
- Test: `src/platform/ai/__tests__/memoryStateRender.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/platform/ai/__tests__/memoryStateRender.test.ts
import { describe, it, expect } from 'vitest';
import { renderMemoryStateBlock } from '../memoryStateRender';
import { makeInitialState, type CharacterMemoryStateRecord } from '../memoryStateTypes';

function buildSampleState(): CharacterMemoryStateRecord {
  const s = makeInitialState('char-1');
  s.relationship.stage = '恋人';
  s.relationship.addressToUser = '小明哥';
  s.relationship.boundaries = [
    { topic: '前任', reason: '她沉默半天', severity: 'hard' },
    { topic: '体重', reason: '换话题就好', severity: 'soft' },
  ];
  s.relationship.inJokes = [{ content: '说馒头', context: '她的猫', createdAt: 1 }];
  s.relationship.lastUpdatedAt = new Date('2026-04-20').getTime();

  s.factChains = [
    {
      id: 'c1',
      key: 'job',
      subject: 'user',
      entries: [
        { id: 'n1', content: '在腾讯', at: new Date('2024-12').getTime(), createdAt: 1 },
        { id: 'n2', content: '换到字节', at: new Date('2025-06').getTime(), createdAt: 2 },
      ],
      createdAt: 1, updatedAt: 2,
    },
    {
      id: 'c2', subject: 'character',
      entries: [{ id: 'n3', content: '我不喝咖啡', at: 100, createdAt: 1 }],
      createdAt: 1, updatedAt: 1,
    },
    {
      id: 'c3', subject: 'peer', peerCharacterId: 'char-2', peerName: '小美',
      entries: [{ id: 'n4', content: '在换工作', at: 200, createdAt: 1 }],
      createdAt: 1, updatedAt: 1,
    },
  ];

  s.openLoops = [
    { id: 'l1', topic: '答应看新狗', promisedBy: 'user', createdAt: 1, status: 'open' },
    { id: 'l2', topic: '已闭', promisedBy: 'user', createdAt: 1, status: 'closed', closedAt: 2 },
  ];

  s.highlights = [
    { id: 'h1', content: '生日她笑了', categories: ['surprise'], weight: 0.9,
      at: new Date('2026-03-15').getTime(), createdAt: 1 },
  ];

  s.lastCompressedAt = new Date('2026-04-20').getTime();
  return s;
}

describe('renderMemoryStateBlock', () => {
  it('null state 返回空字符串', () => {
    expect(renderMemoryStateBlock(null, { context: 'normal' })).toBe('');
  });

  it('渲染含所有段落 + disclaimer', () => {
    const out = renderMemoryStateBlock(buildSampleState(), { context: 'normal' });
    expect(out).toContain('[当前关系]');
    expect(out).toContain('恋人');
    expect(out).toContain('小明哥');
    expect(out).toContain('前任');
    expect(out).toContain('馒头');
    expect(out).toContain('[已知事实]');
    expect(out).toContain('关于你');
    expect(out).toContain('在腾讯');
    expect(out).toContain('换到字节');
    expect(out).toContain('关于我');
    expect(out).toContain('关于其他角色');
    expect(out).toContain('小美');
    expect(out).toContain('[待闭环的约定]');
    expect(out).toContain('答应看新狗');
    expect(out).not.toContain('已闭'); // closed 的 loop 过滤
    expect(out).toContain('[印象深刻的时刻]');
    expect(out).toContain('生日她笑了');
    expect(out).toContain('以近期对话为准');
  });

  it('不渲染 affinity 数字', () => {
    const s = buildSampleState();
    s.relationship.affinity = 87;
    const out = renderMemoryStateBlock(s, { context: 'normal' });
    expect(out).not.toContain('87');
    expect(out).not.toContain('亲密度');
  });

  it('group context 过滤 private fact', () => {
    const s = buildSampleState();
    s.factChains[0]!.entries.push({
      id: 'n-secret', content: '秘密', at: 999, private: true, createdAt: 1,
    });
    const normal = renderMemoryStateBlock(s, { context: 'normal' });
    expect(normal).toContain('秘密');
    const group = renderMemoryStateBlock(s, { context: 'group' });
    expect(group).not.toContain('秘密');
  });

  it('空字段不渲染对应段', () => {
    const s = makeInitialState('char-1');
    const out = renderMemoryStateBlock(s, { context: 'normal' });
    expect(out).toContain('[当前关系]');
    expect(out).not.toContain('[已知事实]');
    expect(out).not.toContain('[待闭环的约定]');
    expect(out).not.toContain('[印象深刻的时刻]');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateRender.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现渲染**

```ts
// src/platform/ai/memoryStateRender.ts
/**
 * Render CharacterMemoryStateRecord into a block of text suitable for the
 * tail of the system prompt. Three guarantees:
 *   1. Quantitative `affinity` is NEVER rendered (defends against LLM
 *      treating stale numbers as ground truth).
 *   2. All time-sensitive blocks carry a "as-of" date.
 *   3. The block ends with a disclaimer telling the LLM to prefer the
 *      conversation history over this snapshot.
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md §防漂移机制
 */

import {
  type CharacterMemoryStateRecord,
  type FactChain,
  type FactSubject,
  type Highlight,
} from './memoryStateTypes';

export type RenderContext = 'normal' | 'group' | 'ai-ai';

export interface RenderOptions {
  context: RenderContext;
  /** Top K highlights by weight × recency to inject (default: render all). */
  highlightTopK?: number;
}

const SUBJECT_LABEL: Record<FactSubject, string> = {
  user: '关于你',
  character: '关于我',
  shared: '我们共同',
  peer: '关于其他角色',
  meta: '对话偏好',
  other: '其他',
};

const SUBJECT_ORDER: FactSubject[] = ['user', 'character', 'shared', 'peer', 'meta', 'other'];

function formatDate(ts: number): string {
  if (!ts) return '未知';
  const d = new Date(ts);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

function shouldFilterPrivate(ctx: RenderContext): boolean {
  return ctx === 'group' || ctx === 'ai-ai';
}

function renderRelationshipBlock(state: CharacterMemoryStateRecord): string {
  const r = state.relationship;
  const lines: string[] = [`[当前关系]（截至 ${formatDate(r.lastUpdatedAt)}）`];
  lines.push(`阶段：${r.stage}`);
  lines.push(`她叫你："${r.addressToUser}"`);

  if (r.boundaries.length) {
    lines.push('敏感话题：');
    for (const b of r.boundaries) {
      const tag = b.severity === 'hard' ? '硬避' : '软避';
      lines.push(`  · ${b.topic}（${tag}；${b.reason}）`);
    }
  }
  if (r.inJokes.length) {
    lines.push('我们之间的梗：');
    for (const j of r.inJokes) {
      lines.push(`  · ${j.content}（${j.context}）`);
    }
  }
  return lines.join('\n');
}

function renderChain(c: FactChain, opts: RenderOptions): string[] {
  const filtered = c.entries.filter((e) => !(shouldFilterPrivate(opts.context) && e.private));
  if (filtered.length === 0) return [];
  const lines: string[] = [];
  if (c.key) {
    lines.push(`  · ${c.key}：`);
    for (const e of filtered) {
      lines.push(`    · (${formatDate(e.at)}) ${e.content}`);
    }
  } else {
    for (const e of filtered) {
      lines.push(`  · (${formatDate(e.at)}) ${e.content}`);
    }
  }
  return lines;
}

function renderFactsBlock(state: CharacterMemoryStateRecord, opts: RenderOptions): string {
  const bySubject = new Map<FactSubject, FactChain[]>();
  for (const c of state.factChains) {
    if (!bySubject.has(c.subject)) bySubject.set(c.subject, []);
    bySubject.get(c.subject)!.push(c);
  }

  const sections: string[] = [];
  for (const subj of SUBJECT_ORDER) {
    const chains = bySubject.get(subj);
    if (!chains?.length) continue;

    if (subj === 'peer') {
      const peerLines: string[] = [];
      for (const c of chains) {
        const inner = renderChain(c, opts);
        if (inner.length === 0) continue;
        const name = c.peerName ?? c.peerCharacterId ?? '某角色';
        peerLines.push(`  关于 ${name}：`);
        // peer 链内部缩进多一级
        for (const line of inner) peerLines.push(`  ${line}`);
      }
      if (peerLines.length) {
        sections.push(`${SUBJECT_LABEL[subj]}：\n${peerLines.join('\n')}`);
      }
      continue;
    }

    const lines: string[] = [];
    for (const c of chains) lines.push(...renderChain(c, opts));
    if (lines.length) sections.push(`${SUBJECT_LABEL[subj]}：\n${lines.join('\n')}`);
  }

  if (sections.length === 0) return '';
  return ['[已知事实]', ...sections].join('\n');
}

function renderOpenLoopsBlock(state: CharacterMemoryStateRecord): string {
  const open = state.openLoops.filter((l) => l.status === 'open');
  if (open.length === 0) return '';
  const lines = ['[待闭环的约定]'];
  for (const l of open) {
    const who = l.promisedBy === 'user' ? '她答应' : '我答应';
    lines.push(`  · ${l.topic}（${who}，${formatDate(l.createdAt)}）`);
  }
  return lines.join('\n');
}

function renderHighlightsBlock(state: CharacterMemoryStateRecord, opts: RenderOptions): string {
  if (state.highlights.length === 0) return '';
  const k = opts.highlightTopK ?? state.highlights.length;
  const now = Date.now();
  const score = (h: Highlight): number => h.weight * (h.at / now);
  const sorted = [...state.highlights].sort((a, b) => score(b) - score(a)).slice(0, k);

  const lines = ['[印象深刻的时刻]'];
  for (const h of sorted) {
    lines.push(`  · (${formatDate(h.at)}) ${h.content}`);
  }
  return lines.join('\n');
}

const DISCLAIMER =
  '---\n以上为上次整理时的印象；若近期对话内容与之不符，以近期对话为准——对话是当前实时事实。';

export function renderMemoryStateBlock(
  state: CharacterMemoryStateRecord | null | undefined,
  opts: RenderOptions,
): string {
  if (!state) return '';
  const blocks: string[] = [];
  blocks.push(renderRelationshipBlock(state));
  const facts = renderFactsBlock(state, opts);
  if (facts) blocks.push(facts);
  const loops = renderOpenLoopsBlock(state);
  if (loops) blocks.push(loops);
  const highlights = renderHighlightsBlock(state, opts);
  if (highlights) blocks.push(highlights);
  blocks.push(DISCLAIMER);
  return blocks.join('\n\n');
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateRender.test.ts`
Expected: 5 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/memoryStateRender.ts src/platform/ai/__tests__/memoryStateRender.test.ts
git commit -m "feat(memory): render memory state into system prompt block"
```

---

## Task 7: Pass A — 结构抽取

**Files:**
- Create: `src/platform/ai/compressionPassA.ts`
- Test: `src/platform/ai/__tests__/compressionPassA.test.ts`

- [ ] **Step 1: 写测试（mock fetch，验证 prompt 构造 + 响应解析）**

```ts
// src/platform/ai/__tests__/compressionPassA.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPassA } from '../compressionPassA';
import { makeInitialState } from '../memoryStateTypes';

const fetchMock = vi.fn();

describe('runPassA', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  function mockChatJson(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('成功解析 JSON 响应', async () => {
    mockChatJson({
      factAdds: [{ content: '用户叫小明', subject: 'user', at: 1000 }],
      factAppends: [],
      loopsOpened: [{ topic: '新狗', promisedBy: 'user' }],
      loopsClosed: [],
      jokeAdds: [],
    });
    const state = makeInitialState('char-1');
    const result = await runPassA({
      state,
      messages: [{ role: 'user', speaker: '小明', content: '我叫小明，有空给你看新狗', createdAt: 1000 }],
      peers: [],
      endpoint: 'https://api.test',
      apiKey: 'sk-test',
      model: 'gpt-4',
      providerId: 'openai',
      maxTokens: 1000,
    });
    expect(result.factAdds).toHaveLength(1);
    expect(result.loopsOpened).toHaveLength(1);
  });

  it('LLM 返回非法 JSON 抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'not json' } }] }),
    });
    const state = makeInitialState('char-1');
    await expect(
      runPassA({
        state, messages: [], peers: [],
        endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
      }),
    ).rejects.toThrow(/Pass A/);
  });

  it('支持 code block 包围的 JSON（fallback 解析）', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: {
        content: '```json\n{"factAdds":[],"factAppends":[],"loopsOpened":[],"loopsClosed":[],"jokeAdds":[]}\n```',
      } }] }),
    });
    const state = makeInitialState('char-1');
    const result = await runPassA({
      state, messages: [], peers: [],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    expect(result.factAdds).toEqual([]);
  });

  it('peers 列表注入 prompt', async () => {
    mockChatJson({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    const state = makeInitialState('char-1');
    await runPassA({
      state, messages: [], peers: [{ id: 'char-2', name: '小美' }],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    const callBody = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const sysPrompt = callBody.messages.find((m: { role: string }) => m.role === 'system').content;
    expect(sysPrompt).toContain('小美');
  });

  it('HTTP 错误抛错', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 500, text: async () => 'oops',
    });
    const state = makeInitialState('char-1');
    await expect(
      runPassA({
        state, messages: [], peers: [],
        endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
      }),
    ).rejects.toThrow(/Pass A/);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPassA.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 Pass A**

```ts
// src/platform/ai/compressionPassA.ts
/**
 * Compression Pass A — structural extraction.
 *
 * Inputs current fact chains, open loops, in-jokes, and known peers; reads
 * a batch of memory entries; returns a JSON diff describing what to add /
 * append / open / close. Pure I/O — applies via memoryStateMutations.
 */

import type {
  CharacterMemoryStateRecord,
  FactSubject,
} from './memoryStateTypes';
import type { PassAResult } from './memoryStateMutations';

export interface PassMessage {
  role: 'user' | 'assistant' | 'system';
  speaker: string;
  content: string;
  createdAt: number;
  entryId?: string;
}

export interface PassPeer {
  id: string;
  name: string;
}

export interface PassACommonInput {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  maxTokens: number;
}

export interface PassAInput extends PassACommonInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
  peers: PassPeer[];
}

const SUBJECT_ENUM: FactSubject[] = ['user', 'character', 'shared', 'peer', 'meta', 'other'];

function buildPrompt(input: PassAInput): { system: string; user: string } {
  const peerLines = input.peers.length
    ? input.peers.map((p) => `- ${p.name} (id: ${p.id})`).join('\n')
    : '（暂无）';

  const activeChains = input.state.factChains.map((c) => {
    const head = `[${c.id}] subject=${c.subject}${c.key ? ` key=${c.key}` : ''}${
      c.peerCharacterId ? ` peer=${c.peerName ?? c.peerCharacterId}` : ''
    }`;
    const entries = c.entries.map((e) => `   · ${e.content}`).join('\n');
    return `${head}\n${entries}`;
  }).join('\n');

  const openLoops = input.state.openLoops
    .filter((l) => l.status === 'open')
    .map((l) => `[${l.id}] ${l.topic}（${l.promisedBy === 'user' ? '她' : '我'}答应）`)
    .join('\n');

  const inJokes = input.state.relationship.inJokes
    .map((j) => `· ${j.content}（${j.context}）`)
    .join('\n');

  const system = `你是一个记忆系统的"结构抽取"模块。从这批新对话里抽出三类结构化信息：事实变化、待闭环的约定、共同的梗。

【可用的 subject 枚举】
${SUBJECT_ENUM.map((s) => `- ${s}`).join('\n')}

【subject 含义】
- user: 关于用户本人 / 用户生活圈的事实
- character: 关于"我"（本角色）自己的一致性锚点
- shared: 我和用户共同经历过的事
- peer: 我认识的其他 AI 角色（仅限手机里的角色，不是路人）
- meta: 对话/互动偏好（"她不爱长篇"等）
- other: 实在归不进上面的兜底

【已知 peers（仅这些算 peer 主体；其余人名归 user 生活圈）】
${peerLines}

【当前 active 事实链】
${activeChains || '（暂无）'}

【当前 open loops】
${openLoops || '（暂无）'}

【当前 inJokes】
${inJokes || '（暂无）'}

【输出格式：严格 JSON，无任何注释或额外文字】
{
  "factAdds":    [{"content": "...", "subject": "user|character|shared|peer|meta|other", "key"?: "...", "peerCharacterId"?: "...", "peerName"?: "...", "at": 时间戳}],
  "factAppends": [{"chainId": "现有链 id", "content": "...", "at": 时间戳}],
  "loopsOpened": [{"topic": "...", "promisedBy": "user|character"}],
  "loopsClosed": [{"loopId": "现有 loop id"}],
  "jokeAdds":    [{"content": "...", "context": "..."}]
}

【关键约束】
- 同主题的新变化请 append 到已有链；只有全新话题才建新链。
- 游戏 / roleplay 中的临时身份（"他是女巫"等）不要抽成事实。
- 如果这批没有新内容，所有数组返回 [] 即可，不要编造。`;

  const user = input.messages
    .map((m) => `[${new Date(m.createdAt).toISOString()}] ${m.speaker}: ${m.content}`)
    .join('\n');

  return { system, user };
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const codeBlock = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (codeBlock) {
    try { return JSON.parse(codeBlock[1]!); } catch {}
  }
  const braces = text.match(/\{[\s\S]+\}/);
  if (braces) {
    try { return JSON.parse(braces[0]); } catch {}
  }
  throw new Error('No valid JSON found');
}

function validatePassA(raw: unknown): PassAResult {
  if (!raw || typeof raw !== 'object') throw new Error('not object');
  const r = raw as Record<string, unknown>;
  return {
    factAdds: Array.isArray(r.factAdds) ? (r.factAdds as PassAResult['factAdds']) : [],
    factAppends: Array.isArray(r.factAppends) ? (r.factAppends as PassAResult['factAppends']) : [],
    loopsOpened: Array.isArray(r.loopsOpened) ? (r.loopsOpened as PassAResult['loopsOpened']) : [],
    loopsClosed: Array.isArray(r.loopsClosed) ? (r.loopsClosed as PassAResult['loopsClosed']) : [],
    jokeAdds: Array.isArray(r.jokeAdds) ? (r.jokeAdds as PassAResult['jokeAdds']) : [],
  };
}

export async function runPassA(input: PassAInput): Promise<PassAResult> {
  const { system, user } = buildPrompt(input);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  if (input.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }

  const res = await fetch(`${input.endpoint}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: input.maxTokens,
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pass A HTTP ${res.status}: ${body}`);
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    return validatePassA(tryParseJson(content));
  } catch (e) {
    throw new Error(`Pass A parse failed: ${(e as Error).message} — raw: ${content.slice(0, 200)}`);
  }
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPassA.test.ts`
Expected: 5 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/compressionPassA.ts src/platform/ai/__tests__/compressionPassA.test.ts
git commit -m "feat(memory): compression Pass A — structural extraction"
```

---

## Task 8: Pass B — 关系更新

**Files:**
- Create: `src/platform/ai/compressionPassB.ts`
- Test: `src/platform/ai/__tests__/compressionPassB.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/platform/ai/__tests__/compressionPassB.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPassB } from '../compressionPassB';
import { makeInitialState } from '../memoryStateTypes';

const fetchMock = vi.fn();

describe('runPassB', () => {
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  function mock(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('解析 affinityDelta + stage', async () => {
    mock({
      affinityDelta: 5,
      stageChange: '密友',
      addressChange: '小明',
      boundaryAdds: [{ topic: '前任', reason: 'X', severity: 'hard' }],
      boundaryRemoves: [],
    });
    const state = makeInitialState('char-1');
    const r = await runPassB({
      state, messages: [],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    expect(r.affinityDelta).toBe(5);
    expect(r.stageChange).toBe('密友');
    expect(r.boundaryAdds).toHaveLength(1);
  });

  it('缺字段时填默认', async () => {
    mock({ affinityDelta: 0 });
    const state = makeInitialState('char-1');
    const r = await runPassB({
      state, messages: [],
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
    });
    expect(r.boundaryAdds).toEqual([]);
    expect(r.boundaryRemoves).toEqual([]);
    expect(r.stageChange).toBeUndefined();
  });

  it('HTTP 错误抛错', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'x' });
    await expect(
      runPassB({
        state: makeInitialState('c'), messages: [],
        endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
      }),
    ).rejects.toThrow(/Pass B/);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPassB.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 Pass B**

```ts
// src/platform/ai/compressionPassB.ts
/**
 * Compression Pass B — relationship update.
 *
 * Reads the current relationship state and the new message batch; outputs
 * a delta on affinity / stage / 称呼 / boundaries. Stage and address
 * changes only fire on explicit conversational signal; affinity moves
 * are bounded per round.
 */

import type { CharacterMemoryStateRecord, Boundary } from './memoryStateTypes';
import type { PassBResult } from './memoryStateMutations';
import type { PassMessage, PassACommonInput } from './compressionPassA';

export interface PassBInput extends PassACommonInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
}

function buildPrompt(input: PassBInput): { system: string; user: string } {
  const r = input.state.relationship;
  const system = `你是一个关系模型更新模块。读这一批对话，判断"我"（本角色）和用户的关系发生了什么变化。

【当前关系状态】
- 阶段：${r.stage}
- 称呼用户：${r.addressToUser}
- 已有边界：${r.boundaries.map((b) => `${b.topic}(${b.severity})`).join('，') || '无'}

【更新约束】
- affinityDelta: 这一批对话的整体情感强度，整数，[-20, 20] 之间。日常对话 ±0~5；明显感情爆发或冷战才到 ±10+。
- stageChange: 仅在明确对话信号下设置（如"我们在一起吧"才能从"朋友"→"恋人"；"我们分手"才能反向）。否则不要返回这个字段。
- addressChange: 仅在明确称呼变化下设置。否则不返回。
- boundaryAdds: 用户明确表达"不想聊 X"才加。
- boundaryRemoves: 按 topic 字符串移除已存在的 boundary。
- 游戏 / roleplay 里的情感不计入真实关系。

【输出格式：严格 JSON】
{
  "affinityDelta": 数字,
  "stageChange"?: "字符串",
  "addressChange"?: "字符串",
  "boundaryAdds": [{"topic": "...", "reason": "...", "severity": "soft"|"hard"}],
  "boundaryRemoves": ["topic1", "topic2"]
}`;

  const user = input.messages
    .map((m) => `[${new Date(m.createdAt).toISOString()}] ${m.speaker}: ${m.content}`)
    .join('\n');

  return { system, user };
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const cb = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (cb) { try { return JSON.parse(cb[1]!); } catch {} }
  const br = text.match(/\{[\s\S]+\}/);
  if (br) { try { return JSON.parse(br[0]); } catch {} }
  throw new Error('No valid JSON');
}

function validatePassB(raw: unknown): PassBResult {
  if (!raw || typeof raw !== 'object') throw new Error('not object');
  const r = raw as Record<string, unknown>;
  return {
    affinityDelta: typeof r.affinityDelta === 'number' ? r.affinityDelta : 0,
    stageChange: typeof r.stageChange === 'string' && r.stageChange ? r.stageChange : undefined,
    addressChange: typeof r.addressChange === 'string' && r.addressChange ? r.addressChange : undefined,
    boundaryAdds: Array.isArray(r.boundaryAdds) ? (r.boundaryAdds as Boundary[]) : [],
    boundaryRemoves: Array.isArray(r.boundaryRemoves) ? (r.boundaryRemoves as string[]) : [],
  };
}

export async function runPassB(input: PassBInput): Promise<PassBResult> {
  const { system, user } = buildPrompt(input);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  if (input.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }
  const res = await fetch(`${input.endpoint}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: input.maxTokens,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pass B HTTP ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    return validatePassB(tryParseJson(content));
  } catch (e) {
    throw new Error(`Pass B parse failed: ${(e as Error).message} — raw: ${content.slice(0, 200)}`);
  }
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPassB.test.ts`
Expected: 3 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/compressionPassB.ts src/platform/ai/__tests__/compressionPassB.test.ts
git commit -m "feat(memory): compression Pass B — relationship update"
```

---

## Task 9: Pass C — 情节摘要 + Highlights

**Files:**
- Create: `src/platform/ai/compressionPassC.ts`
- Test: `src/platform/ai/__tests__/compressionPassC.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/platform/ai/__tests__/compressionPassC.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runPassC } from '../compressionPassC';
import { makeInitialState } from '../memoryStateTypes';

const fetchMock = vi.fn();

describe('runPassC', () => {
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock); });
  afterEach(() => vi.unstubAllGlobals());

  function mock(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('解析 summary + highlights', async () => {
    mock({
      summary: '我们今天聊了换工作的事...',
      highlights: [
        { content: '她说她紧张', categories: ['striking'], weight: 0.8, at: 1000 },
      ],
    });
    const state = makeInitialState('char-1');
    const r = await runPassC({
      state, messages: [],
      characterName: '小美', userName: '小明',
      contextWindow: 32000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    expect(r.summary).toContain('换工作');
    expect(r.highlights).toHaveLength(1);
    expect(r.highlights[0]!.weight).toBe(0.8);
  });

  it('previousSummary 注入 prompt', async () => {
    mock({ summary: '', highlights: [] });
    const state = makeInitialState('char-1');
    state.episodicSummary = { content: '上次记忆', version: 1, coveringUpTo: 100, lastUpdatedAt: 200 };
    await runPassC({
      state, messages: [],
      characterName: '小美', userName: '小明', contextWindow: 32000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === 'user').content;
    expect(userMsg).toContain('上次记忆');
  });

  it('字数约束按 contextWindow * 0.3', async () => {
    mock({ summary: '', highlights: [] });
    await runPassC({
      state: makeInitialState('char-1'), messages: [],
      characterName: '小美', userName: '小明', contextWindow: 10000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    const sysMsg = body.messages.find((m: { role: string }) => m.role === 'system').content;
    expect(sysMsg).toContain('3000'); // 10000 * 0.3
  });

  it('weight 越界自动 clamp', async () => {
    mock({
      summary: '',
      highlights: [
        { content: 'x', categories: ['striking'], weight: 1.5, at: 1 },
        { content: 'y', categories: ['striking'], weight: -0.3, at: 1 },
      ],
    });
    const r = await runPassC({
      state: makeInitialState('char-1'), messages: [],
      characterName: '小美', userName: '小明', contextWindow: 32000,
      endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 1000,
    });
    expect(r.highlights[0]!.weight).toBe(1);
    expect(r.highlights[1]!.weight).toBe(0);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPassC.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 Pass C**

```ts
// src/platform/ai/compressionPassC.ts
/**
 * Compression Pass C — narrative refinement.
 *
 * Produces (1) the next version of the rolling first-person episodic
 * summary (with a "最近基调" segment) and (2) up to 3 highlights worth
 * preserving long-term.
 */

import type {
  CharacterMemoryStateRecord,
  HighlightCategory,
} from './memoryStateTypes';
import type { PassCResult } from './memoryStateMutations';
import type { PassMessage, PassACommonInput } from './compressionPassA';

export interface PassCInput extends PassACommonInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
  characterName: string;
  userName: string;
  contextWindow: number;
}

const VALID_CATEGORIES: HighlightCategory[] = [
  'striking', 'surprise', 'positive', 'turning_point',
];

function buildPrompt(input: PassCInput): { system: string; user: string } {
  const charLimit = Math.round(input.contextWindow * 0.3);
  const previousSummary = input.state.episodicSummary?.content ?? '';

  const system = `你是${input.characterName}的"叙事记忆"模块。任务是：把这批新对话整合进我（${input.characterName}）的长期回忆，并从中挑出"值得记一辈子"的瞬间。

【输出格式：严格 JSON】
{
  "summary": "字符串。第一人称（'我'指${input.characterName}）。结构两段：第一段写整体叙事，第二段以'[最近基调]'开头描述近期${input.userName}的状态/我对他的感受。",
  "highlights": [
    {"content": "...", "categories": ["striking|surprise|positive|turning_point"], "weight": 0~1, "at": 时间戳}
  ]
}

【summary 规则】
- 第一人称视角，"我"指${input.characterName}
- 必须整合 previousSummary（如果有）和新对话；老的细节可以糊化但不能丢
- 字数 ≤ ${charLimit}（含[最近基调]段）
- 不要编造未发生的事

【highlights 规则】
- 最多 3 条（少于 3 条也可以，没有就空数组）
- categories: striking=情感张力高 / surprise=没预期到 / positive=正反馈 / turning_point=关系转折
- weight: 0~1，1=绝不能忘；< 0.3 就别记
- at: 对应最相关消息的时间戳`;

  const userParts: string[] = [];
  if (previousSummary) {
    userParts.push(`[之前的记忆]\n${previousSummary}\n\n[新的对话]`);
  } else {
    userParts.push('[对话内容]');
  }
  userParts.push(
    input.messages
      .map((m) => `[${new Date(m.createdAt).toISOString()}] ${m.speaker}: ${m.content}`)
      .join('\n'),
  );
  return { system, user: userParts.join('\n') };
}

function tryParseJson(text: string): unknown {
  try { return JSON.parse(text); } catch {}
  const cb = text.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (cb) { try { return JSON.parse(cb[1]!); } catch {} }
  const br = text.match(/\{[\s\S]+\}/);
  if (br) { try { return JSON.parse(br[0]); } catch {} }
  throw new Error('No valid JSON');
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function validatePassC(raw: unknown): PassCResult {
  if (!raw || typeof raw !== 'object') throw new Error('not object');
  const r = raw as Record<string, unknown>;
  const summary = typeof r.summary === 'string' ? r.summary : '';
  const rawHl = Array.isArray(r.highlights) ? r.highlights : [];
  const highlights = rawHl
    .filter((h): h is Record<string, unknown> => !!h && typeof h === 'object')
    .map((h) => {
      const cats = Array.isArray(h.categories)
        ? (h.categories as string[]).filter((c): c is HighlightCategory =>
            VALID_CATEGORIES.includes(c as HighlightCategory))
        : [];
      return {
        content: typeof h.content === 'string' ? h.content : '',
        categories: cats.length ? cats : (['striking'] as HighlightCategory[]),
        weight: typeof h.weight === 'number' ? clamp(h.weight, 0, 1) : 0.5,
        at: typeof h.at === 'number' ? h.at : Date.now(),
      };
    })
    .filter((h) => h.content);
  return { summary, highlights };
}

export async function runPassC(input: PassCInput): Promise<PassCResult> {
  const { system, user } = buildPrompt(input);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${input.apiKey}`,
  };
  if (input.providerId === 'openrouter') {
    headers['HTTP-Referer'] = 'https://hiphone.app';
    headers['X-Title'] = 'hiPhone';
  }
  const res = await fetch(`${input.endpoint}/chat/completions`, {
    method: 'POST', headers,
    body: JSON.stringify({
      model: input.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      max_tokens: input.maxTokens,
      temperature: 0.4,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Pass C HTTP ${res.status}: ${body}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? '';
  try {
    return validatePassC(tryParseJson(content));
  } catch (e) {
    throw new Error(`Pass C parse failed: ${(e as Error).message} — raw: ${content.slice(0, 200)}`);
  }
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPassC.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/compressionPassC.ts src/platform/ai/__tests__/compressionPassC.test.ts
git commit -m "feat(memory): compression Pass C — narrative + highlights"
```

---

## Task 10: 压缩 pipeline（编排）

**Files:**
- Create: `src/platform/ai/compressionPipeline.ts`
- Test: `src/platform/ai/__tests__/compressionPipeline.test.ts`

- [ ] **Step 1: 写测试**

```ts
// src/platform/ai/__tests__/compressionPipeline.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCompressionPipeline } from '../compressionPipeline';
import * as passA from '../compressionPassA';
import * as passB from '../compressionPassB';
import * as passC from '../compressionPassC';
import { makeInitialState } from '../memoryStateTypes';

describe('runCompressionPipeline', () => {
  let aSpy: ReturnType<typeof vi.spyOn>;
  let bSpy: ReturnType<typeof vi.spyOn>;
  let cSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    aSpy = vi.spyOn(passA, 'runPassA');
    bSpy = vi.spyOn(passB, 'runPassB');
    cSpy = vi.spyOn(passC, 'runPassC');
  });
  afterEach(() => { aSpy.mockRestore(); bSpy.mockRestore(); cSpy.mockRestore(); });

  const baseInput = {
    state: makeInitialState('char-1'),
    messages: [{ role: 'user' as const, speaker: 'me', content: 'hi', createdAt: 1000 }],
    peers: [],
    characterName: 'A', userName: 'B',
    contextWindow: 32000,
    endpoint: 'x', apiKey: 'x', model: 'x', providerId: 'openai', maxTokens: 100,
  };

  it('全部成功 → 三个 pass 并发跑，state 被 patch', async () => {
    aSpy.mockResolvedValue({ factAdds: [{ content: 'f', subject: 'user', at: 1 }],
      factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockResolvedValue({ affinityDelta: 5, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockResolvedValue({ summary: 's', highlights: [] });
    const out = await runCompressionPipeline(baseInput);
    expect(out.factChains).toHaveLength(1);
    expect(out.relationship.affinity).toBe(55);
    expect(out.episodicSummary?.content).toBe('s');
    expect(aSpy).toHaveBeenCalledOnce();
    expect(bSpy).toHaveBeenCalledOnce();
    expect(cSpy).toHaveBeenCalledOnce();
  });

  it('Pass A 失败 → 整体抛错，state 不变', async () => {
    aSpy.mockRejectedValue(new Error('A failed'));
    bSpy.mockResolvedValue({ affinityDelta: 5, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockResolvedValue({ summary: 's', highlights: [] });
    await expect(runCompressionPipeline(baseInput)).rejects.toThrow(/A failed/);
  });

  it('Pass B 失败 → 整体抛错', async () => {
    aSpy.mockResolvedValue({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockRejectedValue(new Error('B failed'));
    cSpy.mockResolvedValue({ summary: 's', highlights: [] });
    await expect(runCompressionPipeline(baseInput)).rejects.toThrow(/B failed/);
  });

  it('Pass C 失败 → 整体抛错', async () => {
    aSpy.mockResolvedValue({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockResolvedValue({ affinityDelta: 0, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockRejectedValue(new Error('C failed'));
    await expect(runCompressionPipeline(baseInput)).rejects.toThrow(/C failed/);
  });

  it('coveringUpTo 取 messages 最后一条 createdAt', async () => {
    aSpy.mockResolvedValue({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    bSpy.mockResolvedValue({ affinityDelta: 0, boundaryAdds: [], boundaryRemoves: [] });
    cSpy.mockResolvedValue({ summary: '', highlights: [] });
    const out = await runCompressionPipeline({
      ...baseInput,
      messages: [
        { role: 'user', speaker: 'a', content: 'x', createdAt: 100 },
        { role: 'assistant', speaker: 'b', content: 'y', createdAt: 200 },
      ],
    });
    expect(out.episodicSummary?.coveringUpTo).toBe(200);
    expect(out.lastCompressedAt).toBe(200);
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPipeline.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现 pipeline**

```ts
// src/platform/ai/compressionPipeline.ts
/**
 * Compression pipeline — orchestrates Pass A/B/C in parallel and applies
 * all three results to a CharacterMemoryStateRecord transactionally.
 *
 * Failure semantics: if ANY pass fails, the whole pipeline rejects and
 * the input state is not mutated. The caller is responsible for keeping
 * the corresponding entries unmarked so the next trigger retries.
 */

import { runPassA, type PassMessage, type PassPeer } from './compressionPassA';
import { runPassB } from './compressionPassB';
import { runPassC } from './compressionPassC';
import {
  applyPassAResult,
  applyPassBResult,
  applyPassCResult,
} from './memoryStateMutations';
import type { CharacterMemoryStateRecord } from './memoryStateTypes';

export interface CompressionPipelineInput {
  state: CharacterMemoryStateRecord;
  messages: PassMessage[];
  peers: PassPeer[];
  characterName: string;
  userName: string;
  contextWindow: number;
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  maxTokens: number;
}

export async function runCompressionPipeline(
  input: CompressionPipelineInput,
): Promise<CharacterMemoryStateRecord> {
  const common = {
    endpoint: input.endpoint,
    apiKey: input.apiKey,
    model: input.model,
    providerId: input.providerId,
    maxTokens: input.maxTokens,
  };

  const [a, b, c] = await Promise.all([
    runPassA({ state: input.state, messages: input.messages, peers: input.peers, ...common }),
    runPassB({ state: input.state, messages: input.messages, ...common }),
    runPassC({
      state: input.state,
      messages: input.messages,
      characterName: input.characterName,
      userName: input.userName,
      contextWindow: input.contextWindow,
      ...common,
    }),
  ]);

  const coveringUpTo = input.messages.length
    ? input.messages[input.messages.length - 1]!.createdAt
    : Date.now();

  let next = applyPassAResult(input.state, a);
  next = applyPassBResult(next, b);
  next = applyPassCResult(next, c, coveringUpTo);
  return next;
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/compressionPipeline.test.ts`
Expected: 5 tests pass

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/compressionPipeline.ts src/platform/ai/__tests__/compressionPipeline.test.ts
git commit -m "feat(memory): orchestrate 3-pass compression pipeline"
```

---

## Task 11: 替换 characterMemoryCompression 主流程

**Files:**
- Modify: `src/platform/ai/characterMemoryCompression.ts`
- Modify: `src/platform/ai/__tests__/characterMemoryCompression.test.ts`

- [ ] **Step 1: 阅读现有测试，理解期望行为**

Run: `cat src/platform/ai/__tests__/characterMemoryCompression.test.ts`

记录现有测试断言的行为（写 system entry 到流），需要在 step 3 中改写。

- [ ] **Step 2: 改写 characterMemoryCompression.ts 用新 pipeline**

```ts
// src/platform/ai/characterMemoryCompression.ts
/**
 * Character-level memory compression trigger + orchestration.
 *
 * Triggered automatically after every memoryStore append (post-hook) and
 * manually via runCompressionIfNeeded(). Runs the 3-pass pipeline,
 * writes back state via memoryStateStore, and marks consumed entries
 * compressed=true (no longer injected, but kept in IDB).
 *
 * See docs/superpowers/specs/2026-04-25-character-memory-redesign-design.md
 */

import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { usePersonaStore } from '@/platform/stores/personaStore';
import { getAdapter } from './providers';
import { estimateTokens } from './tokenEstimator';
import {
  useCharacterMemory,
  setPostAppendHook,
  type MemoryEntry,
} from './characterMemoryStore';
import { useMemoryState } from './memoryStateStore';
import { runCompressionPipeline } from './compressionPipeline';
import type { PassMessage, PassPeer } from './compressionPassA';

const ROLE_OVERHEAD = 6;
const inFlight = new Map<string, Promise<void>>();

export function runCompressionIfNeeded(characterId: string): Promise<void> {
  const existing = inFlight.get(characterId);
  if (existing) return existing;

  const p = doCompression(characterId)
    .catch((e) => {
      console.warn(`[compression] ${characterId} failed:`, e);
    })
    .finally(() => {
      if (inFlight.get(characterId) === p) inFlight.delete(characterId);
    });
  inFlight.set(characterId, p);
  return p;
}

/** Run compression now regardless of token-ratio threshold (manual trigger). */
export function runCompressionForce(characterId: string): Promise<void> {
  const existing = inFlight.get(characterId);
  if (existing) return existing;

  const p = doCompression(characterId, { force: true })
    .catch((e) => { console.warn(`[compression] ${characterId} failed:`, e); })
    .finally(() => { if (inFlight.get(characterId) === p) inFlight.delete(characterId); });
  inFlight.set(characterId, p);
  return p;
}

function entryToMessage(e: MemoryEntry, charactersById: Map<string, { id: string; name: string }>, personaName: string): PassMessage {
  const speaker = e.role === 'assistant'
    ? charactersById.get(e.characterId)?.name ?? '我'
    : e.speakerId === 'me'
      ? personaName
      : charactersById.get(e.speakerId)?.name ?? e.speakerId;
  return {
    role: e.role,
    speaker,
    content: e.content,
    createdAt: e.createdAt,
    entryId: e.id,
  };
}

async function doCompression(
  characterId: string,
  options: { force?: boolean } = {},
): Promise<void> {
  const entries = useCharacterMemory.getState().getAll(characterId);
  if (entries.length === 0) return;

  const aiConfig = useAIConfigStore.getState();
  if (!aiConfig.apiKey) return;
  const adapter = getAdapter(aiConfig.provider);
  if (!adapter) return;

  const liveEntries = entries.filter((e) => !e.compressed);
  if (liveEntries.length === 0) return;

  if (!options.force) {
    const threshold = aiConfig.summarizeThreshold ?? 0;
    if (threshold <= 0) return;
    const tokens = liveEntries.reduce(
      (sum, e) => sum + estimateTokens(e.content) + ROLE_OVERHEAD, 0);
    const budget = aiConfig.contextWindow * threshold;
    if (tokens <= budget) return;
  }

  const keepRecent = aiConfig.keepRecentMessages ?? 0;
  const sliceEnd = liveEntries.length - keepRecent;
  if (sliceEnd <= 0) return;
  const slice = liveEntries.slice(0, sliceEnd);
  if (slice.length === 0) return;

  const characters = useCharacterStore.getState().characters;
  const charactersById = new Map(characters.map((c) => [c.id, { id: c.id, name: c.name }]));
  const character = charactersById.get(characterId);
  const persona = usePersonaStore.getState().getActivePersona();
  const personaName = persona?.name ?? '用户';

  const messages: PassMessage[] = slice.map((e) => entryToMessage(e, charactersById, personaName));

  // Peers: 已知的其他角色（不包括自己）
  const peers: PassPeer[] = characters
    .filter((c) => c.id !== characterId)
    .map((c) => ({ id: c.id, name: c.name }));

  const currentState = useMemoryState
    .getState()
    .getOrInit(characterId, personaName);

  const nextState = await runCompressionPipeline({
    state: currentState,
    messages,
    peers,
    characterName: character?.name ?? '角色',
    userName: personaName,
    contextWindow: aiConfig.contextWindow,
    endpoint: aiConfig.apiEndpoint || adapter.defaultEndpoint,
    apiKey: aiConfig.apiKey,
    model: aiConfig.model,
    providerId: aiConfig.provider,
    maxTokens: aiConfig.maxTokens,
  });

  // Transactional commit: write state, then mark slice entries compressed.
  // memoryState 的 IDB 同步是订阅式异步；entries 的 compressed 标记
  // 也走 store.set 的订阅式 IDB 同步。两者最终一致。
  useMemoryState.getState().set(characterId, nextState);

  // Mark consumed entries compressed=true（保留在 IDB，仅不再注入 prompt）
  const consumedIds = new Set(slice.map((e) => e.id));
  useCharacterMemory.setState((s) => ({
    entries: {
      ...s.entries,
      [characterId]: (s.entries[characterId] ?? []).map((e) =>
        consumedIds.has(e.id) ? { ...e, compressed: true } : e,
      ),
    },
  }));
}

export function installAutoCompression(): void {
  setPostAppendHook((charId) => {
    void runCompressionIfNeeded(charId);
  });
}
```

- [ ] **Step 3: 改写 characterMemoryCompression.test.ts**

```ts
// src/platform/ai/__tests__/characterMemoryCompression.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { runCompressionIfNeeded, runCompressionForce } from '../characterMemoryCompression';
import { useCharacterMemory, _resetCharacterMemoryForTests } from '../characterMemoryStore';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';
import * as pipeline from '../compressionPipeline';
import { makeInitialState } from '../memoryStateTypes';

describe('characterMemoryCompression', () => {
  let pipelineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    await _resetCharacterMemoryForTests();
    await _resetMemoryStateForTests();
    useAIConfigStore.setState({
      apiKey: 'sk-test',
      apiEndpoint: 'https://x',
      model: 'gpt-4',
      provider: 'openai',
      contextWindow: 1000,
      summarizeThreshold: 0.5,
      maxTokens: 500,
      keepRecentMessages: 0,
    } as never);
    useCharacterStore.setState({
      characters: [{ id: 'char-1', name: '小美' } as never],
    } as never);
    pipelineSpy = vi.spyOn(pipeline, 'runCompressionPipeline');
  });
  afterEach(() => pipelineSpy.mockRestore());

  function pushMessages(count: number): void {
    const big = 'x'.repeat(500); // ~每条 500 token
    for (let i = 0; i < count; i++) {
      useCharacterMemory.getState().append('char-1', {
        role: 'user', speakerId: 'me', content: big, source: 'xingyu',
      });
    }
  }

  it('未超阈值不触发', async () => {
    pushMessages(1);
    await runCompressionIfNeeded('char-1');
    expect(pipelineSpy).not.toHaveBeenCalled();
  });

  it('超阈值触发，state 写入', async () => {
    pipelineSpy.mockImplementation(async () => {
      const s = makeInitialState('char-1');
      s.episodicSummary = { content: 'mock', version: 1, coveringUpTo: 1, lastUpdatedAt: 1 };
      return s;
    });
    pushMessages(5);
    await runCompressionIfNeeded('char-1');
    expect(pipelineSpy).toHaveBeenCalledOnce();
    expect(useMemoryState.getState().get('char-1')?.episodicSummary?.content).toBe('mock');
  });

  it('成功后旧 entries 被标 compressed', async () => {
    pipelineSpy.mockImplementation(async () => makeInitialState('char-1'));
    pushMessages(5);
    await runCompressionIfNeeded('char-1');
    const all = useCharacterMemory.getState().getAll('char-1');
    expect(all.every((e) => e.compressed)).toBe(true);
  });

  it('pipeline 失败 → entries 保持未压', async () => {
    pipelineSpy.mockRejectedValue(new Error('boom'));
    pushMessages(5);
    await runCompressionIfNeeded('char-1');
    const all = useCharacterMemory.getState().getAll('char-1');
    expect(all.every((e) => !e.compressed)).toBe(true);
  });

  it('runCompressionForce 即使未超阈值也跑', async () => {
    pipelineSpy.mockImplementation(async () => makeInitialState('char-1'));
    pushMessages(1);
    await runCompressionForce('char-1');
    expect(pipelineSpy).toHaveBeenCalledOnce();
  });

  it('in-flight dedup', async () => {
    let resolve: (v: never) => void = null!;
    pipelineSpy.mockImplementation(() => new Promise((r) => { resolve = r as never; }));
    pushMessages(5);
    const a = runCompressionIfNeeded('char-1');
    const b = runCompressionIfNeeded('char-1');
    expect(a).toBe(b);
    resolve(makeInitialState('char-1') as never);
    await a;
  });
});
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/characterMemoryCompression.test.ts`
Expected: 6 tests pass

如果 type 错误，确认 mock 用 `as never` 或精确字段。

- [ ] **Step 5: 提交**

```bash
git add src/platform/ai/characterMemoryCompression.ts src/platform/ai/__tests__/characterMemoryCompression.test.ts
git commit -m "refactor(memory): replace single-blob summarizer with 3-pass pipeline"
```

---

## Task 12: 接入 promptAssembly 渲染

**Files:**
- Modify: `src/platform/ai/promptAssembly.ts`
- Modify: `src/platform/ai/__tests__/renderMemoryToTranscript.test.ts`

- [ ] **Step 1: 找到 `renderMemoryToTranscript` 当前如何处理 `[长期记忆]`**

Run: `grep -n "longTermMemory\|compressed\|长期记忆\|renderMemoryStateBlock" src/platform/ai/promptAssembly.ts`

确认 `longTermMemory` 来源（找的是 `compressed:true` entry）。

- [ ] **Step 2: 改写 `renderMemoryToTranscript`**

主要改动：
- `longTermMemory` 不再来自最后一个 `compressed:true` entry，而是来自 `episodicSummary.content`
- 新增 system 尾部块 `stateTailBlock`，调 `renderMemoryStateBlock`
- `live` 过滤逻辑不变（仍是 `!compressed`）

```ts
// 在 promptAssembly.ts 顶部新增 imports
import { renderMemoryStateBlock, type RenderContext } from './memoryStateRender';
import { useMemoryState } from './memoryStateStore';
```

修改 `TranscriptRenderResult` interface（在文件中找到该 interface，约在第 152-159 行）：

```ts
export interface TranscriptRenderResult {
  /** system #2 内容；含 `[长期记忆]\n...` 前缀。无 episodicSummary 时为 null。 */
  longTermMemory: string | null;
  /** system #N 内容；状态层（关系/事实/loops/highlights）+ disclaimer。 */
  stateTailBlock: string | null;
  /** system #3 内容；含 `[历史记录]\n` 首行 + N 行 entry。无活 entry 时为 null。 */
  transcriptBlock: string | null;
  /** 最后一条活 entry 是 role=user 时非 null。 */
  userTurn: ChatMessage | null;
}
```

修改 `renderMemoryToTranscript` 实现（在 `MemoryRenderContext` 上加可选 `characterId`，方便取 state）：

```ts
export interface MemoryRenderContext {
  currentCharId: string;
  charactersById: Map<string, { id: string; name: string }>;
  personaName: string;
  /** 用于 private fact 过滤；缺省视为 normal 私聊场景 */
  renderContext?: RenderContext;
}
```

在 `renderMemoryToTranscript` 函数内部，把"最后一个 compressed entry"那段（约 197-199 行）替换为读 state：

```ts
export function renderMemoryToTranscript(
  entries: readonly MemoryEntry[],
  ctx: MemoryRenderContext,
): TranscriptRenderResult {
  const memState = useMemoryState.getState().get(ctx.currentCharId) ?? null;

  const longTermMemory = memState?.episodicSummary
    ? `[长期记忆]\n${memState.episodicSummary.content}`
    : null;

  const stateTailBlock = renderMemoryStateBlock(memState, {
    context: ctx.renderContext ?? 'normal',
  }) || null;

  const live = entries.filter((e) => !e.compressed);
  if (live.length === 0) {
    return { longTermMemory, stateTailBlock, transcriptBlock: null, userTurn: null };
  }

  // ... 原有 transcript 渲染逻辑不变 ...
  // 末尾返回处补上 stateTailBlock
}
```

具体改动需要保留原文件的其他逻辑，只替换 `longTermMemory` 来源 + 新增 `stateTailBlock` 字段 + 在所有 return 点带上它。

- [ ] **Step 3: 找到 prompt 拼接处，把 stateTailBlock 拼进 system 块**

Run: `grep -n "longTermMemory\|transcriptBlock" src/platform/ai/promptAssembly.ts`

找到 `assemblePrompt`（或类似）使用这些字段的位置。在那里把 `stateTailBlock` 拼到 system 提示词的末尾（disclaimer 前面或后面，按 spec 设计放在所有 system 内容之后）。

具体形式取决于现有 system block 结构；保留 KV-cache 友好顺序：persona → worldbook → stateTailBlock → 每次一致的提示。

- [ ] **Step 4: 改写测试**

```ts
// src/platform/ai/__tests__/renderMemoryToTranscript.test.ts
// （加测试，不替换原有，原有 long-term 逻辑替换为读 state）
import { describe, it, expect, beforeEach } from 'vitest';
import { renderMemoryToTranscript } from '../promptAssembly';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';
import { makeInitialState } from '../memoryStateTypes';

describe('renderMemoryToTranscript — state-driven long-term memory', () => {
  beforeEach(async () => { await _resetMemoryStateForTests(); });

  it('episodicSummary 不存在 → longTermMemory=null', () => {
    const r = renderMemoryToTranscript([], {
      currentCharId: 'char-1', charactersById: new Map(), personaName: 'me',
    });
    expect(r.longTermMemory).toBeNull();
  });

  it('episodicSummary 存在 → longTermMemory 含[长期记忆]前缀', () => {
    const s = makeInitialState('char-1');
    s.episodicSummary = { content: '我们玩得很开心', version: 1, coveringUpTo: 1, lastUpdatedAt: 1 };
    useMemoryState.getState().set('char-1', s);
    const r = renderMemoryToTranscript([], {
      currentCharId: 'char-1', charactersById: new Map(), personaName: 'me',
    });
    expect(r.longTermMemory).toContain('[长期记忆]');
    expect(r.longTermMemory).toContain('我们玩得很开心');
  });

  it('stateTailBlock 在 state 非空时返回非 null', () => {
    const s = makeInitialState('char-1');
    s.relationship.lastUpdatedAt = Date.now();
    useMemoryState.getState().set('char-1', s);
    const r = renderMemoryToTranscript([], {
      currentCharId: 'char-1', charactersById: new Map(), personaName: 'me',
    });
    expect(r.stateTailBlock).toContain('[当前关系]');
  });
});
```

- [ ] **Step 5: 跑相关测试**

Run: `pnpm vitest run src/platform/ai/__tests__/renderMemoryToTranscript.test.ts src/platform/ai/__tests__/promptAssembly.chunks.test.ts`
Expected: pass（如有原测试因 `compressed` 写入流引发的断言，需要更新预期）

- [ ] **Step 6: 提交**

```bash
git add src/platform/ai/promptAssembly.ts src/platform/ai/__tests__/renderMemoryToTranscript.test.ts
git commit -m "feat(memory): inject state tail + state-driven long-term memory in promptAssembly"
```

---

## Task 13: 应用启动初始化

**Files:**
- Modify: 调用入口（`src/main.tsx` 或 platform init 处；先定位）

- [ ] **Step 1: 找当前 memoryStore 初始化位置**

Run: `grep -rn "loadCharacterMemoryFromIdb\|installAutoCompression\|startCharacterMemoryIdbSync" src/ | head -10`

定位现有 init 顺序（main.tsx 或类似）。

- [ ] **Step 2: 在同一位置追加 memoryState 初始化**

```ts
// 在已有
//   await loadCharacterMemoryFromIdb();
//   startCharacterMemoryIdbSync();
//   installAutoCompression();
// 之后追加：
import { loadMemoryStateFromIdb, startMemoryStateIdbSync } from '@/platform/ai/memoryStateStore';
// ...
await loadMemoryStateFromIdb();
startMemoryStateIdbSync();
```

- [ ] **Step 3: 跑一次完整测试套件确认无回归**

Run: `pnpm vitest run`
Expected: 全部 pass

- [ ] **Step 4: 提交**

```bash
git add src/  # 调整为实际改动文件
git commit -m "feat(memory): wire memoryState load/sync into app init"
```

---

## Task 14: 旧数据迁移（[长期记忆] system entry → episodicSummary）

**Files:**
- Create: `src/platform/ai/memoryStateMigration.ts`
- Test: `src/platform/ai/__tests__/memoryStateMigration.test.ts`
- Modify: 在初始化处调用迁移

- [ ] **Step 1: 写测试**

```ts
// src/platform/ai/__tests__/memoryStateMigration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { migrateLegacyLongTermMemory } from '../memoryStateMigration';
import {
  useCharacterMemory,
  _resetCharacterMemoryForTests,
} from '../characterMemoryStore';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';

describe('migrateLegacyLongTermMemory', () => {
  beforeEach(async () => {
    await _resetCharacterMemoryForTests();
    await _resetMemoryStateForTests();
  });

  it('遇到 compressed=true 的 system entry → 迁移到 state.episodicSummary 并删除', async () => {
    useCharacterMemory.setState({
      entries: {
        'char-1': [
          {
            id: 'legacy-1', characterId: 'char-1', role: 'system',
            speakerId: 'system', content: '[长期记忆]\n旧的记忆',
            source: 'system', createdAt: 100, compressed: true,
          },
          {
            id: 'live-1', characterId: 'char-1', role: 'user',
            speakerId: 'me', content: 'hi', source: 'xingyu', createdAt: 200,
          },
        ],
      },
    });

    await migrateLegacyLongTermMemory();

    const state = useMemoryState.getState().get('char-1');
    expect(state?.episodicSummary?.content).toContain('旧的记忆');

    const remaining = useCharacterMemory.getState().getAll('char-1');
    expect(remaining.find((e) => e.id === 'legacy-1')).toBeUndefined();
    expect(remaining.find((e) => e.id === 'live-1')).toBeDefined();
  });

  it('已有 episodicSummary 不覆盖', async () => {
    useCharacterMemory.setState({
      entries: {
        'char-1': [{
          id: 'legacy-1', characterId: 'char-1', role: 'system',
          speakerId: 'system', content: '[长期记忆]\n旧的',
          source: 'system', createdAt: 100, compressed: true,
        }],
      },
    });
    useMemoryState.getState().set('char-1', {
      ...useMemoryState.getState().getOrInit('char-1'),
      episodicSummary: { content: '新的', version: 1, coveringUpTo: 0, lastUpdatedAt: 0 },
    });

    await migrateLegacyLongTermMemory();

    expect(useMemoryState.getState().get('char-1')?.episodicSummary?.content).toBe('新的');
  });

  it('无 legacy entry 时是 no-op', async () => {
    await migrateLegacyLongTermMemory();
    expect(useMemoryState.getState().get('char-1')).toBeUndefined();
  });

  it('幂等：重复跑不重复迁移', async () => {
    useCharacterMemory.setState({
      entries: {
        'char-1': [{
          id: 'legacy-1', characterId: 'char-1', role: 'system',
          speakerId: 'system', content: '[长期记忆]\nX',
          source: 'system', createdAt: 100, compressed: true,
        }],
      },
    });
    await migrateLegacyLongTermMemory();
    await migrateLegacyLongTermMemory();
    expect(useMemoryState.getState().get('char-1')?.episodicSummary?.content).toContain('X');
  });
});
```

- [ ] **Step 2: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateMigration.test.ts`
Expected: FAIL

- [ ] **Step 3: 实现迁移**

```ts
// src/platform/ai/memoryStateMigration.ts
/**
 * One-time migration from M4.1's `[长期记忆]` system entry to M5's
 * structured episodicSummary in CharacterMemoryStateRecord.
 *
 * Runs at app init after loadCharacterMemoryFromIdb + loadMemoryStateFromIdb.
 * Idempotent: re-running with no legacy entries is a no-op; running with
 * existing episodicSummary leaves it untouched.
 */

import { useCharacterMemory, type MemoryEntry } from './characterMemoryStore';
import { useMemoryState } from './memoryStateStore';
import { makeInitialState } from './memoryStateTypes';

const LONG_TERM_PREFIX = '[长期记忆]\n';

function isLegacyLongTermEntry(e: MemoryEntry): boolean {
  return (
    e.role === 'system' &&
    e.compressed === true &&
    e.source === 'system' &&
    e.content.startsWith(LONG_TERM_PREFIX)
  );
}

export async function migrateLegacyLongTermMemory(): Promise<void> {
  const allEntries = useCharacterMemory.getState().entries;
  const charIds = Object.keys(allEntries);

  for (const charId of charIds) {
    const entries = allEntries[charId] ?? [];
    const legacy = entries.find(isLegacyLongTermEntry);
    if (!legacy) continue;

    const memState = useMemoryState.getState();
    const existing = memState.get(charId);
    if (!existing?.episodicSummary) {
      const summary = legacy.content.slice(LONG_TERM_PREFIX.length);
      const base = existing ?? makeInitialState(charId);
      memState.set(charId, {
        ...base,
        episodicSummary: {
          content: summary,
          version: 1,
          coveringUpTo: legacy.createdAt,
          lastUpdatedAt: legacy.createdAt,
        },
        lastCompressedAt: legacy.createdAt,
      });
    }

    // 删除 legacy entry（无论 episodicSummary 是否被覆盖；旧条目以后不再有用）
    useCharacterMemory.setState((s) => ({
      entries: {
        ...s.entries,
        [charId]: (s.entries[charId] ?? []).filter((e) => !isLegacyLongTermEntry(e)),
      },
    }));
  }
}
```

- [ ] **Step 4: 跑测试**

Run: `pnpm vitest run src/platform/ai/__tests__/memoryStateMigration.test.ts`
Expected: 4 tests pass

- [ ] **Step 5: 把迁移接入 init 流程**

修改 task 13 的 init 文件：

```ts
import { migrateLegacyLongTermMemory } from '@/platform/ai/memoryStateMigration';
// ...
await loadCharacterMemoryFromIdb();
await loadMemoryStateFromIdb();
await migrateLegacyLongTermMemory();   // <-- 在两个 load 之后跑一次
startCharacterMemoryIdbSync();
startMemoryStateIdbSync();
installAutoCompression();
```

- [ ] **Step 6: 提交**

```bash
git add src/platform/ai/memoryStateMigration.ts src/platform/ai/__tests__/memoryStateMigration.test.ts src/  # init 文件
git commit -m "feat(memory): migrate legacy [长期记忆] system entries to episodicSummary"
```

---

## Task 15: 删除旧 summarizer 调用路径 + 清理

**Files:**
- Modify: `src/platform/ai/summarizer.ts`（保留还是删？看是否还有调用方）
- Verify: 没有任何代码再调 `compressHistory` / 写 `role:'system' compressed:true` entry

- [ ] **Step 1: 找 `compressHistory` 的调用方**

Run: `grep -rn "compressHistory\|from.*summarizer" src/ --include="*.ts" --include="*.tsx" | grep -v "__tests__\|memoryStateMigration"`

应该只剩 summarizer.ts 自身导出和（可能）测试。

- [ ] **Step 2: 决定是否删除 summarizer.ts**

如果没有非测试的调用方：
```bash
git rm src/platform/ai/summarizer.ts src/platform/ai/__tests__/summarizer.test.ts
```

如果还有 user-app SDK 之类的对外暴露，则保留并加 deprecation 注释。

- [ ] **Step 3: 找 `replaceRange` 的调用方**

Run: `grep -rn "replaceRange" src/ --include="*.ts" --include="*.tsx"`

如果只剩 store 自身定义和测试，可以保留（API 仍可用），不必删除。

- [ ] **Step 4: 跑全套测试**

Run: `pnpm vitest run`
Expected: 全部 pass

- [ ] **Step 5: 提交**

```bash
git add -u  # 删除的文件 + 修改的文件
git commit -m "chore(memory): remove legacy summarizer path"
```

---

## Task 16: 端到端集成测试（mock LLM）

**Files:**
- Create: `src/platform/ai/__tests__/m5.compression.e2e.test.ts`

- [ ] **Step 1: 写 E2E**

```ts
// src/platform/ai/__tests__/m5.compression.e2e.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { runCompressionForce } from '../characterMemoryCompression';
import {
  useCharacterMemory, _resetCharacterMemoryForTests,
} from '../characterMemoryStore';
import { useMemoryState, _resetMemoryStateForTests } from '../memoryStateStore';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

describe('M5 端到端：原始消息 → state 各层', () => {
  const fetchMock = vi.fn();

  beforeEach(async () => {
    await _resetCharacterMemoryForTests();
    await _resetMemoryStateForTests();
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();

    useAIConfigStore.setState({
      apiKey: 'sk-test', apiEndpoint: 'https://test', model: 'gpt-4',
      provider: 'openai', contextWindow: 8000, summarizeThreshold: 0.8,
      maxTokens: 1000, keepRecentMessages: 0,
    } as never);
    useCharacterStore.setState({
      characters: [
        { id: 'char-1', name: '小美' },
        { id: 'char-2', name: '老周' },
      ] as never,
    } as never);
  });
  afterEach(() => vi.unstubAllGlobals());

  function mockChatJson(content: unknown) {
    fetchMock.mockResolvedValueOnce({
      ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(content) } }] }),
    });
  }

  it('Pass A/B/C 全部成功 → state 完整更新；entries 标 compressed', async () => {
    // 三个 LLM 响应（顺序无关，三个并发）
    mockChatJson({  // Pass A
      factAdds: [{ content: '用户在腾讯', subject: 'user', key: 'job', at: 1000 }],
      factAppends: [], loopsOpened: [{ topic: '看新狗', promisedBy: 'user' }],
      loopsClosed: [], jokeAdds: [],
    });
    mockChatJson({  // Pass B
      affinityDelta: 5, stageChange: '朋友',
      boundaryAdds: [], boundaryRemoves: [],
    });
    mockChatJson({  // Pass C
      summary: '我们今天聊了工作和小狗',
      highlights: [{ content: '她有点害羞', categories: ['striking'], weight: 0.7, at: 1000 }],
    });

    // 推 3 条消息
    useCharacterMemory.getState().append('char-1', {
      role: 'user', speakerId: 'me', content: '我在腾讯', source: 'xingyu',
    });
    useCharacterMemory.getState().append('char-1', {
      role: 'assistant', speakerId: 'char-1', content: '哦哦', source: 'xingyu',
    });
    useCharacterMemory.getState().append('char-1', {
      role: 'user', speakerId: 'me', content: '改天给你看新狗', source: 'xingyu',
    });

    await runCompressionForce('char-1');

    const state = useMemoryState.getState().get('char-1');
    expect(state?.factChains).toHaveLength(1);
    expect(state?.factChains[0]!.entries[0]!.content).toBe('用户在腾讯');
    expect(state?.openLoops).toHaveLength(1);
    expect(state?.relationship.affinity).toBe(55);
    expect(state?.relationship.stage).toBe('朋友');
    expect(state?.episodicSummary?.content).toContain('小狗');
    expect(state?.highlights).toHaveLength(1);

    const allEntries = useCharacterMemory.getState().getAll('char-1');
    expect(allEntries.every((e) => e.compressed)).toBe(true);
  });

  it('任一 Pass 失败 → state 不变；entries 保持未压', async () => {
    mockChatJson({ factAdds: [], factAppends: [], loopsOpened: [], loopsClosed: [], jokeAdds: [] });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => 'B fail' });
    mockChatJson({ summary: '', highlights: [] });

    useCharacterMemory.getState().append('char-1', {
      role: 'user', speakerId: 'me', content: 'x', source: 'xingyu',
    });

    await runCompressionForce('char-1');

    expect(useMemoryState.getState().get('char-1')?.episodicSummary).toBeNull();
    expect(useMemoryState.getState().get('char-1')?.factChains ?? []).toEqual([]);
    const all = useCharacterMemory.getState().getAll('char-1');
    expect(all.every((e) => !e.compressed)).toBe(true);
  });
});
```

- [ ] **Step 2: 跑 E2E**

Run: `pnpm vitest run src/platform/ai/__tests__/m5.compression.e2e.test.ts`
Expected: 2 tests pass

- [ ] **Step 3: 跑全套测试 + 类型检查 + build**

Run: `pnpm vitest run && pnpm tsc --noEmit && pnpm build`
Expected: 全部 pass，无 TS 错误

- [ ] **Step 4: 提交**

```bash
git add src/platform/ai/__tests__/m5.compression.e2e.test.ts
git commit -m "test(memory): add M5 e2e — full pipeline + failure isolation"
```

---

## 自查 (writing-plans 自审)

- [x] **Spec 覆盖**：spec 各节均映射到任务
  - 数据结构 → T1
  - IDB schema → T2/T3
  - State store → T4
  - Mutator → T5
  - 渲染 → T6 / T12
  - Pass A/B/C → T7/T8/T9
  - Pipeline → T10
  - 触发整合 → T11
  - 注入 → T12
  - 启动初始化 → T13
  - 迁移 → T14
  - 清理 → T15
  - E2E → T16
- [x] **无 placeholder**：每步都给了完整代码 / 命令 / 期望输出
- [x] **类型一致**：`PassMessage`、`PassPeer`、`CompressionPipelineInput` 在 T7/T8/T9/T10 中字段一致；`PassACommonInput` 复用
- [x] **commit 格式**：与现有 commit 风格一致（无 Co-Authored-By trailer）
- [x] **TDD**：每个新模块都是 test-first；现有测试有更新

## 已知偏离 / 待确认（实现期可决定）

1. **Promise lock for state IDB sync**: T4 实现里 `putMemoryState` 是 fire-and-forget。如果连续 set 同一 charId 极快（<10ms），最后一次 set 之前的写入可能竞争——实际由 IDB 原子事务保证最终一致性，但测试里 `await new Promise(r => setTimeout(r, 10))` 等可能不稳。如发现 flake，加 fence (await idb 队列空) 后再 assert。

2. **promptAssembly 改造的具体行**: T12 step 2 描述了"找到 longTermMemory 来源那段"，因为 `promptAssembly.ts` 是 27KB 大文件，具体行号会随版本漂移。实施时按 grep 结果定位。

3. **init 文件位置**: T13 要按实际 `loadCharacterMemoryFromIdb` 调用位置改。可能在 `src/main.tsx` 或 `src/platform/init.ts`。

4. **fake-indexeddb 配置**: 大量测试用 `import 'fake-indexeddb/auto'`，假设项目已安装该 dep。如果 vitest setup 已全局注入，可省略每个文件的 import。

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-26-character-memory-redesign.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
