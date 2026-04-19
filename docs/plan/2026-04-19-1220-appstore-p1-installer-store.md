# App Store Redesign — P1 · Installer 改造 + Store Schema 扩展

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为上层 UI 重构（P2/P3）铺地基：给 `InstalledUserApp` 加 `version` / `installedAt` / `sizeBytes` 三个字段，给 `install()` 加 `onUpgradeDetected` 回调以支持"发现同 id 时暂停让用户确认"的流程。纯逻辑层改动，UI 层不动。

**Architecture:** `InstalledUserApp` 类型扩展为必选字段 → TS 编译器强制所有构造点填齐 → installer 装配时从 manifest + 编译产物推导出新字段 → AppMeta IDB 记录增加 `sizeBytes` → `loadInstalledApps()` 回填旧数据时用安全回退。升级确认走新的 `onUpgradeDetected?: (info) => boolean | Promise<boolean>` 可选回调，返回 false 时以 `'user-cancelled'` 错误中止（新错误种类，向后兼容）。

**Tech Stack:** TypeScript + Zustand + IndexedDB (via existing `idbStorage` wrapper) + vitest + fake-indexeddb。规范：Tailwind 优先、`lucide-react`（UI 层才用）、复用项目 design tokens。

**Upstream spec:** `docs/superpowers/specs/2026-04-19-appstore-ui-redesign-design.md`

---

## 文件布局

**修改：**
- `src/platform/stores/installedUserAppsStore.ts` — 扩展 `InstalledUserApp` interface
- `src/platform/userApp/installer.ts` — AppMeta 加 `sizeBytes`、install() 计算并写入、`loadInstalledApps()` 回填、新增 `onUpgradeDetected` 回调 + `'user-cancelled'` 错误种类
- `src/platform/stores/__tests__/installedUserAppsStore.test.ts` — 修 sample 对象
- `src/shell/Springboard/__tests__/apps.data.userApps.test.ts` — 修 store.setState 构造体
- `src/platform/userApp/__tests__/installer.test.ts` — 新增若干用例
- `src/platform/userApp/__tests__/installer.progress.test.ts` — 若已断言 InstalledUserApp 形状则修

**新建：**
- `src/platform/userApp/__tests__/installer.upgradeCallback.test.ts` — 升级确认回调的独立测试

**不改：**
- 所有 UI 层（AppStore/ManagePage/UploadPage/InstalledAppRow）— P2/P3 处理
- appRegistry / sandbox / compiler — 无关

---

## Task 1 · 扩展 `InstalledUserApp` 类型

**Files:**
- Modify: `src/platform/stores/installedUserAppsStore.ts:3-10`
- Test: `src/platform/stores/__tests__/installedUserAppsStore.test.ts:7-13` (fix sample)

- [ ] **Step 1.1 · 写失败测试**

编辑 `src/platform/stores/__tests__/installedUserAppsStore.test.ts`，在 `sample` 下方追加新用例（不改 sample 本身，这一步先让新字段测试红）：

```typescript
// 文件末尾 describe 块内追加
  it('exposes version, installedAt, sizeBytes on stored record', () => {
    const app: InstalledUserApp = {
      id: 'meta-rich',
      name: 'Meta Rich',
      iconDataUrl: null,
      page: 1,
      perspectiveAware: false,
      version: '1.2.3',
      installedAt: 1_700_000_000_000,
      sizeBytes: 2_048,
    };
    useInstalledUserAppsStore.getState().add(app);
    const stored = useInstalledUserAppsStore.getState().apps[0]!;
    expect(stored.version).toBe('1.2.3');
    expect(stored.installedAt).toBe(1_700_000_000_000);
    expect(stored.sizeBytes).toBe(2_048);
  });
```

- [ ] **Step 1.2 · 跑测试验证红**

```bash
pnpm vitest run src/platform/stores/__tests__/installedUserAppsStore.test.ts
```

Expected: 编译错误 `Property 'version' does not exist on type 'InstalledUserApp'` 或类似。

