# M2：完整安装流程 + 基础 SDK —— 设计文档

> 父 spec: [2026-04-16-app-store-design.md](./2026-04-16-app-store-design.md)  
> 前置里程碑: [2026-04-17-m1-architecture-decoupling-design.md](./2026-04-17-m1-architecture-decoupling-design.md)  
> 对应里程碑: **M2**（App Store 需求的第二个里程碑）

## 概述

M1 让 hiPhone 具备了"可以接入新 app 的插件式架构"，并用一个硬编码的假 user app 验证了管道（TSX 字符串 → 编译 → 沙箱 → 渲染）。**M2 的目标是让管道能吃真 zip 包：用户（开发阶段即开发者）提供一个 zip，系统解压 → 校验 → 持久化到 IndexedDB → 图标出现在桌面 → 点击运行 → 数据在 app 关闭 / 刷新 / 多 owner 视角下正确持久化与隔离。**

M2 完成后，M3 再搭 App Store UI 就只是"给 installer 加一层界面"。

**M2 做什么：**
- Zip 上传 → 解压 → manifest 校验 → 多文件 TSX 编译 → IDB 持久化的完整安装管道
- Springboard 支持动态 user app 图标（含自定义 icon.png）
- 新 IDB object store `app-kv`（单层升级），为 user app 提供 per-app + per-owner 隔离的 key-value 存储
- `@hiphone/storage`、`@hiphone/perspective`、`@hiphone/hooks` 三个 SDK 模块
- 多文件模块解析（CJS lazy eval），支持循环依赖
- DEV 专用 `globalThis.__hiphoneInstall(file)` 入口，用于 M2 期间的手动和自动化测试
- 卸载完整流程（清 app-meta、app-src、app-kv 三个 store 的所有相关 key + Registry 反注册 + 桌面移图标）

**M2 不做什么：**
- **App Store UI**——文件选择器、进度条、"远程仓库"浏览全部留给 M3
- **Twind（运行时 Tailwind）**——父 spec 的 M2.S6，已被裁掉；user app 先用 inline style / style 标签 / 纯 CSS 跑通，Twind 作为单独 stage 合并进 M3
- **`@hiphone/fetch/ai/nav/toast`**——SDK 其余模块全部在 M3
- **内置 app 存储迁移到 `app-kv`**——`app-kv` 的 schema 会设计成"内置 app 可平滑接入"的形态，但 M2 完全不触碰任何内置 app；内置 app 迁移作为独立后续里程碑立项
- **权限系统（manifest.permissions）**——M2 的 SDK 就 storage/perspective/hooks，不涉及需要鉴权的能力（fetch/ai-tools 都在 M3+），所以 `permissions` 字段 M2 识别但不消费
- **版本升级 diff / app 市场更新通知**——M3+

## 用户需求

把 App Store 宏观需求（父 spec）落地的第二阶段。M2 完成后具备：
- 一条完整的 **zip → 安装 → 运行 → 数据持久化 → 卸载** 管道
- user app 编写体验达到"和普通 React 项目一样"（多文件 import、看到 source map、编译错当场暴露）
- 用户 app 的数据严格按 app + owner 双层隔离，符合 hiPhone "查手机"视角的已有语义

这是 M3（App Store UI + 完整 SDK）的前置依赖。M2 完成之前 M3 只能做一层空壳 UI，没有后端管道支撑。

## 关键决策记录

五个决策通过 brainstorming 逐个敲定：

