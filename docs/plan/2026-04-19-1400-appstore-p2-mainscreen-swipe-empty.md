# App Store Redesign — P2 · 主屏重构 + 左滑卸载 + 空状态

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development。每个 Task 派独立 subagent，两阶段 review 后入下一个。

**Goal:** 替换现有双 tab 的 AppStoreApp 为单页 iOS 大标题布局：主视图是"已装列表"（新版 InstalledAppRow 显示版本/大小/时间，左滑露出红色卸载 action，长按预留 hook），空时渲染 EmptyState。上传入口暂保留为把现有 UploadPage 包到一个简单 modal 里（P3 再替换为 UploadSheet 状态机）。

**Architecture:** 自底向上分层构建：工具函数 (T1) → SwipeRow 手势容器 (T2) → 新 InstalledAppRow (T3) → EmptyState (T4) → InstalledList (T5) → AppStoreApp 顶层重写 + 清理老文件 (T6) → 回归 (T7)。所有样式走 Tailwind utility，手势用 `useRef` 管理 isDragging（jsdom 兼容），spring 常量从 `@/platform/design-tokens/motion` import。

**Tech Stack:** React + TypeScript + Tailwind + lucide-react + Zustand + vitest + @testing-library/react。

**Upstream spec:** `docs/superpowers/specs/2026-04-19-appstore-ui-redesign-design.md` §4.1/4.2/4.9。

**Prereqs (已在 P1 落地):** `InstalledUserApp` 有 `version`/`installedAt`/`sizeBytes` 字段；installer 的 `onUpgradeDetected` 可选回调已接入（P3 才消费）。

---

## 文件布局

**新建：**
- `src/platform/utils/formatters.ts` — `formatByteSize`, `formatRelativeTime`
- `src/platform/utils/__tests__/formatters.test.ts`
- `src/apps/AppStore/components/SwipeRow.tsx` — 左滑手势容器
- `src/apps/AppStore/components/__tests__/SwipeRow.test.tsx`
- `src/apps/AppStore/components/EmptyState.tsx`
- `src/apps/AppStore/components/__tests__/EmptyState.test.tsx`
- `src/apps/AppStore/components/InstalledList.tsx`
- `src/apps/AppStore/components/__tests__/InstalledList.test.tsx`
- `src/apps/AppStore/__tests__/AppStoreApp.test.tsx` — 覆盖新布局
- `src/apps/AppStore/components/UploadSheetPlaceholder.tsx` — P2 临时 modal 壳，P3 替换

**修改：**
- `src/apps/AppStore/AppStoreApp.tsx` — 重写为单页 + 大标题 + "+" + drop target
- `src/apps/AppStore/components/InstalledAppRow.tsx` — 重写，消费 version/size/time，集成 SwipeRow，长按预留
- `src/apps/AppStore/components/__tests__/InstalledAppRow.test.tsx` — 重写

**删除：**
- `src/apps/AppStore/ManagePage.tsx`（内容并入 AppStoreApp）
- `src/apps/AppStore/components/UninstallConfirm.tsx`（左滑替代）
- `src/apps/AppStore/__tests__/ManagePage.test.tsx`（新的 AppStoreApp test 覆盖）

**不改：**
- `src/apps/AppStore/UploadPage.tsx` — P2 阶段保留运行，P3 替换
- `src/platform/userApp/installer.ts` — 纯消费
- 所有系统原子组件

---

## Task 1 · 工具函数 formatters.ts

**Files:**
- Create: `src/platform/utils/formatters.ts`
- Test: `src/platform/utils/__tests__/formatters.test.ts`

- [ ] **Step 1.1 · 写失败测试**