- [ ] **Step 1.3 · 扩展 interface**

编辑 `src/platform/stores/installedUserAppsStore.ts`，把 interface 替换为：

```typescript
export interface InstalledUserApp {
  id: string;
  name: string;
  /** Data URL constructed at install from icon.png; null = use platform default icon. */
  iconDataUrl: string | null;
  page: number;
  perspectiveAware: boolean;
  /** From manifest.version; fallback '1.0.0' for legacy records missing this field. */
  version: string;
  /** Unix ms when the app was installed (Date.now() at install time). */
  installedAt: number;
  /** Sum of compiled bundle byte lengths (UTF-8); 0 for legacy records. */
  sizeBytes: number;
}
```

- [ ] **Step 1.4 · 修 sample 对象让老测试继续过**

编辑 `src/platform/stores/__tests__/installedUserAppsStore.test.ts`，把 `sample` 改为：

```typescript
const sample: InstalledUserApp = {
  id: 'my-todo',
  name: '待办',
  iconDataUrl: null,
  page: 1,
  perspectiveAware: false,
  version: '1.0.0',
  installedAt: 1_700_000_000_000,
  sizeBytes: 512,
};
```

- [ ] **Step 1.5 · 跑测试**

```bash
pnpm vitest run src/platform/stores/__tests__/installedUserAppsStore.test.ts
```

Expected: 全部通过（5 个用例）。

- [ ] **Step 1.6 · 跑 tsc 看有没有其他构造点爆掉**

```bash
pnpm tsc --noEmit
```

Expected: 看到至少两个错误 — `apps.data.userApps.test.ts` 里的 `setState` 构造体、`installer.ts` 里 `record: InstalledUserApp = { ... }` 构造、`loadInstalledApps()` 里 `records: InstalledUserApp[] = metas.map(...)` 构造。下面任务逐一修。

- [ ] **Step 1.7 · 修 Springboard 测试构造点**

编辑 `src/shell/Springboard/__tests__/apps.data.userApps.test.ts`，把两处 `setState` 中的对象补齐新字段。第一处（行 16-26 附近）：

```typescript
    useInstalledUserAppsStore.setState({
      apps: [
        {
          id: 'my-todo',
          name: '待办',
          iconDataUrl: 'data:image/png;base64,xxx',
          page: 1,
          perspectiveAware: false,
          version: '1.0.0',
          installedAt: 1_700_000_000_000,
          sizeBytes: 0,
        },
      ],
    });
```

第二处（行 34-38 附近）：

```typescript
    useInstalledUserAppsStore.setState({
      apps: [
        {
          id: 'x',
          name: 'X',
          iconDataUrl: null,
          page: 1,
          perspectiveAware: false,
          version: '1.0.0',
          installedAt: 1_700_000_000_000,
          sizeBytes: 0,
        },
      ],
    });
```

- [ ] **Step 1.8 · 跑 Springboard 测试验证**

```bash
pnpm vitest run src/shell/Springboard/__tests__/apps.data.userApps.test.ts
```

Expected: 3 个用例全过。

- [ ] **Step 1.9 · commit**

```bash
git add src/platform/stores/installedUserAppsStore.ts \
        src/platform/stores/__tests__/installedUserAppsStore.test.ts \
        src/shell/Springboard/__tests__/apps.data.userApps.test.ts
git commit -m "feat(store): add version/installedAt/sizeBytes to InstalledUserApp"
```

---

## Task 2 · AppMeta 加 `sizeBytes` + install() 计算并写入

**Files:**
- Modify: `src/platform/userApp/installer.ts:62-66` (AppMeta interface)
- Modify: `src/platform/userApp/installer.ts:155-182` (compute + persist)
- Test: `src/platform/userApp/__tests__/installer.test.ts`

- [ ] **Step 2.1 · 写失败测试**

在 `src/platform/userApp/__tests__/installer.test.ts` 文件末尾（最后一个 `describe` 块之前或内部，找个合适位置）追加：

