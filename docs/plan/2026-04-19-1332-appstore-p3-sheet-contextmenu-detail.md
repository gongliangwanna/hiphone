# P3 · UploadSheet 状态机 + 长按菜单 + 详情 Sheet

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development`. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 完成 App Store UI 重设计第三阶段 — 用带状态机的半屏 UploadSheet 替换 P2 的 Placeholder,给已装行接上长按 Context Menu + 详情 Sheet,删除旧 `UploadPage.tsx`。

**Architecture:**
- UploadSheet 是 `<modal sheet>`,内部 5 phase 状态机 (`idle` → `installing` → `needsUpgradeConfirm?` → `success | error`),每 phase 渲染一个 View 子组件。
- AppContextMenu 在长按后 overlay 显示,提供"打开 / 查看详情 / 卸载"三项;"查看详情"打开 AppDetailSheet。
- installer.ts 已在 P1 加好 `onUpgradeDetected` 回调,P3 UploadSheet 通过 Promise resolver pattern 消费它。

**Tech Stack:** React + TypeScript, Tailwind (项目规范), `lucide-react` icons, `<Material>`(backdrop-filter), vitest + jsdom, `useRef` for gesture state (src/CLAUDE.md 踩坑 4), 现有 spring tokens。

**Parent spec:** `docs/superpowers/specs/2026-04-19-appstore-ui-redesign-design.md` §4.3–§4.8
**Preceding plans:** P1 `docs/plan/2026-04-19-1220-appstore-p1-installer-store.md` (完成), P2 `docs/plan/2026-04-19-1400-appstore-p2-mainscreen-swipe-empty.md` (完成)

---

## 文件结构

新建:
```
src/apps/AppStore/components/
├── UploadSheet.tsx                     主 sheet 容器 + 状态机
├── AppContextMenu.tsx                  长按浮层菜单
├── AppDetailSheet.tsx                  详情 sheet
└── views/
    ├── DropZoneView.tsx                idle phase
    ├── InstallProgressView.tsx         installing phase(含 progress ring)
    ├── UpgradeConfirmView.tsx          needsUpgradeConfirm phase
    ├── InstallSuccessView.tsx          success phase
    └── InstallErrorView.tsx            error phase
```

修改:
- `src/apps/AppStore/AppStoreApp.tsx` — 用 `<UploadSheet>` 替换 `<UploadSheetPlaceholder>`,接入 `<AppContextMenu>` + `<AppDetailSheet>`(消费 `handleLongPress`)

删除:
- `src/apps/AppStore/UploadPage.tsx`
- `src/apps/AppStore/components/UploadSheetPlaceholder.tsx`

测试新增(一一对应):
```
src/apps/AppStore/components/__tests__/
├── UploadSheet.test.tsx
├── AppContextMenu.test.tsx
├── AppDetailSheet.test.tsx
└── views/
    ├── DropZoneView.test.tsx
    ├── InstallProgressView.test.tsx
    ├── UpgradeConfirmView.test.tsx
    ├── InstallSuccessView.test.tsx
    └── InstallErrorView.test.tsx
```

---

## Task 1: InstallProgressView(含 progress ring)

**Files:**
- Create: `src/apps/AppStore/components/views/InstallProgressView.tsx`
- Create: `src/apps/AppStore/components/views/__tests__/InstallProgressView.test.tsx`

**Context:** 这是 installing phase 展示。接 `InstallProgressEvent`,把 stage 权重映射到 0–100% 全局百分比,用 SVG 圆环展示。阶段文案:

| stage | 显示文字 | global % 区间 |
|---|---|---|
| unzip | "正在解压…" | 0 → 15 |
| validate | "校验 manifest…" | 15 → 20 |
| compile (fileIndex/total) | "编译 {fileIndex+1}/{total}" | 20 → 90 |
| persist | "写入本地存储…" | 90 → 100 |
| done | "完成" | 100 |
| error | — (由父层切换到 ErrorView,此处不渲染) | — |

事件内 `progress` 字段是 **该 stage 内部的 0–1 百分比**,需映射到全局区间。例:`compile, progress: 0.5, fileIndex: 2, total: 4` → 全局 = `20 + (90-20) * (2+0.5)/4 = 63.75%`。实际简化:忽略 stage 内 progress,只按 fileIndex 分段。具体:
```ts
// compile: 20 + (90 - 20) * (fileIndex + 1) / total
```

- [ ] **Step 1: Write failing tests**

```tsx
// src/apps/AppStore/components/views/__tests__/InstallProgressView.test.tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InstallProgressView } from '../InstallProgressView';

describe('InstallProgressView', () => {
  it('shows unzip stage text and ~7% progress', () => {
    render(<InstallProgressView event={{ stage: 'unzip', progress: 0.5 }} />);
    expect(screen.getByText('正在解压…')).toBeInTheDocument();
    expect(screen.getByTestId('install-progress-ring')).toHaveAttribute('data-percent', '8');
  });

  it('maps compile fileIndex=1 of total=4 to 42%', () => {
    render(
      <InstallProgressView
        event={{ stage: 'compile', progress: 0, fileIndex: 1, total: 4 }}
      />,
    );
    expect(screen.getByText('编译 2/4')).toBeInTheDocument();
    expect(screen.getByTestId('install-progress-ring')).toHaveAttribute('data-percent', '55');
  });

  it('shows persist 95%', () => {
    render(<InstallProgressView event={{ stage: 'persist', progress: 0.5 }} />);
    expect(screen.getByText('写入本地存储…')).toBeInTheDocument();
    expect(screen.getByTestId('install-progress-ring')).toHaveAttribute('data-percent', '95');
  });
});
```

- [ ] **Step 2: Run — expect fail**

`pnpm vitest run src/apps/AppStore/components/views/__tests__/InstallProgressView.test.tsx`

- [ ] **Step 3: Implement**

```tsx
// src/apps/AppStore/components/views/InstallProgressView.tsx
import type { InstallProgressEvent } from '@/platform/userApp/installer';

interface Props {
  event: InstallProgressEvent;
}