| 决策项 | 选择 | 理由 |
|---|---|---|
| **Q1: M2 范围** | 6 个阶段（父 spec 的 S1-S5 + S7，砍 S6 Twind） | zip → 运行 + 存储 + 生命周期是关键路径；Tailwind 运行时不挡路（app 先用 inline style 跑得通），独立并入 M3；避免 M2 膨胀 |
| **Q2: M2 期间的安装入口** | `globalThis.__hiphoneInstall(file)` DEV API + 强 vitest 覆盖 | M3 才做 App Store UI；M2 重点是锁 installer 的 IDB + Registry + Springboard 响应，不做 UI；vitest 生成 zip 直接喂 installer，DevTools 粘一行手测 |
| **Q3: user app storage 物理布局** | 新 object store `app-kv`（IDB v2 → v3 一次性升级） | 零动态创建 store（IDB 限制）；卸载走 `index.openCursor(by-appId)` 一把扫清；观测/调试干净；schema 设计成内置 app 后续可接入的形态 |
| **Q4: 多文件模块解析** | CommonJS 式 lazy eval（安装时全部 Sucrase 预编译存 map，运行时按 `require` 路径 fallback + 模块缓存惰性执行） | 不自己做 import 扫描（Sucrase 已把 import 翻成 require）；循环依赖按 Node CJS 语义自然工作；相对路径 fallback 是 ~50 行 |
| **Q5: 重装同 id 的 app** | 覆盖 source 和 manifest，保留 `app-kv` 数据（升级语义） | 符合 iOS App Store 直觉；实现简单（IDB 操作只改 app-meta/app-src，app-kv 不动）；重装 = 迭代代码，数据理应保留 |
| **Approach: 实现顺序** | Walking skeleton（每个 stage 末尾都是完整绿 E2E） | M2 系统边界多（zip 解析 + IDB 升级 + SDK 多层），攒到最后一把粘合集成风险大；骨架先立，每 stage 在已知绿基线上增厚 |

## 架构

### 目录结构

```
src/platform/
├── storage/
│   └── idbStorage.ts                   【改】v2→v3：新增 app-meta / app-src / app-kv 三个 store
├── stores/
│   └── installedUserAppsStore.ts       【新】S1 — 已装 user app 列表（Zustand，backed by app-meta）
└── userApp/
    ├── compiler.ts                     【既有】M1 已实现（带 source maps）
    ├── sandbox.ts                      【既有】M1 已实现
    ├── manifest.ts                     【新】S1 — manifest schema + 校验
    ├── installer.ts                    【新】S1 — 核心安装 + 卸载管道
    ├── moduleResolver.ts               【新】S2 — CJS lazy eval 多文件解析
    ├── appStorage.ts                   【新】S3 — app-kv IDB 读写原语
    ├── devInstall.ts                   【新】S1 — globalThis.__hiphoneInstall 挂载（DEV-only）
    └── sdk/
        ├── index.ts                    【改】每个 stage 增模块
        ├── ui.ts                       【既有】
        ├── wrap.tsx                    【既有】
        ├── errorBoundary.tsx           【既有】
        ├── storage.ts                  【新】S3 — @hiphone/storage
        ├── perspective.ts              【新】S4 — @hiphone/perspective
        └── hooks.ts                    【新】S5 — @hiphone/hooks

src/shell/Springboard/
└── apps.data.ts                        【改】S1 — 图标合并 "内置静态 + 用户动态(来自 installedUserAppsStore)"

src/apps/
└── AppScene.tsx                        【改】S4 — perspectiveAware 从 manifest 读（user app 场景）
```

### Walking skeleton — 6 个 stage

| Stage | 关键产出 | 完成时 DEV demo 能做到 |
|---|---|---|
| **S1 — 最小骨架** | `manifest.ts` + `installer.ts`（单文件版本）+ `installedUserAppsStore` + Springboard 合并 + `devInstall.ts` | DevTools 粘 `__hiphoneInstall(singleFileZip)` → 桌面出图标 → 点开跑 "Hello" |
| **S2 — 多文件** | `moduleResolver.ts` CJS lazy eval + installer 改成"预编译所有 .tsx/.ts/.ts" | 上传含 `import './X'` 的 zip 跑得通；循环依赖也能跑 |
| **S3 — 真存储** | `idbStorage.ts` v3 升级（建 `app-kv`）+ `appStorage.ts` + `@hiphone/storage`（扁平 key：`{appId}:{key}`） | todo app 刷新页面数据仍在；`globalSet/get` 可用 |
| **S4 — perspective** | key 升级加 owner 维度 + `@hiphone/perspective` + manifest `perspectiveAware` 字段在 AppScene 生效 | 查角色手机时 `perspectiveAware: false` 的 user app 显示占位；`perspectiveAware: true` 的数据自动按 owner 隔离 |
| **S5 — 生命周期** | `@hiphone/hooks`（useOnLaunch/Resume/Background/Kill/OpenParams/AppMemory） | 计时器 user app 后台保留、kill 重置；在桌面上 open 回来立即 resume 回调 |
| **S6 — E2E（= 父 spec S7）** | 真 `todo-app.zip` 测试 fixture + 全链路 vitest 集成测试 | 10 条验收标准全绿 |

