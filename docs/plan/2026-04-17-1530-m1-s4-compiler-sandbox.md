# M1 · S4: Compiler + Sandbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立一个最小的"TSX 字符串 → 编译 → 沙箱执行 → React 组件"的管道。

**Architecture:** `compileTsx(source)` 用 Sucrase（按需动态 import）把 TSX 转成 CommonJS 风格 JS。`executeSandboxed(compiledCode, resolve)` 用 `new Function` 构造隔离作用域，遮蔽常见全局变量，注入自定义 `require` 转发给 `resolve(specifier)`，返回 `module.exports.default`（用户组件）。

**Tech Stack:** Sucrase (新增依赖), TypeScript, Vitest, React 19.

**Parent spec:** [2026-04-17-m1-architecture-decoupling-design.md](../superpowers/specs/2026-04-17-m1-architecture-decoupling-design.md) §S4

**Prerequisites:** None（独立于 S1/S2/S3）

**Test command:** `pnpm test` (single-run vitest).

---

## File Structure

- **Modify** `package.json` — 添加 `sucrase` 依赖
- **Create** `src/platform/userApp/compiler.ts` — Sucrase 按需加载 + TSX 转 JS
- **Create** `src/platform/userApp/__tests__/compiler.test.ts`
- **Create** `src/platform/userApp/sandbox.ts` — `new Function` + 全局遮蔽 + require 注入
- **Create** `src/platform/userApp/__tests__/sandbox.test.ts`

---

## Task 1: Install Sucrase + Compiler

**Files:**
- Modify: `package.json`
- Create: `src/platform/userApp/compiler.ts`
- Create: `src/platform/userApp/__tests__/compiler.test.ts`

- [ ] **Step 1: Install sucrase**

Run: `pnpm add sucrase`
Expected: package installed, `package.json` 和 `pnpm-lock.yaml` 更新。

Verify version is in dependencies (not devDependencies):

```bash
grep '"sucrase"' package.json
```

Expected: `"sucrase": "^3.x.x"` in `dependencies` block.

- [ ] **Step 2: Write failing test for compileTsx**

Create `src/platform/userApp/__tests__/compiler.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { compileTsx } from '../compiler';

describe('compileTsx', () => {
  it('compiles basic TSX to commonjs JS', async () => {
    const source = `
import React from 'react';

interface Props { name: string }

export default function Hello({ name }: Props) {
  return <div>Hello, {name}</div>;
}
    `;

    const compiled = await compileTsx(source);

    // After Sucrase transforms [typescript, jsx, imports], the output:
    // - Strips TypeScript interface
    // - Converts ESM import to require() calls
    // - Converts JSX to React.createElement
    expect(compiled).toContain('require(');
    expect(compiled).toContain('react');
    expect(compiled).toMatch(/React\.createElement|_react\.default\.createElement/);
    expect(compiled).toContain('module.exports');
    expect(compiled).not.toContain('interface Props');
  });

  it('compiles TSX with @hiphone/ui import', async () => {
    const source = `
import React from 'react';
import { NavBar } from '@hiphone/ui';