export function InstallProgressView({ event }: Props) {
  const { text, percent } = mapEvent(event);
  // SVG ring: circumference = 2πr (r=52) ≈ 326.7. strokeDasharray = circumference.
  // strokeDashoffset = circumference * (1 - percent/100)
  const C = 326.7;
  const offset = C * (1 - percent / 100);
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-5">
      <div
        data-testid="install-progress-ring"
        data-percent={percent}
        className="relative w-[120px] h-[120px]"
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="52" fill="none"
            stroke="var(--color-fill-tertiary)" strokeWidth="8" />
          <circle cx="60" cy="60" r="52" fill="none"
            stroke="var(--color-systemBlue)" strokeWidth="8"
            strokeDasharray={C} strokeDashoffset={offset}
            strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 0.2s' }} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center
          text-[22px] font-semibold text-[var(--color-label)]">
          {percent}%
        </div>
      </div>
      <div className="text-[15px] text-[var(--color-secondaryLabel)]">{text}</div>
    </div>
  );
}

function mapEvent(event: InstallProgressEvent): { text: string; percent: number } {
  switch (event.stage) {
    case 'unzip':
      return { text: '正在解压…', percent: Math.round(15 * event.progress) };
    case 'validate':
      return { text: '校验 manifest…', percent: Math.round(15 + 5 * event.progress) };
    case 'compile': {
      const base = 20;
      const span = 70; // 20 → 90
      const per = span / event.total;
      return {
        text: `编译 ${event.fileIndex + 1}/${event.total}`,
        percent: Math.round(base + per * (event.fileIndex + event.progress)),
      };
    }
    case 'persist':
      return { text: '写入本地存储…', percent: Math.round(90 + 10 * event.progress) };
    case 'done':
      return { text: '完成', percent: 100 };
    case 'error':
      return { text: '', percent: 0 };
  }
}
```

- [ ] **Step 4: Run — expect pass**

`pnpm vitest run src/apps/AppStore/components/views/__tests__/InstallProgressView.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/apps/AppStore/components/views/InstallProgressView.tsx \
        src/apps/AppStore/components/views/__tests__/InstallProgressView.test.tsx
git commit -m "feat(appstore): InstallProgressView with SVG ring"
```

---

## Task 2: DropZoneView + UpgradeConfirmView

**Files:**
- Create: `src/apps/AppStore/components/views/DropZoneView.tsx`
- Create: `src/apps/AppStore/components/views/UpgradeConfirmView.tsx`
- Create: `src/apps/AppStore/components/views/__tests__/DropZoneView.test.tsx`
- Create: `src/apps/AppStore/components/views/__tests__/UpgradeConfirmView.test.tsx`

**Context:**
- **DropZoneView** — idle phase。点击或拖拽 zip → 回调 `onFile(file)`。UI:大虚线框,中间 `UploadCloud` (lucide),文字"选择或拖放 zip 文件"+"zip 里需包含 manifest.json + 入口 TSX"。`<input type=file accept=".zip" data-testid="upload-file-input">`。
- **UpgradeConfirmView** — needsUpgradeConfirm phase。展示版本对比卡片 + "升级不会清除数据"说明 + [取消][更新] 按钮。props: `{ existing: { name; version }; incoming: { name; version }; onCancel; onConfirm }`。取消 → `onCancel()`,更新 → `onConfirm()`。

- [ ] **Step 1: Write DropZoneView test**

```tsx
// src/apps/AppStore/components/views/__tests__/DropZoneView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DropZoneView } from '../DropZoneView';

