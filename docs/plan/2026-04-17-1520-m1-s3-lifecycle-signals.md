# M1 · S3: Lifecycle Signals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `appRuntimeStore` 里加一套 launch/resume/background/kill 的单调递增 nonce 机制，给未来的 `@hiphone/hooks` SDK 订阅用。

**Architecture:** `appEvents: Record<appId, { launch, resume, background, kill }>`——每个 app 维护一组 nonce，状态转换时对应字段 +1。Hook 侧用 `useEffect(cb, [nonce])` 触发回调。`wasAppKilled` 继续保留（M1 不改消费者）。

**Tech Stack:** TypeScript, Zustand, Vitest.

**Parent spec:** [2026-04-17-m1-architecture-decoupling-design.md](../superpowers/specs/2026-04-17-m1-architecture-decoupling-design.md) §S3

**Prerequisites:** None（独立于 S1/S2）

**Test command:** `pnpm test` (single-run vitest).

---

## 事件发射矩阵

| 转换路径 | 触发方法 | 发射事件 |
|---------|---------|---------|
| 首次打开（app 从未在 recentApps 中出现） | `openApp(id)` | `launch++` |
| 从后台恢复（app 在 recentApps 中，但非 active） | `openApp(id)` / `activateApp(id)` | `resume++` |
| 被 kill 后重开（`wasAppKilled(id) === true`） | `openApp(id)` / `activateApp(id)` | `launch++`（调用前已在 removeApp 时 kill++ 过） |
| 前台 → 后台（退回主屏） | `goHome()` / `exitAppToHome()` | 对被退出的 app：`background++` |
| 被上划关闭 | `removeApp(id)` | `kill++` |

**判定规则：**
- `openApp` / `activateApp`：若 `activeAppId === id`（已在前台）→ 不发任何事件；否则查"之前是否在 recentApps"决定 launch vs resume
- `goHome` / `exitAppToHome`：只对当前 `activeAppId` 发 background（若有）
- `removeApp`：永远发 kill（即使 app 不在 recentApps 中也无副作用，用 Set 去重）

---

## File Structure

- **Modify** `src/platform/stores/appRuntimeStore.ts` — 加 `appEvents` state + emit 逻辑
- **Create** `src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts` — nonce 专项测试

---

## Task 1: Add appEvents State + Ensure Nonces Initialize

**Files:**
- Modify: `src/platform/stores/appRuntimeStore.ts`
- Create: `src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`

- [ ] **Step 1: Write failing test for appEvents field**

Create `src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';
import { useAppRuntimeStore, wasAppKilled, clearAppKilled } from '../appRuntimeStore';

function resetStore() {
  useAppRuntimeStore.setState({
    activeAppId: null,
    appOrigin: null,
    switcherCardOrigin: null,
    switcherCardViewport: null,
    recentApps: [],
    switcherAppId: null,
    transitionSource: 'icon',
    presentationMode: 'foreground',
    dismissedAppId: null,
    dismissReason: null,
    switcherDismissing: false,
    appEvents: {},
    cardDismiss: {
      appId: null, startY: 0, cardHeight: 1,
      deltaY: 0, progress: 0, velocityY: 0,
    },
  });
  // Clear any killed flags left over from previous test
  clearAppKilled('settings');
  clearAppKilled('weather');
  clearAppKilled('xingyu');
}

describe('appRuntimeStore — lifecycle nonces', () => {
  beforeEach(() => resetStore());

  it('appEvents starts empty', () => {
    expect(useAppRuntimeStore.getState().appEvents).toEqual({});
  });
});
```

- [ ] **Step 2: Run test — verify fails (appEvents field missing)**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: FAIL — TypeScript error: `appEvents` does not exist on `AppRuntimeState`.

- [ ] **Step 3: Add appEvents state + types**

In `src/platform/stores/appRuntimeStore.ts`, add the types near the top (after existing interfaces):

```typescript
export interface AppEventNonces {
  /** New-launch count (fresh start or after kill). */
  launch: number;
  /** Resume count (foreground from background). */
  resume: number;
  /** Background count (foreground → background). */
  background: number;
  /** Kill count (swiped away). */
  kill: number;
}
```

Add to `AppRuntimeState` interface (inside the interface definition):

```typescript
  /** Monotonically increasing lifecycle event nonces per app. Hooks
   *  subscribe via useEffect on the relevant nonce field. */
  appEvents: Record<string, AppEventNonces>;
```

Add to initial state (inside `useAppRuntimeStore.create(...)`, after `cardDismiss: {...}`):

```typescript
  appEvents: {},
```

- [ ] **Step 4: Run test — verify passes**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 1 passed.

- [ ] **Step 5: Add helper function for emitting events**

At the top of `appRuntimeStore.ts` (before the `useAppRuntimeStore` declaration, near `resetCardDismissState`):