```typescript
  it('records sizeBytes in IDB app-meta as the sum of compiled sources', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'size-test',
        name: 'Size Test',
        version: '1.0.0',
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
    await install(zip);

    const db = await getDB();
    const meta = await new Promise<{ sizeBytes: number } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(APP_META_STORE, 'readonly');
        const req = tx.objectStore(APP_META_STORE).get('size-test');
        req.onsuccess = () =>
          resolve(req.result as { sizeBytes: number } | undefined);
        req.onerror = () => reject(req.error);
      },
    );
    expect(meta).toBeDefined();
    expect(meta!.sizeBytes).toBeGreaterThan(0);
  });

  it('exposes sizeBytes and version on the store record after install', async () => {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'exposure-test',
        name: 'Exposure',
        version: '2.5.1',
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
    await install(zip);

    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'exposure-test');
    expect(record).toBeDefined();
    expect(record!.version).toBe('2.5.1');
    expect(record!.sizeBytes).toBeGreaterThan(0);
    expect(record!.installedAt).toBeGreaterThan(0);
  });
```

- [ ] **Step 2.2 · 跑测试验证红**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.test.ts -t "sizeBytes"
```

Expected: 两个用例都失败。第一个因为 AppMeta 没 `sizeBytes` 字段（`meta.sizeBytes` 是 undefined）；第二个因为 store record 缺字段（TS 编译报错或运行时 undefined）。

- [ ] **Step 2.3 · 扩展 AppMeta interface**

编辑 `src/platform/userApp/installer.ts`，把 `AppMeta` 改为（第 62-66 行）：

```typescript
interface AppMeta {
  manifest: UserAppManifest;
  installedAt: number;
  iconDataUrl: string | null;
  /** Sum of compiled bundle byte lengths. Added P1; absent on legacy records → 0. */
  sizeBytes: number;
}
```

- [ ] **Step 2.4 · install() 计算 sizeBytes 并写入**

编辑 `src/platform/userApp/installer.ts`，**在第 156 行 `emit({ stage: 'compile', progress: 1, fileIndex: total, total });` 之后**插入：

```typescript
    // Sum compiled bytes (UTF-8). Used by App Store UI to show "X MB".
    const sizeBytes = Object.values(compiledMap).reduce(
      (sum, code) => sum + new TextEncoder().encode(code).byteLength,
      0,
    );
```

然后把第 175 行的 meta 构造体改为：

```typescript
      const meta: AppMeta = { manifest, installedAt, iconDataUrl, sizeBytes };
```

再把第 185-191 行的 store record 构造体改为：

```typescript
    const record: InstalledUserApp = {
      id: manifest.id,
      name: manifest.name,
      iconDataUrl,
      page: USER_APP_PAGE,
      perspectiveAware: manifest.perspectiveAware,
      version: manifest.version,
      installedAt,
      sizeBytes,
    };
```

- [ ] **Step 2.5 · 跑测试验证通过**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.test.ts -t "sizeBytes|exposes"
```

Expected: 两个新用例通过。

- [ ] **Step 2.6 · 跑全量 installer 测试回归**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.test.ts src/platform/userApp/__tests__/installer.progress.test.ts
```

Expected: 全过。如 installer.progress.test.ts 里有 InstalledUserApp 形状断言爆掉，补齐新字段即可。

- [ ] **Step 2.7 · commit**

```bash
git add src/platform/userApp/installer.ts \
        src/platform/userApp/__tests__/installer.test.ts