**关键约束：每个 stage 末尾 `pnpm test` + `pnpm build` 都全绿。** 任一 stage 完成意味着生产 bundle 可构建、所有测试通过，是 walking skeleton 的核心价值。

### 新增依赖

| 依赖 | 用途 | 体积（gzip） | 引入 stage |
|---|---|---|---|
| `jszip` | 解压用户上传的 zip 包 | ~45KB | S1 |
| `sucrase` | 从 M1 的 DEV-only 晋升为生产依赖（installer 必须能在生产用） | ~120KB | S1 |

M1 的 Sucrase 是 DEV-gated 动态 import，生产 bundle 不包含。M2 的 installer 在生产下也要能跑（`__hiphoneInstall` 只是入口 DEV-only，管道本身是生产代码），所以 Sucrase 实质上进入了生产 bundle。M2 不做"首次安装才 lazy load Sucrase"的优化（walking skeleton 阶段保持简单），作为 M2+ 的可选增量。

## 各 stage 详细设计

### S1：最小骨架

#### S1.1 Manifest schema（`manifest.ts`）

```typescript
export interface UserAppManifest {
  id: string;               // 必填，^[a-z0-9][a-z0-9-]{2,31}$
  name: string;             // 必填
  version: string;          // 必填，语义化版本（x.y.z）
  entry: string;            // 必填，zip 内相对路径（如 "App.tsx"）
  icon?: string;            // 可选，zip 内 PNG 路径
  perspectiveAware?: boolean; // 可选，默认 false
  // M2 识别但不消费的字段（允许出现，不报错）:
  author?: string;
  description?: string;
  permissions?: string[];
  aiTools?: string;
}

export function validateManifest(raw: unknown): UserAppManifest;  // 抛 ManifestError
```

**id 冲突规则：**
- 不能和 `appRegistry.has(id)` 返回 true 的内置 app 重复
- 不能以 `__` 开头（预留给平台虚拟 app，如 §9.7 的 `__user__`）
- 大小写敏感；manifest 强制小写

#### S1.2 Installer 管道（`installer.ts`）

```typescript
export interface InstallResult {
  id: string;
  installedAt: number;
  isUpgrade: boolean;
}

export async function install(file: Blob): Promise<InstallResult>;
export async function uninstall(appId: string): Promise<void>;
export async function loadInstalledApps(): Promise<void>;  // 启动时调，重建 Registry
```

**`install(file)` 管道（8 步，任一失败整体 abort，不留半残状态）：**

1. **JSZip 解压**——失败抛 `InstallError('bad-zip')`
2. **读 `manifest.json` → `validateManifest`**——失败抛 `InstallError('bad-manifest', details)`
3. **id 冲突检查**——内置 id 冲突或 `__` 开头 → 拒；已装 user app → 标记 `isUpgrade=true` 继续
4. **读所有 `.tsx / .ts` → `compileTsx` 全部**——任一编译失败抛 `InstallError('compile', filePath, message)`，错误一次性暴露
5. **读 `icon.png`（若有）→ 转 data URL**
6. **IDB 原子写入**（单事务跨 `app-meta` + `app-src`）：
   - `app-meta:{id}` → `{ manifest, installedAt, iconDataUrl }`
   - `app-src:{id}` → `{ compiledMap: Record<path, compiledCode>, installedAt }`
   - 升级时 `app-kv:{id}:*` 不动
