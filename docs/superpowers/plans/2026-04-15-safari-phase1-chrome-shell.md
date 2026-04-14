# Safari Phase 1: Chrome 壳重做 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Safari's flat, plain bottom bar, address bar, and URL editing overlay with a refined skeuomorphic design featuring inset shadows, gradient glass, loading shimmer, branded favicons, and lucide-react icons.

**Architecture:** All changes are within `src/apps/Safari/`. The store (`safariStore.ts`) gets two new fields (`isLoading`, `searchHistory`). The component (`SafariApp.tsx`) gets restructured: hand-drawn SVG icons replaced with lucide-react, flat styles replaced with gradient/shadow/glass effects, and a new loading shimmer CSS animation. A separate CSS file (`safari.css`) is created for keyframe animations and pseudo-element styles that can't be done inline or with Tailwind.

**Tech Stack:** React, Zustand, Tailwind CSS, lucide-react, framer-motion, CSS keyframes

**Spec:** `docs/superpowers/specs/2026-04-15-safari-ui-redesign.md` (Phase 1 sections 1.1–1.4)

---

### Task 1: Extend safariStore with `isLoading` and `searchHistory`

**Files:**
- Modify: `src/apps/Safari/safariStore.ts`
- Create: `src/apps/Safari/__tests__/safariStore.test.ts`

- [ ] **Step 1: Write failing tests for new store fields**

```ts
// src/apps/Safari/__tests__/safariStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSafariStore } from '../safariStore';

beforeEach(() => {
  useSafariStore.getState().reset();
});

describe('safariStore — isLoading', () => {
  it('defaults to false', () => {
    expect(useSafariStore.getState().isLoading).toBe(false);
  });

  it('setLoading sets isLoading', () => {
    useSafariStore.getState().setLoading(true);
    expect(useSafariStore.getState().isLoading).toBe(true);
    useSafariStore.getState().setLoading(false);
    expect(useSafariStore.getState().isLoading).toBe(false);
  });

  it('navigateTo sets isLoading to true', () => {
    useSafariStore.getState().navigateTo('https://apple.com');
    expect(useSafariStore.getState().isLoading).toBe(true);
  });

  it('reset clears isLoading', () => {
    useSafariStore.getState().setLoading(true);
    useSafariStore.getState().reset();
    expect(useSafariStore.getState().isLoading).toBe(false);
  });
});

describe('safariStore — searchHistory', () => {
  it('defaults to empty array', () => {
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });

  it('navigateTo with search query adds to searchHistory', () => {
    useSafariStore.getState().navigateTo('apple news');
    expect(useSafariStore.getState().searchHistory).toContain('apple news');
  });

  it('navigateTo with URL does not add to searchHistory', () => {
    useSafariStore.getState().navigateTo('https://apple.com');
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });

  it('searchHistory deduplicates entries', () => {
    useSafariStore.getState().navigateTo('apple news');
    useSafariStore.getState().navigateTo('apple news');
    const history = useSafariStore.getState().searchHistory;
    expect(history.filter((h) => h === 'apple news')).toHaveLength(1);
  });

  it('searchHistory keeps max 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      useSafariStore.getState().navigateTo(`query ${i}`);
    }
    expect(useSafariStore.getState().searchHistory).toHaveLength(10);
    // Most recent should be first
    expect(useSafariStore.getState().searchHistory[0]).toBe('query 11');
  });

  it('clearSearchHistory empties the array', () => {
    useSafariStore.getState().navigateTo('test query');
    useSafariStore.getState().clearSearchHistory();
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });

  it('reset clears searchHistory', () => {
    useSafariStore.getState().navigateTo('test');
    useSafariStore.getState().reset();
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/apps/Safari/__tests__/safariStore.test.ts`
Expected: FAIL — `isLoading`, `setLoading`, `searchHistory`, `clearSearchHistory` not defined

- [ ] **Step 3: Implement store changes**

