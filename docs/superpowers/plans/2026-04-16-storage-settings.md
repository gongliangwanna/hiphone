# Storage Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "存储" page in Settings that visualizes per-category storage usage and hosts the "delete all data" action.

**Architecture:** New `calculateStorageUsage()` utility reads all three IDB object stores, classifies entries by key prefix, and returns byte estimates per category. A new `StoragePage` component renders an iOS-style stacked color bar + category list. The existing "删除所有数据" logic moves from `SettingsHome` into `StoragePage`.

**Tech Stack:** React, Zustand, IndexedDB (via existing `getDB()`), lucide-react icons, Tailwind CSS, Vitest

---

### Task 1: Storage Usage Calculator

**Files:**
- Create: `src/platform/storage/calculateStorageUsage.ts`
- Create: `src/platform/storage/__tests__/calculateStorageUsage.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// src/platform/storage/__tests__/calculateStorageUsage.test.ts
import { describe, it, expect } from 'vitest';
import { formatBytes, classifyKvKey, STORAGE_CATEGORIES } from '../calculateStorageUsage';

describe('formatBytes', () => {
  it('returns "0 KB" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 KB');
  });

  it('returns "< 1 KB" for small non-zero values', () => {
    expect(formatBytes(500)).toBe('< 1 KB');
  });

  it('returns whole KB for values under 1 MB', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(512000)).toBe('500 KB');
  });

  it('returns one-decimal MB for values >= 1 MB', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(2621440)).toBe('2.5 MB');
  });
});

describe('classifyKvKey', () => {
  it('classifies character-related keys', () => {
    expect(classifyKvKey('hiPhone-characters')).toBe('characters');
    expect(classifyKvKey('hiPhone-persona')).toBe('characters');
    expect(classifyKvKey('hiPhone-world-books')).toBe('characters');
  });

  it('classifies notes keys (including per-entity)', () => {
    expect(classifyKvKey('hiPhone-notes')).toBe('notes');
    expect(classifyKvKey('hiPhone-notes::char-abc')).toBe('notes');
  });

  it('classifies calendar key', () => {
    expect(classifyKvKey('hiPhone-calendar')).toBe('calendar');
  });

  it('classifies everything else as other', () => {
    expect(classifyKvKey('hiPhone-ai-config')).toBe('other');
    expect(classifyKvKey('hiPhone-springboard')).toBe('other');
    expect(classifyKvKey('hiPhone-music')).toBe('other');
    expect(classifyKvKey('hiPhone-system')).toBe('other');
    expect(classifyKvKey('hiPhone-gomoku')).toBe('other');
  });
});

describe('STORAGE_CATEGORIES', () => {
  it('has 6 categories with required fields', () => {
    expect(STORAGE_CATEGORIES).toHaveLength(6);
    for (const cat of STORAGE_CATEGORIES) {
      expect(cat).toHaveProperty('key');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('icon');
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/platform/storage/__tests__/calculateStorageUsage.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/platform/storage/calculateStorageUsage.ts
import { getDB, hasIDB, MESSAGES_STORE, MOMENTS_STORE } from './idbStorage';

// ---------------------------------------------------------------------------
// Category definitions
// ---------------------------------------------------------------------------

export interface StorageCategoryDef {
  key: string;
  label: string;
  color: string;
  icon: string; // lucide-react icon name
}

export const STORAGE_CATEGORIES: StorageCategoryDef[] = [
  { key: 'messages', label: '聊天消息', color: '#34C759', icon: 'MessageCircle' },
  { key: 'moments', label: '朋友圈动态', color: '#5856D6', icon: 'Image' },
  { key: 'characters', label: '角色卡', color: '#AF52DE', icon: 'User' },
  { key: 'notes', label: '备忘录', color: '#FF9500', icon: 'Pencil' },
  { key: 'calendar', label: '日历事件', color: '#007AFF', icon: 'Calendar' },
  { key: 'other', label: '其他', color: '#8E8E93', icon: 'Folder' },
];

// ---------------------------------------------------------------------------
// KV key → category mapping
// ---------------------------------------------------------------------------

const CHARACTER_KEYS = new Set([
  'hiPhone-characters',
  'hiPhone-persona',
  'hiPhone-world-books',
]);

export function classifyKvKey(key: string): string {
  if (CHARACTER_KEYS.has(key)) return 'characters';
  if (key === 'hiPhone-notes' || key.startsWith('hiPhone-notes::')) return 'notes';
  if (key === 'hiPhone-calendar') return 'calendar';
  return 'other';
}

// ---------------------------------------------------------------------------
// Byte estimation
// ---------------------------------------------------------------------------

function estimateBytes(value: unknown): number {
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Format bytes for display
// ---------------------------------------------------------------------------

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return '< 1 KB';
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Main calculator
// ---------------------------------------------------------------------------

export interface StorageUsageResult {
  /** Bytes per category key */
  byCategory: Record<string, number>;
  totalBytes: number;
}

export async function calculateStorageUsage(): Promise<StorageUsageResult> {
  const byCategory: Record<string, number> = {};
  for (const cat of STORAGE_CATEGORIES) {
    byCategory[cat.key] = 0;
  }

  if (!hasIDB) return { byCategory, totalBytes: 0 };

  try {
    const db = await getDB();

    // 1. Messages store → 'messages' category
    const messages = await getAllFromStore(db, MESSAGES_STORE);
    for (const msg of messages) {
      byCategory.messages += estimateBytes(msg);
    }

    // 2. Moments store → 'moments' category
    const moments = await getAllFromStore(db, MOMENTS_STORE);
    for (const m of moments) {
      byCategory.moments += estimateBytes(m);
    }

    // 3. KV store → classify by key
    const kvEntries = await getAllKvEntries(db);
    for (const { key, value } of kvEntries) {
      const category = classifyKvKey(key);
      byCategory[category] = (byCategory[category] ?? 0) + estimateBytes(value);
    }
  } catch (e) {
    console.warn('[calculateStorageUsage] failed:', e);
  }

  const totalBytes = Object.values(byCategory).reduce((sum, b) => sum + b, 0);
  return { byCategory, totalBytes };
}

// ---------------------------------------------------------------------------
// IDB helpers (read-only traversal)
// ---------------------------------------------------------------------------

function getAllFromStore(db: IDBDatabase, storeName: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getAllKvEntries(
  db: IDBDatabase,
): Promise<{ key: string; value: unknown }[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction('kv', 'readonly');
    const store = tx.objectStore('kv');
    const entries: { key: string; value: unknown }[] = [];
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (cursor) {
        entries.push({ key: cursor.key as string, value: cursor.value });
        cursor.continue();
      } else {
        resolve(entries);
      }
    };
    req.onerror = () => reject(req.error);
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/platform/storage/__tests__/calculateStorageUsage.test.ts`
Expected: PASS — all 7 tests pass (formatBytes × 4, classifyKvKey × 4, STORAGE_CATEGORIES × 1)