7. **更新 `installedUserAppsStore`**（Zustand，内部 subscribe Springboard）→ 桌面自动响应
8. **注册到 `appRegistry`**——`component` 字段是一个 lazy loader React 组件，首次 render 时才从 `app-src` 读 compiled map → 构造 moduleResolver → `executeSandboxed`

**`uninstall(appId)`：**
1. 校验 `appId` 确实是 user app（不能卸内置）
2. IDB 原子事务：
   - `app-meta` delete key
   - `app-src` delete key
   - `app-kv` 用 `by-appId` 索引 cursor 扫清该 app 所有 key（覆盖所有 owner 和 global）
3. `installedUserAppsStore` 移除
4. `appRegistry.unregister(appId)`

**`loadInstalledApps()`：** 启动时调（在 `registerBuiltins()` 之后），读 `app-meta` 全量 → 为每个 user app 在 `installedUserAppsStore` + `appRegistry` 补齐。不读 `app-src`（懒加载）。

#### S1.3 `installedUserAppsStore`（`src/platform/stores/installedUserAppsStore.ts`）

Zustand store，管理已装 user app 列表：

```typescript
interface InstalledUserApp {
  id: string;
  name: string;
  iconDataUrl: string | null;
  page: number;         // 桌面页号，默认 1（内置主屏占 0）
  perspectiveAware: boolean;
}

interface InstalledUserAppsState {
  apps: InstalledUserApp[];
  add(app: InstalledUserApp): void;
  remove(id: string): void;
}
```

**Persist：** 不经 Zustand persist——`app-meta` 本身就是 persistence，store 只是内存镜像，`loadInstalledApps()` 启动时从 `app-meta` 重建。这避免两处持久化同步问题。

#### S1.4 Springboard 接入

`src/shell/Springboard/apps.data.ts` 改造：
- 导出的 `getApps()` 原来是静态数组，改成：`[...BUILTIN_APPS, ...installedUserAppsStore.getState().apps.map(toAppInfo)]`
- Springboard 用 `useSyncExternalStore` / Zustand 订阅 store 变化 → 自动重渲染
- 每个 user app 的 icon 字段用 `iconDataUrl ?? DEFAULT_USER_APP_ICON`（平台占位 SVG）

#### S1.5 DEV 安装入口（`devInstall.ts`）

```typescript
if (import.meta.env.DEV) {
  (globalThis as any).__hiphoneInstall = (file: Blob) => install(file);
  (globalThis as any).__hiphoneUninstall = (appId: string) => uninstall(appId);
  (globalThis as any).__hiphoneMakeTestZip = makeTestZip;  // 便携构造测试 zip 的工具函数
}
```

生产 build Vite DCE 剔除整个 if。`makeTestZip(spec)` 接受一个 `{manifest, files: Record<path, string>}` 形态的对象（也可传入预置 preset 名字如 `'todo'` 走内置 fixture），返回一个内存 Blob，方便 DevTools 里一行命令造 zip 手测。

### S2：多文件模块解析

#### S2.1 `moduleResolver.ts` 核心

```typescript
export function createUserAppRuntime(
  compiledMap: Record<string, string>,  // path → compiled JS
  entryPath: string,
  sdkResolve: (specifier: string) => unknown,  // M1 已有的 resolveModule
): ComponentType {
  const moduleCache = new Map<string, { exports: any }>();
  
  const requireFrom = (fromPath: string) => (specifier: string) => {
    // Bare name (react / @hiphone/*) → SDK
    if (!specifier.startsWith('.')) {
      return sdkResolve(specifier);
    }
    
    const resolved = resolveRelativePath(fromPath, specifier, compiledMap);
    // (resolveRelativePath 做 fallback: X → X / X.tsx / X.ts / X/index.tsx / X/index.ts)
    
    const cached = moduleCache.get(resolved);
    if (cached) return cached.exports;
    
    const module = { exports: {} };
    moduleCache.set(resolved, module);  // 插 placeholder 先 (关键：处理循环依赖)
    executeInSandbox(compiledMap[resolved], requireFrom(resolved), module);
    return module.exports;
  };
  
  const entryModule = { exports: {} };
  moduleCache.set(entryPath, entryModule);
  executeInSandbox(compiledMap[entryPath], requireFrom(entryPath), entryModule);
  
  return (entryModule.exports as any).default;
}
```