```typescript
function bumpEvent(
  events: Record<string, AppEventNonces>,
  id: string,
  kind: keyof AppEventNonces,
): Record<string, AppEventNonces> {
  const prev = events[id] ?? { launch: 0, resume: 0, background: 0, kill: 0 };
  return {
    ...events,
    [id]: { ...prev, [kind]: prev[kind] + 1 },
  };
}
```

- [ ] **Step 6: Typecheck + run all store tests**

Run: `pnpm typecheck`
Expected: no errors.

Run: `pnpm test src/platform/stores/__tests__/`
Expected: all existing store tests still pass.

- [ ] **Step 7: Commit (scaffolding only — emit logic comes next)**

```bash
git add src/platform/stores/appRuntimeStore.ts src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts
git commit -m "$(cat <<'EOF'
feat(appRuntimeStore): add appEvents nonce scaffolding

M1 S3 Task 1 — 只加 state 和 bumpEvent helper，尚未在任何状态转换
点发射事件。所有现有测试保持通过。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Emit launch / resume in openApp

**Files:**
- Modify: `src/platform/stores/appRuntimeStore.ts`
- Modify: `src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`

- [ ] **Step 1: Add failing tests for openApp emissions**

Append to `appRuntimeStore.lifecycle.test.ts`:

```typescript
  it('openApp first-time emits launch (not resume)', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(1);
    expect(ev?.resume).toBe(0);
  });

  it('openApp on already-backgrounded app emits resume', () => {
    // First open
    useAppRuntimeStore.getState().openApp('settings', null);
    // Go home (backgrounds it)
    useAppRuntimeStore.getState().goHome();
    // Re-open
    useAppRuntimeStore.getState().openApp('settings', null);

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(1);
    expect(ev?.resume).toBe(1);
  });

  it('openApp after kill emits launch (not resume)', () => {
    // Open + kill
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().removeApp('settings');
    // Re-open — wasAppKilled('settings') is true
    useAppRuntimeStore.getState().openApp('settings', null);

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(2);
    expect(ev?.resume).toBe(0);
  });

  it('openApp when already active emits nothing new', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    const before = useAppRuntimeStore.getState().appEvents.settings;
    // Re-open same app while already active
    useAppRuntimeStore.getState().openApp('settings', null);
    const after = useAppRuntimeStore.getState().appEvents.settings;
    expect(after?.launch).toBe(before?.launch);
    expect(after?.resume).toBe(before?.resume);
  });
```

- [ ] **Step 2: Run tests — verify they fail**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 4 new tests fail (launch/resume not incrementing).

- [ ] **Step 3: Modify openApp to emit events**

In `appRuntimeStore.ts`, replace the existing `openApp` implementation:

```typescript
  openApp: (id, origin) =>
    set((state) => {
      // Decide event kind BEFORE mutating state
      const alreadyActive = state.activeAppId === id;
      const wasKilled = wasAppKilled(id);
      const wasInRecent = state.recentApps.some((t) => t.id === id);

      let nextEvents = state.appEvents;
      if (!alreadyActive) {
        if (wasKilled) {
          clearAppKilled(id);
          nextEvents = bumpEvent(nextEvents, id, 'launch');
        } else if (wasInRecent) {
          nextEvents = bumpEvent(nextEvents, id, 'resume');
        } else {
          nextEvents = bumpEvent(nextEvents, id, 'launch');
        }
      }

      const task = { id, origin };

      return {
        activeAppId: id,
        appOrigin: origin,
        switcherCardOrigin: null,
        switcherCardViewport: null,
        recentApps: moveTaskToFront(state.recentApps, task),
        switcherAppId: id,
        transitionSource: 'icon',
        presentationMode: 'foreground',
        dismissedAppId: null,
        dismissReason: null,
        switcherDismissing: false,
        appEvents: nextEvents,
        ...resetCardDismissState(),
      };
    }),
```

- [ ] **Step 4: Run tests — verify all 4 new tests pass**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 5 passed (1 scaffolding + 4 openApp tests).

- [ ] **Step 5: Run existing appRuntimeStore tests — verify no regressions**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.test.ts`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/platform/stores/appRuntimeStore.ts src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts
git commit -m "$(cat <<'EOF'
feat(appRuntimeStore): emit launch/resume nonces from openApp

M1 S3 Task 2 — openApp 根据 wasAppKilled + recentApps 成员关系决定
发 launch 还是 resume；已 active 时不发任何事件（防抖）。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Emit resume in activateApp

**Files:**
- Modify: `src/platform/stores/appRuntimeStore.ts`
- Modify: `src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`

- [ ] **Step 1: Add failing test for activateApp resume**

Append to `appRuntimeStore.lifecycle.test.ts`:

```typescript
  it('activateApp (from switcher) on backgrounded app emits resume', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().goHome();
    // activateApp is the switcher tap
    useAppRuntimeStore.getState().activateApp('settings');

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(1);
    expect(ev?.resume).toBe(1);
  });

  it('activateApp after kill emits launch', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().removeApp('settings');
    // Simulate switcher reopen path (though kill usually removes from switcher,
    // this guards the symmetry with openApp).
    useAppRuntimeStore.getState().activateApp('settings');

    const ev = useAppRuntimeStore.getState().appEvents.settings;
    expect(ev?.launch).toBe(2);
  });
```

- [ ] **Step 2: Run — verify fails**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 2 new tests fail.

- [ ] **Step 3: Modify activateApp**

Replace `activateApp` in `appRuntimeStore.ts`:

```typescript
  activateApp: (id, source = 'switcher') =>
    set((state) => {
      const alreadyActive = state.activeAppId === id;
      const wasKilled = wasAppKilled(id);

      let nextEvents = state.appEvents;
      if (!alreadyActive) {
        if (wasKilled) {
          clearAppKilled(id);
          nextEvents = bumpEvent(nextEvents, id, 'launch');
        } else {
          nextEvents = bumpEvent(nextEvents, id, 'resume');
        }
      }

      const task = state.recentApps.find((item) => item.id === id) ?? { id, origin: null };

      return {
        activeAppId: id,
        appOrigin: task.origin,
        recentApps: moveTaskToFront(state.recentApps, task),
        switcherAppId: id,
        transitionSource: source,
        presentationMode: 'foreground',
        switcherEnterAnimating: false,
        dismissedAppId: null,
        dismissReason: null,
        switcherDismissing: false,
        appEvents: nextEvents,
        ...resetCardDismissState(),
      };
    }),
```

- [ ] **Step 4: Run tests — verify passes**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Run full store tests + typecheck**

Run: `pnpm test src/platform/stores/` && `pnpm typecheck`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/platform/stores/appRuntimeStore.ts src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts
git commit -m "$(cat <<'EOF'
feat(appRuntimeStore): emit launch/resume nonces from activateApp

M1 S3 Task 3 — activateApp (switcher tap) 同样区分 launch (after kill)
vs resume，保持与 openApp 对称。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Emit background in goHome / exitAppToHome

**Files:**
- Modify: `src/platform/stores/appRuntimeStore.ts`
- Modify: `src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `appRuntimeStore.lifecycle.test.ts`:

```typescript
  it('goHome emits background for the currently active app', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().goHome();
    expect(useAppRuntimeStore.getState().appEvents.settings?.background).toBe(1);
  });

  it('goHome with no active app emits nothing', () => {
    useAppRuntimeStore.getState().goHome();
    expect(useAppRuntimeStore.getState().appEvents).toEqual({});
  });

  it('exitAppToHome emits background for active app', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().exitAppToHome();
    expect(useAppRuntimeStore.getState().appEvents.settings?.background).toBe(1);
  });
```

- [ ] **Step 2: Run — verify fails**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 3 new tests fail.

- [ ] **Step 3: Modify goHome**

Replace `goHome` in `appRuntimeStore.ts`:

```typescript
  goHome: () =>
    set((state) => {
      const exitingId = state.activeAppId;
      const nextEvents = exitingId
        ? bumpEvent(state.appEvents, exitingId, 'background')
        : state.appEvents;

      return {
        activeAppId: null,
        appOrigin: null,
        switcherCardOrigin: null,
        switcherCardViewport: null,
        switcherAppId: exitingId ?? state.switcherAppId ?? state.recentApps[0]?.id ?? null,
        presentationMode: 'foreground',
        switcherEnterAnimating: false,
        dismissedAppId: null,
        dismissReason: null,
        switcherDismissing: false,
        appEvents: nextEvents,
        ...resetCardDismissState(),
      };
    }),
```

- [ ] **Step 4: Modify exitAppToHome**

Replace `exitAppToHome` in `appRuntimeStore.ts`:

```typescript
  exitAppToHome: () => {
    const state = get();
    if (!state.activeAppId) return;
    const exitingId = state.activeAppId;
    set({
      activeAppId: null,
      switcherCardOrigin: null,
      switcherCardViewport: null,
      presentationMode: 'foreground',
      switcherEnterAnimating: false,
      switcherAppId: exitingId,
      dismissedAppId: exitingId,
      dismissReason: 'home',
      switcherDismissing: false,
      appEvents: bumpEvent(state.appEvents, exitingId, 'background'),
      ...resetCardDismissState(),
    });
  },
