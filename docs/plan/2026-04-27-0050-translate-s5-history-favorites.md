# Translate App S5 — History + Favorites Implementation Plan

**日期**: 2026-04-27
**分支**: feat/m1-architecture
**前置阶段**: S1 motion SDK / S2 builtin pipeline / S3 core flow / S4 lang sheets — 全部 merged

---

## 1. 用户需求（来自 spec §2.2 / §3.6 / §3.7）

> 历史：最近 50 条，FIFO，按 (text, srcLang, tgtLang) 去重
> 收藏：无上限，星标常用条目
> 存储 per-owner，压测 `@hiphone/storage` 主路径

操作流：
- 翻译成功 → 自动写入 history（命中去重则提到表头，保留 id）
- TargetPanel 上点星 → 收藏当前条目；再点 → 取消收藏
- NavBar 右上角"时钟图标" → 打开历史 sheet；"星标图标" → 打开收藏 sheet
- 历史 sheet 行：左滑删除 / 点击行恢复到主面板 / 行内星标
- 收藏 sheet 行：点击恢复 / 行内星标（取消即移出收藏，但历史保留）

## 2. 关键决策

### 2.1 HistoryEntry 存 Language 对象，不只存 code

Spec §3.6 写的是 `sourceLang: string`，但显示行需要 native 名（"中文" / "English"），自定义语种又要保留 name。**直接存 `Language` 对象**避免双向 lookup：
```ts
type HistoryEntry = {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: Language;  // {code, name, native}
  targetLang: Language;
  ts: number;
};
```
偏离 spec 的字面定义，但符合 spec 意图（"ISO code 或自由文本"——Language 对象同时承载两者）。

### 2.2 去重 key

`${sourceText}|${sourceLang.code}|${targetLang.code}` —— 命中时把旧条目移到表头并更新 ts + targetText（用最新译文覆盖），id **保留**以维持 favorite 链接。

### 2.3 Favorite 与 History 通过 id 关联

Favorites 存独立数组（spec §3.6），但每条 `FavoriteEntry.id` 与 history 中的对应条目 id 相同。当 history 因 cap 50 把老条目挤出去时，**favorite 不受影响**——这是 spec 的"收藏无上限"+"历史 cap 50"组合的自然结果。

### 2.4 存储读写策略

- **加载**: app mount 时一次性 `storage.get('history')` + `storage.get('favorites')`，转 state
- **写入**: 每个变更操作 = 立即 `storage.set` + state 更新，不批处理
- **持久化失败**: console.warn，UI 不阻塞（spec §3.8）

### 2.5 Sheet UI 不复用 LangSheet

LangSheet 是按钮列表；history/favorites 行带左滑删除 + 行内星标，结构差异大。**单独实现 RecentRow / RecentsSheet / FavoritesSheet**，但共享同一个 sheet 容器结构（backdrop + bottom-sheet motion 配方）。

### 2.6 左滑删除（仅 history sheet）

用 `motion.div` + `drag="x"` + `dragConstraints={{left: -88, right: 0}}`，露出红色"删除"按钮。点击删除按钮 → state 移除条目 + storage.set 持久化。**不实现自动 snap-back**——iOS 原生也是手动点删除。

收藏 sheet 不允许左滑删除（spec §3.7 表格只有"删历史"），取消收藏靠点星。

### 2.7 NavBar 入口

NavBar 已支持 `rightButtons: NavBarButton[]`。传两个按钮：
- `<Clock>` → setSheetOpen('history')
- `<Star>` → setSheetOpen('favorites')

## 3. 文件清单

### 新增
- `src/apps/translate/hooks/useHistory.ts` — storage 读写 + 去重 + cap + 收藏增删
- `src/apps/translate/recents/RecentsSheet.tsx` — 历史 sheet（左滑删 + 行内星 + 点击恢复）
- `src/apps/translate/recents/FavoritesSheet.tsx` — 收藏 sheet（行内星 + 点击恢复）
- `src/apps/translate/recents/RecentRow.tsx` — 单行组件，被两 sheet 复用
- `src/apps/translate/hooks/__tests__/useHistory.test.ts` — cap / 去重 / 收藏单测

