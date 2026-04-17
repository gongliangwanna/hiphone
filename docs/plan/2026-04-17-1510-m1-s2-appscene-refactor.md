# M1 · S2: AppScene Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `AppScene.tsx` 的 if-else + 硬编码两个 Set 替换为"查 Registry + 从 entry 读字段"，行为 100% 不变。

**Architecture:** `AppScene` 改为纯 lookup：根据 `appId` 从 `appRegistry` 拿 entry，读 `entry.perspectiveAware` / `entry.globalData` 决定是否显示占位。找不到 entry 则兜底 DemoApp（保留既有行为）。App 组件的 direct import 全部移除（已在 S1 的 `registerBuiltins.ts` 里）。

**Tech Stack:** TypeScript, React 19, Vitest, @testing-library/react.

**Parent spec:** [2026-04-17-m1-architecture-decoupling-design.md](../superpowers/specs/2026-04-17-m1-architecture-decoupling-design.md) §S2

**Prerequisites:** S1 complete (appRegistry + registerBuiltins 已落地)

**Test command:** `pnpm test` (single-run vitest).

---

## File Structure

- **Modify (near-full rewrite)** `src/apps/AppScene.tsx` — Registry lookup 替代 if-else
- **Create** `src/apps/__tests__/AppScene.test.tsx` — 回归测试覆盖 perspective 逻辑

---

## Task 1: Write Regression Tests for Current AppScene Behavior

这是防回归的关键：先冻结当前行为为测试，再做改造。

**Files:**
- Create: `src/apps/__tests__/AppScene.test.tsx`

**Strategy:** Use stub components registered into the Registry (instead of real app components) so tests isolate AppScene's routing logic. This avoids rendering heavy app trees in jsdom and keeps tests fast/stable. The "real apps still work" check is a hand smoke test in Task 2.

**Important:** Task 1 tests will FAIL against the current (unrefactored) AppScene because it still dispatches via if-else on specific app ids — stubs registered under different ids won't render. Task 2's refactor makes them pass. This is intentional: Task 1 writes the spec for the refactored behavior, Task 2 makes it true.

- [ ] **Step 1: Write tests for the refactored AppScene contract**

Create `src/apps/__tests__/AppScene.test.tsx`:

```typescript
import { render, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ComponentType } from 'react';
import { appRegistry } from '@/platform/appRegistry';
import { AppScene } from '../AppScene';
import { usePhoneOwnerStore } from '@/platform/stores/phoneOwnerStore';
import { useCharacterStore } from '@/platform/stores/characterStore';

const makeStub = (label: string): ComponentType =>
  function Stub() { return <div data-testid="stub">{label}</div>; };

function registerStub(opts: {
  id: string;
  perspectiveAware: boolean;
  globalData: boolean;
  label: string;
}) {
  appRegistry.register({
    id: opts.id,
    type: 'builtin',
    component: makeStub(opts.label),
    perspectiveAware: opts.perspectiveAware,
    globalData: opts.globalData,
  });
}

describe('AppScene (post-Registry refactor)', () => {
  beforeEach(() => {
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
    usePhoneOwnerStore.setState({ phoneOwnerId: null });
    useCharacterStore.setState({
      characters: [{
        id: 'char-001', name: '测试角色', avatar: '',
        description: '', personality: '', scenario: '',
        systemPrompt: '', postHistoryInstructions: '',
        messageExamples: [], alternateGreetings: [],
      }],
    });
  });

  afterEach(() => {
    cleanup();
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
  });

  it('renders the registered component when viewing as player', () => {
    registerStub({ id: 'app-a', perspectiveAware: false, globalData: false, label: 'A-RENDER' });

    const { getByTestId } = render(<AppScene appId="app-a" />);
    expect(getByTestId('stub').textContent).toBe('A-RENDER');
  });

  it('renders DemoApp fallback for unknown appId', () => {
    const { container } = render(<AppScene appId="nonexistent-app-xyz" />);
    // DemoApp displays the appId somewhere in its output
    expect(container.textContent).toContain('nonexistent-app-xyz');
  });

  it('renders perspective-aware app normally when viewing another phone', () => {
    registerStub({ id: 'app-pa', perspectiveAware: true, globalData: false, label: 'PA-RENDER' });
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });

    const { getByTestId } = render(<AppScene appId="app-pa" />);
    expect(getByTestId('stub').textContent).toBe('PA-RENDER');
  });

  it('renders global-data app normally when viewing another phone', () => {
    registerStub({ id: 'app-gd', perspectiveAware: false, globalData: true, label: 'GD-RENDER' });
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });

    const { getByTestId } = render(<AppScene appId="app-gd" />);
    expect(getByTestId('stub').textContent).toBe('GD-RENDER');
  });

  it('shows read-only placeholder for non-perspective, non-global app when viewing another phone', () => {
    registerStub({ id: 'app-ro', perspectiveAware: false, globalData: false, label: 'RO-RENDER' });
    usePhoneOwnerStore.setState({ phoneOwnerId: 'char-001' });

    const { container, queryByTestId } = render(<AppScene appId="app-ro" />);
    // Stub is NOT rendered — placeholder is
    expect(queryByTestId('stub')).toBeNull();
    expect(container.textContent).toContain('测试角色');
    expect(container.textContent).toContain('暂无数据');
  });
});
```