git commit -m "feat(installer): compute and persist sizeBytes; expose new meta on store"
```

---

## Task 3 · `loadInstalledApps()` 回填字段（含旧数据 fallback）

**Files:**
- Modify: `src/platform/userApp/installer.ts:268-275` (loadInstalledApps mapper)
- Test: `src/platform/userApp/__tests__/installer.test.ts`

- [ ] **Step 3.1 · 写失败测试**

在 `installer.test.ts` 追加：

```typescript
  it('loadInstalledApps populates new fields from stored AppMeta', async () => {
    // Seed IDB directly with a record that includes sizeBytes
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([APP_META_STORE, APP_SRC_STORE], 'readwrite');
      tx.objectStore(APP_META_STORE).put(
        {
          manifest: {
            id: 'legacy-new',
            name: 'Legacy New',
            version: '3.0.0',
            entry: 'index.tsx',
            perspectiveAware: false,
          },
          installedAt: 1_700_000_000_123,
          iconDataUrl: null,
          sizeBytes: 4_096,
        },
        'legacy-new',
      );
      tx.objectStore(APP_SRC_STORE).put(
        { compiledMap: { 'index.tsx': 'module.exports={};' }, installedAt: 1_700_000_000_123 },
        'legacy-new',
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await loadInstalledApps();
    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'legacy-new');
    expect(record).toBeDefined();
    expect(record!.version).toBe('3.0.0');
    expect(record!.installedAt).toBe(1_700_000_000_123);
    expect(record!.sizeBytes).toBe(4_096);
  });

  it('loadInstalledApps falls back for legacy records missing sizeBytes', async () => {
    // Seed IDB with an old-schema record (no sizeBytes key)
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([APP_META_STORE, APP_SRC_STORE], 'readwrite');
      tx.objectStore(APP_META_STORE).put(
        {
          manifest: {
            id: 'legacy-old',
            name: 'Legacy Old',
            version: '0.9.0',
            entry: 'index.tsx',
            perspectiveAware: false,
          },
          installedAt: 1_600_000_000_000,
          iconDataUrl: null,
          // no sizeBytes key on purpose
        },
        'legacy-old',
      );
      tx.objectStore(APP_SRC_STORE).put(
        { compiledMap: { 'index.tsx': 'module.exports={};' }, installedAt: 1_600_000_000_000 },
        'legacy-old',
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    await loadInstalledApps();
    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'legacy-old');
    expect(record).toBeDefined();
    expect(record!.sizeBytes).toBe(0);
    expect(record!.version).toBe('0.9.0');
    expect(record!.installedAt).toBe(1_600_000_000_000);
  });
```

- [ ] **Step 3.2 · 跑测试验证红**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.test.ts -t "loadInstalledApps populates|loadInstalledApps falls back"
```

Expected: 两个用例都失败 — record 对象里没有 version/installedAt/sizeBytes 字段。

- [ ] **Step 3.3 · 修 loadInstalledApps 的 mapper**

编辑 `src/platform/userApp/installer.ts`，把第 268-274 行的 `records: InstalledUserApp[] = metas.map(...)` 改为：

```typescript
  const records: InstalledUserApp[] = metas.map(({ id, meta }) => ({
    id,
    name: meta.manifest.name,
    iconDataUrl: meta.iconDataUrl,
    page: USER_APP_PAGE,
    perspectiveAware: meta.manifest.perspectiveAware,
    version: meta.manifest.version,
    installedAt: meta.installedAt,
    // Legacy records (pre-P1) don't have sizeBytes — fall back to 0 so UI
    // shows "—". Newly installed apps always have it set (Task 2).
    sizeBytes: typeof meta.sizeBytes === 'number' ? meta.sizeBytes : 0,
  }));
```

- [ ] **Step 3.4 · 跑测试验证通过**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.test.ts -t "loadInstalledApps"
```

Expected: 所有 `loadInstalledApps` 相关用例都过。

- [ ] **Step 3.5 · commit**

```bash
git add src/platform/userApp/installer.ts \
        src/platform/userApp/__tests__/installer.test.ts
git commit -m "feat(installer): loadInstalledApps backfills new meta fields"
```

---

## Task 4 · 新增 `onUpgradeDetected` 回调类型 + `'user-cancelled'` 错误种类

**Files:**
- Modify: `src/platform/userApp/installer.ts:24-31` (InstallErrorKind)
- Modify: `src/platform/userApp/installer.ts:52-54` (InstallOptions)

- [ ] **Step 4.1 · 写类型测试（编译期断言）**

新建文件 `src/platform/userApp/__tests__/installer.upgradeCallback.test.ts`（Task 5 会扩展它；先只放类型断言）：

```typescript
import { describe, it, expect } from 'vitest';
import type { InstallOptions, InstallErrorKind } from '../installer';
import { InstallError } from '../installer';