Note: `calculateStorageUsage()` itself is async and requires IDB — it's not unit-testable in jsdom without fake-indexeddb. The pure functions (`formatBytes`, `classifyKvKey`) are fully tested. The async function will be verified via integration in the browser.

- [ ] **Step 5: Commit**

```bash
git add src/platform/storage/calculateStorageUsage.ts src/platform/storage/__tests__/calculateStorageUsage.test.ts
git commit -m "feat(storage): add calculateStorageUsage utility with formatBytes and classifyKvKey"
```

---

### Task 2: StoragePage Component

**Files:**
- Create: `src/apps/Settings/pages/StoragePage.tsx`

**Dependencies:** Task 1 (needs `calculateStorageUsage`, `formatBytes`, `STORAGE_CATEGORIES`)

- [ ] **Step 1: Create the StoragePage component**

```tsx
// src/apps/Settings/pages/StoragePage.tsx
import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Image,
  User,
  Pencil,
  Calendar,
  Folder,
  Trash2,
} from 'lucide-react';
import { ListSection, ListRow } from '@/system';
import {
  calculateStorageUsage,
  formatBytes,
  STORAGE_CATEGORIES,
  type StorageUsageResult,
} from '@/platform/storage/calculateStorageUsage';

// Map icon name string → React component
const ICON_MAP: Record<string, React.ComponentType<{ size?: number }>> = {
  MessageCircle,
  Image,
  User,
  Pencil,
  Calendar,
  Folder,
};

export function StoragePage() {
  const [usage, setUsage] = useState<StorageUsageResult | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    calculateStorageUsage().then(setUsage);
  }, []);

  const handleResetAllData = async () => {
    try {
      if ('databases' in indexedDB) {
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) indexedDB.deleteDatabase(db.name);
        }
      }
      localStorage.clear();
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
      }
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  if (!usage) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
        data-testid="storage-page"
      >
        <span style={{ color: 'var(--color-secondaryLabel)', fontSize: 15 }}>
          正在计算…
        </span>
      </div>
    );
  }

  const totalLabel = formatBytes(usage.totalBytes);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      data-testid="storage-page"
    >
      <div style={{ padding: 'var(--spacing-4)' }}>
        {/* ── Storage Overview Bar ── */}
        <div className="mb-6">
          <div
            className="overflow-hidden"
            style={{
              backgroundColor: 'var(--color-tertiarySystemBackground)',
              borderRadius: 'var(--radius-group)',
              padding: 16,
            }}
          >
            <div
              className="mb-2 flex justify-between"
              style={{ fontSize: 13, color: 'var(--color-secondaryLabel)' }}
            >
              <span>已使用</span>
              <span>{totalLabel}</span>
            </div>

            {/* Stacked color bar */}
            <div
              className="flex overflow-hidden"
              style={{
                height: 24,
                borderRadius: 6,
                backgroundColor: 'var(--color-systemFill)',
              }}
            >
              {STORAGE_CATEGORIES.map((cat) => {
                const bytes = usage.byCategory[cat.key] ?? 0;
                if (bytes === 0 || usage.totalBytes === 0) return null;
                const pct = (bytes / usage.totalBytes) * 100;
                return (
                  <div
                    key={cat.key}
                    style={{
                      width: `${pct}%`,
                      backgroundColor: cat.color,
                      minWidth: pct > 0 ? 2 : 0,
                    }}
                  />
                );
              })}
            </div>

            {/* Legend */}
            <div
              className="mt-2.5 flex flex-wrap"
              style={{
                gap: '6px 14px',
                fontSize: 11,
                color: 'var(--color-secondaryLabel)',
              }}
            >
              {STORAGE_CATEGORIES.map((cat) => (
                <span key={cat.key} className="flex items-center gap-1">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 8,
                      borderRadius: 2,
                      backgroundColor: cat.color,
                    }}
                  />
                  {cat.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Category Breakdown ── */}
        <ListSection>
          {STORAGE_CATEGORIES.map((cat, i) => {
            const IconComp = ICON_MAP[cat.icon];
            const bytes = usage.byCategory[cat.key] ?? 0;
            return (
              <ListRow
                key={cat.key}
                icon={IconComp ? <IconComp size={16} /> : undefined}
                iconColor={cat.color}
                title={cat.label}
                detail={formatBytes(bytes)}
                isLast={i === STORAGE_CATEGORIES.length - 1}
              />
            );
          })}
        </ListSection>

        {/* ── Delete All Data ── */}
        <ListSection>
          <ListRow
            icon={<Trash2 size={16} />}
            iconColor="#FF3B30"
            title={<span style={{ color: '#FF3B30' }}>删除所有数据</span>}
            onClick={() => setShowResetConfirm(true)}
            isLast
          />
        </ListSection>

        <div style={{ height: 40 }} />
      </div>

      {/* ── Confirm Dialog ── */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="mx-8 w-full overflow-hidden"
            style={{
              maxWidth: 270,
              borderRadius: 14,
              backgroundColor: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 pt-5 pb-4 text-center">
              <div style={{ fontSize: 17, fontWeight: 600, color: '#000' }}>
                删除所有数据
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: '#666',
                  marginTop: 8,
                  lineHeight: 1.4,
                }}
              >
                将清除所有聊天记录、角色数据、设置等内容，且无法恢复。确定要继续吗？
              </div>
            </div>
            <div
              style={{ borderTop: '0.5px solid rgba(0,0,0,0.1)' }}
              className="flex"
            >
              <button
                className="flex-1 py-3 text-center active:bg-black/5"
                style={{
                  fontSize: 17,
                  color: '#007AFF',
                  borderRight: '0.5px solid rgba(0,0,0,0.1)',
                }}
                onClick={() => setShowResetConfirm(false)}
              >
                取消
              </button>
              <button
                className="flex-1 py-3 text-center active:bg-black/5"
                style={{ fontSize: 17, fontWeight: 600, color: '#FF3B30' }}
                onClick={handleResetAllData}
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/apps/Settings/pages/StoragePage.tsx
git commit -m "feat(settings): add StoragePage with usage visualization and delete-all"
```