### 修改
- `src/apps/translate/TranslateApp.tsx` — 接 useHistory；NavBar rightButtons；翻译成功 → 写历史；TargetPanel 加星按钮；render 两个 sheet；点击行恢复主面板状态
- `src/apps/translate/panels/TargetPanel.tsx` — 新增 `entryId?: string` + `isFavorited?: boolean` + `onToggleFavorite?: () => void` props，加星按钮（只在 success + entryId 存在时显示）
- `src/platform/userApp/builtinUserApps.ts` — 新增 4 个 `?raw` import + files 表
- `src/platform/userApp/__tests__/translate.sandbox.test.ts` — 加 history/favorites smoke test
- `src/apps/translate/CLAUDE.md` — 追加 S5 段落

## 4. 任务拆解

### Task 1: useHistory hook + 单测

**Files:**
- Create: `src/apps/translate/hooks/useHistory.ts`
- Create: `src/apps/translate/hooks/__tests__/useHistory.test.ts`

#### 类型与常量

```ts
import { useEffect, useState, useCallback, useRef } from 'react';
import { get, set } from '@hiphone/storage';
import type { Language } from '../constants/languages';

export const HISTORY_CAP = 50;
const HISTORY_KEY = 'history';
const FAVORITES_KEY = 'favorites';

export interface HistoryEntry {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: Language;
  targetLang: Language;
  ts: number;
}

export interface FavoriteEntry extends HistoryEntry {
  favoritedAt: number;
}

export interface UseHistoryResult {
  history: HistoryEntry[];
  favorites: FavoriteEntry[];
  loaded: boolean;
  addEntry: (input: { sourceText: string; targetText: string; sourceLang: Language; targetLang: Language }) => Promise<HistoryEntry>;
  deleteHistory: (id: string) => Promise<void>;
  isFavorited: (id: string) => boolean;
  toggleFavorite: (entry: HistoryEntry) => Promise<void>;
}

function dedupeKey(text: string, src: Language, tgt: Language): string {
  return `${text}|${src.code}|${tgt.code}`;
}

function genId(): string {
  // crypto.randomUUID 沙箱可用（spec §2.5 navigator/crypto 未遮蔽）
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
```

#### Hook 主体

```ts
export function useHistory(): UseHistoryResult {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount. Failures logged but don't block UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [h, f] = await Promise.all([get(HISTORY_KEY), get(FAVORITES_KEY)]);
        if (cancelled) return;
        if (Array.isArray(h)) setHistory(h as HistoryEntry[]);
        if (Array.isArray(f)) setFavorites(f as FavoriteEntry[]);
      } catch (e) {
        console.warn('[translate] history load failed', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Always write through current state — guards against in-flight set
  // batches racing each other.
  const persistHistory = useCallback(async (next: HistoryEntry[]) => {
    setHistory(next);
    try { await set(HISTORY_KEY, next); }
    catch (e) { console.warn('[translate] history save failed', e); }
  }, []);
  const persistFavorites = useCallback(async (next: FavoriteEntry[]) => {
    setFavorites(next);
    try { await set(FAVORITES_KEY, next); }
    catch (e) { console.warn('[translate] favorites save failed', e); }
  }, []);

  // Read history via ref to avoid stale closures in addEntry.
  const historyRef = useRef(history);
  historyRef.current = history;
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  const addEntry = useCallback(
    async (input: { sourceText: string; targetText: string; sourceLang: Language; targetLang: Language }) => {
      const key = dedupeKey(input.sourceText, input.sourceLang, input.targetLang);
      const existing = historyRef.current.find(
        (e) => dedupeKey(e.sourceText, e.sourceLang, e.targetLang) === key,
      );
      const ts = Date.now();
      let entry: HistoryEntry;
      let next: HistoryEntry[];
      if (existing) {
        // Promote: keep id (favorite linkage), refresh ts + targetText.
        entry = { ...existing, targetText: input.targetText, ts };
        next = [entry, ...historyRef.current.filter((e) => e.id !== existing.id)];
      } else {
        entry = { id: genId(), ...input, ts };
        next = [entry, ...historyRef.current].slice(0, HISTORY_CAP);
      }
      await persistHistory(next);
      return entry;
    },
    [persistHistory],
  );

  const deleteHistory = useCallback(
    async (id: string) => {
      const next = historyRef.current.filter((e) => e.id !== id);
      await persistHistory(next);
    },
    [persistHistory],
  );

  const isFavorited = useCallback(
    (id: string) => favoritesRef.current.some((f) => f.id === id),
    [],
  );

  const toggleFavorite = useCallback(
    async (entry: HistoryEntry) => {
      const idx = favoritesRef.current.findIndex((f) => f.id === entry.id);
      const next: FavoriteEntry[] =
        idx >= 0
          ? favoritesRef.current.filter((f) => f.id !== entry.id)
          : [{ ...entry, favoritedAt: Date.now() }, ...favoritesRef.current];
      await persistFavorites(next);
    },
    [persistFavorites],
  );

  return { history, favorites, loaded, addEntry, deleteHistory, isFavorited, toggleFavorite };
}
```

