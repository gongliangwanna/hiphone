# M3 · S1: Runtime Tailwind Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 user app 里的 `className="flex gap-4 bg-red-500"` 在运行时渲染出正确的 CSS；做到"零配置、一次注入、幂等、失败不崩"。宿主 shell 视觉不受影响。

**Architecture:** 新增 `src/platform/userApp/twindRuntime.ts` 导出 `ensureTwindInstalled()`。函数内部动态 `import('@tailwindcss/browser')`，包 auto-activates：扫描 `document` 里所有 `class` attribute，向 `document.head` 注入生成的 Tailwind CSS；并用内置 MutationObserver 响应后续 DOM 变化。在 installer 的 `LazyUserApp` 的 `useLayoutEffect` 里调一次（紧接 `registerMountedApp` 之后），多次调用幂等。失败时 `console.warn` + 重置 installed 标志让后续 user app 挂载可重试。

**Tech Stack:** TypeScript, Vitest, React 19, **`@tailwindcss/browser`（新增）**, pnpm.

**Parent spec:** [2026-04-18-m3-app-store-ui-design.md](../superpowers/specs/2026-04-18-m3-app-store-ui-design.md) §S1 + §架构.#1

**Test command:** `pnpm test` (single-run vitest). Path alias `@/` → `src/`.

---

## File Structure

- **Modify** `package.json` — add `@tailwindcss/browser` as runtime dep
- **Create** `src/platform/userApp/twindRuntime.ts` — `ensureTwindInstalled()` singleton
- **Create** `src/platform/userApp/__tests__/twindRuntime.test.ts`
- **Modify** `src/platform/userApp/installer.ts` — `LazyUserApp` 的 `useLayoutEffect` 里调 `ensureTwindInstalled()`
- **Modify** `src/platform/userApp/__tests__/m2.e2e.test.ts` — 在既有 todo fixture 加一个 Tailwind class 断言，确认宿主 + Tailwind runtime 的端到端集成不破

---

## Task 1: Install @tailwindcss/browser dependency

**Files:** `package.json` 根目录

- [ ] **Step 1: 添加依赖**

Run:
```bash
pnpm add @tailwindcss/browser@^4
```

Expected: `package.json` 的 `dependencies` 多一行 `"@tailwindcss/browser": "^4.x.x"`；`pnpm-lock.yaml` 更新。

- [ ] **Step 2: 验证 import 可用（静态检查）**

Run:
```bash
node -e "import('@tailwindcss/browser').then(m => console.log(Object.keys(m).length >= 0 ? 'ok' : 'empty'))"
```

Expected: 输出 `ok`（包被解析到，无 import 错误）。该包只有副作用，不一定导出具名 API —— 我们只关心 `import()` 能 resolve。

- [ ] **Step 3: 确认 build 未破坏**

Run:
```bash
pnpm typecheck
```

Expected: 无 TS 错误（新依赖有 TS types 或至少能被当作 `any` import）。

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "$(cat <<'EOF'
chore(deps): add @tailwindcss/browser for user app runtime Tailwind

M3 S1 前置依赖。User app 代码在运行时由 Sucrase 编译，构建时扫描
不到它用的 Tailwind class。@tailwindcss/browser 在运行时扫描 DOM
并生成 CSS，与宿主构建时 Tailwind v4 语义一致。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: twindRuntime.ts — ensureTwindInstalled singleton

**Files:**
- Create: `src/platform/userApp/twindRuntime.ts`
- Create: `src/platform/userApp/__tests__/twindRuntime.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/platform/userApp/__tests__/twindRuntime.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('twindRuntime', () => {
  beforeEach(() => {
    // vi.resetModules clears the internal "installed" flag between tests so
    // each test starts from a fresh state.
    vi.resetModules();
    vi.doUnmock('@tailwindcss/browser');
  });

  it('ensureTwindInstalled imports @tailwindcss/browser exactly once across many calls', async () => {
    const importMock = vi.fn(() => Promise.resolve({}));
    vi.doMock('@tailwindcss/browser', () => {
      importMock();
      return {};
    });

    const { ensureTwindInstalled } = await import('../twindRuntime');

    // Fire 5 concurrent calls
    await Promise.all([
      ensureTwindInstalled(),
      ensureTwindInstalled(),
      ensureTwindInstalled(),
      ensureTwindInstalled(),
      ensureTwindInstalled(),
    ]);
    // Plus one sequential call
    await ensureTwindInstalled();

    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('swallows import failures (console.warn) and allows retry on next call', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // First call: simulate a rejected import
    let attempt = 0;
    vi.doMock('@tailwindcss/browser', () => {
      attempt++;
      if (attempt === 1) throw new Error('network fail');
      return {};
    });

    const { ensureTwindInstalled } = await import('../twindRuntime');

    await ensureTwindInstalled(); // should not throw
    expect(warnSpy).toHaveBeenCalled();

    // Next call should retry (installed flag reset on failure)
    await ensureTwindInstalled();
    expect(attempt).toBe(2);

    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
pnpm test src/platform/userApp/__tests__/twindRuntime.test.ts
```