In `src/apps/Safari/safariStore.ts`, add the new fields to the interface and implementation:

```ts
// Add to SafariState interface (after editText):
isLoading: boolean;
searchHistory: string[];

// Add actions:
setLoading: (loading: boolean) => void;
clearSearchHistory: () => void;
```

Add to initial state:
```ts
isLoading: false,
searchHistory: [],
```

Add action implementations:
```ts
setLoading: (loading) => set({ isLoading: loading }),

clearSearchHistory: () => set({ searchHistory: [] }),
```

Modify `navigateTo` — after computing `url`, add `isLoading: true` to the return object, and add search history tracking:
```ts
navigateTo: (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return;

  const urlInput = isUrl(trimmed);
  const url = urlInput ? normalizeUrl(trimmed) : buildSearchUrl(trimmed);
  const domain = extractDomain(url);

  set((state) => {
    const tabs = state.tabs.map((tab) => {
      if (tab.id !== state.activeTabId) return tab;
      const newHistory = [...tab.history.slice(0, tab.historyIndex + 1), url];
      return {
        ...tab,
        url,
        title: domain,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        hasError: false,
      };
    });

    // Track search queries (not URLs) in search history
    let searchHistory = state.searchHistory;
    if (!urlInput) {
      searchHistory = [trimmed, ...searchHistory.filter((h) => h !== trimmed)].slice(0, 10);
    }

    return { tabs, isEditing: false, view: 'browse' as const, isLoading: true, searchHistory };
  });
},
```

Modify `reset` — add `isLoading: false, searchHistory: []` to the reset state.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/apps/Safari/__tests__/safariStore.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/apps/Safari/safariStore.ts src/apps/Safari/__tests__/safariStore.test.ts
git commit -m "feat(safari): add isLoading and searchHistory to safariStore"
```

---

### Task 2: Create safari.css for loading shimmer animation

**Files:**
- Create: `src/apps/Safari/safari.css`

The conic-gradient rotation and pseudo-element loading shimmer cannot be done with Tailwind utility classes alone. This file contains only the keyframe animation and the `.safari-url-capsule-loading` class.

- [ ] **Step 1: Create safari.css**

```css
/* src/apps/Safari/safari.css */

/* Loading shimmer — conic-gradient rotation around URL capsule */
@keyframes safari-border-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.safari-url-capsule-loading {
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.06),
    0 0 12px rgba(0, 122, 255, 0.12),
    0 0 4px rgba(0, 122, 255, 0.08);
}

.safari-url-capsule-loading::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: 16px;
  background: conic-gradient(
    from 0deg,
    rgba(0, 122, 255, 0) 0%,
    rgba(0, 122, 255, 0.35) 15%,
    rgba(90, 200, 250, 0.5) 25%,
    rgba(0, 122, 255, 0.35) 35%,
    rgba(0, 122, 255, 0) 50%,
    rgba(0, 122, 255, 0) 100%
  );
  animation: safari-border-spin 2.5s linear infinite;
  z-index: 0;
}