describe('DropZoneView', () => {
  it('calls onFile when file selected', () => {
    const onFile = vi.fn();
    render(<DropZoneView onFile={onFile} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    const file = new File(['x'], 'app.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });

  it('calls onFile on drop', () => {
    const onFile = vi.fn();
    render(<DropZoneView onFile={onFile} />);
    const zone = screen.getByTestId('upload-drop-zone');
    const file = new File(['x'], 'app.zip', { type: 'application/zip' });
    fireEvent.drop(zone, { dataTransfer: { files: [file] } });
    expect(onFile).toHaveBeenCalledWith(file);
  });
});
```

- [ ] **Step 2: Run — expect fail**

- [ ] **Step 3: Implement DropZoneView**

```tsx
// src/apps/AppStore/components/views/DropZoneView.tsx
import { useRef, useState, type DragEvent } from 'react';
import { UploadCloud } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
}

export function DropZoneView({ onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(false);

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setActive(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  };

  return (
    <div className="px-4 py-6">
      <div
        data-testid="upload-drop-zone"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setActive(true); }}
        onDragLeave={() => setActive(false)}
        onDrop={handleDrop}
        className={`min-h-[180px] rounded-[14px] border-2 border-dashed
          flex flex-col items-center justify-center gap-3 px-6 py-10 cursor-pointer
          transition-colors
          ${active
            ? 'border-[var(--color-systemBlue)] bg-[var(--color-fill-tertiary)]'
            : 'border-[var(--color-separator)] bg-[var(--color-systemBackground)]'}`}
      >
        <UploadCloud size={40} strokeWidth={1.5}
          className="text-[var(--color-systemBlue)]" />
        <div className="text-[15px] font-medium text-[var(--color-label)]">
          选择或拖放 zip 文件
        </div>
        <div className="text-[13px] text-[var(--color-secondaryLabel)]">
          zip 里需包含 manifest.json + 入口 TSX
        </div>
      </div>
      <input
        ref={inputRef}
        data-testid="upload-file-input"
        type="file"
        accept=".zip,application/zip"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Run — DropZoneView passes**

- [ ] **Step 5: Write UpgradeConfirmView test**

```tsx
// src/apps/AppStore/components/views/__tests__/UpgradeConfirmView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UpgradeConfirmView } from '../UpgradeConfirmView';

const existing = { name: 'My App', version: '1.0.0' };
const incoming = { name: 'My App', version: '1.2.0' };

describe('UpgradeConfirmView', () => {
  it('shows both versions', () => {
    render(
      <UpgradeConfirmView existing={existing} incoming={incoming}
        onCancel={() => {}} onConfirm={() => {}} />,
    );
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
    expect(screen.getByText('1.2.0')).toBeInTheDocument();
  });

  it('invokes onConfirm on 更新', () => {
    const onConfirm = vi.fn();
    render(
      <UpgradeConfirmView existing={existing} incoming={incoming}
        onCancel={() => {}} onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('invokes onCancel on 取消', () => {
    const onCancel = vi.fn();
    render(
      <UpgradeConfirmView existing={existing} incoming={incoming}
        onCancel={onCancel} onConfirm={() => {}} />,
    );
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(onCancel).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run — expect fail**

- [ ] **Step 7: Implement UpgradeConfirmView**

```tsx
// src/apps/AppStore/components/views/UpgradeConfirmView.tsx
import { ArrowRight } from 'lucide-react';

interface VersionInfo {
  name: string;
  version: string;
}

interface Props {
  existing: VersionInfo;
  incoming: VersionInfo;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UpgradeConfirmView({ existing, incoming, onCancel, onConfirm }: Props) {
  return (
    <div className="flex flex-col gap-5 px-5 py-6">
      <div className="text-center">
        <div className="text-[20px] font-semibold text-[var(--color-label)]">
          发现已装的 {existing.name}
        </div>
        <div className="mt-1 text-[13px] text-[var(--color-secondaryLabel)]">
          升级不会清除已保存的数据
        </div>
      </div>
      <div className="flex items-center justify-center gap-4 px-4 py-4
        rounded-[14px] bg-[var(--color-fill-quaternary)]">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-[var(--color-secondaryLabel)]">当前</span>
          <span className="text-[17px] font-semibold text-[var(--color-label)]">
            {existing.version}
          </span>
        </div>
        <ArrowRight size={18} className="text-[var(--color-secondaryLabel)]" />
        <div className="flex flex-col items-center gap-1">
          <span className="text-[11px] text-[var(--color-systemBlue)]">更新</span>
          <span className="text-[17px] font-semibold text-[var(--color-systemBlue)]">
            {incoming.version}
          </span>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onCancel}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-fill-tertiary)]
            text-[17px] font-medium text-[var(--color-label)]">
          取消
        </button>
        <button type="button" onClick={onConfirm}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-systemBlue)]
            text-[17px] font-semibold text-white">
          更新
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Run — all tests pass**

- [ ] **Step 9: Commit**

```bash
git add src/apps/AppStore/components/views/DropZoneView.tsx \
        src/apps/AppStore/components/views/UpgradeConfirmView.tsx \
        src/apps/AppStore/components/views/__tests__/DropZoneView.test.tsx \
        src/apps/AppStore/components/views/__tests__/UpgradeConfirmView.test.tsx
git commit -m "feat(appstore): DropZone and UpgradeConfirm views"
```

---

## Task 3: InstallSuccessView + InstallErrorView

**Files:**
- Create: `src/apps/AppStore/components/views/InstallSuccessView.tsx`
- Create: `src/apps/AppStore/components/views/InstallErrorView.tsx`
- Create: `src/apps/AppStore/components/views/__tests__/InstallSuccessView.test.tsx`
- Create: `src/apps/AppStore/components/views/__tests__/InstallErrorView.test.tsx`

**Context:**
- **InstallSuccessView** — 大勾(lucide `Check` 在绿色圆形背景 88×88),标题 `已更新到 {version}` / `已安装 {name}`(按 `isUpgrade` 决定),副标题"桌面的 {name} 已刷新",按钮 [继续安装 secondary][打开 App primary]。props: `{ appName; version; isUpgrade; onContinue; onOpen }`。
- **InstallErrorView** — 大红叉(lucide `X`,红色圆 88×88),按 `InstallError.kind` 文案:
  ```
  bad-zip → 这个 zip 打不开
  bad-manifest → manifest.json 格式不对
  id-conflict → ID 与内置 App 冲突,无法安装
  entry-missing → 入口文件找不到
  compile → 编译失败
  io → 存储出错,请重试
  user-cancelled → (此 view 不应被渲染,UploadSheet 层跳过)
  ```
  按钮 [查看详情 secondary][重试 primary]。"查看详情"切内部 state,展开 `error.message` 全文;其它时候折叠。props: `{ error: InstallError; onRetry }`。

- [ ] **Step 1: Write SuccessView test**

```tsx
// src/apps/AppStore/components/views/__tests__/InstallSuccessView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallSuccessView } from '../InstallSuccessView';

describe('InstallSuccessView', () => {
  it('shows install copy', () => {
    render(<InstallSuccessView
      appName="Demo" version="1.0.0" isUpgrade={false}
      onContinue={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/已安装.*Demo/)).toBeInTheDocument();
  });

  it('shows upgrade copy with version', () => {
    render(<InstallSuccessView
      appName="Demo" version="2.0.0" isUpgrade={true}
      onContinue={() => {}} onOpen={() => {}} />);
    expect(screen.getByText(/已更新到.*2\.0\.0/)).toBeInTheDocument();
  });

  it('invokes callbacks', () => {
    const onContinue = vi.fn(), onOpen = vi.fn();
    render(<InstallSuccessView appName="Demo" version="1" isUpgrade={false}
      onContinue={onContinue} onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: '继续安装' }));
    fireEvent.click(screen.getByRole('button', { name: '打开 App' }));
    expect(onContinue).toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement SuccessView**

```tsx
// src/apps/AppStore/components/views/InstallSuccessView.tsx
import { Check } from 'lucide-react';

interface Props {
  appName: string;
  version: string;
  isUpgrade: boolean;
  onContinue: () => void;
  onOpen: () => void;
}

export function InstallSuccessView({
  appName, version, isUpgrade, onContinue, onOpen,
}: Props) {
  const title = isUpgrade ? `已更新到 ${version}` : `已安装 ${appName}`;
  return (
    <div className="flex flex-col items-center gap-5 px-5 py-8">
      <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center
        bg-[var(--color-systemGreen)]">
        <Check size={48} strokeWidth={3} className="text-white" />
      </div>
      <div className="text-center">
        <div className="text-[20px] font-semibold text-[var(--color-label)]">{title}</div>
        <div className="mt-1 text-[13px] text-[var(--color-secondaryLabel)]">
          桌面的 {appName} 已刷新
        </div>
      </div>
      <div className="flex gap-3 w-full">
        <button type="button" onClick={onContinue}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-fill-tertiary)]
            text-[17px] font-medium text-[var(--color-label)]">
          继续安装
        </button>
        <button type="button" onClick={onOpen}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-systemBlue)]
            text-[17px] font-semibold text-white">
          打开 App
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write ErrorView test**