#### S2.2 M1 sandbox.ts 适配

M1 `executeSandboxed(code, resolve)` 的签名"一次性构造 + 执行"不够用了。改造为：

```typescript
export function executeInSandbox(
  compiledCode: string,
  require: (specifier: string) => unknown,
  module: { exports: any },
): void;
```

M1 的单次入口签名仍保留（内部就是 create module + executeInSandbox 的包装），不破坏 M1 测试。

### S3：真存储

#### S3.1 IDB v2 → v3 升级（`idbStorage.ts`）

`onupgradeneeded` 中新增三个 store 的创建逻辑，照 v1→v2 的套路（幂等，多次 upgrade 不重复创建）：

```typescript
// v3: User app storage
if (!db.objectStoreNames.contains(APP_META_STORE)) {
  db.createObjectStore(APP_META_STORE);  // key = appId, 人工传
}
if (!db.objectStoreNames.contains(APP_SRC_STORE)) {
  db.createObjectStore(APP_SRC_STORE);
}
if (!db.objectStoreNames.contains(APP_KV_STORE)) {
  const store = db.createObjectStore(APP_KV_STORE);  // key = "{appId}:..."
  store.createIndex('by-app-id', 'appId', { unique: false });
  // value 存 { appId, scope, ownerId, userKey, value } 多字段结构
}
```

DB_VERSION 从 2 升到 3。向下兼容（v2 用户首次访问自动 upgrade，现有 kv/messages/moments 数据不动）。

#### S3.2 `appStorage.ts` 原语

```typescript
export async function appStorageGet(appId: string, fullKey: string): Promise<unknown>;
export async function appStorageSet(appId: string, fullKey: string, value: unknown): Promise<void>;
export async function appStorageRemove(appId: string, fullKey: string): Promise<void>;
export async function appStorageListByAppId(appId: string): Promise<string[]>;  // 返回全部 fullKey
export async function appStorageDeleteAllByAppId(appId: string): Promise<void>;  // 卸载时用
```

`fullKey` 由上层 SDK 构造（S3 扁平，S4 加 owner）。`appStorage.ts` 只做 IDB 原语，不懂 key 语义。

#### S3.3 `@hiphone/storage`（`sdk/storage.ts`）

S3 版本的 key 构造规则（扁平）：

```typescript
// 当前 user app 的 appId 从 runtime 上下文拿（createUserAppRuntime 建立时注入）
export async function get(key: string): Promise<unknown>;
export async function set(key: string, value: unknown): Promise<void>;
export async function remove(key: string): Promise<void>;
export async function list(): Promise<string[]>;         // 返回用户传入过的原始 key 列表（剥前缀）
export async function globalGet(key: string): Promise<unknown>;
export async function globalSet(key: string, value: unknown): Promise<void>;
```

Key 映射（S3 扁平）：
```
set('items', [...])     → appStorageSet(appId, `${appId}:${key}`, value)
globalSet('theme', ...) → appStorageSet(appId, `${appId}:__global__:${key}`, value)
```

S4 会把第一条变成 `${appId}:owner:${ownerId}:${key}`，globalSet 改成 `${appId}:global:${key}`（`__global__` → `global`，作为 S3→S4 迁移的一部分 rename，反正 S3 的数据是开发期攒的、允许 breaking）。

### S4：Perspective 接入

#### S4.1 Key 升级 + 迁移

S3 的扁平 `{appId}:{key}` 在 S4 启动时做一次 lazy 迁移（IDB 不升版本，在 `loadInstalledApps()` 里跑）：
- 扁平 key `{appId}:{key}`（非 `__global__` 开头）→ 改写为 `{appId}:owner:me:{key}`
- `{appId}:__global__:{key}` → `{appId}:global:{key}`
- 迁移幂等（探测 key 格式已经是新格式就跳过）

#### S4.2 `@hiphone/perspective`（`sdk/perspective.ts`）