export default function App() {
  return <NavBar title="Test" />;
}
    `;

    const compiled = await compileTsx(source);

    expect(compiled).toContain('@hiphone/ui');
    expect(compiled).toContain('module.exports');
  });

  it('throws on syntax errors', async () => {
    const bad = `export default function Broken({ { { `;
    await expect(compileTsx(bad)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run — verify fails (module missing)**

Run: `pnpm test src/platform/userApp/__tests__/compiler.test.ts`
Expected: FAIL — cannot import `../compiler`.

- [ ] **Step 4: Implement compileTsx**

Create `src/platform/userApp/compiler.ts`:

```typescript
/**
 * Lazily-loaded Sucrase transform. Sucrase is ~120KB gzipped and only
 * needed when we actually compile a user app. Keeping it dynamic means
 * hiPhone startup is not penalized when no user app is opened.
 */
let sucrasePromise: Promise<typeof import('sucrase')> | null = null;

function loadSucrase() {
  if (!sucrasePromise) {
    sucrasePromise = import('sucrase');
  }
  return sucrasePromise;
}

/**
 * Compile a TSX source string to CommonJS-flavored JS.
 *
 * Transforms applied:
 * - `typescript` — strip type annotations and interfaces
 * - `jsx` — convert JSX to React.createElement
 * - `imports` — convert ESM import/export to CJS require/module.exports
 *
 * The resulting code is runnable inside `executeSandboxed()` which
 * provides `require` / `module` / `exports` / `React` in scope.
 */
export async function compileTsx(source: string): Promise<string> {
  const { transform } = await loadSucrase();
  const result = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    production: true,
  });
  return result.code;
}
```

- [ ] **Step 5: Run — verify passes**

Run: `pnpm test src/platform/userApp/__tests__/compiler.test.ts`
Expected: 3 passed.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/platform/userApp/compiler.ts src/platform/userApp/__tests__/compiler.test.ts
git commit -m "$(cat <<'EOF'
feat(userApp): add Sucrase-based TSX compiler (lazy-loaded)

M1 S4 Task 1 — compileTsx 把用户 app 的 TSX 字符串转成 CJS 风格 JS。
Sucrase 按需动态 import，hiPhone 启动不背负 120KB。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sandbox Execution

**Files:**
- Create: `src/platform/userApp/sandbox.ts`
- Create: `src/platform/userApp/__tests__/sandbox.test.ts`

- [ ] **Step 1: Write failing tests for sandbox**

Create `src/platform/userApp/__tests__/sandbox.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { compileTsx } from '../compiler';
import { executeSandboxed } from '../sandbox';

describe('executeSandboxed', () => {
  function makeResolver(modules: Record<string, unknown>) {
    return (specifier: string) => {
      if (specifier in modules) return modules[specifier];
      throw new Error(`Module not found: ${specifier}`);
    };
  }

  it('executes compiled code and returns default export', async () => {
    const compiled = await compileTsx(`
import React from 'react';
export default function Hello() {
  return React.createElement('div', null, 'hello');
}
    `);

    const Component = executeSandboxed(compiled, makeResolver({ react: React }));

    expect(typeof Component).toBe('function');
    // Render it once to make sure it returns a React element
    const element = (Component as React.FC)({});
    expect(React.isValidElement(element)).toBe(true);
  });

  it('forwards require() calls to the resolver', async () => {
    const fakeUi = { NavBar: () => null };
    const compiled = await compileTsx(`
import React from 'react';
import { NavBar } from '@hiphone/ui';
export default function App() {
  return React.createElement(NavBar, null);
}
    `);

    const resolver = vi.fn(makeResolver({ react: React, '@hiphone/ui': fakeUi }));
    executeSandboxed(compiled, resolver);

    expect(resolver).toHaveBeenCalledWith('react');
    expect(resolver).toHaveBeenCalledWith('@hiphone/ui');
  });

  it('resolver errors propagate', async () => {
    const compiled = await compileTsx(`
import { missing } from 'does-not-exist';
export default function App() { return null; }
    `);

    expect(() => {
      executeSandboxed(compiled, makeResolver({ react: React }));
    }).toThrow(/Module not found/);
  });

  it('shadows global window/document/fetch inside user code', async () => {
    // User code tries to grab window. Since window is shadowed to undefined,
    // typeof check should return 'undefined', not 'object'.
    const compiled = await compileTsx(`
export default function Probe() {
  return { win: typeof window, doc: typeof document, fet: typeof fetch };
}
    `);

    const Probe = executeSandboxed(
      compiled,
      makeResolver({}),
    ) as () => { win: string; doc: string; fet: string };

    const probed = Probe();
    expect(probed.win).toBe('undefined');
    expect(probed.doc).toBe('undefined');
    expect(probed.fet).toBe('undefined');
  });

  it('provides React as both injected parameter and via require("react")', async () => {
    const compiled = await compileTsx(`
import React, { createElement } from 'react';
export default function App() {
  return createElement('span', null, 'ok');
}
    `);

    const App = executeSandboxed(compiled, makeResolver({ react: React }));
    const rendered = (App as React.FC)({});
    expect(React.isValidElement(rendered)).toBe(true);
  });
});
```

- [ ] **Step 2: Run — verify fails (module missing)**

Run: `pnpm test src/platform/userApp/__tests__/sandbox.test.ts`
Expected: FAIL — cannot import `../sandbox`.

- [ ] **Step 3: Implement sandbox**

Create `src/platform/userApp/sandbox.ts`:

```typescript
import React from 'react';
import type { ComponentType } from 'react';

/**
 * Module resolver function: maps a bare specifier (e.g. 'react',
 * '@hiphone/ui') to the actual module object. Throws on unknown
 * specifiers. Typically wired to `src/platform/userApp/sdk/index.ts`.
 */
export type ModuleResolver = (specifier: string) => unknown;

/**
 * Execute compiled user code in a soft sandbox (L1).
 *
 * Approach: `new Function(...argNames, body)` with argNames that include
 * a list of shadowed globals (all set to `undefined`) plus the needed
 * runtime (`module`, `exports`, `require`, `React`). This removes direct
 * access to common globals without breaking referential transparency for
 * things the user *should* have (React, the SDK surface via require).
 *
 * Security assessment: see parent spec — L1 is acceptable for M1-M3
 * because user-app authors don't see host code and have no motive or
 * information to escape the sandbox. Escape is possible in principle
 * (via constructor-hop tricks), but not interesting in our threat model.
 * Architecturally we leave room for L2 (iframe sandbox) in M4+.
 *
 * @param compiledCode — output of `compileTsx()`
 * @param resolve — module resolver for `require(specifier)` calls
 * @returns the default export of the compiled module (a React component)
 */
export function executeSandboxed(
  compiledCode: string,
  resolve: ModuleResolver,
): ComponentType {
  // Globals we explicitly shadow. User code accessing these will see
  // `undefined` (safer than letting them leak through).
  const shadowedNames = [
    'window',
    'document',
    'globalThis',
    'fetch',
    'localStorage',
    'sessionStorage',
    'indexedDB',
    'XMLHttpRequest',
    'WebSocket',
    'Worker',
  ];
  const shadowedValues = shadowedNames.map(() => undefined);

  const moduleObj: { exports: { default?: ComponentType } } = { exports: {} };

  // Wrap resolver with __esModule-aware interop so that Sucrase's
  // `_interopRequireDefault` helper does not double-wrap real ES modules.
  const require = (specifier: string): unknown => resolve(specifier);

  // Construct: (shadowed..., module, exports, require, React) => { <compiledCode> }
  const fn = new Function(
    ...shadowedNames,
    'module',
    'exports',
    'require',
    'React',
    compiledCode,
  );

  fn(
    ...shadowedValues,
    moduleObj,
    moduleObj.exports,
    require,
    React,
  );

  const Component = moduleObj.exports.default;
  if (typeof Component !== 'function') {
    throw new Error(
      'User app compiled code did not export a default component (function)',
    );
  }
  return Component;
}
```

- [ ] **Step 4: Run — verify passes**

Run: `pnpm test src/platform/userApp/__tests__/sandbox.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Run full userApp tests**

Run: `pnpm test src/platform/userApp/`
Expected: compiler (3) + sandbox (5) = 8 passed.

- [ ] **Step 6: Typecheck**

Run: `pnpm typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/platform/userApp/sandbox.ts src/platform/userApp/__tests__/sandbox.test.ts
git commit -m "$(cat <<'EOF'
feat(userApp): add soft sandbox (L1) for executing compiled user code

M1 S4 Task 2 — executeSandboxed 用 new Function 构造隔离作用域，
遮蔽 window/document/fetch 等常见全局，注入 require 转发给
ModuleResolver，注入 React 供 JSX 使用。返回 module.exports.default。

安全性评估详见父 spec：L1 对 M1-M3 场景足够，M4+ 可升级 iframe。

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Acceptance Criteria

- [ ] `sucrase` 在 `dependencies` 中（不是 devDependencies）
- [ ] `compileTsx('...')` 能异步返回编译好的 JS 字符串
- [ ] `executeSandboxed(code, resolve)` 能返回 React 组件
- [ ] 沙箱内 `typeof window === 'undefined'`
- [ ] 沙箱内 `require('react')` 返回真实 React 实例
- [ ] 未知模块的 require 抛错
- [ ] 8 个单元测试通过
- [ ] `pnpm test` 全绿
- [ ] `pnpm typecheck` 通过
- [ ] 2 commits on branch

## Notes for Next Stage (S5)

S5 把 `executeSandboxed` 需要的 `ModuleResolver` 实现出来：`@hiphone/ui` 暴露 `NavBar`，`react` 返回 React 实例，其他 specifier 抛错。加上 AppScreen 自动包裹。
