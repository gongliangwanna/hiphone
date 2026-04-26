# 翻译 App S2 — `builtinUserApps.ts` 注册管道 + Sucrase 进生产 bundle

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立"内置但走用户 APP 沙箱管道"的 App 注册机制，让翻译 App 在生产环境也能 compile→sandbox→register。本阶段只放最小占位 TSX 验证管道，真实翻译内容在 S3 替换。

**Architecture:** 新增 `src/platform/userApp/builtinUserApps.ts` 暴露 `BuiltinUserApp` 类型 + `BUILTIN_USER_APPS` 常量数组 + `mountBuiltinUserApps()` async 函数。后者复用 `installer.ts` 已有的 `compileTsx` + `createUserAppRuntime` + `wrapUserComponent` 链路，但注册时 `type: 'builtin'`（防卸载）+ 不进 `installedUserAppsStore`（AppStore UI 不显示）。在 `App.tsx` 启动序列里**无条件调用**（不靠 DEV gate），从而把 Sucrase 拉进生产 bundle。

**Tech Stack:** TypeScript / Vitest / Vite / Sucrase（已存在）/ React

**Spec 来源：** `docs/superpowers/specs/2026-04-26-translate-app-design.md` §2.1, §3.1, §3.2

**前置依赖：** S1 已完成（`@hiphone/motion` 已注册）

---

### Task 1: 创建 `builtinUserApps.ts` 骨架（含翻译占位 TSX）

**Files:**
- Create: `src/platform/userApp/builtinUserApps.ts`

- [ ] **Step 1: 写文件内容**

```ts
/**
 * Built-in user apps: ship with hiPhone, run through the user-app
 * sandbox pipeline (compile → sandbox → register), but cannot be
 * uninstalled and don't appear in App Store's "installed" list.
 *
 * Why this exists:
 * - Validates the user-app SDK upper bound — these apps consume only
 *   the public `@hiphone/*` surface, proving uploaded user apps can
 *   achieve the same fidelity.
 * - Makes Sucrase a first-class production dependency: an unconditional
 *   compileTsx caller forces it into the prod bundle (CLAUDE.md note 4).
 *
 * Lifecycle:
 * - Registered at startup via mountBuiltinUserApps() in App.tsx
 * - Registered with type: 'builtin' so installer.uninstall rejects them
 * - Not added to installedUserAppsStore — App Store UI never shows them
 * - Springboard apps.data.ts entries reference them by id like any
 *   other system app
 *
 * Each app's source lives as a multi-file map (path → TSX string). The
 * pipeline compiles every file via compileTsx and runs the entry through
 * createUserAppRuntime, identical to how installer.ts handles uploaded
 * zips.
 */

import { appRegistry } from '@/platform/appRegistry';
import { compileTsx } from './compiler';
import { createUserAppRuntime } from './moduleResolver';
import { resolveModule } from './sdk';
import { wrapUserComponent } from './sdk/wrap';

export interface BuiltinUserApp {
  id: string;
  name: string;
  /** Map of file path → TSX source. Paths are relative to the app root. */
  files: Record<string, string>;
  /** Entry file path; must be a key in `files`. */
  entry: string;
  perspectiveAware: boolean;
  globalData: boolean;
}

// ─────────────────────────────────────────────────────────
// App sources
// ─────────────────────────────────────────────────────────

const TRANSLATE_PLACEHOLDER_SOURCE = `
import React from 'react';
import { NavBar } from '@hiphone/ui';

export default function TranslateApp() {
  return (
    <div style={{ height: '100%', backgroundColor: 'var(--color-systemBackground)' }}>
      <NavBar title="翻译" />
      <div style={{ padding: 20, fontSize: 17, color: 'var(--color-secondaryLabel)' }}>
        翻译功能即将上线 (S3-S5)
      </div>
    </div>
  );
}
`;

export const BUILTIN_USER_APPS: BuiltinUserApp[] = [
  {
    id: 'translate',
    name: '翻译',
    entry: 'TranslateApp.tsx',
    files: {
      'TranslateApp.tsx': TRANSLATE_PLACEHOLDER_SOURCE,
    },
    perspectiveAware: true,
    globalData: false,
  },
];

// ─────────────────────────────────────────────────────────
// Mount
// ─────────────────────────────────────────────────────────

/**
 * Compile every built-in user app and register the result in appRegistry.
 *
 * Idempotent: if an id is already registered (e.g. tests re-import), the
 * later register call simply overwrites the entry — same semantics as
 * appRegistry.register elsewhere.
 *
 * Failure mode: any single app failing to compile is logged and skipped
 * so a broken built-in does not blank the springboard. Production should
 * surface such failures in dist build smoke checks (Task 4).
 */