---

### Task 3: Route Registration & Home Page Wiring

**Files:**
- Modify: `src/apps/Settings/SettingsApp.tsx` (add import + route entries)
- Modify: `src/apps/Settings/SettingsHome.tsx` (add entry row, remove danger zone)

**Dependencies:** Task 2 (needs `StoragePage` to exist)

- [ ] **Step 1: Register the route in SettingsApp.tsx**

Add the import at the end of the import block (after line 21):

```typescript
import { StoragePage } from './pages/StoragePage';
```

Add to `PAGE_TITLES` (after `display: '显示与亮度'` line 30):

```typescript
  storage: '存储',
```

Add to `PAGE_COMPONENTS` (after `display: DisplayPage` line 51):

```typescript
  storage: StoragePage,
```

- [ ] **Step 2: Modify SettingsHome.tsx — add entry, remove danger zone**

Add `HardDrive` to the lucide-react imports (line 1-14). Replace the import line:

```typescript
import {
  Heart,
  Cpu,
  Activity,
  Image,
  Info,
  ChevronRight,
  ShieldAlert,
  BookOpen,
  Trash2,
  Wrench,
  User,
  HardDrive,
} from 'lucide-react';
```

Remove the `showResetConfirm` state declaration (line 29):
```typescript
// DELETE: const [showResetConfirm, setShowResetConfirm] = useState(false);
```