新建 `src/platform/utils/__tests__/formatters.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatByteSize, formatRelativeTime } from '../formatters';

describe('formatByteSize', () => {
  it('formats 0 as "—"', () => {
    expect(formatByteSize(0)).toBe('—');
  });
  it('formats < 1024 as "N B"', () => {
    expect(formatByteSize(512)).toBe('512 B');
  });
  it('formats KB with 1 decimal', () => {
    expect(formatByteSize(2048)).toBe('2.0 KB');
    expect(formatByteSize(1536)).toBe('1.5 KB');
  });
  it('formats MB with 1 decimal', () => {
    expect(formatByteSize(2.3 * 1024 * 1024)).toBe('2.3 MB');
  });
  it('handles huge values (GB)', () => {
    expect(formatByteSize(2 * 1024 * 1024 * 1024)).toMatch(/GB/);
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-04-19T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "今天" for timestamps within today', () => {
    expect(formatRelativeTime(NOW - 1000)).toBe('今天');
    expect(formatRelativeTime(NOW - 3_600_000)).toBe('今天');
  });
  it('returns "昨天" for 1 day ago', () => {
    expect(formatRelativeTime(NOW - 24 * 3_600_000 - 60_000)).toBe('昨天');
  });
  it('returns "N 天前" for 2-6 days ago', () => {
    expect(formatRelativeTime(NOW - 3 * 24 * 3_600_000)).toBe('3 天前');
    expect(formatRelativeTime(NOW - 6 * 24 * 3_600_000)).toBe('6 天前');
  });
  it('returns "上周" for 7-13 days ago', () => {
    expect(formatRelativeTime(NOW - 8 * 24 * 3_600_000)).toBe('上周');
  });
  it('returns "M 月 D 日" for older same-year dates', () => {
    const jan15 = new Date('2026-01-15T12:00:00Z').getTime();
    expect(formatRelativeTime(jan15)).toBe('1 月 15 日');
  });
  it('returns "YYYY 年 M 月 D 日" for different year', () => {
    const lastYear = new Date('2025-06-10T12:00:00Z').getTime();
    expect(formatRelativeTime(lastYear)).toBe('2025 年 6 月 10 日');
  });
  it('returns "—" for 0 or invalid', () => {
    expect(formatRelativeTime(0)).toBe('—');
  });
});
```

- [ ] **Step 1.2 · 跑红**

```bash
pnpm vitest run src/platform/utils/__tests__/formatters.test.ts
```

Expected: 全红（模块不存在）。

- [ ] **Step 1.3 · 实现 formatters.ts**

新建 `src/platform/utils/formatters.ts`：

```typescript
const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

/** Format byte count for UI. Returns "—" for 0 (legacy records). */
export function formatByteSize(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / GB).toFixed(1)} GB`;
}

const DAY_MS = 24 * 3_600_000;

/** Format a Unix ms timestamp as a Chinese relative time. "—" for 0. */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return '—';
  const now = Date.now();
  const then = new Date(timestamp);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStart = today.getTime();

  if (timestamp >= todayStart) return '今天';
  const daysAgo = Math.floor((todayStart - timestamp) / DAY_MS) + 1;
  if (daysAgo === 1) return '昨天';
  if (daysAgo < 7) return `${daysAgo} 天前`;
  if (daysAgo < 14) return '上周';

  const thenYear = then.getFullYear();
  const nowYear = new Date(now).getFullYear();
  const m = then.getMonth() + 1;
  const d = then.getDate();
  if (thenYear === nowYear) return `${m} 月 ${d} 日`;
  return `${thenYear} 年 ${m} 月 ${d} 日`;
}
```

- [ ] **Step 1.4 · 跑绿**

```bash
pnpm vitest run src/platform/utils/__tests__/formatters.test.ts
```

Expected: 全过（~14 用例）。

- [ ] **Step 1.5 · commit**

```bash
git add src/platform/utils/formatters.ts src/platform/utils/__tests__/formatters.test.ts
git commit -m "feat(utils): add formatByteSize + formatRelativeTime helpers"
```

---

## Task 2 · SwipeRow 手势容器

**Files:**
- Create: `src/apps/AppStore/components/SwipeRow.tsx`
- Test: `src/apps/AppStore/components/__tests__/SwipeRow.test.tsx`

**Design:**
- 左滑 pointer 手势；位移 ≤ 0（向左为负）时显示右侧"卸载" action
- 使用 `useRef` 管理 `isDragging` + `startX`（见 src/CLAUDE.md 踩坑 4）
- 释放时按 threshold（≥ 32px）吸附到 "-92px"（露出 action），否则回 0
- 点右侧 action → 调 `onDelete()`；点主体 children 时只在未露出时触发 `onOpen?.()`
- 命中区 ≥ 44px，action 宽度固定 92px

- [ ] **Step 2.1 · 写失败测试**

新建 `src/apps/AppStore/components/__tests__/SwipeRow.test.tsx`：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SwipeRow } from '../SwipeRow';

function makePointer(clientX: number) {
  return {
    clientX,
    clientY: 0,
    pointerId: 1,
    pointerType: 'touch',
    button: 0,
  };
}

describe('SwipeRow', () => {
  it('renders children in closed state', () => {
    render(
      <SwipeRow onDelete={() => {}}>
        <div>content</div>
      </SwipeRow>,
    );
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(screen.queryByTestId('swipe-delete-action')).not.toBeVisible();
  });

  it('exposes delete action after leftward swipe past threshold', () => {
    const onDelete = vi.fn();
    render(
      <SwipeRow onDelete={onDelete}>
        <div data-testid="child">content</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(200));
    fireEvent.pointerMove(track, makePointer(100)); // -100px
    fireEvent.pointerUp(track, makePointer(100));

    const action = screen.getByTestId('swipe-delete-action');
    expect(action).toBeVisible();
  });

  it('snaps back when swipe under threshold', () => {
    render(
      <SwipeRow onDelete={() => {}}>
        <div>c</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(200));
    fireEvent.pointerMove(track, makePointer(190)); // -10px
    fireEvent.pointerUp(track, makePointer(190));
    // Action should NOT be exposed (still closed)
    const action = screen.getByTestId('swipe-delete-action');
    // Use style translateX or aria-hidden to check; easiest: expect translate style
    expect(track.style.transform).toMatch(/translateX\(0(?:px)?\)/);
  });

  it('calls onDelete when action tapped', () => {
    const onDelete = vi.fn();
    render(
      <SwipeRow onDelete={onDelete}>
        <div>c</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(200));
    fireEvent.pointerMove(track, makePointer(80));
    fireEvent.pointerUp(track, makePointer(80));
    fireEvent.click(screen.getByTestId('swipe-delete-action'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('ignores rightward swipe (positive delta) — stays closed', () => {
    render(
      <SwipeRow onDelete={() => {}}>
        <div>c</div>
      </SwipeRow>,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, makePointer(100));
    fireEvent.pointerMove(track, makePointer(200));
    fireEvent.pointerUp(track, makePointer(200));
    expect(track.style.transform).toMatch(/translateX\(0(?:px)?\)/);
  });
});
```