.safari-url-capsule-loading::after {
  content: '';
  position: absolute;
  inset: 1.5px;
  border-radius: 12.5px;
  background: linear-gradient(to bottom, #fafafa, #eeeff1);
  z-index: 0;
}

.safari-url-capsule-loading > * {
  position: relative;
  z-index: 1;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/Safari/safari.css
git commit -m "feat(safari): add loading shimmer CSS keyframes"
```

---

### Task 3: Replace all hand-drawn SVG icons with lucide-react

**Files:**
- Modify: `src/apps/Safari/SafariApp.tsx`

This task removes all 10 hand-drawn icon components (BackIcon, ForwardIcon, ShareIcon, BookmarkIcon, TabsIcon, PlusIcon, CloseIcon, SearchIcon, GlobeIcon, LockIcon) and replaces with lucide-react imports.

- [ ] **Step 1: Add lucide-react imports and remove icon components**

At the top of `SafariApp.tsx`, replace the existing imports with:

```tsx
import { useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Share,
  BookOpen,
  Layers,
  Plus,
  X,
  Search,
  Globe,
  Lock,
} from 'lucide-react';
import { AppScreen } from '@/system';
import { Material } from '@/system/Material/Material';
import { useSafariStore, extractDomain } from './safariStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import './safari.css';
```

Delete all the icon function components at the bottom of the file: `BackIcon`, `ForwardIcon`, `ShareIcon`, `BookmarkIcon`, `TabsIcon`, `PlusIcon`, `CloseIcon`, `SearchIcon`, `GlobeIcon`, `LockIcon`.

- [ ] **Step 2: Update all icon usages in BrowseView toolbar**

Replace icon usages in the toolbar section:

| Old | New |
|-----|-----|
| `<BackIcon />` | `<ChevronLeft size={22} strokeWidth={2.5} />` |
| `<ForwardIcon />` | `<ChevronRight size={22} strokeWidth={2.5} />` |
| `<ShareIcon />` | `<Share size={20} strokeWidth={1.8} />` |
| `<BookmarkIcon />` | `<BookOpen size={20} strokeWidth={1.8} />` |
| `<TabsIcon />` | (replaced by tab count badge in Task 4) |

- [ ] **Step 3: Update icon usages in URL editing overlay**

| Old | New |
|-----|-----|
| `<SearchIcon size={16} />` | `<Search size={16} strokeWidth={2} />` |

- [ ] **Step 4: Update icon usages in TabGridView and TabCard**

| Old | New |
|-----|-----|
| `<PlusIcon />` | `<Plus size={22} strokeWidth={2} />` |
| `<CloseIcon size={10} color="..." />` | `<X size={10} strokeWidth={2} />` |
| `<GlobeIcon size={14} />` | `<Globe size={14} strokeWidth={1.8} />` |

- [ ] **Step 5: Update icon usages in ErrorPage and URL bar**

| Old | New |
|-----|-----|
| `<GlobeIcon size={64} />` | `<Globe size={64} strokeWidth={1.2} />` |
| `<LockIcon size={12} />` | `<Lock size={12} strokeWidth={2} />` |

- [ ] **Step 6: Verify build passes**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 7: Commit**

```bash
git add src/apps/Safari/SafariApp.tsx
git commit -m "refactor(safari): replace hand-drawn SVGs with lucide-react icons"
```

---

### Task 4: Restyle bottom bar — gradient glass + inset address bar + tab count badge

**Files:**
- Modify: `src/apps/Safari/SafariApp.tsx`

This is the core visual redesign of the bottom chrome. Three sub-components change: the `<Material>` bottom bar wrapper, the URL capsule, and the toolbar row.

- [ ] **Step 1: Restyle the bottom `<Material>` bar**

In `BrowseView`, replace the bottom `<Material>` block. Change the wrapper style to add gradient overlay and upward shadow:

```tsx
<Material
  variant="chrome"
  className="shrink-0 flex flex-col"
  style={{
    borderTop: '0.5px solid rgba(0, 0, 0, 0.06)',
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    background: 'linear-gradient(to bottom, rgba(255,255,255,0.88), rgba(244,244,248,0.95))',
    boxShadow: '0 -2px 20px rgba(0,0,0,0.04)',
  }}
>
```

- [ ] **Step 2: Restyle the URL capsule**

Replace the URL capsule button styling with the inset shadow skeuomorphic design. Add `isLoading` from the store and apply the CSS class conditionally:

```tsx
const isLoading = useSafariStore((s) => s.isLoading);
```

Update the capsule button:
```tsx
<button
  onClick={handleUrlBarClick}
  className={`relative flex w-full items-center justify-center rounded-[14px] px-4 overflow-hidden ${
    isLoading ? 'safari-url-capsule-loading' : ''
  }`}
  style={{
    height: 44,
    maxWidth: 500,
    background: 'linear-gradient(to bottom, #fafafa, #eeeff1)',
    boxShadow: isLoading
      ? undefined  // CSS class handles it
      : 'inset 0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(255,255,255,0.8)',
  }}
  data-testid="safari-url-bar"
>
```

Update the lock icon display to green:
```tsx
{showStartPage ? (
  <span className="text-[15px]" style={{ color: 'var(--color-secondaryLabel)' }}>
    搜索或输入网站名称
  </span>
) : (
  <div className="relative z-[1] flex items-center gap-1.5">
    <Lock size={12} strokeWidth={2} style={{ color: '#34c759' }} />
    <span className="truncate text-[15px] font-medium tracking-wide" style={{ color: 'var(--color-label)' }}>
      {displayDomain}
    </span>
  </div>
)}
```

- [ ] **Step 3: Add iframe onLoad handler to clear isLoading**

In `BrowseView`, add a ref and handler for the iframe load event:

```tsx
const setLoading = useSafariStore((s) => s.setLoading);

const handleIframeLoad = useCallback(() => {
  setLoading(false);
}, [setLoading]);
```

Update the iframe element:
```tsx
<iframe
  key={activeTab?.url}
  src={activeTab?.url ?? undefined}
  className="h-full w-full border-0"
  sandbox="allow-scripts allow-same-origin allow-forms"
  title="Web content"
  onError={handleIframeError}
  onLoad={handleIframeLoad}
  data-testid="safari-iframe"
/>
```

- [ ] **Step 4: Replace TabsIcon with tab count badge**

Replace the tabs toolbar button. Instead of `<TabsIcon />`, show the tab count number in a styled badge:

```tsx
<ToolbarButton
  onClick={() => setView('tabs')}
  testId="safari-tabs-btn"
>
  <span
    className="flex items-center justify-center rounded-lg text-[13px] font-bold"
    style={{
      width: 28,
      height: 26,
      background: 'rgba(0, 122, 255, 0.07)',
      border: '1.5px solid rgba(0, 122, 255, 0.2)',
      color: 'var(--color-systemBlue)',
    }}
  >
    {tabs.length}
  </span>
</ToolbarButton>
```

- [ ] **Step 5: Add press state to ToolbarButton**

Update the `ToolbarButton` component to include press state feedback:

```tsx
function ToolbarButton({
  children,
  onClick,
  disabled = false,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center rounded-[10px] transition-all duration-150 active:scale-[0.92] active:bg-black/[0.06]"
      style={{
        minWidth: 44,
        minHeight: 38,
        color: disabled
          ? 'var(--color-quaternaryLabel)'
          : 'var(--color-systemBlue)',
        opacity: disabled ? 0.5 : 1,
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 6: Verify the app renders**

Run: `npx vite build 2>&1 | tail -5` or start dev server and verify in browser.
Expected: Build succeeds, no errors

- [ ] **Step 7: Commit**

```bash
git add src/apps/Safari/SafariApp.tsx
git commit -m "feat(safari): restyle bottom bar with gradient glass, inset URL capsule, tab badge"
```

---

### Task 5: Restyle URL editing overlay — unified search box + pill cancel + search history

**Files:**
- Modify: `src/apps/Safari/SafariApp.tsx`

- [ ] **Step 1: Define FAVORITES with branded colors**

Replace the FAVORITES array at the top of the file. Each entry gets a `gradient` and `logo` field for the branded favicon:

```tsx
const FAVORITES = [
  { name: 'Apple', url: 'https://www.apple.com', gradient: 'linear-gradient(145deg, #555, #2d2d2d)', letter: '' },
  { name: 'Google', url: 'https://www.google.com', gradient: 'linear-gradient(145deg, #4285f4, #2b6bcb)', letter: 'G' },
  { name: 'Wikipedia', url: 'https://zh.wikipedia.org', gradient: 'linear-gradient(145deg, #737373, #4a4a4a)', letter: 'W' },
  { name: '百度', url: 'https://www.baidu.com', gradient: 'linear-gradient(145deg, #2932e1, #1a24b8)', letter: '百' },
  { name: 'GitHub', url: 'https://github.com', gradient: 'linear-gradient(145deg, #3a3a3a, #1a1a1a)', letter: '' },
  { name: 'YouTube', url: 'https://www.youtube.com', gradient: 'linear-gradient(145deg, #ff2020, #cc0000)', letter: '' },
];
```

Note: Apple, GitHub, YouTube use SVG logos (inline in the render); Google, Wikipedia, 百度 use letter abbreviations.

- [ ] **Step 2: Create FavIcon component for branded favicon rendering**

Add a helper component that renders each favicon with branded gradient + white logo/letter:

```tsx
function FavIcon({ fav }: { fav: typeof FAVORITES[number] }) {
  return (
    <div
      className="flex items-center justify-center rounded-[14px] text-white"
      style={{
        width: 52,
        height: 52,
        background: fav.gradient,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12), inset 0 -1px 2px rgba(0,0,0,0.06)',
      }}
    >
      {fav.letter ? (
        <span className="text-[22px] font-bold">{fav.letter}</span>
      ) : fav.name === 'Apple' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M18.7 19.5c-.9 1.1-1.9 2.1-3.4 2.1-1.5 0-2-.9-3.6-.9-1.7 0-2.3.9-3.7.9-1.5 0-2.6-1.1-3.5-2.2C2.4 16.6 1.2 12.3 3.5 9.5c1.1-1.4 2.8-2.2 4.5-2.2 1.5 0 2.6 1 3.5 1s2.2-1.2 3.9-1c.7 0 2.5.3 3.7 2.1-3.2 1.9-2.7 6.8.6 8.1zM14.5 5.3c.9-1.1 1.5-2.6 1.3-4.3-1.3.1-2.8.9-3.7 2-.8.9-1.5 2.5-1.3 3.9 1.4.1 2.8-.7 3.7-1.6z" />
        </svg>
      ) : fav.name === 'GitHub' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M23 9.7s-.2-1.7-.9-2.4c-.8-.9-1.7-.9-2.2-.9C16.8 6 12 6 12 6s-4.8 0-7.9.4c-.4 0-1.4 0-2.2.9C1.2 8 1 9.7 1 9.7S.8 11.7.8 13.6v1.8c0 2 .2 3.9.2 3.9s.2 1.7.9 2.4c.8.9 1.9.8 2.4.9 1.7.2 7.7.2 7.7.2s4.8 0 7.9-.3c.4-.1 1.4-.1 2.2-.9.7-.7.9-2.4.9-2.4s.2-2 .2-3.9v-1.8c0-2-.2-3.9-.2-3.9zM9.5 16.2V8.8l6 3.7-6 3.7z" />
        </svg>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the URL editing overlay**

Replace the full `{isEditing && (...)}` overlay block inside BrowseView. The new version has:
1. Top bar with unified search input (same inset style as URL capsule) + pill cancel button
2. Empty state: favorites grid (using FavIcon) + search history list
3. Typing state: search suggestion cards with type icons

```tsx
{/* ── Full-screen URL editing overlay ── */}
<AnimatePresence>
  {isEditing && (
    <motion.div
      className="absolute inset-0 z-50 flex flex-col"
      style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Top bar */}
      <Material
        variant="chrome"
        className="flex items-center gap-0"
        style={{
          paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
          paddingBottom: 10,
          paddingLeft: 16,
          paddingRight: 16,
          borderBottom: '0.5px solid rgba(0, 0, 0, 0.06)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.92), rgba(248,248,250,0.96))',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
        }}
      >
        <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute left-3 top-0 bottom-0 flex items-center">
            <Search size={16} strokeWidth={2} style={{ color: 'var(--color-secondaryLabel)' }} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="搜索或输入网站名称"
            className="w-full rounded-[14px] border-0 py-[11px] pl-9 pr-9 outline-none text-[16px] tracking-[0.1px]"
            style={{
              background: 'linear-gradient(to bottom, #fafafa, #eeeff1)',
              color: 'var(--color-label)',
              boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(255,255,255,0.8)',
            }}
            data-testid="safari-url-input"
          />
          {editText && (
            <button
              type="button"
              onClick={() => setEditText('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full"
              style={{ backgroundColor: '#c7c7cc' }}
            >
              <X size={10} strokeWidth={2.5} color="white" />
            </button>
          )}
        </form>
        <button
          onClick={handleCancel}
          className="ml-2.5 shrink-0 rounded-[20px] px-3.5 py-[7px] text-[15px] font-medium transition-all duration-150 active:scale-95"
          style={{
            color: 'var(--color-systemBlue)',
            backgroundColor: 'rgba(0, 0, 0, 0.05)',
            boxShadow: '0 0.5px 2px rgba(0,0,0,0.04)',
          }}
          data-testid="safari-cancel-edit"
        >
          取消
        </button>
      </Material>

      {/* Suggestions area */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
        {editText.trim() ? (
          <SearchSuggestions editText={editText} onSelect={navigateTo} />
        ) : (
          <EmptySearchState onFavoriteClick={handleFavoriteClick} />
        )}
      </div>
    </motion.div>
  )}
</AnimatePresence>
```

- [ ] **Step 4: Create EmptySearchState component**

```tsx
function EmptySearchState({ onFavoriteClick }: { onFavoriteClick: (url: string) => void }) {
  const searchHistory = useSafariStore((s) => s.searchHistory);
  const navigateTo = useSafariStore((s) => s.navigateTo);

  return (
    <div className="mx-auto max-w-[500px]">
      <p
        className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--color-secondaryLabel)' }}
      >
        个人收藏
      </p>
      <div
        className="mb-6 grid grid-cols-4 gap-x-2.5 gap-y-3.5 rounded-2xl px-3.5 py-[18px]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}
      >
        {FAVORITES.map((fav) => (
          <button
            key={fav.url}
            className="flex flex-col items-center gap-1.5"
            onClick={() => onFavoriteClick(fav.url)}
          >
            <FavIcon fav={fav} />
            <span
              className="max-w-full truncate text-[11px] font-medium"
              style={{ color: 'var(--color-label)' }}
            >
              {fav.name}
            </span>
          </button>
        ))}
      </div>

      {searchHistory.length > 0 && (
        <>
          <p
            className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--color-secondaryLabel)' }}
          >
            最近搜索
          </p>
          <div
            className="overflow-hidden rounded-2xl"
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)',
            }}
          >
            {searchHistory.map((query, i) => (
              <button
                key={query}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-black/[0.03]"
                style={{
                  borderTop: i > 0 ? '0.5px solid rgba(0, 0, 0, 0.06)' : undefined,
                }}
                onClick={() => navigateTo(query)}
              >
                <Search size={16} strokeWidth={2} style={{ color: 'var(--color-secondaryLabel)' }} />
                <span className="flex-1 text-[16px]" style={{ color: 'var(--color-systemBlue)' }}>
                  {query}
                </span>
                <ChevronRight size={14} strokeWidth={2} style={{ color: 'var(--color-quaternaryLabel)' }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create SearchSuggestions component**

```tsx
function SearchSuggestions({ editText, onSelect }: { editText: string; onSelect: (input: string) => void }) {
  const trimmed = editText.trim();

  // Check if any favorite matches
  const matchedFav = FAVORITES.find(
    (f) =>
      f.name.toLowerCase().includes(trimmed.toLowerCase()) ||
      f.url.toLowerCase().includes(trimmed.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-[500px] space-y-2">
      {/* Primary search suggestion */}
      <button
        className="flex w-full items-center gap-3.5 rounded-[14px] px-4 py-3 active:bg-black/[0.03]"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.85)',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)',
        }}
        onClick={() => onSelect(trimmed)}
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
          style={{ background: 'linear-gradient(135deg, #007aff, #5ac8fa)' }}
        >
          <Search size={16} strokeWidth={2} color="white" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[16px]" style={{ color: 'var(--color-label)' }}>{trimmed}</p>
          <p className="text-[12px]" style={{ color: 'var(--color-secondaryLabel)' }}>DuckDuckGo 搜索</p>
        </div>
        <ChevronRight size={16} strokeWidth={2} style={{ color: 'var(--color-quaternaryLabel)' }} />
      </button>

      {/* Matched favorite */}
      {matchedFav && (
        <button
          className="flex w-full items-center gap-3.5 rounded-[14px] px-4 py-3 active:bg-black/[0.03]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}
          onClick={() => onSelect(matchedFav.url)}
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
            style={{ background: matchedFav.gradient }}
          >
            {matchedFav.letter ? (
              <span className="text-xs font-bold text-white">{matchedFav.letter}</span>
            ) : (
              <Globe size={16} strokeWidth={1.8} color="white" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[16px]" style={{ color: 'var(--color-label)' }}>{matchedFav.name}</p>
            <p className="text-[12px]" style={{ color: 'var(--color-secondaryLabel)' }}>
              {extractDomain(matchedFav.url)} — 个人收藏
            </p>
          </div>
          <ChevronRight size={16} strokeWidth={2} style={{ color: 'var(--color-quaternaryLabel)' }} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Update StartPage to use FavIcon**

Replace the emoji-based favorites grid in `StartPage` to use the new `FavIcon` component:

```tsx
function StartPage({ onFavoriteClick }: { onFavoriteClick: (url: string) => void }) {
  return (
    <div
      className="h-full overflow-y-auto px-5 pt-12 pb-24"
      style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
      data-testid="safari-start-page"
    >
      <div className="mx-auto max-w-[500px]">
        <p
          className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-secondaryLabel)' }}
        >
          个人收藏
        </p>
        <div
          className="mb-8 grid grid-cols-4 gap-x-2.5 gap-y-3.5 rounded-2xl px-3.5 py-[18px]"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}
        >
          {FAVORITES.map((fav) => (
            <button
              key={fav.url}
              className="flex flex-col items-center gap-1.5"
              onClick={() => onFavoriteClick(fav.url)}
              data-testid={`safari-fav-${fav.name}`}
            >
              <FavIcon fav={fav} />
              <span
                className="max-w-full truncate text-[11px] font-medium"
                style={{ color: 'var(--color-label)' }}
              >
                {fav.name}
              </span>
            </button>
          ))}
        </div>

        <p
          className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-secondaryLabel)' }}
        >
          经常访问的网站
        </p>
        <div
          className="flex items-center justify-center rounded-2xl py-12"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.85)',
            boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)',
          }}
        >
          <span className="text-sm" style={{ color: 'var(--color-tertiaryLabel)' }}>
            暂无经常访问的网站
          </span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Verify the app renders correctly**

Start dev server: `npx vite dev`
Open Safari app in the browser, verify:
1. Bottom bar has gradient glass + inset shadow URL capsule
2. Tab count badge shows number
3. Clicking URL bar opens overlay with branded favicons + pill cancel button
4. Typing shows search suggestion cards
5. Loading shimmer appears when navigating to a URL

- [ ] **Step 8: Commit**

```bash
git add src/apps/Safari/SafariApp.tsx
git commit -m "feat(safari): restyle URL editing overlay with branded favicons, pill cancel, search history"
```

---

### Task 6: Write component tests for SafariApp

**Files:**
- Create: `src/apps/Safari/__tests__/SafariApp.test.tsx`

- [ ] **Step 1: Write component tests**

```tsx
// src/apps/Safari/__tests__/SafariApp.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SafariApp } from '../SafariApp';
import { useSafariStore } from '../safariStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

beforeEach(() => {
  useSafariStore.getState().reset();
  useAppRuntimeStore.setState({
    activeAppId: 'safari',
    appOrigin: { x: 0, y: 0, width: 60, height: 60 },
  });
});

describe('SafariApp', () => {
  it('renders the app container', () => {
    render(<SafariApp />);
    expect(screen.getByTestId('safari-app')).toBeInTheDocument();
  });

  it('shows URL bar with search placeholder on start page', () => {
    render(<SafariApp />);
    expect(screen.getByTestId('safari-url-bar')).toBeInTheDocument();
    expect(screen.getByText('搜索或输入网站名称')).toBeInTheDocument();
  });

  it('shows tab count badge', () => {
    render(<SafariApp />);
    const tabBtn = screen.getByTestId('safari-tabs-btn');
    expect(tabBtn).toBeInTheDocument();
    // Should show "1" for initial tab
    expect(tabBtn.textContent).toContain('1');
  });

  it('opens URL editing overlay on URL bar click', () => {
    render(<SafariApp />);
    fireEvent.click(screen.getByTestId('safari-url-bar'));
    expect(screen.getByTestId('safari-url-input')).toBeInTheDocument();
    expect(screen.getByTestId('safari-cancel-edit')).toBeInTheDocument();
  });

  it('cancel button has pill styling (rounded-[20px])', () => {
    render(<SafariApp />);
    fireEvent.click(screen.getByTestId('safari-url-bar'));
    const cancelBtn = screen.getByTestId('safari-cancel-edit');
    expect(cancelBtn.className).toContain('rounded-');
  });

  it('shows branded favicons instead of emojis', () => {
    render(<SafariApp />);
    expect(screen.getByTestId('safari-start-page')).toBeInTheDocument();
    // Should NOT contain any emoji characters from old design
    const startPage = screen.getByTestId('safari-start-page');
    expect(startPage.textContent).not.toContain('🍎');
    expect(startPage.textContent).not.toContain('🔍');
  });

  it('shows search history when available', () => {
    // Add search history
    act(() => useSafariStore.getState().navigateTo('test query'));
    // Go back to start page and open search
    act(() => useSafariStore.getState().goBack());
    render(<SafariApp />);
    fireEvent.click(screen.getByTestId('safari-url-bar'));
    expect(screen.getByText('test query')).toBeInTheDocument();
  });

  it('shows lock icon with domain when navigated', () => {
    act(() => useSafariStore.getState().navigateTo('https://apple.com'));
    render(<SafariApp />);
    expect(screen.getByText('apple.com')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/apps/Safari/__tests__/SafariApp.test.tsx`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/apps/Safari/__tests__/SafariApp.test.tsx
git commit -m "test(safari): add component tests for Phase 1 Chrome shell redesign"
```

---

### Task 7: Visual QA and final adjustments

**Files:**
- Modify: `src/apps/Safari/SafariApp.tsx` (if adjustments needed)
- Modify: `src/apps/Safari/safari.css` (if adjustments needed)

- [ ] **Step 1: Start dev server and verify all states**

Run: `npx vite dev`

Test checklist:
1. Open Safari app from home screen
2. Verify start page shows branded favicons (not emojis)
3. Verify bottom bar has gradient glass effect with upward shadow
4. Verify URL capsule has inset shadow appearance
5. Verify tab count badge shows "1"
6. Click URL bar → overlay opens with pill cancel button
7. Type text → search suggestions appear with blue/gray type icons
8. Navigate to a URL → loading shimmer appears (conic rotation)
9. Page loads → shimmer stops
10. Green lock icon + domain shown in URL bar
11. Back/forward buttons work with press state feedback
12. Switch to tab grid view → verify tab count is correct
13. Create new tab → tab count updates in badge

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 3: Run build**

Run: `npx vite build`
Expected: Build succeeds

- [ ] **Step 4: Final commit (if adjustments were made)**

```bash
git add -A src/apps/Safari/
git commit -m "fix(safari): Phase 1 visual QA adjustments"
```