```typescript
export function useCurrentOwner(): {
  ownerId: 'me' | string;        // 'me' = 玩家，否则 'char-{id}'
  ownerName: string;
  isViewingOther: boolean;
};

export function getCurrentOwner(): { ownerId, ownerName, isViewingOther };
```

内部包 `usePerspective()` hook + 读 `phoneOwnerStore`。仅暴露 `ownerId` 字符串形式（不透传 `phoneOwnerId: null`），隐藏"玩家 = null"这个宿主内部细节。

#### S4.3 Manifest `perspectiveAware` 在 AppScene 生效

M1 的 `AppScene.tsx` 已经按 `entry.perspectiveAware + entry.globalData` 走 placeholder 逻辑。S4 要做的是：installer 注册 user app 到 Registry 时，把 `entry.perspectiveAware` 从 manifest 读出来，`entry.globalData` 始终 false（user app 不支持声明全局数据，要隔离就开 perspectiveAware）。

### S5：生命周期 SDK

#### S5.1 `@hiphone/hooks`（`sdk/hooks.ts`）

```typescript
export function useOnLaunch(callback: () => void): void;
export function useOnResume(callback: () => void): void;
export function useOnBackground(callback: () => void): void;
export function useOnKill(callback: () => void): void;
export function useOpenParams(): Record<string, unknown> | null;
export function useAppMemory<T>(key: string, initial: T): [T, (val: T) => void];
export function useAppState(): 'launching' | 'active' | 'resuming';
```

`useOnLaunch/Resume/Background/Kill` 实现套路：
```typescript
const currentAppId = useCurrentAppId();  // runtime context
const nonce = useAppRuntimeStore(s => s.appEvents[currentAppId]?.launch ?? 0);
const prev = useRef(nonce);
useEffect(() => {
  if (nonce > prev.current) {
    callback();
    prev.current = nonce;
  }
}, [nonce]);
```

#### S5.2 `useAppMemory` 实现

模块级 `Map<appId, Map<key, any>>`。`useOnKill` 触发时清除该 appId 的整个 inner Map（M1 signal 已就绪）。不写 IDB——用户明确要 persistent 应该用 `@hiphone/storage`。

#### S5.3 `useOpenParams`

Deep Link 参数 M3 才真正有（`@hiphone/nav.open(appId, params)` 是 M3 SDK）。M2 版本的 `useOpenParams` 先实现 infrastructure（`appRuntimeStore` 里加 `openParams: Record<appId, params>` 字段，hook 读之），值永远是 `null`（因为 M2 没人 setter）。M3 的 `@hiphone/nav.open` 才会往这个字段写。

### S6：E2E 验收（= 父 spec S7）

#### S6.1 测试 fixture

`src/platform/userApp/__tests__/fixtures/todo-app/`:
- `manifest.json`（`id: test-todo`, `perspectiveAware: true`）
- `App.tsx`（入口，用 `@hiphone/storage` 和 `@hiphone/hooks.useOnLaunch`）
- `components/TodoItem.tsx`
- `utils.ts`
- `icon.png`（32×32 测试图）

测试时用 JSZip 实时打包成 Blob 喂 installer。

#### S6.2 集成测试（覆盖 10 条验收）

`src/platform/userApp/__tests__/m2-e2e.integration.test.ts`：
- 安装 todo-app.zip → 断言 IDB 三 store 状态 + Registry + installedUserAppsStore
- `render(<AppScene appId='test-todo' />)` → 断言 NavBar 和 TodoItem 渲染
- 模拟用户点击"添加 todo" → 读 IDB `app-kv` → 断言写入 `test-todo:owner:me:items`
- 切 `phoneOwnerStore.phoneOwnerId = 'char-001'` → 重渲染 → 断言 items 清空（char-001 的空间）+ 写 todo 落在 `test-todo:owner:char-001:items`
- 切回玩家视角 → 断言玩家的 items 回来
- 模拟 kill（`useAppRuntimeStore.getState().removeApp('test-todo')`）→ 重新 open → 断言 `useOnLaunch` 触发、`useAppMemory` 里的值 reset
- 调 `uninstall('test-todo')` → 断言 IDB 三 store 都清了该 id 的所有 key、Registry 无、Springboard 无