- [ ] **Step 2.2 · 跑红**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/SwipeRow.test.tsx
```

Expected: 全红（组件不存在）。

- [ ] **Step 2.3 · 实现 SwipeRow**

新建 `src/apps/AppStore/components/SwipeRow.tsx`：

```typescript
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  onDelete: () => void;
  /** Label shown in the revealed action button; default "卸载". */
  deleteLabel?: string;
}

const ACTION_WIDTH = 92;
const THRESHOLD = 32;

export function SwipeRow({ children, onDelete, deleteLabel = '卸载' }: Props) {
  const isDragging = useRef(false);
  const startX = useRef(0);
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState(false);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    isDragging.current = true;
    startX.current = e.clientX;
  };

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current) return;
    const delta = e.clientX - startX.current;
    // Leftward drag only; clamp to [-ACTION_WIDTH, 0]
    const next = Math.min(0, Math.max(-ACTION_WIDTH, delta + (open ? -ACTION_WIDTH : 0)));
    setOffset(next);
  };

  const onPointerUp = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    const shouldOpen = offset < -THRESHOLD;
    setOpen(shouldOpen);
    setOffset(shouldOpen ? -ACTION_WIDTH : 0);
  };

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        data-testid="swipe-delete-action"
        aria-label={deleteLabel}
        onClick={onDelete}
        className="absolute inset-y-0 right-0 flex items-center justify-center gap-1 text-white bg-[var(--color-systemRed)] min-h-[44px]"
        style={{ width: ACTION_WIDTH }}
      >
        <Trash2 size={18} strokeWidth={2} />
        <span className="text-[13px]">{deleteLabel}</span>
      </button>
      <div
        data-testid="swipe-row-track"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className="relative bg-[var(--color-background)] touch-pan-y"
        style={{ transform: `translateX(${offset}px)`, transition: isDragging.current ? 'none' : 'transform 180ms ease-out' }}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2.4 · 跑绿**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/SwipeRow.test.tsx