Expected: FAIL — `Cannot find module '../twindRuntime'`.

- [ ] **Step 3: Implement twindRuntime.ts**

Create `src/platform/userApp/twindRuntime.ts`:

```typescript
/**
 * Runtime Tailwind bootstrapping for user apps.
 *
 * User app TSX is compiled by Sucrase at runtime, so its class names are
 * invisible to the host's build-time Tailwind scan. @tailwindcss/browser
 * scans `document` for class attributes after import and generates the
 * matching CSS into <head>; it also keeps a MutationObserver running to
 * catch dynamically rendered classes.
 *
 * We invoke this lazily from UserAppRoot's layout effect — the first time
 * any user app mounts the package is dynamically imported; subsequent
 * mounts reuse the already-loaded module.
 */

let installed = false;
let pending: Promise<void> | null = null;

export function ensureTwindInstalled(): Promise<void> {
  if (installed) return Promise.resolve();
  if (pending) return pending;

  pending = import('@tailwindcss/browser')
    .then(() => {
      installed = true;
    })
    .catch((err: unknown) => {
      console.warn('[twindRuntime] failed to load @tailwindcss/browser:', err);
      // Reset both flags so a future mount can retry.
      installed = false;
    })
    .finally(() => {
      pending = null;
    });

  return pending;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm test src/platform/userApp/__tests__/twindRuntime.test.ts
```

Expected: PASS (both tests).

- [ ] **Step 5: Commit**

```bash
git add src/platform/userApp/twindRuntime.ts src/platform/userApp/__tests__/twindRuntime.test.ts
git commit -m "$(cat <<'EOF'
feat(userApp): runtime Tailwind bootstrapper (ensureTwindInstalled)

Idempotent singleton that dynamically imports @tailwindcss/browser on
first call. Concurrent callers share the same in-flight promise; failed
imports are logged to console.warn and reset the flag so retries are
possible on next user app mount.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Wire ensureTwindInstalled into LazyUserApp mount

**Files:**
- Modify: `src/platform/userApp/installer.ts` (lines 279-295 — `buildUserAppComponent`)

- [ ] **Step 1: Modify LazyUserApp to invoke ensureTwindInstalled**

In `src/platform/userApp/installer.ts`, find the existing `LazyUserApp` function inside `buildUserAppComponent` (around line 279):

```typescript
const LazyRaw: ComponentType = function LazyUserApp() {
    if (!cache) {
      cache = createUserAppRuntime(compiledMap, manifest.entry, resolveModule, appId);
    }

    // Register this app instance via useLayoutEffect so it runs before any
    // passive useEffect callbacks inside user app code (e.g. `get('todos')`
    // in useEffect). React runs ALL layout effects before ANY passive effects,
    // regardless of component depth — so this registration is guaranteed to
    // be in place when user app useEffect callbacks fire.
    React.useLayoutEffect(() => {
      const unregister = registerMountedApp(appId);
      return unregister;
    }, []);

    return React.createElement(cache);
  };
```

Replace with:

```typescript
const LazyRaw: ComponentType = function LazyUserApp() {
    if (!cache) {
      cache = createUserAppRuntime(compiledMap, manifest.entry, resolveModule, appId);
    }

    // Register this app instance via useLayoutEffect so it runs before any
    // passive useEffect callbacks inside user app code (e.g. `get('todos')`
    // in useEffect). React runs ALL layout effects before ANY passive effects,
    // regardless of component depth — so this registration is guaranteed to
    // be in place when user app useEffect callbacks fire.
    //
    // Also kick off runtime Tailwind bootstrap so user app className="flex"
    // etc. get their CSS generated. The first user app mount triggers the
    // import; subsequent mounts are no-ops.
    React.useLayoutEffect(() => {
      void ensureTwindInstalled();
      const unregister = registerMountedApp(appId);
      return unregister;
    }, []);

    return React.createElement(cache);
  };
```

Also add the import near the top of the file (after the existing `import { registerMountedApp } from './sdk/context';` on line 21):

```typescript
import { ensureTwindInstalled } from './twindRuntime';
```

- [ ] **Step 2: Run existing installer/M2 tests to verify no regression**

Run:
```bash
pnpm test src/platform/userApp/__tests__/installer.test.ts src/platform/userApp/__tests__/m2.e2e.test.ts
```

Expected: All existing tests PASS. The new `ensureTwindInstalled` call is non-throwing and async, so it should not affect sync test paths. In test env the `@tailwindcss/browser` import may fail silently (console.warn) — that's OK.

If any test suddenly fails because of the console.warn output polluting test stdout, add to the test file's setup:

```typescript
vi.spyOn(console, 'warn').mockImplementation(() => {});
```

But do NOT add this preemptively — only if a test fails.

- [ ] **Step 3: Run full test suite**

Run:
```bash
pnpm test
```

Expected: All tests PASS (M1 + M2 + new S1 tests).

- [ ] **Step 4: Commit**

```bash
git add src/platform/userApp/installer.ts
git commit -m "$(cat <<'EOF'
feat(userApp): kick off Tailwind runtime from LazyUserApp mount