#### 单测

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHistory, HISTORY_CAP } from '../useHistory';
import { CURATED_LANGUAGES } from '../../constants/languages';

const ZH = CURATED_LANGUAGES.find((l) => l.code === 'zh')!;
const EN = CURATED_LANGUAGES.find((l) => l.code === 'en')!;
const JA = CURATED_LANGUAGES.find((l) => l.code === 'ja')!;

const storageMap = new Map<string, unknown>();
vi.mock('@hiphone/storage', () => ({
  get: vi.fn(async (k: string) => storageMap.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { storageMap.set(k, v); }),
}));

describe('useHistory', () => {
  beforeEach(() => { storageMap.clear(); });

  it('starts empty and marks loaded after initial fetch', async () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });

  it('addEntry adds new entry to head', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.addEntry({ sourceText: '你好', targetText: 'Hello', sourceLang: ZH, targetLang: EN });
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]!.sourceText).toBe('你好');
    expect(result.current.history[0]!.targetText).toBe('Hello');
  });

  it('addEntry dedupes by (sourceText, srcCode, tgtCode), promotes & keeps id', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let firstId = '';
    await act(async () => {
      const e = await result.current.addEntry({ sourceText: '你好', targetText: 'Hello', sourceLang: ZH, targetLang: EN });
      firstId = e.id;
    });
    await act(async () => {
      await result.current.addEntry({ sourceText: '世界', targetText: 'World', sourceLang: ZH, targetLang: EN });
    });
    await act(async () => {
      const e = await result.current.addEntry({ sourceText: '你好', targetText: 'Hi there', sourceLang: ZH, targetLang: EN });
      expect(e.id).toBe(firstId); // promoted, same id
    });
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]!.id).toBe(firstId);
    expect(result.current.history[0]!.targetText).toBe('Hi there'); // updated
  });

  it('caps history at HISTORY_CAP, FIFO drops oldest', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      for (let i = 0; i < HISTORY_CAP + 5; i++) {
        await result.current.addEntry({ sourceText: `text-${i}`, targetText: `out-${i}`, sourceLang: ZH, targetLang: EN });
      }
    });
    expect(result.current.history).toHaveLength(HISTORY_CAP);
    expect(result.current.history[0]!.sourceText).toBe(`text-${HISTORY_CAP + 4}`);
    // oldest 5 dropped
    expect(result.current.history.find((e) => e.sourceText === 'text-0')).toBeUndefined();
  });

  it('deleteHistory removes by id and persists', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let id = '';
    await act(async () => {
      const e = await result.current.addEntry({ sourceText: 'a', targetText: 'A', sourceLang: ZH, targetLang: EN });
      id = e.id;
    });
    await act(async () => { await result.current.deleteHistory(id); });
    expect(result.current.history).toEqual([]);
    expect(storageMap.get('history')).toEqual([]);
  });

  it('toggleFavorite adds and removes from favorites', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let entry: { id: string };
    await act(async () => {
      entry = await result.current.addEntry({ sourceText: 'a', targetText: 'A', sourceLang: ZH, targetLang: EN });
    });
    expect(result.current.isFavorited(entry!.id)).toBe(false);
    await act(async () => { await result.current.toggleFavorite(entry as HistoryEntry); });
    expect(result.current.isFavorited(entry!.id)).toBe(true);
    expect(result.current.favorites).toHaveLength(1);
    await act(async () => { await result.current.toggleFavorite(entry as HistoryEntry); });
    expect(result.current.isFavorited(entry!.id)).toBe(false);
    expect(result.current.favorites).toHaveLength(0);
  });

  it('different language pairs are distinct entries (no dedup)', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.addEntry({ sourceText: '你好', targetText: 'Hello', sourceLang: ZH, targetLang: EN });
      await result.current.addEntry({ sourceText: '你好', targetText: 'こんにちは', sourceLang: ZH, targetLang: JA });
    });
    expect(result.current.history).toHaveLength(2);
  });

  it('hydrates from storage on mount', async () => {
    storageMap.set('history', [{ id: 'preset', sourceText: 'x', targetText: 'X', sourceLang: ZH, targetLang: EN, ts: 1 }]);
    storageMap.set('favorites', [{ id: 'preset', sourceText: 'x', targetText: 'X', sourceLang: ZH, targetLang: EN, ts: 1, favoritedAt: 2 }]);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.history).toHaveLength(1);
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.isFavorited('preset')).toBe(true);
  });
});
```

**Verify command:** `pnpm vitest run src/apps/translate/hooks/__tests__/useHistory.test.ts`

---

### Task 2: RecentRow component

**Files:**
- Create: `src/apps/translate/recents/RecentRow.tsx`

```tsx
import React from 'react';
import { motion } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { Star, Trash2 } from 'lucide-react';
import type { HistoryEntry } from '../hooks/useHistory';