```tsx
// src/apps/AppStore/components/views/__tests__/InstallErrorView.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InstallErrorView } from '../InstallErrorView';
import { InstallError } from '@/platform/userApp/installer';

describe('InstallErrorView', () => {
  it('maps bad-zip kind to 这个 zip 打不开', () => {
    const err = new InstallError('bad-zip', 'raw zip parse failed at byte 42');
    render(<InstallErrorView error={err} onRetry={() => {}} />);
    expect(screen.getByText('这个 zip 打不开')).toBeInTheDocument();
    expect(screen.queryByText(/byte 42/)).not.toBeInTheDocument();
  });

  it('reveals raw message after 查看详情', () => {
    const err = new InstallError('io', 'IDBRequest aborted');
    render(<InstallErrorView error={err} onRetry={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '查看详情' }));
    expect(screen.getByText('IDBRequest aborted')).toBeInTheDocument();
  });

  it('invokes onRetry', () => {
    const onRetry = vi.fn();
    const err = new InstallError('compile', 'TS error');
    render(<InstallErrorView error={err} onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: Implement ErrorView**

```tsx
// src/apps/AppStore/components/views/InstallErrorView.tsx
import { useState } from 'react';
import { X as XIcon } from 'lucide-react';
import { InstallError, type InstallErrorKind } from '@/platform/userApp/installer';

const KIND_COPY: Record<Exclude<InstallErrorKind, 'user-cancelled'>, string> = {
  'bad-zip': '这个 zip 打不开',
  'bad-manifest': 'manifest.json 格式不对',
  'id-conflict': 'ID 与内置 App 冲突,无法安装',
  'entry-missing': '入口文件找不到',
  'compile': '编译失败',
  'io': '存储出错,请重试',
  'uninstall-builtin': '内置 App 无法卸载',
};

interface Props {
  error: InstallError;
  onRetry: () => void;
}

export function InstallErrorView({ error, onRetry }: Props) {
  const [showDetail, setShowDetail] = useState(false);
  const kind = error.kind === 'user-cancelled' ? 'io' : error.kind;
  const label = KIND_COPY[kind];
  return (
    <div className="flex flex-col items-center gap-5 px-5 py-8">
      <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center
        bg-[var(--color-systemRed)]">
        <XIcon size={48} strokeWidth={3} className="text-white" />
      </div>
      <div className="text-[20px] font-semibold text-[var(--color-label)] text-center">
        {label}
      </div>
      {showDetail && (
        <div className="w-full max-h-[120px] overflow-y-auto p-3 rounded-[10px]
          bg-[var(--color-fill-quaternary)]
          text-[12px] text-[var(--color-secondaryLabel)] font-mono">
          {error.message}
        </div>
      )}
      <div className="flex gap-3 w-full">
        <button type="button" onClick={() => setShowDetail((v) => !v)}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-fill-tertiary)]
            text-[17px] font-medium text-[var(--color-label)]">
          查看详情
        </button>
        <button type="button" onClick={onRetry}
          className="flex-1 h-11 rounded-[14px]
            bg-[var(--color-systemBlue)]
            text-[17px] font-semibold text-white">
          重试
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run all tests — expect pass**

- [ ] **Step 6: Commit**

```bash
git add src/apps/AppStore/components/views/InstallSuccessView.tsx \
        src/apps/AppStore/components/views/InstallErrorView.tsx \
        src/apps/AppStore/components/views/__tests__/InstallSuccessView.test.tsx \
        src/apps/AppStore/components/views/__tests__/InstallErrorView.test.tsx
git commit -m "feat(appstore): Success and Error install views"
```

---

## Task 4: UploadSheet 容器 + 状态机 + installer 集成

**Files:**
- Create: `src/apps/AppStore/components/UploadSheet.tsx`
- Create: `src/apps/AppStore/components/__tests__/UploadSheet.test.tsx`

**Context:** 半屏 sheet 容器(视觉可复用 `UploadSheetPlaceholder` 的 chrome:黑 40% 遮罩 + 底部圆角白底 + handle + 标题 + 关闭按钮)。内部管理 phase 状态,并调用 `installer.install(file, { onProgress, onUpgradeDetected })`。

**状态机:**
```ts
type Phase =
  | { kind: 'idle' }
  | { kind: 'installing'; file: File; event: InstallProgressEvent }
  | { kind: 'needsUpgradeConfirm';
      existing: { name: string; version: string };
      incoming: { name: string; version: string };
      resolve: (ok: boolean) => void;
    }
  | { kind: 'success'; appName: string; version: string; isUpgrade: boolean; appId: string }
  | { kind: 'error'; error: InstallError };
```

**Props:** `{ initialFile?: File; onClose: () => void; onOpenApp: (id: string) => void }`。

**关键逻辑**(写在 `useCallback`/`useEffect`):
```ts
const startInstall = useCallback(async (file: File) => {
  setPhase({ kind: 'installing', file, event: { stage: 'unzip', progress: 0 } });
  try {
    const result = await install(file, {
      onProgress: (event) => {
        if (event.stage === 'done' || event.stage === 'error') return;
        setPhase((p) => (p.kind === 'installing' ? { ...p, event } : p));
      },
      onUpgradeDetected: ({ existing, incoming }) =>
        new Promise<boolean>((resolve) => {
          setPhase({ kind: 'needsUpgradeConfirm', existing, incoming, resolve });
        }),
    });
    // Get name/version from installedUserAppsStore after install resolves.
    const stored = useInstalledUserAppsStore.getState().apps.find((a) => a.id === result.id);
    setPhase({
      kind: 'success',
      appName: stored?.name ?? result.id,
      version: stored?.version ?? '1.0.0',
      isUpgrade: result.isUpgrade,
      appId: result.id,
    });
  } catch (err) {
    if (err instanceof InstallError) {
      if (err.kind === 'user-cancelled') {
        setPhase({ kind: 'idle' });
      } else {
        setPhase({ kind: 'error', error: err });
      }
    } else {
      setPhase({ kind: 'error', error: new InstallError('io', String(err)) });
    }
  }
}, []);
```

**标题映射** (sheet 顶栏):
- idle → `上传 App`
- installing → `安装中`
- needsUpgradeConfirm → `确认更新`
- success → `安装完成`
- error → `安装失败`