```

- [ ] **Step 5: Run — verify all pass**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 10 passed.

- [ ] **Step 6: Run full store tests**

Run: `pnpm test src/platform/stores/`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/platform/stores/appRuntimeStore.ts src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts
git commit -m "$(cat <<'EOF'
feat(appRuntimeStore): emit background nonce from goHome and exitAppToHome

M1 S3 Task 4 — 退回主屏的两条路径都在对 activeAppId 发 background。
无 active 时不发。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Emit kill in removeApp

**Files:**
- Modify: `src/platform/stores/appRuntimeStore.ts`
- Modify: `src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `appRuntimeStore.lifecycle.test.ts`:

```typescript
  it('removeApp emits kill and also sets wasAppKilled', () => {
    useAppRuntimeStore.getState().openApp('settings', null);
    useAppRuntimeStore.getState().removeApp('settings');

    expect(useAppRuntimeStore.getState().appEvents.settings?.kill).toBe(1);
    expect(wasAppKilled('settings')).toBe(true);
  });

  it('removeApp on unknown id emits kill (best-effort)', () => {
    useAppRuntimeStore.getState().removeApp('never-opened');
    expect(useAppRuntimeStore.getState().appEvents['never-opened']?.kill).toBe(1);
  });

  it('full lifecycle: launch → background → resume → kill → launch', () => {
    const s = useAppRuntimeStore.getState;

    s().openApp('settings', null);
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 0, background: 0, kill: 0 });

    s().goHome();
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 0, background: 1, kill: 0 });

    s().openApp('settings', null);
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 1, background: 1, kill: 0 });

    s().removeApp('settings');
    expect(s().appEvents.settings).toEqual({ launch: 1, resume: 1, background: 1, kill: 1 });

    s().openApp('settings', null);
    expect(s().appEvents.settings).toEqual({ launch: 2, resume: 1, background: 1, kill: 1 });
  });
```

- [ ] **Step 2: Run — verify fails**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 3 new tests fail.

- [ ] **Step 3: Modify removeApp**

Replace `removeApp` in `appRuntimeStore.ts`:

```typescript
  removeApp: (id) => {
    _killedApps.add(id);
    set((state) => {
      const removedIndex = state.recentApps.findIndex((task) => task.id === id);
      const nextRecentApps = state.recentApps.filter((task) => task.id !== id);
      const fallbackTask = resolveFallbackTask(nextRecentApps, removedIndex);
      const nextActiveAppId =
        state.activeAppId === id ? fallbackTask?.id ?? null : state.activeAppId;
      const nextActiveTask =
        nextActiveAppId == null
          ? null
          : nextRecentApps.find((task) => task.id === nextActiveAppId) ?? null;
      const nextSwitcherAppId =
        state.switcherAppId === id ? fallbackTask?.id ?? null : state.switcherAppId;
      const shouldExitSwitcher = state.presentationMode === 'switcher' && nextRecentApps.length === 0;

      return {
        recentApps: nextRecentApps,
        activeAppId: shouldExitSwitcher ? null : nextActiveAppId,
        appOrigin: shouldExitSwitcher ? null : nextActiveTask?.origin ?? null,
        switcherAppId: shouldExitSwitcher ? null : nextSwitcherAppId,
        presentationMode: shouldExitSwitcher ? 'foreground' : state.presentationMode,
        dismissedAppId: null,
        dismissReason: null,
        appEvents: bumpEvent(state.appEvents, id, 'kill'),
      };
    });
  },
```

- [ ] **Step 4: Run — verify all pass**

Run: `pnpm test src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts`
Expected: 13 passed.

- [ ] **Step 5: Run entire test suite**

Run: `pnpm test`
Expected: all pass (no regressions anywhere).

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/platform/stores/appRuntimeStore.ts src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts
git commit -m "$(cat <<'EOF'
feat(appRuntimeStore): emit kill nonce from removeApp + full-cycle tests

M1 S3 Task 5 — removeApp 同时更新 _killedApps Set 和 appEvents.kill
nonce（两者共存，M1 不改现有 wasAppKilled 消费者）。加一个
launch → background → resume → kill → launch 全循环测试锁死
状态机。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria

- [ ] 13 lifecycle tests pass in `appRuntimeStore.lifecycle.test.ts`
- [ ] 所有现有 `appRuntimeStore.test.ts` 测试保持通过
- [ ] `pnpm test` 全绿
- [ ] `pnpm typecheck` 通过
- [ ] 4 commits on branch:
  - Task 1 scaffolding
  - Task 2 openApp emit
  - Task 3 activateApp emit
  - Task 4 goHome/exitAppToHome emit
  - Task 5 removeApp emit
  
  (可以合并某些提交——比如 Task 1+2，取决于 executing-plans 的策略)

## Notes for Next Stage (S4)

S4 新建 `src/platform/userApp/` 目录，落 compiler + sandbox。需要安装 `sucrase` 依赖。与 S3 完全独立。