```

Expected: 5 个用例全过。如果 "renders children in closed state" 的 `not.toBeVisible` 断言因 opacity 问题不稳定，改为 `expect(track.style.transform).toMatch(/translateX\(0/)` 更稳；按需调整测试（不要降低覆盖）。

- [ ] **Step 2.5 · commit**

```bash
git add src/apps/AppStore/components/SwipeRow.tsx src/apps/AppStore/components/__tests__/SwipeRow.test.tsx
git commit -m "feat(appstore): add SwipeRow left-swipe container with delete action"
```

---

## Task 3 · 新版 InstalledAppRow

**Files:**
- Modify: `src/apps/AppStore/components/InstalledAppRow.tsx` (重写)
- Test: `src/apps/AppStore/components/__tests__/InstalledAppRow.test.tsx` (重写)

**Design:**
- 三栏布局：`[icon 44×44] [name + meta (version · size · relative time)] [打开 按钮]`
- `打开` 按钮视觉亲和性，不是必须 — 整行是命中区，点任意位置调 `onOpen(id)`
- 整行包在 `<SwipeRow>` 里，`onDelete` 转调传入的 `onDelete`
- 长按 500ms 触发 `onLongPress(id)`（预留 hook；P3 接 Context Menu）— 用 `useLongPress` from `@/platform/gesture/useLongPress`
- Tailwind 为主，无 inline style（除了必要的动画）

- [ ] **Step 3.1 · 写失败测试**

替换 `src/apps/AppStore/components/__tests__/InstalledAppRow.test.tsx` 全部内容：

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstalledAppRow } from '../InstalledAppRow';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

const sample: InstalledUserApp = {
  id: 'demo',
  name: 'Demo',
  iconDataUrl: null,
  page: 1,
  perspectiveAware: false,
  version: '1.2.3',
  installedAt: Date.now() - 2 * 24 * 3_600_000,
  sizeBytes: 2 * 1024 * 1024,
};

describe('InstalledAppRow', () => {
  it('renders name, version, formatted size, relative time', () => {
    render(
      <InstalledAppRow app={sample} onOpen={() => {}} onDelete={() => {}} onLongPress={() => {}} />,
    );
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText(/1\.2\.3/)).toBeInTheDocument();
    expect(screen.getByText(/2\.0 MB/)).toBeInTheDocument();
    expect(screen.getByText(/2 天前/)).toBeInTheDocument();
  });

  it('shows default icon placeholder when no iconDataUrl', () => {
    render(
      <InstalledAppRow app={sample} onOpen={() => {}} onDelete={() => {}} onLongPress={() => {}} />,
    );
    expect(screen.getByTestId(`installed-app-icon-${sample.id}`)).toBeInTheDocument();
  });

  it('calls onOpen when "打开" button clicked', () => {
    const onOpen = vi.fn();
    render(
      <InstalledAppRow app={sample} onOpen={onOpen} onDelete={() => {}} onLongPress={() => {}} />,
    );
    fireEvent.click(screen.getByTestId(`open-button-${sample.id}`));
    expect(onOpen).toHaveBeenCalledWith(sample.id);
  });

  it('calls onDelete when swipe action tapped', () => {
    const onDelete = vi.fn();
    render(
      <InstalledAppRow app={sample} onOpen={() => {}} onDelete={onDelete} onLongPress={() => {}} />,
    );
    const track = screen.getByTestId('swipe-row-track');
    fireEvent.pointerDown(track, { clientX: 200, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerMove(track, { clientX: 80, pointerId: 1, pointerType: 'touch' });
    fireEvent.pointerUp(track, { clientX: 80, pointerId: 1, pointerType: 'touch' });
    fireEvent.click(screen.getByTestId('swipe-delete-action'));
    expect(onDelete).toHaveBeenCalledWith(sample.id);
  });

  it('formats "—" size for legacy (sizeBytes: 0)', () => {
    render(
      <InstalledAppRow
        app={{ ...sample, sizeBytes: 0 }}
        onOpen={() => {}}
        onDelete={() => {}}
        onLongPress={() => {}}
      />,
    );
    // Meta line contains '—' when size is 0
    expect(screen.getByTestId(`installed-app-meta-${sample.id}`).textContent).toContain('—');
  });
});
```

- [ ] **Step 3.2 · 跑红**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/InstalledAppRow.test.tsx
```

Expected: 红 — 新 props (`onOpen`, `onDelete`, `onLongPress`) 不存在；meta 渲染不对。

- [ ] **Step 3.3 · 重写 InstalledAppRow**

替换 `src/apps/AppStore/components/InstalledAppRow.tsx` 全部内容：

```typescript
import { ArrowUpRight } from 'lucide-react';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';
import { useLongPress } from '@/platform/gesture/useLongPress';
import { formatByteSize, formatRelativeTime } from '@/platform/utils/formatters';
import { SwipeRow } from './SwipeRow';

interface Props {
  app: InstalledUserApp;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function InstalledAppRow({ app, onOpen, onDelete, onLongPress }: Props) {
  const longPressProps = useLongPress(() => onLongPress(app.id), { delay: 500 });

  return (
    <SwipeRow onDelete={() => onDelete(app.id)}>
      <div
        data-testid={`installed-app-row-${app.id}`}
        className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-separator)] min-h-[60px]"
        {...longPressProps}
      >
        <div
          data-testid={`installed-app-icon-${app.id}`}
          className="w-11 h-11 rounded-[10px] overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#e0e0e0] to-[#a0a0a0]"
        >
          {app.iconDataUrl && (
            <img src={app.iconDataUrl} alt="" className="w-full h-full object-cover" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-medium text-[var(--color-label)] truncate">
            {app.name}
          </div>
          <div
            data-testid={`installed-app-meta-${app.id}`}
            className="text-[12px] text-[var(--color-secondaryLabel)] truncate"
          >
            {app.version} · {formatByteSize(app.sizeBytes)} · {formatRelativeTime(app.installedAt)}
          </div>
        </div>

        <button
          type="button"
          data-testid={`open-button-${app.id}`}
          aria-label={`打开 ${app.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onOpen(app.id);
          }}
          className="flex items-center gap-1 px-3 min-h-[32px] rounded-full bg-[var(--color-fill-secondary)] text-[13px] font-medium text-[var(--color-systemBlue)] flex-shrink-0"
        >
          <span>打开</span>
          <ArrowUpRight size={14} strokeWidth={2} />
        </button>
      </div>
    </SwipeRow>
  );
}
```

- [ ] **Step 3.4 · 跑绿**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/InstalledAppRow.test.tsx
```

Expected: 5 个用例全过。若某个测试因为 `useLongPress` 副作用失败（window event listeners），确保测试用 `act()` 或 fireEvent 正确模拟。

- [ ] **Step 3.5 · commit**

```bash
git add src/apps/AppStore/components/InstalledAppRow.tsx \
        src/apps/AppStore/components/__tests__/InstalledAppRow.test.tsx
git commit -m "feat(appstore): rewrite InstalledAppRow with version/size/time + swipe + long-press"
```

---

## Task 4 · EmptyState

**Files:**
- Create: `src/apps/AppStore/components/EmptyState.tsx`
- Test: `src/apps/AppStore/components/__tests__/EmptyState.test.tsx`

- [ ] **Step 4.1 · 写失败测试**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('renders heading, subtitle, and CTA', () => {
    render(<EmptyState onUpload={() => {}} />);
    expect(screen.getByText('还没装 App')).toBeInTheDocument();
    expect(screen.getByText(/拖拽文件/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /上传 zip/ })).toBeInTheDocument();
  });

  it('calls onUpload when CTA clicked', () => {
    const onUpload = vi.fn();
    render(<EmptyState onUpload={onUpload} />);
    fireEvent.click(screen.getByRole('button', { name: /上传 zip/ }));
    expect(onUpload).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4.2 · 跑红**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/EmptyState.test.tsx
```

Expected: 红。

- [ ] **Step 4.3 · 实现 EmptyState**

```typescript
import { ArrowDownToLine } from 'lucide-react';

interface Props {
  onUpload: () => void;
}

export function EmptyState({ onUpload }: Props) {
  return (
    <div
      data-testid="appstore-empty-state"
      className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <div className="w-[104px] h-[104px] rounded-[20px] bg-gradient-to-br from-[var(--color-systemBlue)] to-[#0060df] flex items-center justify-center">
        <ArrowDownToLine size={56} strokeWidth={1.75} className="text-white" />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-[22px] font-semibold text-[var(--color-label)]">还没装 App</h2>
        <p className="text-[14px] text-[var(--color-secondaryLabel)] max-w-[280px]">
          上传一个 zip 包体验你自己的 user app，或拖拽文件到任意位置自动安装。
        </p>
      </div>
      <button
        type="button"
        onClick={onUpload}
        className="min-h-[44px] px-6 rounded-full bg-[var(--color-systemBlue)] text-white text-[15px] font-medium"
      >
        上传 zip
      </button>
    </div>
  );
}
```

- [ ] **Step 4.4 · 跑绿**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/EmptyState.test.tsx
```

Expected: 2 用例全过。

- [ ] **Step 4.5 · commit**

```bash
git add src/apps/AppStore/components/EmptyState.tsx \
        src/apps/AppStore/components/__tests__/EmptyState.test.tsx
git commit -m "feat(appstore): add EmptyState with icon, heading, CTA"
```

---

## Task 5 · InstalledList

**Files:**
- Create: `src/apps/AppStore/components/InstalledList.tsx`
- Test: `src/apps/AppStore/components/__tests__/InstalledList.test.tsx`

**Design:**
- 组件负责：section header "已装 N 个 App" + 列表映射（按 installedAt 降序）
- 把 uninstall 的错误 toast 留给父层（AppStoreApp 统一处理）
- Props: `apps: InstalledUserApp[]`, `onOpen`, `onDelete`, `onLongPress`

- [ ] **Step 5.1 · 写失败测试**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstalledList } from '../InstalledList';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

function app(id: string, installedAt: number): InstalledUserApp {
  return {
    id,
    name: id.toUpperCase(),
    iconDataUrl: null,
    page: 1,
    perspectiveAware: false,
    version: '1.0.0',
    installedAt,
    sizeBytes: 1024,
  };
}

describe('InstalledList', () => {
  it('renders section header with app count', () => {
    const apps = [app('a', 2000), app('b', 1000)];
    render(<InstalledList apps={apps} onOpen={() => {}} onDelete={() => {}} onLongPress={() => {}} />);
    expect(screen.getByText(/已装 2 个/)).toBeInTheDocument();
  });

  it('sorts rows by installedAt descending', () => {
    const apps = [app('older', 1000), app('newer', 2000)];
    render(<InstalledList apps={apps} onOpen={() => {}} onDelete={() => {}} onLongPress={() => {}} />);
    const rows = screen.getAllByTestId(/installed-app-row-/);
    expect(rows[0]).toHaveAttribute('data-testid', 'installed-app-row-newer');
    expect(rows[1]).toHaveAttribute('data-testid', 'installed-app-row-older');
  });
});
```

- [ ] **Step 5.2 · 跑红**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/InstalledList.test.tsx
```

Expected: 红。

- [ ] **Step 5.3 · 实现 InstalledList**

```typescript
import { useMemo } from 'react';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';
import { InstalledAppRow } from './InstalledAppRow';

interface Props {
  apps: InstalledUserApp[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onLongPress: (id: string) => void;
}

export function InstalledList({ apps, onOpen, onDelete, onLongPress }: Props) {
  const sorted = useMemo(
    () => [...apps].sort((a, b) => b.installedAt - a.installedAt),
    [apps],
  );

  return (
    <div data-testid="appstore-installed-list" className="flex-1 overflow-y-auto">
      <div className="px-4 pt-3 pb-2 text-[13px] text-[var(--color-secondaryLabel)] uppercase tracking-wide">
        已装 {apps.length} 个 App
      </div>
      {sorted.map((app) => (
        <InstalledAppRow
          key={app.id}
          app={app}
          onOpen={onOpen}
          onDelete={onDelete}
          onLongPress={onLongPress}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5.4 · 跑绿**

```bash
pnpm vitest run src/apps/AppStore/components/__tests__/InstalledList.test.tsx
```

Expected: 2 用例全过。

- [ ] **Step 5.5 · commit**

```bash
git add src/apps/AppStore/components/InstalledList.tsx \
        src/apps/AppStore/components/__tests__/InstalledList.test.tsx
git commit -m "feat(appstore): add InstalledList with section header + sort"
```

---

## Task 6 · 重写 AppStoreApp + 清理老文件

**Files:**
- Modify: `src/apps/AppStore/AppStoreApp.tsx` (完全重写)
- Create: `src/apps/AppStore/components/UploadSheetPlaceholder.tsx`
- Create: `src/apps/AppStore/__tests__/AppStoreApp.test.tsx`
- Delete: `src/apps/AppStore/ManagePage.tsx`
- Delete: `src/apps/AppStore/components/UninstallConfirm.tsx`
- Delete: `src/apps/AppStore/__tests__/ManagePage.test.tsx`

**Design:**
- 单页：`<AppScreen>` + `<NavBar variant="largeTitle" title="App Store" rightButtons={[{ icon: <Plus/>, onClick: openSheet }]}/>`
- Body：已装数 0 → `<EmptyState>`；否则 `<InstalledList>`
- 整页 drop target：dragover/drop 全局监听，拖入 zip 打开 sheet 并传文件给 UploadSheetPlaceholder
- UploadSheetPlaceholder：半屏 modal 包裹现有 UploadPage，带顶部 handle，关闭按钮；**不动 UploadPage 内部逻辑，P3 替换**
- uninstall 错误：`useToastStore` 顶部 toast（如无此 store，用本地 state 渲染一个 dismissable banner，代码见实现步骤）
- 关闭 sheet 时清 `pendingFile`

- [ ] **Step 6.1 · 写失败测试**

新建 `src/apps/AppStore/__tests__/AppStoreApp.test.tsx`：

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AppStoreApp } from '../AppStoreApp';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

describe('AppStoreApp', () => {
  beforeEach(() => {
    useInstalledUserAppsStore.setState({ apps: [] });
  });

  it('renders large-title NavBar', () => {
    render(<AppStoreApp />);
    expect(screen.getByText('App Store')).toBeInTheDocument();
  });

  it('renders EmptyState when no apps installed', () => {
    render(<AppStoreApp />);
    expect(screen.getByTestId('appstore-empty-state')).toBeInTheDocument();
  });

  it('renders InstalledList when apps exist', () => {
    useInstalledUserAppsStore.setState({
      apps: [
        {
          id: 'demo',
          name: 'Demo',
          iconDataUrl: null,
          page: 1,
          perspectiveAware: false,
          version: '1.0.0',
          installedAt: Date.now(),
          sizeBytes: 0,
        },
      ],
    });
    render(<AppStoreApp />);
    expect(screen.getByTestId('appstore-installed-list')).toBeInTheDocument();
  });

  it('opens upload sheet when "+" button clicked', () => {
    render(<AppStoreApp />);
    fireEvent.click(screen.getByTestId('appstore-plus-button'));
    expect(screen.getByTestId('appstore-upload-sheet')).toBeInTheDocument();
  });

  it('opens upload sheet via EmptyState CTA', () => {
    render(<AppStoreApp />);
    fireEvent.click(screen.getByRole('button', { name: /上传 zip/ }));
    expect(screen.getByTestId('appstore-upload-sheet')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6.2 · 跑红**

```bash
pnpm vitest run src/apps/AppStore/__tests__/AppStoreApp.test.tsx
```

Expected: 红。

- [ ] **Step 6.3 · 实现 UploadSheetPlaceholder**

新建 `src/apps/AppStore/components/UploadSheetPlaceholder.tsx`：

```typescript
import { X } from 'lucide-react';
import { UploadPage } from '../UploadPage';

interface Props {
  onClose: () => void;
}

/**
 * P2 临时 sheet 壳。P3 会替换为完整的 UploadSheet 状态机
 * （idle → installing → needsUpgradeConfirm → success/error）。
 */
export function UploadSheetPlaceholder({ onClose }: Props) {
  return (
    <div
      data-testid="appstore-upload-sheet"
      className="absolute inset-0 z-20 flex flex-col"
    >
      <div
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative mt-auto bg-[var(--color-background)] rounded-t-[14px] flex flex-col min-h-[60%] max-h-[90%]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-separator)]">
          <div className="w-[36px] h-[5px] rounded-full bg-[var(--color-fill-tertiary)] absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[17px] font-semibold text-[var(--color-label)] mt-2">
            上传 App
          </span>
          <button
            type="button"
            aria-label="关闭"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-[var(--color-fill-secondary)]"
          >
            <X size={16} strokeWidth={2.5} className="text-[var(--color-secondaryLabel)]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <UploadPage />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6.4 · 重写 AppStoreApp**

替换 `src/apps/AppStore/AppStoreApp.tsx` 全部内容：

```typescript
import { useState, useCallback, type DragEvent } from 'react';
import { Plus } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { uninstall } from '@/platform/userApp/installer';
import { EmptyState } from './components/EmptyState';
import { InstalledList } from './components/InstalledList';
import { UploadSheetPlaceholder } from './components/UploadSheetPlaceholder';

export function AppStoreApp() {
  const apps = useInstalledUserAppsStore((s) => s.apps);
  const openApp = useAppRuntimeStore((s) => s.openApp);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const openSheet = useCallback(() => setSheetOpen(true), []);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  const handleOpen = useCallback(
    (id: string) => {
      openApp(id, null);
    },
    [openApp],
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await uninstall(id);
    } catch (err) {
      setToast(err instanceof Error ? err.message : String(err));
      setTimeout(() => setToast(null), 3000);
    }
  }, []);

  const handleLongPress = useCallback((_id: string) => {
    // P3 will wire this to AppContextMenu. P2 placeholder: noop.
  }, []);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) setDragOver(true);
  };
  const onDragLeave = () => setDragOver(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) setSheetOpen(true);
  };

  return (
    <AppScreen>
      <NavBar
        title="App Store"
        variant="largeTitle"
        rightButtons={[
          {
            icon: <Plus size={22} strokeWidth={2.25} />,
            onClick: openSheet,
            testId: 'appstore-plus-button',
          },
        ]}
      />
      <div
        className={`flex-1 min-h-0 flex flex-col relative ${dragOver ? 'ring-2 ring-[var(--color-systemBlue)] ring-inset' : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {apps.length === 0 ? (
          <EmptyState onUpload={openSheet} />
        ) : (
          <InstalledList
            apps={apps}
            onOpen={handleOpen}
            onDelete={handleDelete}
            onLongPress={handleLongPress}
          />
        )}

        {toast && (
          <div
            data-testid="appstore-toast"
            className="absolute top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-[var(--color-systemRed)] text-white text-[14px]"
          >
            {toast}
          </div>
        )}
      </div>

      {sheetOpen && <UploadSheetPlaceholder onClose={closeSheet} />}
    </AppScreen>
  );
}
```

**Note on `rightButtons` testId**: verify current NavBar's NavBarButton type supports `testId`. If not, adapt by wrapping button content in a `<span data-testid="appstore-plus-button">`. Read `src/system/NavBar/NavBar.tsx` first if unsure.

- [ ] **Step 6.5 · 删除老文件**

```bash
git rm src/apps/AppStore/ManagePage.tsx \
       src/apps/AppStore/components/UninstallConfirm.tsx \
       src/apps/AppStore/__tests__/ManagePage.test.tsx
```

**IMPORTANT**: grep to confirm no other file imports these:

```bash
grep -rn "ManagePage\|UninstallConfirm" src/ --exclude-dir=node_modules || true
```

Expected: no matches after deletion. If matches found (e.g., AppStoreApp.tsx still importing ManagePage), fix those imports in Step 6.4 before running rm.

- [ ] **Step 6.6 · 跑绿**

```bash
pnpm vitest run src/apps/AppStore/
```

Expected: AppStoreApp tests + all child component tests pass.

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6.7 · commit**

```bash
git add src/apps/AppStore/AppStoreApp.tsx \
        src/apps/AppStore/components/UploadSheetPlaceholder.tsx \
        src/apps/AppStore/__tests__/AppStoreApp.test.tsx
# Deletions should already be staged by git rm above
git commit -m "feat(appstore): rewrite as single-page large-title + empty state + drag-drop"
```

---

## Task 7 · 回归 & 类型 & 构建

- [ ] **Step 7.1 · tsc**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 7.2 · 全量测试**

```bash
pnpm vitest run
```

Expected: 全绿。如有外层引用 ManagePage/UninstallConfirm 的测试爆掉，修补引用或删除陈旧测试。

- [ ] **Step 7.3 · build**

```bash
pnpm build
```

Expected: tsc 过；PWA workbox 的 2MB chunk 警告与 P1/P2 无关（pre-existing）。

- [ ] **Step 7.4 · 无 commit（前面 task 已增量提交）**

---

## 完成标志

- [ ] `AppStoreApp.tsx` 是单页（无 tab），大标题 + "+" 按钮 + drop target
- [ ] 已装数 0 时渲染 `EmptyState`，否则 `InstalledList`
- [ ] 每个行显示 `版本 · 大小 · 相对时间`
- [ ] 左滑行露出红色"卸载"action，点 action 调 `uninstall(id)`
- [ ] 长按 500ms 触发 `onLongPress(id)`（P3 接入实际菜单）
- [ ] 顶部 toast 展示卸载失败
- [ ] `ManagePage.tsx` / `UninstallConfirm.tsx` 已删，仓库无残留引用
- [ ] `pnpm tsc --noEmit` 干净
- [ ] `pnpm vitest run` 全绿
- [ ] 6 个 task commit（T1-T6），T7 无 commit

---

## 下一步（P3）

P3 · UploadSheet 状态机 + 长按 Context Menu + 详情 Sheet：
- 替换 `UploadSheetPlaceholder` 为真正的 `UploadSheet`（4 phase 状态机：idle/installing/needsUpgradeConfirm/success/error）
- 消费 `installer.onUpgradeDetected`（P1 已接入）
- 把 `onLongPress` 的 noop 替换为打开 `AppContextMenu`
- 新增 `AppDetailSheet` 供 Context Menu "查看详情" 使用
- 删除 `UploadPage.tsx`