**initialFile effect:** 如果 mount 时 `initialFile` 非空,立即 `startInstall(initialFile)`。

- [ ] **Step 1: Write test skeleton**

```tsx
// src/apps/AppStore/components/__tests__/UploadSheet.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UploadSheet } from '../UploadSheet';
import * as installerMod from '@/platform/userApp/installer';
import { InstallError } from '@/platform/userApp/installer';

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('UploadSheet', () => {
  it('starts in idle phase showing DropZone', () => {
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    expect(screen.getByTestId('upload-drop-zone')).toBeInTheDocument();
  });

  it('transitions idle → installing → success on happy path', async () => {
    vi.spyOn(installerMod, 'install').mockImplementation(async (_file, opts) => {
      opts?.onProgress?.({ stage: 'unzip', progress: 0.5 });
      opts?.onProgress?.({ stage: 'compile', progress: 0, fileIndex: 0, total: 1 });
      return { id: 'demo', installedAt: 1, isUpgrade: false };
    });
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    const file = new File(['x'], 'demo.zip', { type: 'application/zip' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '打开 App' })).toBeInTheDocument(),
    );
  });

  it('shows UpgradeConfirm and resolves true on 更新', async () => {
    let resolveUpgrade!: (ok: boolean) => void;
    vi.spyOn(installerMod, 'install').mockImplementation(async (_file, opts) => {
      const ok = await opts!.onUpgradeDetected!({
        existing: { id: 'demo', name: 'Demo', version: '1.0.0' },
        incoming: { id: 'demo', name: 'Demo', version: '2.0.0' },
      });
      expect(ok).toBe(true);
      return { id: 'demo', installedAt: 2, isUpgrade: true };
    });
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'demo.zip', { type: 'application/zip' })] },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '更新' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: '更新' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '打开 App' })).toBeInTheDocument(),
    );
  });

  it('shows ErrorView on bad-zip', async () => {
    vi.spyOn(installerMod, 'install').mockRejectedValue(
      new InstallError('bad-zip', 'corrupt'),
    );
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    const input = screen.getByTestId('upload-file-input') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'demo.zip', { type: 'application/zip' })] },
    });
    await waitFor(() =>
      expect(screen.getByText('这个 zip 打不开')).toBeInTheDocument(),
    );
  });

  it('returns to idle silently on user-cancelled', async () => {
    vi.spyOn(installerMod, 'install').mockImplementation(async (_f, opts) => {
      await opts!.onUpgradeDetected!({
        existing: { id: 'demo', name: 'Demo', version: '1.0.0' },
        incoming: { id: 'demo', name: 'Demo', version: '2.0.0' },
      });
      throw new InstallError('user-cancelled', 'cancelled');
    });
    render(<UploadSheet onClose={() => {}} onOpenApp={() => {}} />);
    fireEvent.change(screen.getByTestId('upload-file-input'), {
      target: { files: [new File(['x'], 'demo.zip', { type: 'application/zip' })] },
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    await waitFor(() =>
      expect(screen.getByTestId('upload-drop-zone')).toBeInTheDocument(),
    );
  });
});
```

- [ ] **Step 2: Run — fail**

- [ ] **Step 3: Implement UploadSheet**

骨架(完整实现约 140 行):
```tsx
// src/apps/AppStore/components/UploadSheet.tsx
import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  install,
  InstallError,
  type InstallProgressEvent,
} from '@/platform/userApp/installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { DropZoneView } from './views/DropZoneView';
import { InstallProgressView } from './views/InstallProgressView';
import { UpgradeConfirmView } from './views/UpgradeConfirmView';
import { InstallSuccessView } from './views/InstallSuccessView';
import { InstallErrorView } from './views/InstallErrorView';

type Phase =
  | { kind: 'idle' }
  | { kind: 'installing'; file: File; event: InstallProgressEvent }
  | { kind: 'needsUpgradeConfirm';
      existing: { name: string; version: string };
      incoming: { name: string; version: string };
      resolve: (ok: boolean) => void }
  | { kind: 'success'; appName: string; version: string; isUpgrade: boolean; appId: string }
  | { kind: 'error'; error: InstallError };

interface Props {
  initialFile?: File | null;
  onClose: () => void;
  onOpenApp: (id: string) => void;
}

export function UploadSheet({ initialFile, onClose, onOpenApp }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });

  const startInstall = useCallback(async (file: File) => {
    setPhase({ kind: 'installing', file, event: { stage: 'unzip', progress: 0 } });
    try {
      const result = await install(file, {
        onProgress: (event) => {
          if (event.stage === 'done' || event.stage === 'error') return;
          setPhase((p) => (p.kind === 'installing' ? { ...p, event } : p));
        },
        onUpgradeDetected: ({ existing, incoming }) =>
          new Promise<boolean>((resolve) => {
            setPhase({
              kind: 'needsUpgradeConfirm',
              existing: { name: existing.name, version: existing.version },
              incoming: { name: incoming.name, version: incoming.version },
              resolve,
            });
          }),
      });
      const stored = useInstalledUserAppsStore.getState().apps.find((a) => a.id === result.id);
      setPhase({
        kind: 'success',
        appName: stored?.name ?? result.id,
        version: stored?.version ?? '1.0.0',
        isUpgrade: result.isUpgrade,
        appId: result.id,
      });
    } catch (err) {
      if (err instanceof InstallError) {
        if (err.kind === 'user-cancelled') {
          setPhase({ kind: 'idle' });
        } else {
          setPhase({ kind: 'error', error: err });
        }
      } else {
        setPhase({
          kind: 'error',
          error: new InstallError('io', err instanceof Error ? err.message : String(err)),
        });
      }
    }
  }, []);

  useEffect(() => {
    if (initialFile) void startInstall(initialFile);
    // Only on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const title =
    phase.kind === 'idle' ? '上传 App' :
    phase.kind === 'installing' ? '安装中' :
    phase.kind === 'needsUpgradeConfirm' ? '确认更新' :
    phase.kind === 'success' ? '安装完成' :
    '安装失败';

  return (
    <div data-testid="appstore-upload-sheet" className="absolute inset-0 z-20 flex flex-col">
      <div role="presentation" onClick={onClose}
        className="absolute inset-0 bg-black/40" />
      <div className="relative mt-auto bg-[var(--color-background)]
        rounded-t-[14px] flex flex-col min-h-[60%] max-h-[90%]">
        <div className="relative flex items-center justify-between
          px-4 py-3 border-b border-[var(--color-separator)]">
          <div className="w-[36px] h-[5px] rounded-full
            bg-[var(--color-fill-tertiary)]
            absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[17px] font-semibold text-[var(--color-label)] mt-2">
            {title}
          </span>
          <button type="button" aria-label="关闭" onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
              bg-[var(--color-fill-secondary)]">
            <X size={16} strokeWidth={2.5} className="text-[var(--color-secondaryLabel)]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {phase.kind === 'idle' && <DropZoneView onFile={(f) => void startInstall(f)} />}
          {phase.kind === 'installing' && <InstallProgressView event={phase.event} />}
          {phase.kind === 'needsUpgradeConfirm' && (
            <UpgradeConfirmView
              existing={phase.existing}
              incoming={phase.incoming}
              onCancel={() => phase.resolve(false)}
              onConfirm={() => phase.resolve(true)}
            />
          )}
          {phase.kind === 'success' && (
            <InstallSuccessView
              appName={phase.appName}
              version={phase.version}
              isUpgrade={phase.isUpgrade}
              onContinue={() => setPhase({ kind: 'idle' })}
              onOpen={() => { onOpenApp(phase.appId); onClose(); }}
            />
          )}
          {phase.kind === 'error' && (
            <InstallErrorView
              error={phase.error}
              onRetry={() => setPhase({ kind: 'idle' })}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run — pass**

- [ ] **Step 5: Commit**

```bash
git add src/apps/AppStore/components/UploadSheet.tsx \
        src/apps/AppStore/components/__tests__/UploadSheet.test.tsx