Remove the entire `handleResetAllData` function (lines 31-52).

Remove the `useState` import if no other useState remains. Check: the only useState usage was `showResetConfirm`. So update line 1:
```typescript
import { useSettingsNavStore } from './settingsNavStore';
```
(Remove `useState` from the `import { useState } from 'react'` on line 1.)

In the Device Section (lines 156-186), add a new ListRow for storage after the 壁纸 row (after line 163):

```tsx
        <ListRow
          icon={<HardDrive size={16} />}
          iconColor="#8E8E93"
          title="存储"
          onClick={() => push('storage')}
          chevron
        />
```

Remove the entire Danger Zone section (lines 188-197):
```tsx
// DELETE the entire ListSection containing "删除所有数据"
```

Remove the entire confirm dialog (lines 199-247):
```tsx
// DELETE the entire {showResetConfirm && (...)} block
```

- [ ] **Step 3: Run the existing SettingsApp tests**

Run: `npx vitest run src/apps/Settings/SettingsApp.test.tsx`

The test at line 29 checks for `list-row-关于本机` — still present, should pass. No test references "删除所有数据" by testid, so removal won't break existing tests.

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/apps/Settings/SettingsApp.tsx src/apps/Settings/SettingsHome.tsx
git commit -m "feat(settings): wire StoragePage route and add entry in device section"
```

---

### Task 4: Integration Test

**Files:**
- Create: `src/apps/Settings/pages/__tests__/StoragePage.test.tsx`

**Dependencies:** Task 3 (full wiring needed)

- [ ] **Step 1: Write the integration test**

```tsx
// src/apps/Settings/pages/__tests__/StoragePage.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsApp } from '../../SettingsApp';
import { useSettingsNavStore } from '../../settingsNavStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