## 交付清单

| 阶段 | 交付物 | 验收标准 |
|---|---|---|
| **S1** | `manifest.ts`、`installer.ts`（单文件版）、`installedUserAppsStore`、`devInstall.ts`、Springboard 合并；单元测试 | `__hiphoneInstall(单文件zip)` 桌面出图标、点开跑；`pnpm test/build` 全绿 |
| **S2** | `moduleResolver.ts`；installer 改成预编译所有 .tsx/.ts；M1 sandbox 签名扩展；单元测试覆盖相对路径 fallback + 循环依赖 | 多文件 zip 可装可跑；循环依赖不抛 |
| **S3** | IDB v3 升级；`appStorage.ts`；`@hiphone/storage` SDK；单元测试 | user app 中 `await set / await get` 可用；刷新页面后数据持久；`globalSet/Get` 可用 |
| **S4** | S3 扁平 key 迁移到 owner 格式；`@hiphone/perspective`；AppScene 读 user app 的 `perspectiveAware` 字段；卸载清所有 owner 数据；单元测试 | 切 owner 视角数据自动隔离；`perspectiveAware: false` user app 显示占位；卸载不留残 |
| **S5** | `@hiphone/hooks`（6 个 hook + 1 state hook）；单元测试覆盖各 nonce 触发时机 | 计时器 app 后台保留 / kill 重置在单元测试中锁定 |
| **S6** | `todo-app` fixture + m2-e2e.integration.test.ts + 手工回归清单 | 10 条里程碑验收全绿 |

## 测试计划

### 单元测试（vitest）

```
src/platform/userApp/__tests__/manifest.test.ts
  - validateManifest 接受合法 manifest
  - id 不合法格式抛 ManifestError
  - 必填字段缺失抛错
  - 内置 app id 冲突抛 IdConflictError

src/platform/userApp/__tests__/installer.test.ts
  - install(单文件 zip) 成功路径
  - bad-zip / bad-manifest / compile 错误抛对应类型
  - 重装（相同 id）保留 app-kv 数据、覆盖 app-src
  - uninstall 清所有三 store 的相关 key
  - loadInstalledApps 重建 Registry 和 Store

src/platform/userApp/__tests__/moduleResolver.test.ts
  - 相对路径 fallback: './X' 依次尝试 X / X.tsx / X.ts / X/index.tsx / X/index.ts
  - 循环依赖 A↔B 不死循环，按 CJS 语义解开
  - 多层嵌套（A → B → C）正确传递

src/platform/userApp/__tests__/appStorage.test.ts
  - get/set/remove 往返
  - listByAppId 返回全部 fullKey
  - deleteAllByAppId 只清目标 app，不动其他 app

src/platform/userApp/sdk/__tests__/storage.test.ts
  - set/get 自动加 appId 前缀（S3 扁平）
  - S4: 加 owner 命名空间后按 phoneOwnerId 切换
  - globalSet 跨 owner 共享
  - list 返回原始 user key（剥前缀）

src/platform/userApp/sdk/__tests__/perspective.test.ts
  - useCurrentOwner 玩家视角返回 ownerId='me'
  - 切 phoneOwnerId 切换 ownerId/name/isViewingOther

src/platform/userApp/sdk/__tests__/hooks.test.ts
  - useOnLaunch 首次触发 + kill 后重开触发
  - useOnResume 后台→前台触发
  - useOnBackground 前台→后台触发
  - useOnKill 上划杀触发
  - useAppMemory 跨后台保留、kill 重置

src/platform/stores/__tests__/installedUserAppsStore.test.ts
  - add/remove 正确
  - Springboard 订阅变更
```

### 集成测试（S6）

见 §S6.2。

### 手工回归

- DevTools 粘贴 `__hiphoneInstall(await __hiphoneMakeTestZip('todo'))` 完整流程跑一遍
- 刷新页面 → 图标和数据都还在
- 切 owner 视角 → `perspectiveAware` 语义符合预期
- 上划关 app → 再次打开 → `useAppMemory` 重置，`useOnLaunch` 再触发