git commit -m "feat(appstore): UploadSheet with phase state machine"
```

---

## Task 5: AppContextMenu

**Files:**
- Create: `src/apps/AppStore/components/AppContextMenu.tsx`
- Create: `src/apps/AppStore/components/__tests__/AppContextMenu.test.tsx`

**Context:** 长按浮层。样式(iOS 13+):
- 全屏半透明 backdrop(点外部关闭)—— 用 `<Material variant="thick">`(项目规范:backdrop-filter 字面量只能来自 `<Material>`)
- 居中 card:顶部缩略卡(iconDataUrl + name + version) + 分隔线 + 菜单 item 列表
- 菜单项:
  - **打开** - `ArrowUpRight` icon
  - **查看详情** - `Info` icon
  - **卸载** - `Trash2` icon,destructive 红色

Props:
```ts
interface Props {
  app: InstalledUserApp;  // 从 installedUserAppsStore
  onOpen: () => void;
  onDetail: () => void;
  onUninstall: () => void;
  onClose: () => void;
}
```

- [ ] **Step 1: Test**

```tsx
// src/apps/AppStore/components/__tests__/AppContextMenu.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppContextMenu } from '../AppContextMenu';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

const app: InstalledUserApp = {
  id: 'demo', name: 'Demo', iconDataUrl: null,
  page: 0, perspectiveAware: false,
  version: '1.2.0', installedAt: Date.now(), sizeBytes: 1024,
};

describe('AppContextMenu', () => {
  it('renders three actions with app preview', () => {
    render(<AppContextMenu app={app}
      onOpen={() => {}} onDetail={() => {}} onUninstall={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /打开/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /查看详情/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /卸载/ })).toBeInTheDocument();
  });

  it('fires callbacks', () => {
    const onOpen = vi.fn(), onDetail = vi.fn(), onUninstall = vi.fn();
    render(<AppContextMenu app={app}
      onOpen={onOpen} onDetail={onDetail} onUninstall={onUninstall} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /打开/ }));
    fireEvent.click(screen.getByRole('button', { name: /查看详情/ }));
    fireEvent.click(screen.getByRole('button', { name: /卸载/ }));
    expect(onOpen).toHaveBeenCalled();
    expect(onDetail).toHaveBeenCalled();
    expect(onUninstall).toHaveBeenCalled();
  });

  it('fires onClose when backdrop clicked', () => {
    const onClose = vi.fn();
    render(<AppContextMenu app={app}
      onOpen={() => {}} onDetail={() => {}} onUninstall={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('context-menu-backdrop'));
    expect(onClose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// src/apps/AppStore/components/AppContextMenu.tsx
import { ArrowUpRight, Info, Trash2 } from 'lucide-react';
import { Material } from '@/system/Material';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

interface Props {
  app: InstalledUserApp;
  onOpen: () => void;
  onDetail: () => void;
  onUninstall: () => void;
  onClose: () => void;
}

export function AppContextMenu({ app, onOpen, onDetail, onUninstall, onClose }: Props) {
  const fallback = (
    <div className="w-[52px] h-[52px] rounded-[13px]
      bg-gradient-to-br from-[var(--color-systemBlue)] to-[var(--color-systemIndigo)]" />
  );
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center">
      <div
        data-testid="context-menu-backdrop"
        role="presentation"
        onClick={onClose}
        className="absolute inset-0 bg-black/30"
      />
      <Material variant="thick"
        className="relative w-[260px] rounded-[14px] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          {app.iconDataUrl
            ? <img src={app.iconDataUrl} alt="" className="w-[52px] h-[52px] rounded-[13px]" />
            : fallback}
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] font-medium text-[var(--color-label)] truncate">
              {app.name}
            </span>
            <span className="text-[12px] text-[var(--color-secondaryLabel)]">
              版本 {app.version}
            </span>
          </div>
        </div>
        <div className="h-px bg-[var(--color-separator)]" />
        <MenuItem label="打开" icon={<ArrowUpRight size={18} />}
          onClick={() => { onOpen(); onClose(); }} />
        <div className="h-px bg-[var(--color-separator)]" />
        <MenuItem label="查看详情" icon={<Info size={18} />}
          onClick={() => { onDetail(); onClose(); }} />
        <div className="h-px bg-[var(--color-separator)]" />
        <MenuItem label="卸载" icon={<Trash2 size={18} />} destructive
          onClick={() => { onUninstall(); onClose(); }} />
      </Material>
    </div>
  );
}

function MenuItem({ label, icon, destructive, onClick }: {
  label: string; icon: React.ReactNode; destructive?: boolean; onClick: () => void;
}) {
  const color = destructive ? 'var(--color-systemRed)' : 'var(--color-label)';
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center justify-between px-4 py-3 text-[15px]"
      style={{ color }}>
      <span>{label}</span>
      {icon}
    </button>
  );
}
```

**注意:** 如果 `Material` 默认 export 与命名不同,查 `src/system/Material/index.ts`。

- [ ] **Step 3: Run — pass**

- [ ] **Step 4: Commit**

```bash
git add src/apps/AppStore/components/AppContextMenu.tsx \
        src/apps/AppStore/components/__tests__/AppContextMenu.test.tsx