// Mock the storage calculator — IDB is not available in jsdom
vi.mock('@/platform/storage/calculateStorageUsage', async () => {
  const actual = await vi.importActual('@/platform/storage/calculateStorageUsage');
  return {
    ...actual,
    calculateStorageUsage: vi.fn().mockResolvedValue({
      byCategory: {
        messages: 860000,
        moments: 480000,
        characters: 290000,
        notes: 120000,
        calendar: 45000,
        other: 85000,
      },
      totalBytes: 1880000,
    }),
  };
});

describe('StoragePage', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    useAppRuntimeStore.setState({
      activeAppId: 'settings',
      appOrigin: { x: 0, y: 0, width: 60, height: 60 },
    });
  });

  it('navigates to storage page from settings home', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByTestId('storage-page')).toBeInTheDocument();
    });
  });

  it('displays category labels and sizes after loading', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByTestId('storage-page')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('聊天消息')).toBeInTheDocument();
      expect(screen.getByText('840 KB')).toBeInTheDocument();
      expect(screen.getByText('朋友圈动态')).toBeInTheDocument();
      expect(screen.getByText('角色卡')).toBeInTheDocument();
      expect(screen.getByText('备忘录')).toBeInTheDocument();
      expect(screen.getByText('日历事件')).toBeInTheDocument();
      expect(screen.getByText('其他')).toBeInTheDocument();
    });
  });

  it('displays total usage in header', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByText('1.8 MB')).toBeInTheDocument();
    });
  });

  it('shows delete confirmation dialog', async () => {
    render(<SettingsApp />);
    await userEvent.click(screen.getByTestId('list-row-存储'));

    await waitFor(() => {
      expect(screen.getByTestId('storage-page')).toBeInTheDocument();
    });

    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.getByText('聊天消息')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('删除所有数据'));
    expect(screen.getByText('将清除所有聊天记录、角色数据、设置等内容，且无法恢复。确定要继续吗？')).toBeInTheDocument();
  });

  it('delete all data is no longer on settings home', () => {
    render(<SettingsApp />);
    expect(screen.queryByText('删除所有数据')).toBeNull();
  });
});
```

- [ ] **Step 2: Run all tests**

Run: `npx vitest run src/apps/Settings/`
Expected: All tests pass (both `SettingsApp.test.tsx` and `StoragePage.test.tsx`)

- [ ] **Step 3: Commit**

```bash
git add src/apps/Settings/pages/__tests__/StoragePage.test.tsx
git commit -m "test(settings): add StoragePage integration tests"
```

---

### Task 5: Manual Verification & Deploy

**Files:** None (verification only)

**Dependencies:** Task 4

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass, no regressions

- [ ] **Step 2: Build and verify**

Run: `pnpm build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Local verification**

Run: `pnpm dev`

Verify in browser:
1. Open Settings → see "存储" row in device section with gray HardDrive icon
2. Tap "存储" → page slides in with title "存储"
3. See stacked color bar at top with legend
4. See 6 category rows with icons, labels, and byte sizes
5. "删除所有数据" button at bottom
6. Tap delete → confirm dialog appears
7. Tap 取消 → dialog closes
8. Back button returns to settings home
9. "删除所有数据" no longer appears on settings home page

- [ ] **Step 4: Deploy**

Run: `npx -y wrangler pages deploy dist --project-name mini-iphone --commit-dirty=true`
Verify: https://mini-iphone.pages.dev/