export interface RecentRowProps {
  entry: HistoryEntry;
  isFavorited: boolean;
  onPick: (entry: HistoryEntry) => void;
  onToggleFavorite: (entry: HistoryEntry) => void;
  /** When provided, row is left-swipable to reveal a delete button. */
  onDelete?: (id: string) => void;
}

const ROW_OUTER: React.CSSProperties = {
  position: 'relative',
  overflow: 'hidden',
  borderBottom: '1px solid var(--color-separator)',
};

const ROW_INNER: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  width: '100%',
  padding: '12px 16px',
  background: 'var(--color-secondarySystemBackground)',
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  gap: 8,
};

const DELETE_BG: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--color-systemRed)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: 24,
  color: 'white',
  fontSize: 15,
  fontWeight: 600,
};

const STAR_BTN: React.CSSProperties = {
  flexShrink: 0,
  width: 32,
  height: 32,
  borderRadius: 16,
  border: 'none',
  background: 'transparent',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
};

export function RecentRow({ entry, isFavorited, onPick, onToggleFavorite, onDelete }: RecentRowProps) {
  return (
    <div style={ROW_OUTER}>
      {onDelete && (
        <button
          type="button"
          aria-label="删除"
          onClick={() => onDelete(entry.id)}
          style={{ ...DELETE_BG, border: 'none', cursor: 'pointer' }}
        >
          <Trash2 size={18} strokeWidth={2.2} style={{ marginRight: 6 }} />
          删除
        </button>
      )}
      <motion.div
        drag={onDelete ? 'x' : false}
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.05}
        transition={spring.snappy}
        style={ROW_INNER}
      >
        <button
          type="button"
          onClick={() => onPick(entry)}
          aria-label="恢复此条历史"
          style={{ flex: 1, background: 'transparent', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0 }}
        >
          <div style={{ fontSize: 13, color: 'var(--color-secondaryLabel)', marginBottom: 2 }}>
            {entry.sourceLang.native} → {entry.targetLang.native}
          </div>
          <div style={{ fontSize: 15, color: 'var(--color-label)', marginBottom: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {entry.sourceText}
          </div>
          <div style={{ fontSize: 15, color: 'var(--color-secondaryLabel)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {entry.targetText}
          </div>
        </button>
        <motion.button
          type="button"
          aria-label={isFavorited ? '取消收藏' : '收藏'}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry); }}
          whileTap={{ scale: 1.3 }}
          transition={spring.bouncy}
          style={STAR_BTN}
        >
          <Star
            size={20}
            strokeWidth={2}
            color={isFavorited ? 'var(--color-systemYellow)' : 'var(--color-tertiaryLabel)'}
            fill={isFavorited ? 'var(--color-systemYellow)' : 'none'}
          />
        </motion.button>
      </motion.div>
    </div>
  );
}
```

**Verify:** type-check passes; visual verified in sandbox smoke (Task 6).

---

### Task 3: RecentsSheet & FavoritesSheet

**Files:**
- Create: `src/apps/translate/recents/RecentsSheet.tsx`
- Create: `src/apps/translate/recents/FavoritesSheet.tsx`

#### RecentsSheet

```tsx
import React from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { RecentRow } from './RecentRow';
import type { HistoryEntry } from '../hooks/useHistory';