describe('installer types (P1 surface)', () => {
  it('InstallOptions has onUpgradeDetected callback shape', () => {
    const options: InstallOptions = {
      onUpgradeDetected: async ({ existing, incoming }) => {
        expect(typeof existing.id).toBe('string');
        expect(typeof existing.name).toBe('string');
        expect(typeof existing.version).toBe('string');
        expect(typeof incoming.id).toBe('string');
        expect(typeof incoming.name).toBe('string');
        expect(typeof incoming.version).toBe('string');
        return true;
      },
    };
    expect(options.onUpgradeDetected).toBeTypeOf('function');
  });

  it('user-cancelled is a valid InstallErrorKind', () => {
    const kind: InstallErrorKind = 'user-cancelled';
    const err = new InstallError(kind, 'user cancelled upgrade');
    expect(err.kind).toBe('user-cancelled');
    expect(err).toBeInstanceOf(InstallError);
  });
});
```

- [ ] **Step 4.2 · 跑测试验证红**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.upgradeCallback.test.ts
```

Expected: TS 编译错误 — `onUpgradeDetected` 不在 `InstallOptions` 上；`'user-cancelled'` 不是 `InstallErrorKind` 的成员。

- [ ] **Step 4.3 · 扩 InstallErrorKind**

编辑 `src/platform/userApp/installer.ts`，把第 24-31 行改为：

```typescript
export type InstallErrorKind =
  | 'bad-zip'
  | 'bad-manifest'
  | 'id-conflict'
  | 'entry-missing'
  | 'compile'
  | 'uninstall-builtin'
  | 'io'
  | 'user-cancelled';
```

- [ ] **Step 4.4 · 扩 InstallOptions**

编辑 `src/platform/userApp/installer.ts`，把第 52-54 行的 `InstallOptions` 改为：

```typescript
export interface InstallOptions {
  onProgress?: (event: InstallProgressEvent) => void;
  /**
   * Called after manifest validation when the incoming app's id matches an
   * already-installed user app. The caller inspects the version diff and
   * resolves true (continue upgrade) or false (abort — installer will throw
   * InstallError('user-cancelled')). If not provided, upgrades proceed
   * automatically (current behavior).
   */
  onUpgradeDetected?: (info: {
    existing: { id: string; name: string; version: string };
    incoming: { id: string; name: string; version: string };
  }) => boolean | Promise<boolean>;
}
```

- [ ] **Step 4.5 · 跑测试验证通过**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.upgradeCallback.test.ts
```

Expected: 两个用例都过。

- [ ] **Step 4.6 · commit**

```bash
git add src/platform/userApp/installer.ts \
        src/platform/userApp/__tests__/installer.upgradeCallback.test.ts
git commit -m "feat(installer): add onUpgradeDetected option + user-cancelled error kind"
```

---

## Task 5 · 把回调接入 install() 流程

**Files:**
- Modify: `src/platform/userApp/installer.ts:118-127` (existing id-conflict + isUpgrade 逻辑之后插入回调)
- Test: `src/platform/userApp/__tests__/installer.upgradeCallback.test.ts` (扩展)

- [ ] **Step 5.1 · 写失败测试（行为层）**

替换整个 `src/platform/userApp/__tests__/installer.upgradeCallback.test.ts` 文件（在 Task 4 的内容基础上扩展。imports 放到文件顶部统一管理）：

```typescript
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import JSZip from 'jszip';
import type { InstallOptions, InstallErrorKind } from '../installer';
import { InstallError, install } from '../installer';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import { appRegistry } from '@/platform/appRegistry';
import {
  getDB,
  APP_META_STORE,
  APP_SRC_STORE,
  APP_KV_STORE,
} from '@/platform/storage/idbStorage';

async function makeZip(files: Record<string, string>): Promise<Blob> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: 'blob' });
}