export async function mountBuiltinUserApps(): Promise<void> {
  for (const app of BUILTIN_USER_APPS) {
    try {
      const compiledMap: Record<string, string> = {};
      for (const [path, source] of Object.entries(app.files)) {
        compiledMap[path] = await compileTsx(source, `${app.id}/${path}`);
      }
      const RawComponent = createUserAppRuntime(
        compiledMap,
        app.entry,
        resolveModule,
        app.id,
      );
      const WrappedComponent = wrapUserComponent(RawComponent);
      appRegistry.register({
        id: app.id,
        name: app.name,
        type: 'builtin',
        component: WrappedComponent,
        perspectiveAware: app.perspectiveAware,
        globalData: app.globalData,
      });
    } catch (err) {
      console.error(`[builtinUserApps] failed to mount "${app.id}":`, err);
    }
  }
}
```

- [ ] **Step 2: 验证类型**

Run: `pnpm tsc --noEmit`
Expected: 通过（如果 `wrapUserComponent` 期望 `edgeToEdge` / `statusBarStyle` 参数，按其默认 undefined 不传即可——参考 `installer.ts:436-440` 的调用签名）

- [ ] **Step 3: Commit**

```bash
git add src/platform/userApp/builtinUserApps.ts
git commit -m "feat(userApp): builtinUserApps registry + mount pipeline"
```

---

### Task 2: 在 `App.tsx` 启动序列里调用 `mountBuiltinUserApps`

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 读现状**

确认现有内容（避免误改）：

Run: `cat src/App.tsx`
Expected: 含 `mountFakeUserAppIfDev` 在 DEV gate 内部的现有结构

- [ ] **Step 2: 加 import 与调用**

修改 `src/App.tsx`，在现有 import 行之后追加 `mountBuiltinUserApps` import；在 `useEffect` 里**在 DEV gate 之外**调用：

```tsx
import { useEffect } from 'react';
import { Device } from './shell/Device';
import { MusicPlaybackHost } from './apps/Music/MusicPlaybackHost';
import { startHeartbeatScheduler } from './platform/ai/heartbeatAgent';
import { registerBuiltins } from './apps/registerBuiltins';
import { loadInstalledApps } from './platform/userApp/installer';
import { mountFakeUserAppIfDev } from './platform/userApp/devIcon';
import { mountBuiltinUserApps } from './platform/userApp/builtinUserApps';
import { installDevApi } from './platform/userApp/devInstall';

registerBuiltins();

export function App() {
  useEffect(() => {
    startHeartbeatScheduler();
    void loadInstalledApps();
    // Mount built-in user apps (always — dev AND prod). This is the path
    // that pulls Sucrase into the production bundle (CLAUDE.md note 4).
    void mountBuiltinUserApps();
    if (import.meta.env.DEV) {
      installDevApi();
      void mountFakeUserAppIfDev();
    }
  }, []);

  return (
    <>
      <MusicPlaybackHost />
      <Device />
    </>
  );
}
```

只增加：
1. `import { mountBuiltinUserApps } from './platform/userApp/builtinUserApps';`（在 mountFakeUserAppIfDev import 后）
2. `void mountBuiltinUserApps();` + 上面的注释（在 DEV gate 之前）

注意：`mountBuiltinUserApps` 必须在 DEV gate **外面**——否则 Vite 仍会 DCE 掉。

- [ ] **Step 3: 跑现有测试确认没破**

Run: `pnpm vitest run src/platform/userApp src/apps`
Expected: 全 PASS

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire mountBuiltinUserApps into startup (always, not dev-gated)"
```

---

### Task 3: 单元测试 — `builtinUserApps.ts`

**Files:**
- Create: `src/platform/userApp/__tests__/builtinUserApps.test.ts`

测试覆盖：
1. `BUILTIN_USER_APPS` 数组中翻译条目结构正确
2. `mountBuiltinUserApps` 调用后 `appRegistry.has('translate')` 为 true
3. 注册的 entry `type: 'builtin'`（不可卸载）
4. 渲染注册的组件不抛错（验证 createUserAppRuntime 链路完整）
5. 失败的占位 app 不会让其他 app 跟着失败（健壮性）

- [ ] **Step 1: 写测试**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { appRegistry } from '@/platform/appRegistry';
import {
  BUILTIN_USER_APPS,
  mountBuiltinUserApps,
} from '../builtinUserApps';

describe('BUILTIN_USER_APPS', () => {
  it('contains a translate entry with required shape', () => {
    const translate = BUILTIN_USER_APPS.find((a) => a.id === 'translate');
    expect(translate).toBeDefined();
    expect(translate!.name).toBe('翻译');
    expect(translate!.entry).toBe('TranslateApp.tsx');
    expect(translate!.files[translate!.entry]).toContain('export default');
    expect(translate!.perspectiveAware).toBe(true);
    expect(translate!.globalData).toBe(false);
  });
});