export interface RecentsSheetProps {
  open: boolean;
  history: HistoryEntry[];
  isFavorited: (id: string) => boolean;
  onPick: (entry: HistoryEntry) => void;
  onToggleFavorite: (entry: HistoryEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const CONTAINER: React.CSSProperties = { position: 'absolute', inset: 0, zIndex: 100 };
const BACKDROP: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)',
  border: 'none', cursor: 'pointer',
};
const SHEET: React.CSSProperties = {
  position: 'absolute', left: 0, right: 0, bottom: 0,
  background: 'var(--color-secondarySystemBackground)',
  borderTopLeftRadius: 16, borderTopRightRadius: 16,
  padding: '12px 0 24px', maxHeight: '75%',
  display: 'flex', flexDirection: 'column',
};
const HANDLE: React.CSSProperties = {
  width: 36, height: 5, borderRadius: 3, margin: '0 auto 8px',
  background: 'var(--color-tertiaryLabel)',
};
const TITLE: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: 'var(--color-secondaryLabel)',
  padding: '4px 20px 8px',
};
const EMPTY: React.CSSProperties = {
  fontSize: 15, color: 'var(--color-tertiaryLabel)',
  textAlign: 'center', padding: '40px 20px',
};

export function RecentsSheet({
  open, history, isFavorited, onPick, onToggleFavorite, onDelete, onClose,
}: RecentsSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <div style={CONTAINER} role="dialog" aria-modal="true" aria-labelledby="recentssheet-title">
          <motion.button
            type="button" aria-label="关闭" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={spring.smooth} style={BACKDROP}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={spring.snappy} style={SHEET}
          >
            <div style={HANDLE} />
            <div id="recentssheet-title" style={TITLE}>历史</div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {history.length === 0 ? (
                <div style={EMPTY}>暂无历史</div>
              ) : (
                history.map((e) => (
                  <RecentRow
                    key={e.id}
                    entry={e}
                    isFavorited={isFavorited(e.id)}
                    onPick={(entry) => { onPick(entry); onClose(); }}
                    onToggleFavorite={onToggleFavorite}
                    onDelete={onDelete}
                  />
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
```

#### FavoritesSheet

Same structure, no `onDelete` passed (so RecentRow won't show delete bg / be drag-enabled), title "收藏", empty text "暂无收藏".

```tsx
import React from 'react';
import { motion, AnimatePresence } from '@hiphone/motion';
import { spring } from '@hiphone/motion';
import { RecentRow } from './RecentRow';
import type { FavoriteEntry, HistoryEntry } from '../hooks/useHistory';

export interface FavoritesSheetProps {
  open: boolean;
  favorites: FavoriteEntry[];
  isFavorited: (id: string) => boolean;
  onPick: (entry: HistoryEntry) => void;
  onToggleFavorite: (entry: HistoryEntry) => void;
  onClose: () => void;
}

// (Same style constants as RecentsSheet — copy them; cross-file dedup not worth
// the import cost in a sandboxed user-app where each file already pays the
// compile tax.)

export function FavoritesSheet({
  open, favorites, isFavorited, onPick, onToggleFavorite, onClose,
}: FavoritesSheetProps) {
  /* same JSX shape as RecentsSheet, but:
     - title: "收藏"
     - empty: "暂无收藏"
     - map favorites[] without onDelete
     - id="favoritessheet-title"
  */
}
```

(Spec §3.3 lists separate Recents/Favorites sheets — we keep them separate even though they share structure. The duplication is bounded and the divergence is plausible: future favorites view might add ordering controls, history might add date grouping.)

**Verify:** smoke covered in Task 6.

---

### Task 4: Wire useHistory into TranslateApp + add star button

**Files:**
- Modify: `src/apps/translate/TranslateApp.tsx`
- Modify: `src/apps/translate/panels/TargetPanel.tsx`

#### TargetPanel — add star

Extend props:
```tsx
export interface TargetPanelProps {
  text: string;
  status: TargetStatus;
  errorMessage?: string;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
}
```

Render star button **next to** copy button when `text && status !== 'loading' && onToggleFavorite`:
```tsx
<motion.button
  type="button"
  aria-label={isFavorited ? '取消收藏' : '收藏'}
  onClick={onToggleFavorite}
  whileTap={{ scale: 1.3 }}
  transition={spring.bouncy}
  style={{
    position: 'absolute', right: 48, bottom: 8,
    width: 32, height: 32, borderRadius: 16, border: 'none',
    background: 'var(--color-tertiarySystemFill)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: isFavorited ? 'var(--color-systemYellow)' : 'var(--color-systemBlue)',
  }}
>
  <Star size={16} strokeWidth={2.2} fill={isFavorited ? 'currentColor' : 'none'} />
</motion.button>
```

#### TranslateApp — integration

```tsx
import { Clock, Star as StarIcon } from 'lucide-react';
import { useHistory, type HistoryEntry } from './hooks/useHistory';
import { RecentsSheet } from './recents/RecentsSheet';
import { FavoritesSheet } from './recents/FavoritesSheet';

// inside TranslateApp:
const {
  history, favorites, addEntry, deleteHistory,
  isFavorited, toggleFavorite,
} = useHistory();
const [currentEntry, setCurrentEntry] = useState<HistoryEntry | null>(null);
const [sheetOpen, setSheetOpen] = useState<'history' | 'favorites' | null>(null);

// Track translate completion → write history.
const lastSettledRef = useRef<{ text: string; status: TranslateStatus }>({ text: '', status: 'idle' });
useEffect(() => {
  if (
    status === 'success' &&
    targetText &&
    (lastSettledRef.current.text !== targetText || lastSettledRef.current.status !== 'success')
  ) {
    lastSettledRef.current = { text: targetText, status: 'success' };
    void (async () => {
      const entry = await addEntry({
        sourceText: sourceText.trim(),
        targetText,
        sourceLang,
        targetLang,
      });
      setCurrentEntry(entry);
    })();
  }
  if (status === 'idle' || status === 'loading') {
    setCurrentEntry(null);
    lastSettledRef.current = { text: '', status };
  }
}, [status, targetText, sourceText, sourceLang, targetLang, addEntry]);

const onPickHistory = useCallback((entry: HistoryEntry) => {
  setSourceLang(entry.sourceLang);
  setTargetLang(entry.targetLang);
  setSourceText(entry.sourceText);
  reset(); // clear current target panel; user can re-translate
  setCurrentEntry(entry);
}, [reset]);

const onToggleCurrentFavorite = useCallback(() => {
  if (currentEntry) void toggleFavorite(currentEntry);
}, [currentEntry, toggleFavorite]);
```

NavBar:
```tsx
<NavBar
  title="翻译"
  rightButtons={[
    { icon: <Clock size={20} strokeWidth={2} />, onClick: () => setSheetOpen('history'), testId: 'open-history' },
    { icon: <StarIcon size={20} strokeWidth={2} />, onClick: () => setSheetOpen('favorites'), testId: 'open-favorites' },
  ]}
/>
```

TargetPanel:
```tsx
<TargetPanel
  text={targetText}
  status={status}
  errorMessage={error?.message}
  isFavorited={currentEntry ? isFavorited(currentEntry.id) : false}
  onToggleFavorite={currentEntry ? onToggleCurrentFavorite : undefined}
/>
```

Append two sheets at root:
```tsx
<RecentsSheet
  open={sheetOpen === 'history'}
  history={history}
  isFavorited={isFavorited}
  onPick={onPickHistory}
  onToggleFavorite={(entry) => void toggleFavorite(entry)}
  onDelete={(id) => void deleteHistory(id)}
  onClose={() => setSheetOpen(null)}
/>
<FavoritesSheet
  open={sheetOpen === 'favorites'}
  favorites={favorites}
  isFavorited={isFavorited}
  onPick={onPickHistory}
  onToggleFavorite={(entry) => void toggleFavorite(entry)}
  onClose={() => setSheetOpen(null)}
/>
```

**Verify:** `pnpm tsc --noEmit` clean; existing useTranslate tests still pass.

---

### Task 5: Wire new files into builtinUserApps

**Files:**
- Modify: `src/platform/userApp/builtinUserApps.ts`

Add imports + entries:
```ts
import translateUseHistorySrc from '@/apps/translate/hooks/useHistory.ts?raw';
import translateRecentRowSrc from '@/apps/translate/recents/RecentRow.tsx?raw';
import translateRecentsSheetSrc from '@/apps/translate/recents/RecentsSheet.tsx?raw';
import translateFavoritesSheetSrc from '@/apps/translate/recents/FavoritesSheet.tsx?raw';
```

Add to `files`:
```ts
'hooks/useHistory.ts': translateUseHistorySrc,
'recents/RecentRow.tsx': translateRecentRowSrc,
'recents/RecentsSheet.tsx': translateRecentsSheetSrc,
'recents/FavoritesSheet.tsx': translateFavoritesSheetSrc,
```

**Verify:** `pnpm vitest run src/platform/userApp/__tests__/builtinUserApps.test.ts` clean.

---

### Task 6: Sandbox smoke tests

**Files:**
- Modify: `src/platform/userApp/__tests__/translate.sandbox.test.ts`

Mock `@/platform/userApp/sdk/storage`:
```ts
const storageMap = new Map<string, unknown>();
vi.mock('@/platform/userApp/sdk/storage', async () => ({
  get: vi.fn(async (k: string) => storageMap.get(k)),
  set: vi.fn(async (k: string, v: unknown) => { storageMap.set(k, v); }),
  remove: vi.fn(async (k: string) => { storageMap.delete(k); }),
  list: vi.fn(async () => Array.from(storageMap.keys())),
  globalGet: vi.fn(),
  globalSet: vi.fn(),
}));

beforeEach(() => { storageMap.clear(); });
```

Add tests:
```ts
it('successful translate writes a history entry', async () => {
  completeMock.mockResolvedValueOnce('Hello');
  await mountBuiltinUserApps();
  render(React.createElement(appRegistry.get('translate')!.component));

  fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), { target: { value: '你好' } });
  fireEvent.click(screen.getByRole('button', { name: '翻译' }));

  await waitFor(() => expect(screen.getByText('Hello')).toBeTruthy());
  await waitFor(() => {
    const stored = storageMap.get('history') as Array<{ sourceText: string; targetText: string }> | undefined;
    expect(stored).toBeDefined();
    expect(stored![0]!.sourceText).toBe('你好');
    expect(stored![0]!.targetText).toBe('Hello');
  });
  cleanup();
});

it('opening history sheet shows past entry; clicking it restores source text', async () => {
  // Pre-seed storage so hook hydrates
  storageMap.set('history', [{
    id: 'preset-1', sourceText: 'preset-source', targetText: 'preset-target',
    sourceLang: { code: 'zh', name: '中文', native: '中文' },
    targetLang: { code: 'en', name: '英语', native: 'English' },
    ts: Date.now(),
  }]);
  await mountBuiltinUserApps();
  render(React.createElement(appRegistry.get('translate')!.component));

  // Wait for hydrate
  await waitFor(() => expect(screen.getByLabelText('open-history') ?? screen.getByTestId('open-history')).toBeTruthy());
  fireEvent.click(screen.getByTestId('open-history'));
  await waitFor(() => expect(screen.getByText('preset-source')).toBeTruthy());

  fireEvent.click(screen.getByLabelText('恢复此条历史'));
  // Sheet closes, source textarea shows preset-source
  const ta = screen.getByPlaceholderText(/输入要翻译的文本/) as HTMLTextAreaElement;
  await waitFor(() => expect(ta.value).toBe('preset-source'));
  cleanup();
});

it('star button toggles favorite for current translation', async () => {
  completeMock.mockResolvedValueOnce('Hello');
  await mountBuiltinUserApps();
  render(React.createElement(appRegistry.get('translate')!.component));

  fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), { target: { value: '你好' } });
  fireEvent.click(screen.getByRole('button', { name: '翻译' }));
  await waitFor(() => expect(screen.getByText('Hello')).toBeTruthy());
  await waitFor(() => expect(storageMap.get('history')).toBeDefined());

  // Star button is rendered after history entry attached; aria label is "收藏"
  const star = await screen.findByLabelText('收藏');
  fireEvent.click(star);
  await waitFor(() => {
    const favs = storageMap.get('favorites') as unknown[] | undefined;
    expect(favs?.length).toBe(1);
  });
  cleanup();
});
```

**Verify:** `pnpm vitest run src/platform/userApp/__tests__/translate.sandbox.test.ts`

---

### Task 7: Doc + commit

**Files:**
- Modify: `src/apps/translate/CLAUDE.md`

Append S5 section documenting:
- 存储 schema：history (cap 50, FIFO, 三元组去重) / favorites (无上限)
- HistoryEntry 存的是完整 Language 对象（决策记录，spec 字面写 string，我们存对象）
- Favorite 通过 id 关联 history，history cap 不影响 favorite
- 左滑删除仅 history 行；收藏取消靠星

Commit message: `feat(translate): S5 — history + favorites + recents/favorites sheets`

---

## 5. 测试计划

| 层级 | 文件 | 覆盖 |
|------|------|------|
| Hook unit | `useHistory.test.ts` | cap / 去重 / 收藏增删 / hydrate |
| Sandbox smoke | `translate.sandbox.test.ts` | translate→history / 历史 sheet 恢复 / 星标收藏 |
| 兼容回归 | 现有 useTranslate 测试 + S4 sandbox 测试 | 仍 passing |
| 类型 | `pnpm tsc --noEmit` | clean |
| 生产构建 | `pnpm build` | bundle 大小增量在合理范围（~10KB gzipped 量级） |

## 6. 风险与对策

| 风险 | 对策 |
|------|------|
| storage Promise 竞态：addEntry 连续触发，set 顺序不保证 | 用 ref 存最新 history，每次 set 写完整数组（已实现） |
| 沙箱内 `crypto.randomUUID` 可能不存在 | 加 fallback id 生成器（已实现） |
| 自定义语种 dedup：'custom:Klingon' 与 'custom:Klingon ' 视为不同 | 接受——CustomLangInput 已 trim，多空格属用户输入歧义 |
| TargetPanel 加星按钮挤占复制按钮空间 | 复制按钮 right:8、星按钮 right:48，互不重叠 |
| sourceText 在翻译期间变化导致 history 记录不一致 | useEffect 用 `sourceText.trim()`，与 useTranslate 内的 trim 对齐 |

## 7. 不做的事（仍然）

- 全文搜索 history（M2）
- 历史按日期分组（iOS Mail 风格，M2）
- 跨设备同步（IDB 仅本地）
- 收藏排序 / 拖拽
- 历史导出