- [ ] **Step 2: Run tests — confirm they currently fail (pre-refactor)**

Run: `pnpm test src/apps/__tests__/AppScene.test.tsx`
Expected: some/all FAIL against the current AppScene (it still uses if-else on hardcoded app ids, so stubs registered under new ids like `app-a` don't get rendered).

This is expected — Task 2 refactor fixes this.

- [ ] **Step 3: Commit the (failing) contract tests**

```bash
git add src/apps/__tests__/AppScene.test.tsx
git commit -m "$(cat <<'EOF'
test(apps): add AppScene Registry-based routing contract (failing)

M1 S2 Task 1 — 用 stub 组件测 AppScene 的五条路径：
正常 app / 未知 app / perspective-aware / global-data / placeholder。
测试目前对旧的 if-else AppScene 失败（符合预期），Task 2 的重写让
它们通过。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Refactor AppScene to Use Registry

**Files:**
- Modify: `src/apps/AppScene.tsx`

- [ ] **Step 1: Rewrite AppScene.tsx**

Replace the entire contents of `src/apps/AppScene.tsx`:

```typescript
import { appRegistry } from '@/platform/appRegistry';
import { DemoApp } from './DemoApp';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { useCharacterStore } from '@/platform/stores/characterStore';
import { Smartphone } from 'lucide-react';

interface AppSceneProps {
  appId: string;
}

/**
 * AppScene — queries appRegistry to resolve the component for appId and
 * handles "viewing another's phone" perspective semantics via the
 * perspectiveAware / globalData flags on each registry entry.
 *
 * Apps not found in the registry fall through to DemoApp (preserves the
 * prior behavior for icons without a corresponding component, e.g.
 * 'messages', 'alipay', etc.).
 */
export function AppScene({ appId }: AppSceneProps) {
  const { phoneOwnerId, isViewingOther } = usePerspective();
  const entry = appRegistry.get(appId);

  if (!entry) {
    return <DemoApp appId={appId} />;
  }

  // Viewing another's phone: perspective-aware or global-data apps render
  // normally; everything else shows the read-only placeholder.
  if (isViewingOther && !entry.perspectiveAware && !entry.globalData) {
    return <ReadOnlyAppPlaceholder appId={appId} characterId={phoneOwnerId!} />;
  }

  const Component = entry.component;
  return <Component />;
}

const APP_NAMES: Record<string, string> = {
  notes: '备忘录',
  calendar: '日历',
  camera: '相机',
  photos: '照片',
  safari: '浏览器',
  gomoku: '五子棋',
};

function ReadOnlyAppPlaceholder({
  appId,
  characterId,
}: {
  appId: string;
  characterId: string;
}) {
  const character = useCharacterStore(
    (s) => s.characters.find((c) => c.id === characterId),
  );
  const appName = APP_NAMES[appId] || appId;

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 px-8"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      <div
        className="flex items-center justify-center rounded-2xl"
        style={{
          width: 64,
          height: 64,
          backgroundColor: 'rgba(255, 149, 0, 0.1)',
        }}
      >
        <Smartphone size={32} strokeWidth={1.5} color="rgb(255, 149, 0)" />
      </div>
      <div className="text-center">
        <div
          style={{
            fontSize: 17,
            fontWeight: 600,
            color: 'var(--color-label)',
            marginBottom: 6,
          }}
        >
          {character?.name || '???'} 的{appName}
        </div>
        <div
          style={{
            fontSize: 14,
            color: 'var(--color-secondaryLabel)',
            lineHeight: 1.5,
          }}
        >
          该角色的{appName}暂无数据
        </div>
      </div>
    </div>
  );
}
```

**Key changes vs. original:**
- Direct app imports (SettingsApp, XingYuApp, etc.) removed — now loaded via registry
- Two hardcoded Sets (`PERSPECTIVE_AWARE_APPS`, `GLOBAL_DATA_APPS`) removed — semantics now in entry fields
- `AppSceneInner` inner function removed — dispatch is now a simple `<entry.component />`
- `ReadOnlyAppPlaceholder` and `APP_NAMES` unchanged

- [ ] **Step 2: Run contract tests — verify they now pass**

Run: `pnpm test src/apps/__tests__/AppScene.test.tsx`
Expected: all 5 tests now pass (the refactor satisfies the contract written in Task 1).

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: all tests pass (no regressions anywhere).

- [ ] **Step 4: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 5: Smoke test dev build**

Run: `pnpm dev` — open `http://localhost:5173/` and verify:
- [ ] Tap Settings icon — Settings app opens
- [ ] Tap XingYu (可爱信) icon — XingYu app opens
- [ ] Tap Notes icon — Notes app opens
- [ ] Tap Weather icon — Weather app opens
- [ ] Tap Camera icon — Camera app opens
- [ ] Tap Calendar icon — Calendar app opens
- [ ] Tap an icon without a corresponding component (e.g. Messages, Alipay) — DemoApp fallback shows