### 生产 build 验证

- `pnpm build` 通过
- `grep -r "__hiphoneInstall" dist/ || echo OK` 应输出 `OK`（DEV API 被 DCE）
- Sucrase 相关字符串**应该**出现在 dist/ 里（证明已经进入生产 bundle）
- Cloudflare Pages 部署后访问，DevTools 里 `typeof __hiphoneInstall` 应为 `'undefined'`（守卫生效）

## 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| Sucrase 进入生产 bundle 增加 ~120KB gzip | 首屏变大 | 可接受——父 spec 预期内；后续可优化成"首次安装 user app 才动态 import"，不过 M2 不做（walking skeleton 阶段保持简单） |
| IDB v2→v3 升级失败 | 用户数据读不出 | `onupgradeneeded` 保持 v1→v2 的幂等套路；不 drop 任何老 store；Chrome 的 IDB upgrade 原子性有保证 |
| `app-kv` key 格式 S3→S4 迁移出错 | user app 重启后找不到自己的数据 | 迁移幂等（探测已是新格式跳过）；S3 期间的数据是开发期攒的，即便迁移失败丢数据也可接受；S4 单元测试覆盖迁移逻辑 |
| 循环依赖 runtime 出错 | user app 崩 | moduleResolver 严格按 Node CJS 语义（先塞 placeholder 再执行）；单元测试用 A↔B 互 import 的 fixture 锁定；实在崩了 M1 ErrorBoundary 接住，用户看到"App crashed" |
| DevTools 里 `__hiphoneInstall` 被恶意用户拿来装坏 zip | Dev 阶段无所谓 | 仅 DEV-only；生产守卫剔除；M3 真 UI 会走文件选择器，不暴露全局 API |
| 用户 app 的 TSX 编译错在 installer 阶段没抛全、运行时才炸 | 装上了但跑不了 | 改 Sucrase 的 transform 错误在 installer.step-4 全部试一遍，任一 file 编译失败整体拒装 |

## 里程碑验收

**M2 完成 = 满足以下全部条件：**

1. M1 所有现有测试 + 新 M2 所有测试全绿（S1-S6 每一步 `pnpm test` 都过）
2. `pnpm build` 无警告；`grep -r sucrase dist/` 有结果（证明 Sucrase 已进入生产 bundle），`grep -r __hiphoneInstall dist/` 无结果（DEV API 被 DCE）
3. 开发模式下 DevTools 粘贴 `__hiphoneInstall(await __hiphoneMakeTestZip('todo'))` → 桌面出 todo 图标 → 点开正常跑
4. 安装后刷新浏览器 → 图标仍在，数据仍在（IDB 持久化通过）
5. 多文件 zip（含 `import './components/X'`）装得上、跑得通
6. 循环依赖 zip（A ↔ B）装得上、跑得通
7. `perspectiveAware: true` 的 user app：玩家视角写的 todo 和角色视角写的 todo 互不可见
8. `perspectiveAware: false` 的 user app：在角色视角下显示 `ReadOnlyAppPlaceholder`（复用 M1 组件）
9. `useOnLaunch/Resume/Background/Kill/AppMemory/OpenParams` 在对应状态转换时按预期触发（单元测试 + 集成测试覆盖）
10. 卸载 user app 后：Springboard 图标消失、Registry 不含该 id、IDB 三个 store 里该 id 的所有 key 清空

达到这 10 条后，M2 宣告完成，进入 M3（App Store UI + 扩展 SDK + AI App Builder V1）。

**部署：** 遵循项目根 `CLAUDE.md` 规范，部署不是里程碑 gate。M2 完成后用户决定何时部署；需要部署时按 `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md` 流程操作。

**计划文档：** 本设计文档之后，writing-plans skill 会在 `docs/plan/2026-04-17-HHMM-m2-*.md` 产出逐阶段的具体实施计划（S1-S6 每个 stage 的 TDD 步骤、涉及文件、验收检查单）。