const helloTsx = `
import React from 'react';
export default function Hello() {
  return React.createElement('div', null, 'Hello');
}
`;

describe('installer types (P1 surface)', () => {
  it('InstallOptions has onUpgradeDetected callback shape', () => {
    const options: InstallOptions = {
      onUpgradeDetected: async ({ existing, incoming }) => {
        expect(typeof existing.id).toBe('string');
        expect(typeof existing.name).toBe('string');
        expect(typeof existing.version).toBe('string');
        expect(typeof incoming.id).toBe('string');
        expect(typeof incoming.name).toBe('string');
        expect(typeof incoming.version).toBe('string');
        return true;
      },
    };
    expect(options.onUpgradeDetected).toBeTypeOf('function');
  });

  it('user-cancelled is a valid InstallErrorKind', () => {
    const kind: InstallErrorKind = 'user-cancelled';
    const err = new InstallError(kind, 'user cancelled upgrade');
    expect(err.kind).toBe('user-cancelled');
    expect(err).toBeInstanceOf(InstallError);
  });
});

async function wipeIdb(): Promise<void> {
  const db = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(
      [APP_META_STORE, APP_SRC_STORE, APP_KV_STORE],
      'readwrite',
    );
    tx.objectStore(APP_META_STORE).clear();
    tx.objectStore(APP_SRC_STORE).clear();
    tx.objectStore(APP_KV_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

describe('installer onUpgradeDetected callback behavior', () => {
  beforeEach(async () => {
    // Clear user apps from registry BEFORE wiping store (so we have the ids to unregister)
    const allIds = useInstalledUserAppsStore
      .getState()
      .apps.map((a) => a.id);
    for (const id of allIds) appRegistry.unregister(id);
    useInstalledUserAppsStore.setState({ apps: [] });
    await wipeIdb();
  });

  afterEach(() => {
    cleanup();
  });

  async function installFirstVersion(): Promise<void> {
    const zip = await makeZip({
      'manifest.json': JSON.stringify({
        id: 'cb-app',
        name: 'CB App',
        version: '1.0.0',
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
    await install(zip);
  }

  async function buildUpgradeZip(version: string): Promise<Blob> {
    return makeZip({
      'manifest.json': JSON.stringify({
        id: 'cb-app',
        name: 'CB App',
        version,
        entry: 'index.tsx',
        perspectiveAware: false,
      }),
      'index.tsx': helloTsx,
    });
  }

  it('calls onUpgradeDetected with existing + incoming versions', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    let capturedInfo: unknown = null;
    await install(v2, {
      onUpgradeDetected: (info) => {
        capturedInfo = info;
        return true;
      },
    });

    expect(capturedInfo).toMatchObject({
      existing: { id: 'cb-app', name: 'CB App', version: '1.0.0' },
      incoming: { id: 'cb-app', name: 'CB App', version: '2.0.0' },
    });
  });

  it('throws user-cancelled when callback returns false', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    let caught: unknown = null;
    try {
      await install(v2, { onUpgradeDetected: () => false });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(InstallError);
    expect((caught as InstallError).kind).toBe('user-cancelled');

    // Installed record should still be v1 (no overwrite happened)
    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'cb-app');
    expect(record?.version).toBe('1.0.0');
  });

  it('continues upgrade when callback returns true', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    const result = await install(v2, { onUpgradeDetected: () => true });
    expect(result.isUpgrade).toBe(true);

    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'cb-app');
    expect(record?.version).toBe('2.0.0');
  });

  it('does NOT call callback on first install (no existing)', async () => {
    const zip = await buildUpgradeZip('1.0.0');
    let called = false;
    await install(zip, {
      onUpgradeDetected: () => {
        called = true;
        return true;
      },
    });
    expect(called).toBe(false);
  });

  it('supports async callback (Promise<boolean>)', async () => {
    await installFirstVersion();
    const v2 = await buildUpgradeZip('2.0.0');

    await install(v2, {
      onUpgradeDetected: async () =>
        new Promise<boolean>((resolve) => setTimeout(() => resolve(true), 10)),
    });

    const record = useInstalledUserAppsStore
      .getState()
      .apps.find((a) => a.id === 'cb-app');
    expect(record?.version).toBe('2.0.0');
  });
});
```

- [ ] **Step 5.2 · 跑测试验证红**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.upgradeCallback.test.ts
```

Expected: 5 个行为测试全部失败 — 回调根本没被调用（因为 installer 还没有调它）。

- [ ] **Step 5.3 · 接入 install() 流程**

编辑 `src/platform/userApp/installer.ts`，**把第 118-127 行的 id-conflict + isUpgrade 段落**替换为：

```typescript
    // 3. id conflict check (no emit — sub-step of validate)
    const existing = appRegistry.get(manifest.id);
    if (existing && existing.type === 'builtin') {
      throw new InstallError(
        'id-conflict',
        `manifest.id "${manifest.id}" conflicts with a builtin app`,
      );
    }
    const isUpgrade = !!existing && existing.type === 'user';

    // 3b. Upgrade confirmation callback (P1).
    // Only invoked on user-app upgrades. The caller can show a confirmation
    // sheet; returning false cancels the install without side effects.
    if (isUpgrade && options?.onUpgradeDetected) {
      const existingRecord = useInstalledUserAppsStore
        .getState()
        .apps.find((a) => a.id === manifest.id);
      if (existingRecord) {
        const proceed = await options.onUpgradeDetected({
          existing: {
            id: existingRecord.id,
            name: existingRecord.name,
            version: existingRecord.version,
          },
          incoming: {
            id: manifest.id,
            name: manifest.name,
            version: manifest.version,
          },
        });
        if (!proceed) {
          throw new InstallError(
            'user-cancelled',
            `user cancelled upgrade of "${manifest.id}"`,
          );
        }
      }
    }
```

**重要**：新增的这段是 `await` 异步的，确保 `install` 外层函数已经是 async（它本来就是）。`throw InstallError` 走外层的 try/catch → `emit({ stage: 'error', ... })` → rethrow。UI 层接到后需要识别 `kind === 'user-cancelled'` 走静默关闭路径（P3 的事）。

- [ ] **Step 5.4 · 跑测试验证通过**

```bash
pnpm vitest run src/platform/userApp/__tests__/installer.upgradeCallback.test.ts
```

Expected: 7 个用例（2 类型 + 5 行为）全过。

- [ ] **Step 5.5 · 跑全量 installer 测试回归**

```bash
pnpm vitest run src/platform/userApp/__tests__/
```

Expected: 全过。如果 m2.e2e / m3.e2e 某些升级场景挂掉，检查它们是否隐式依赖"没 callback 时静默升级" — 我们的改动保留了这个行为（callback 可选），所以应该不受影响。

- [ ] **Step 5.6 · commit**

```bash
git add src/platform/userApp/installer.ts \
        src/platform/userApp/__tests__/installer.upgradeCallback.test.ts
git commit -m "feat(installer): invoke onUpgradeDetected before proceeding with upgrade"
```

---

## Task 6 · 回归 & 类型校验收尾

**Files:** 无新改动，只跑检查

- [ ] **Step 6.1 · 全量 tsc**

```bash
pnpm tsc --noEmit
```

Expected: 0 errors。如有漏掉的 `InstalledUserApp` 构造点（比如某个我们没搜到的 test fixture），补齐。

- [ ] **Step 6.2 · 全量测试套件**

```bash
pnpm test
```

Expected: 全绿。

- [ ] **Step 6.3 · Build 验证（项目规范：每次改动后跑 build）**

```bash
pnpm build
```

Expected: 无 error。若有 TS error 泄漏出来说明 tsc step 有遗漏。

- [ ] **Step 6.4 · 可选：手动 smoke test**

启动 dev server，上传一个 user app zip 两次（第二次 version 改掉），看 Sheet／console 层是否正常（此时 UI 还没改，所以只验证 installer 不崩）：

```bash
pnpm dev
```

在浏览器打开 App Store，传 zip，确认：
1. 第一次安装成功，桌面出现图标
2. 第二次（同 id，不同 version）安装成功，桌面图标名称/图标按新 manifest 刷新
3. console 无 error

此 step 可跳过（自动化测试已覆盖），但有 UI 配套的人肉验证是 P2 之前的最后一道保险。

- [ ] **Step 6.5 · 无 commit（已在前面 task 增量提交）**

Task 6 是纯验证。若 6.1/6.2 发现问题，回到前面相应 task 修补、补 commit，不在这里聚合提交。

---

## 完成标志

- [ ] `InstalledUserApp` 包含 `version` / `installedAt` / `sizeBytes` 三个必选字段
- [ ] `install()` 在 IDB 存入 `sizeBytes`，store record 包含全部新字段
- [ ] `loadInstalledApps()` 从 IDB 读旧数据时用 `sizeBytes: 0` 回退
- [ ] `install()` 支持可选 `onUpgradeDetected` 回调；返回 false 抛 `'user-cancelled'`
- [ ] `InstallErrorKind` 包含 `'user-cancelled'`
- [ ] 不提供 callback 时升级行为与改动前一致（向后兼容）
- [ ] `pnpm tsc --noEmit` 干净
- [ ] `pnpm test` 全绿
- [ ] `pnpm build` 干净
- [ ] 6 个 commit（每个 task 一个，Task 6 无 commit）

---

## Review 发现的 Deferred 项（P1 内消化）

Task 1 code review（commit `65c540c`）发现但按计划推迟处理的项，**Task 6 收尾时必须完成**：

1. **`src/apps/AppStore/__tests__/ManagePage.test.tsx` 7 处 `InstalledUserApp` 构造缺新字段**
   - 行 23, 24, 36, 47, 64, 65, 88
   - 原 plan 未列出该文件；Task 6 Step 6.1 的 tsc 全量扫描必须把这 7 处补齐
   - 补法同 Springboard 测试：`version: '1.0.0'`, `installedAt: 1_700_000_000_000`, `sizeBytes: 0`

2. **`InstalledUserApp` 的 `version` JSDoc 与实际行为不符**
   - 当前注释：`/** From manifest.version; fallback '1.0.0' for legacy records missing this field. */`
   - 实际：字段是 required、`loadInstalledApps()` 直读 `meta.manifest.version`、无 fallback 路径（manifest parser 已要求 version 必填）
   - 修法：把 "fallback '1.0.0' for legacy records missing this field" 去掉，或改为 `/** From manifest.version (required by manifest schema). */`
   - `sizeBytes` 的 "0 for legacy records" 是对的（Task 3 Step 3.3 的 `typeof meta.sizeBytes === 'number' ? meta.sizeBytes : 0` 兜底），无需改

3. **测试代码小 DRY**（可选，非必须）
   - `installedUserAppsStore.test.ts` 新测试可用 `{ ...sample, id: 'meta-rich', version: '1.2.3', sizeBytes: 2_048 }` 复用 sample
   - 魔法数字 `1_700_000_000_000` 重复 4 次，可抽成 `INSTALLED_AT_FIXTURE` 常量
   - 仅当 Task 6 有余力时处理；不 block P1 完成

---

## 下一步（非本 plan 范围）

P1 完成后，写 P2：
- `docs/plan/YYYY-MM-DD-HHMM-appstore-p2-mainscreen-swipe-empty.md`
- 覆盖：AppStoreApp 单页重构、大标题 + 右上 "+"、InstalledAppRow 新样式（消费 P1 的 version/size/time）、SwipeRow 左滑手势、EmptyState

然后 P3：
- `docs/plan/YYYY-MM-DD-HHMM-appstore-p3-sheet-contextmenu-detail.md`
- 覆盖：UploadSheet 状态机（消费 P1 的 `onUpgradeDetected` callback）、长按 Context Menu、AppDetailSheet、错误 View 文案映射