git commit -m "feat(appstore): AppContextMenu long-press overlay"
```

---

## Task 6: AppDetailSheet + 接线 AppStoreApp + 删除旧文件

**Files:**
- Create: `src/apps/AppStore/components/AppDetailSheet.tsx`
- Create: `src/apps/AppStore/components/__tests__/AppDetailSheet.test.tsx`
- Modify: `src/apps/AppStore/AppStoreApp.tsx` — 替换 Placeholder 为 UploadSheet,接长按 → Menu → Detail/Uninstall 流
- Modify: `src/apps/AppStore/__tests__/AppStoreApp.test.tsx` — 旧 testIds 仍保留(`appstore-plus-button`, `appstore-upload-sheet`)
- Delete: `src/apps/AppStore/UploadPage.tsx`
- Delete: `src/apps/AppStore/components/UploadSheetPlaceholder.tsx`

**AppDetailSheet 结构:**
半屏 sheet(同 UploadSheet chrome:handle + 标题"App 详情" + 关闭)。内容区(iOS 分组列表):

1. Hero: 80×80 图标 + name(20pt semibold) + "版本 {version}"(13pt 二级)
2. 分组"基本信息":
   - Bundle ID: `{app.id}`
   - 大小: `formatByteSize(app.sizeBytes)`(复用 `src/platform/utils/formatters.ts`)
   - 安装时间: `new Date(app.installedAt).toLocaleString('zh-CN')`
3. 分组"权限":
   - Perspective-aware: "是" / "否"
4. 底部 [卸载] destructive 按钮,调 `onUninstall()` 后 `onClose()`

Props: `{ app: InstalledUserApp; onClose: () => void; onUninstall: () => void }`

**AppStoreApp.tsx 接线修改:**
```tsx
// 状态新增
const [pendingFile, setPendingFile] = useState<File | null>(null);
const [contextMenuAppId, setContextMenuAppId] = useState<string | null>(null);
const [detailAppId, setDetailAppId] = useState<string | null>(null);

// onDrop: 改为暂存 file + 打开 sheet
const onDrop = (e) => {
  e.preventDefault(); setDragOver(false);
  const f = e.dataTransfer.files[0];
  if (f) { setPendingFile(f); setSheetOpen(true); }
};

const closeSheet = () => { setSheetOpen(false); setPendingFile(null); };

// handleLongPress 真正实现
const handleLongPress = useCallback((id: string) => {
  setContextMenuAppId(id);
}, []);

// ContextMenu 消费
const menuApp = apps.find((a) => a.id === contextMenuAppId);
const detailApp = apps.find((a) => a.id === detailAppId);

// JSX 新增:
{sheetOpen && (
  <UploadSheet
    initialFile={pendingFile}
    onClose={closeSheet}
    onOpenApp={(id) => { openApp(id, null); closeSheet(); }}
  />
)}
{menuApp && (
  <AppContextMenu app={menuApp}
    onOpen={() => openApp(menuApp.id, null)}
    onDetail={() => { setContextMenuAppId(null); setDetailAppId(menuApp.id); }}
    onUninstall={() => handleDelete(menuApp.id)}
    onClose={() => setContextMenuAppId(null)}
  />
)}
{detailApp && (
  <AppDetailSheet app={detailApp}
    onClose={() => setDetailAppId(null)}
    onUninstall={() => {
      void handleDelete(detailApp.id);
      setDetailAppId(null);
    }}
  />
)}
```

**关键:** 不要删 `UploadSheetPlaceholder` 的引用前先替换 import。先 add UploadSheet,再改引用,再 delete。

- [ ] **Step 1: Write DetailSheet test**

```tsx
// src/apps/AppStore/components/__tests__/AppDetailSheet.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AppDetailSheet } from '../AppDetailSheet';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

const app: InstalledUserApp = {
  id: 'com.demo', name: 'Demo', iconDataUrl: null,
  page: 0, perspectiveAware: true,
  version: '1.2.0', installedAt: 1700000000000, sizeBytes: 2621440, // 2.5 MB
};