First user app mount triggers ensureTwindInstalled() inside the same
useLayoutEffect that registers the mounted app. Side-effect-only — the
void-returning call does not block rendering.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: E2E sanity — fixture app with Tailwind class

**Files:**
- Modify: `src/platform/userApp/__tests__/fixtures/todo-app/App.tsx`
- Modify: `src/platform/userApp/__tests__/m2.e2e.test.ts`

The goal: lock in that the existing todo fixture's app continues to render when we add a Tailwind class, and the class is reflected in the rendered DOM (we don't assert computed style since `@tailwindcss/browser` auto-activation may not settle synchronously in jsdom — the assertion is that the class attribute is present, proving the user-app code path including Tailwind init doesn't crash).

- [ ] **Step 1: Read existing fixture App.tsx**

Run:
```bash
cat src/platform/userApp/__tests__/fixtures/todo-app/App.tsx
```

Locate the root `<div>` element.

- [ ] **Step 2: Add a Tailwind utility class to the fixture's root div**

Edit `src/platform/userApp/__tests__/fixtures/todo-app/App.tsx`. On the outermost returned `<div>` element (the very first element in the rendered tree), add `className="flex flex-col gap-2"` (or merge with existing className). Pick one class combination that:
1. Is a clear Tailwind v4 utility (`flex`, `flex-col`, `gap-2`)
2. Doesn't visually break the fixture in a browser

If the existing fixture already has a className, merge like `className="existing-classes flex flex-col gap-2"`. If it has no className, add the attribute fresh.

**Important:** Do NOT change any logic / state / test IDs. Only the className attribute on the root div.

- [ ] **Step 3: Add a class-presence assertion to the E2E test**

Edit `src/platform/userApp/__tests__/m2.e2e.test.ts`. Find the test that renders the todo app (look for `loadFixtureZip('todo-app')` + `render(...)`). In ONE existing test (pick the most obvious integration test, e.g. one that already asserts on initial render), add an assertion **after** the app renders:

```typescript
// The fixture's root div carries a Tailwind utility class that must
// survive through the sandbox + renderer. (Class presence only — we
// don't assert computed style because jsdom doesn't run CSS.)
expect(container.innerHTML).toContain('flex flex-col gap-2');
```

Place this assertion right after the existing renderer assertions. Do NOT add a new test — modify an existing one.

- [ ] **Step 4: Run m2.e2e.test to verify it still passes**

Run:
```bash
pnpm test src/platform/userApp/__tests__/m2.e2e.test.ts
```

Expected: PASS — all M2 E2E tests, including the one now checking for the Tailwind class in the rendered HTML.

- [ ] **Step 5: Run full suite + typecheck + build**

Run (in parallel if possible):
```bash
pnpm test
pnpm typecheck
pnpm build
```

Expected:
- `pnpm test`: all PASS
- `pnpm typecheck`: no errors
- `pnpm build`: success; output contains an async chunk including `@tailwindcss/browser` (visible via `ls dist/assets/*.js` — there should be a chunk ~50+ KB for the browser package)

- [ ] **Step 6: Commit**

```bash
git add src/platform/userApp/__tests__/fixtures/todo-app/App.tsx src/platform/userApp/__tests__/m2.e2e.test.ts
git commit -m "$(cat <<'EOF'
test(userApp): verify Tailwind class survives sandbox in todo fixture

Add a flex utility class on the todo fixture's root div and assert it
appears in the rendered HTML. Locks that user app code going through
sucrase→sandbox→react doesn't strip className and confirms the
ensureTwindInstalled bootstrap doesn't break mounting even when the
tailwind browser package can't fully settle in jsdom.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## S1 Acceptance Checklist

- [ ] `pnpm test` all green (M1 + M2 + S1 new tests)
- [ ] `pnpm typecheck` zero errors
- [ ] `pnpm build` succeeds
- [ ] `src/platform/userApp/twindRuntime.ts` exists, exports `ensureTwindInstalled()`
- [ ] `src/platform/userApp/installer.ts` → LazyUserApp mount effect invokes `ensureTwindInstalled()`
- [ ] Todo fixture's rendered HTML contains `flex flex-col gap-2` in one E2E test
- [ ] Manual smoke test (optional in agentic flow, recommended once): `pnpm dev` → DevTools → paste `await globalThis.__hiphoneInstall(await globalThis.__hiphoneMakeTestZip('todo'))` → open todo from springboard → elements using Tailwind classes render with Tailwind styles (flex layout, correct background, etc.)

**Walking-skeleton invariant:** After S1 completes, all M1 + M2 behavior still works. The only visible change is user apps can now use Tailwind classes.