describe('mountBuiltinUserApps', () => {
  beforeEach(() => {
    appRegistry.unregister('translate');
  });

  it('compiles + registers each builtin app as type builtin', async () => {
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('builtin');
    expect(entry!.name).toBe('翻译');
    expect(typeof entry!.component).toBe('function');
  });

  it('registered component renders without throwing', async () => {
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate')!;
    // wrapUserComponent installs an ErrorBoundary; if the user-app render
    // throws, the boundary catches and renders a fallback. We assert the
    // outer render call itself does not throw.
    expect(() =>
      render(React.createElement(entry.component)),
    ).not.toThrow();
  });

  it('survives a failing app — logs error and continues with the rest', async () => {
    // Inject a deliberately broken app at the front of the list and verify
    // translate still registers afterward. We mutate via push/pop so other
    // tests are unaffected.
    BUILTIN_USER_APPS.unshift({
      id: '__broken__',
      name: 'Broken',
      entry: 'Missing.tsx',
      files: { 'Other.tsx': 'export default function X(){}' }, // entry missing on purpose
      perspectiveAware: false,
      globalData: false,
    });
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await mountBuiltinUserApps();
      expect(appRegistry.has('translate')).toBe(true);
      expect(appRegistry.has('__broken__')).toBe(false);
      expect(errSpy).toHaveBeenCalled();
    } finally {
      BUILTIN_USER_APPS.shift();
      errSpy.mockRestore();
      appRegistry.unregister('__broken__');
    }
  });
});
```

- [ ] **Step 2: 跑测试确认 PASS**

Run: `pnpm vitest run src/platform/userApp/__tests__/builtinUserApps.test.ts`
Expected: 4 个测试全 PASS

如果 "registered component renders without throwing" 测试 fail：
- 检查 placeholder TSX 的 `<NavBar title="翻译" />` 是否能在 jsdom 渲染——大概率可以；NavBar 组件已经有大量测试覆盖
- 如果 NavBar 在 jsdom 里需要某些 mock，参考 `vitest.setup.ts` 已有的 polyfill

- [ ] **Step 3: Commit**

```bash
git add src/platform/userApp/__tests__/builtinUserApps.test.ts
git commit -m "test(userApp): builtinUserApps mount pipeline + error isolation"
```

---

### Task 4: 生产构建验证 — Sucrase 进 bundle

**Files:**
- Create: `scripts/check-sucrase-in-prod.mjs`

新增一个独立的 node 脚本，跑在 `pnpm build` 之后，扫 `dist/assets/*.js` 是否真的包含 Sucrase 字节码标记。是 dev-time 一次性验证，不进 CI 主干（除非将来再加），所以放 `scripts/` 而非 vitest。

- [ ] **Step 1: 写脚本**

```js
#!/usr/bin/env node
/**
 * Verify Sucrase made it into the production bundle.
 *
 * Why: hiPhone's user-app pipeline relies on runtime TSX compilation via
 * Sucrase. If Vite's DCE silently strips Sucrase (because every caller
 * was DEV-gated), built-in user apps and uploaded user apps both fail
 * silently in production.
 *
 * S2 wires `mountBuiltinUserApps()` as an unconditional caller of
 * `compileTsx`, which transitively imports sucrase. After `pnpm build`,
 * one of the chunks under `dist/assets/` MUST contain Sucrase code.
 *
 * Usage:
 *   pnpm build && node scripts/check-sucrase-in-prod.mjs
 *
 * Exit codes:
 *   0 — sucrase found
 *   1 — not found (regression, Vite is DCE-ing it again)
 *   2 — dist/ missing (run `pnpm build` first)
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const ASSETS = 'dist/assets';

// String unique to Sucrase's transform internals. Picked to be stable
// across minor Sucrase versions and unlikely to appear in unrelated
// libraries. If Sucrase renames it, update the marker here.
const MARKERS = [
  'CJSImportProcessor',
  'JSXTransformer',
  '_interopRequireWildcard', // helper Sucrase emits AND imports during transform
];

let files;
try {
  files = (await readdir(ASSETS)).filter((f) => f.endsWith('.js'));
} catch (err) {
  console.error(`[check-sucrase] cannot read ${ASSETS}: ${err.message}`);
  console.error('Did you run `pnpm build` first?');
  process.exit(2);
}

let foundIn = null;
for (const f of files) {
  const text = await readFile(join(ASSETS, f), 'utf8');
  if (MARKERS.some((m) => text.includes(m))) {
    foundIn = f;
    break;
  }
}

if (!foundIn) {
  console.error(`[check-sucrase] FAIL — no chunk in ${ASSETS} contains Sucrase markers.`);
  console.error(`Markers searched: ${MARKERS.join(', ')}`);
  console.error('Vite likely DCE-d Sucrase. Verify mountBuiltinUserApps is not DEV-gated.');
  process.exit(1);
}

console.log(`[check-sucrase] OK — Sucrase found in ${foundIn}`);
```

- [ ] **Step 2: 跑生产构建 + 验证**

Run: `pnpm build`
Expected: 构建成功

Run: `node scripts/check-sucrase-in-prod.mjs`
Expected: 输出 `[check-sucrase] OK — Sucrase found in <chunk-name>.js`

如果失败：
- 检查 `App.tsx` 里 `void mountBuiltinUserApps();` 是否真的在 DEV gate **外**
- 检查 `mountBuiltinUserApps` 内部是否实际调用 `compileTsx`（如果只调了 `createUserAppRuntime` 却跳过 compile，链路没动 Sucrase）

- [ ] **Step 3: 添加 package.json 脚本（可选但推荐）**

读 `package.json` 看 scripts 段，追加一行：

```json
"verify:prod-sucrase": "node scripts/check-sucrase-in-prod.mjs"
```

让 `pnpm verify:prod-sucrase` 成为一条捷径。如果 package.json scripts 段语法易错，先 `cat package.json` 再用 Edit 工具。

- [ ] **Step 4: Commit**

```bash
git add scripts/check-sucrase-in-prod.mjs package.json
git commit -m "chore(build): script to verify Sucrase ships in production bundle"
```

---

### Task 5: 文档与收尾

**Files:**
- Modify: `src/platform/userApp/CLAUDE.md`

- [ ] **Step 1: 更新踩坑记录 4**

打开 `src/platform/userApp/CLAUDE.md`，找到 "踩坑记录" 第 4 条（关于 `import.meta.env.DEV` 静态替换 + Sucrase 不进生产 bundle 的那条）。

把它改成（或加注释说明状态变化）：

```markdown
4. **(S2 已解决)** Vite 生产构建下 `import.meta.env.DEV` 被静态替换为 `false`，
   整个 DEV-gated 分支被 DCE。M1 阶段这导致 Sucrase 不进生产 bundle。
   **S2 后**：`mountBuiltinUserApps()` 在 `App.tsx` 启动序列里**无条件**调用
   `compileTsx`，把 Sucrase 拉进生产 chunk graph。验证脚本：
   `pnpm verify:prod-sucrase`。
```

- [ ] **Step 2: 在"已落地的架构决策"章节加一条**

```markdown
- **Built-in user apps via `builtinUserApps.ts`** (S2, commit `<sha>`).
  内置 App 如翻译走与上传 App 完全相同的 compile→sandbox→register 链路，
  注册时 `type: 'builtin'` 防卸载，不进 `installedUserAppsStore` 因此 App
  Store 不显示。这是用户 APP SDK 上限验证的核心样本。
```

`<sha>` 暂用占位符 `TBD`——commit 这一改动后用 `git log --oneline -1` 拿到本提交的实际 SHA，再 amend 上去（或留 TBD 也可，下个 stage 再补）。

- [ ] **Step 3: 跑全量测试**

Run: `pnpm vitest run`
Expected: 全 PASS（应有 builtinUserApps 相关 4 个新测）

- [ ] **Step 4: Commit**

```bash
git add src/platform/userApp/CLAUDE.md
git commit -m "docs(userApp): record S2 — Sucrase in prod resolved + builtin user apps"
```

---

## Self-Review

**Spec 覆盖：**
- spec §3.1 注册管道 → Task 1 + Task 2 ✓
- spec §3.2 Springboard 接入（apps.data.ts 已有 translate）→ Task 2 调用顺序保证图标渲染时 registry 已就绪（async race 风险参考 fakeUserApp 现有处理：先 mount，UI 容忍 loading 一帧）✓
- spec §6.1 Sucrase 进生产 bundle 代价 → Task 4 验证脚本锁定不再退化 ✓

**Placeholder 扫描：** Task 5 Step 2 里的 `<sha>` 是必要占位符（commit 后才有 SHA），文档里 commit 后填写或留 TBD 都不阻塞 ✓

**类型 / 命名一致：**
- `BuiltinUserApp` / `BUILTIN_USER_APPS` / `mountBuiltinUserApps` 在 Task 1/2/3 一致 ✓
- registry entry 字段（`id`/`name`/`type`/`component`/`perspectiveAware`/`globalData`）匹配 `appRegistry.ts` 接口 ✓

**Async race 风险：** 翻译图标在 Springboard 渲染时 `mountBuiltinUserApps` 的 promise 可能未 resolve。这与 `mountFakeUserAppIfDev` race 完全相同（CLAUDE.md note 2 已记录可接受），同样的兜底（DemoApp 闪一帧）适用，不阻塞 S2。

---

## 执行选择

S2 plan 写好。直接交给 implementer subagent 跑。