describe('AppDetailSheet', () => {
  it('shows basic metadata', () => {
    render(<AppDetailSheet app={app} onClose={() => {}} onUninstall={() => {}} />);
    expect(screen.getByText('Demo')).toBeInTheDocument();
    expect(screen.getByText(/1\.2\.0/)).toBeInTheDocument();
    expect(screen.getByText('com.demo')).toBeInTheDocument();
    expect(screen.getByText('2.5 MB')).toBeInTheDocument();
    expect(screen.getByText('是')).toBeInTheDocument();
  });

  it('uninstall button triggers callback then close', () => {
    const onUninstall = vi.fn(), onClose = vi.fn();
    render(<AppDetailSheet app={app} onClose={onClose} onUninstall={onUninstall} />);
    fireEvent.click(screen.getByRole('button', { name: '卸载 App' }));
    expect(onUninstall).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement AppDetailSheet**

```tsx
// src/apps/AppStore/components/AppDetailSheet.tsx
import { X } from 'lucide-react';
import { formatByteSize } from '@/platform/utils/formatters';
import type { InstalledUserApp } from '@/platform/stores/installedUserAppsStore';

interface Props {
  app: InstalledUserApp;
  onClose: () => void;
  onUninstall: () => void;
}

export function AppDetailSheet({ app, onClose, onUninstall }: Props) {
  return (
    <div data-testid="appstore-detail-sheet"
      className="absolute inset-0 z-20 flex flex-col">
      <div role="presentation" onClick={onClose}
        className="absolute inset-0 bg-black/40" />
      <div className="relative mt-auto bg-[var(--color-background)]
        rounded-t-[14px] flex flex-col min-h-[60%] max-h-[90%]">
        <div className="relative flex items-center justify-between
          px-4 py-3 border-b border-[var(--color-separator)]">
          <div className="w-[36px] h-[5px] rounded-full
            bg-[var(--color-fill-tertiary)]
            absolute left-1/2 -translate-x-1/2 top-2" />
          <span className="text-[17px] font-semibold text-[var(--color-label)] mt-2">
            App 详情
          </span>
          <button type="button" aria-label="关闭" onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center
              bg-[var(--color-fill-secondary)]">
            <X size={16} strokeWidth={2.5} className="text-[var(--color-secondaryLabel)]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-5">
          <div className="flex items-center gap-4">
            {app.iconDataUrl
              ? <img src={app.iconDataUrl} alt="" className="w-20 h-20 rounded-[20px]" />
              : <div className="w-20 h-20 rounded-[20px]
                  bg-gradient-to-br from-[var(--color-systemBlue)]
                  to-[var(--color-systemIndigo)]" />}
            <div className="flex flex-col min-w-0">
              <span className="text-[20px] font-semibold text-[var(--color-label)] truncate">
                {app.name}
              </span>
              <span className="text-[13px] text-[var(--color-secondaryLabel)]">
                版本 {app.version}
              </span>
            </div>
          </div>
          <Section title="基本信息">
            <Row k="Bundle ID" v={app.id} />
            <Row k="大小" v={formatByteSize(app.sizeBytes)} />
            <Row k="安装时间"
              v={new Date(app.installedAt).toLocaleString('zh-CN')} />
          </Section>
          <Section title="权限">
            <Row k="Perspective-aware" v={app.perspectiveAware ? '是' : '否'} />
          </Section>
          <button type="button" onClick={() => { onUninstall(); onClose(); }}
            className="w-full h-11 rounded-[14px]
              bg-[var(--color-fill-tertiary)]
              text-[17px] font-medium text-[var(--color-systemRed)]">
            卸载 App
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-4 text-[12px] uppercase tracking-wide
        text-[var(--color-secondaryLabel)]">{title}</div>
      <div className="rounded-[12px] bg-[var(--color-fill-quaternary)] divide-y
        divide-[var(--color-separator)]">
        {children}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 text-[15px]">
      <span className="text-[var(--color-secondaryLabel)]">{k}</span>
      <span className="text-[var(--color-label)] truncate max-w-[60%] text-right">{v}</span>
    </div>
  );
}
```

- [ ] **Step 3: Update AppStoreApp**

应用上面展示的接线修改。注意先 import `UploadSheet`, `AppContextMenu`, `AppDetailSheet`,移除对 `UploadSheetPlaceholder` 的 import。测试应该继续保持 5 个用例通过(关键 testId 不变)。

- [ ] **Step 4: 增加 AppStoreApp.test 新测试 — 长按弹 menu,"查看详情"进 detail**

```tsx
// 在现有 AppStoreApp.test.tsx 里新增一个 case(或单独集成测试文件):
it('long press an installed app opens context menu, detail from menu opens detail sheet', async () => {
  // seed 1 app into useInstalledUserAppsStore.getState().apps
  // render <AppStoreApp />
  // fireEvent.pointerDown on the row, wait 500ms (useLongPress delay)
  // expect AppContextMenu visible
  // fireEvent.click 查看详情
  // expect AppDetailSheet visible
});
```

(如果复杂,可以跳过此 case 仅在 manual 验证;但保留注释说明。)

- [ ] **Step 5: Delete 旧文件**

```bash
git rm src/apps/AppStore/UploadPage.tsx \
       src/apps/AppStore/components/UploadSheetPlaceholder.tsx
```

- [ ] **Step 6: Run full vitest — all green**

`pnpm vitest run src/apps/AppStore`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(appstore): wire UploadSheet, ContextMenu, DetailSheet"
```

---

## Task 7: 回归验证(纯验证,无提交内容除非修复 regression)

- [ ] **Step 1:** `pnpm tsc --noEmit` — 期望 clean
- [ ] **Step 2:** `pnpm vitest run` — 期望全绿(应 > 1050 tests,本阶段新增 ≥ 25 tests)
- [ ] **Step 3:** `pnpm build` — workbox 2MB 失败可接受(pre-existing),非 P3 回归
- [ ] **Step 4:** 若有非预期 regression,修复后 commit;否则此 task 无提交

报告:
- tsc ✅/❌
- vitest ✅/❌ + 测试总数
- build 结果(pre-existing or regression)

---

## 接受标准

- [ ] `src/apps/AppStore/UploadPage.tsx` 删除
- [ ] `src/apps/AppStore/components/UploadSheetPlaceholder.tsx` 删除
- [ ] UploadSheet 5 phase 都有测试
- [ ] AppContextMenu 3 item 可用,点 backdrop 关闭
- [ ] AppDetailSheet 展示 6 字段 + 卸载按钮
- [ ] AppStoreApp 长按行为接通 ContextMenu → DetailSheet
- [ ] 全部 tsc clean, vitest 全绿
- [ ] 无新增 `backdrop-filter` 字面量(毛玻璃从 `<Material>` 来)
- [ ] 所有图标来自 lucide-react

---

## 踩坑注意

1. **useLongPress 返回 shape** — P2 T3 已确认:返回 `{ onPointerDown, onPointerUp, onPointerCancel, onClick, cancel, firedRef }`,必须显式挂而非 spread(`cancel`/`firedRef` 非 DOM attr)。AppStoreApp 里 `handleLongPress` 回调是 `InstalledAppRow` 直接调用的,所以新增工作在 AppStoreApp 这层。
2. **installer mock** — `vi.spyOn(installerMod, 'install')` 才能被测试覆盖;不要 mock 整模块。
3. **isDragging ref** — 若要给 Sheet 新增拖下关闭手势(M3 task 范围外,可不做),遵循 src/CLAUDE.md 踩坑 4。
4. **测试中 waitFor useLongPress 500ms delay** — 可以用 `vi.useFakeTimers()` + `vi.advanceTimersByTime(600)`,或直接调内部回调(更稳定)。推荐 fake timers。
5. **Material 组件 import 路径** — 先查 `src/system/Material/index.ts` 确认导出名(可能是 `Material` 或 default)。