Stop the dev server (Ctrl+C).

- [ ] **Step 6: Commit**

```bash
git add src/apps/AppScene.tsx
git commit -m "$(cat <<'EOF'
refactor(apps): AppScene queries appRegistry instead of hardcoded dispatch

M1 S2 — if-else 改成 Registry lookup；两个 perspective Set 下沉到
entry 字段。所有现有 app 行为完全不变（5 个回归测试 + 手工 smoke
都通过）。

- 移除 11 个 app 的 direct import（现由 registerBuiltins.ts 统一管）
- 移除 PERSPECTIVE_AWARE_APPS / GLOBAL_DATA_APPS 两个 Set
- DemoApp 兜底路径保留
- ReadOnlyAppPlaceholder 逻辑完全不变

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria

- [ ] 5 regression tests in `AppScene.test.tsx` all pass
- [ ] `pnpm test` all green
- [ ] `pnpm typecheck` passes
- [ ] 手工 smoke：所有 builtin app 仍可打开（见 Task 2 Step 5 checklist）
- [ ] `AppScene.tsx` 中不再 import 任何 app 组件（`grep -c "from './.*App'" src/apps/AppScene.tsx` 应为 0）
- [ ] 2 commits on branch:
  - `test(apps): capture AppScene perspective behavior as regression baseline`
  - `refactor(apps): AppScene queries appRegistry instead of hardcoded dispatch`

## Notes for Next Stage (S3)

S3 改造 `appRuntimeStore` 加生命周期 nonce。与 S2 完全独立——S3 不需要 Registry，只改 store。
