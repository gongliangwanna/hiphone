# Service Registry — 设计文档

> 父 spec: [2026-04-16-app-store-design.md](./2026-04-16-app-store-design.md) §9（AI Tool Registry, 未来扩展基地）
> 前置: M3（App Store UI + 基础 SDK）

## 概述

本期给 hiPhone 加 **Service Registry** —— 让任何 app（user 或 builtin）都能向平台注册命名服务，任何其它 app 通过 `invoke(appId, serviceName, params?)` 直接调用，**不切换前台、不渲染 UI**。语义类似 iOS App Intents 或普通进程内 RPC，但完全同步、无网络、无序列化。

**为什么要做：** M3 的 `@hiphone/nav.open` 是 iOS URL scheme 风格 —— 必须跳转过去让用户看界面再回来。适合需要确认的操作（支付），但对**静默查询**（查余额、查角色列表、查天气）过于重了。游戏场景（让 AI 驱动 app 互相协作）大量需要静默调用能力。

**架构上的第二重作用：** 父 spec §9 规划的 **AI Tool Registry**（"每个 app 向 AI 注册工具，heartbeat 汇总调用"）本质上是 Service Registry 的特殊消费者 —— AI Tool = Service + JSON Schema 参数描述 + 给 LLM 看的 description。本期做 Service Registry 机制，为 AI Tool 铺基础。

**本期做什么：**
- 平台级 `serviceRegistry` + SDK `@hiphone/services`
- manifest 加 `services?: string` 字段（指向 user app 的 services 入口文件）
- 懒加载：首次 invoke 触发 sandbox 启动 + 顶层 `registerService` 执行
- 内置 app 急加载：`registerBuiltins` 扩展 hook
- 卸载清理
- 并发 bootstrap 去重
- Demo：wallet 暴露 `balance` 服务 + shop 静默查询门控按钮

**本期不做：**
- **AI Tool Registry**：独立 spec，基于本期。service def 会预留 `description?` / `parameters?` 字段但不消费
- **权限系统**：游戏场景无需；任何 app 能调任何服务
- **Reactive subscription**：无 `subscribe(appId, name, cb)`；caller 自行 refetch
- **迁移 `heartbeatTools.ts` 14 个工具**：AI Tool Registry 阶段
- **Timeout / cancellation**：caller 用 `Promise.race` 自控

## 用户需求

M3 完成后，user app 之间只能通过 UI 跳转互动。真实游戏场景大量出现：
- 商场想在显示 "立即购买" 按钮前悄悄查钱包余额
- Todo app 想让 AI 角色发朋友圈 —— 需要 XingYu 暴露 `postMoment` 能力
- 多个 app 需要问平台 "当前视角是哪个角色" —— 不想每个 app 都 `import usePhoneOwnerStore`（打破 sandbox）

解决：**一张平台级 Map + 一套注册 / 调用 SDK**，把"app 暴露的能力"抽象成 first-class concept。

## 关键决策记录

| 决策项 | 选择 | 理由 |
|---|---|---|
| **Q1: 范围 vs AI Tool Registry** | 本期只做 Service 机制，架构预留 `description?` / `parameters?` 字段给 AI Tool 未来消费 | 避免一次吃太多；AI Tool 只是 Service 的"带元数据的变种"，同一张表加字段过滤即可 |
| **Q2: 内置 app 能否注册** | 可以，通过 `registerBuiltins.ts` 扩展的 `registerBuiltinServices(appId, defs)` 急加载 | 对称性；跟父 spec §9 的 AI Tool Registry 设计对齐（内置 + user app 完全对等） |
| **Q3: user app 注册时机** | 独立 `services.ts` 文件 + 懒 eval（首次 invoke 触发） | 不要求 app 先被用户打开过；handler 不依赖 React 生命周期；冷启动零成本 |
| **Q4: Handler 签名形状** | 结构化 `{ name, description?, parameters?, execute }` | 现在 `execute` 够用；`description` / `parameters` 预留给 AI Tool Registry，本期平台不消费 |
| **Q5: 寻址方式** | 显式 `invoke(appId, serviceName, params?)` | 避免全局命名冲突；caller 明确知道自己在调哪个 app |
| **Q6: 权限/安全** | 无 —— 游戏场景；任何 app 调任何服务 | 父 spec permissions 字段保留但不消费；等 M5 远程商店再立项 |
| **Q7: 并发 bootstrap** | 共享 in-flight Promise（复用 `ensureTwindInstalled` 的 pattern） | useEffect 并发 / Strict Mode 双渲染 / 多 app 同时 invoke 会自然出现 |

## 架构

### 目录增量

```
src/platform/
├── services/                           【新】
│   ├── serviceRegistry.ts              核心 Map + bootstrap + invoke + context 包装
│   ├── builtinServices.ts              registerBuiltinServices() + Settings 示例
│   └── __tests__/
│       ├── serviceRegistry.test.ts
│       └── builtinServices.test.ts
│
└── userApp/
    ├── manifest.ts                     【改】加 services?: string 字段
    ├── installer.ts                    【改】uninstall() 末尾调 unregisterApp
    └── sdk/
        ├── services.ts                 【新】@hiphone/services SDK 表面
        ├── index.ts                    【改】moduleMap 加 @hiphone/services
        └── __tests__/
            ├── services.test.ts
            └── index.test.ts           【改】加 resolve 断言

src/apps/
└── registerBuiltins.ts                 【改】加 Settings 的 currentOwnerId 服务

src/platform/userApp/__tests__/fixtures/
├── wallet-app/
│   ├── manifest.json                   【改】加 "services": "services.ts"
│   └── services.ts                     【新】balance 服务
└── shop-app/
    └── App.tsx                         【改】mount 时 invoke wallet.balance 门控按钮态
```

### 核心模块

#### 1. `src/platform/services/serviceRegistry.ts`

**职责：**
- 维护 `Map<appId, Map<serviceName, ServiceDef>>`
- user app 懒加载：首次 invoke 触发 sandbox bootstrap，执行 services.ts 顶层
- 并发 invoke 去重：`bootstrapping: Map<appId, Promise<void>>`
- `invoke` 自动 `withUserAppContext(appId, ...)` 包裹 handler 执行

**类型：**

```typescript
export interface ServiceDef {
  name: string;
  /** Human/LLM-readable description. Not consumed by Service Registry;
   *  reserved for AI Tool Registry future consumer. */
  description?: string;
  /** JSON Schema for params. Reserved for AI Tool Registry. */
  parameters?: Record<string, unknown>;
  execute: (params?: unknown) => Promise<unknown>;
}

export class ServiceNotFoundError extends Error {}
export class ServiceBootstrapError extends Error {
  constructor(public appId: string, public cause: unknown) { super(...); }
}

export const serviceRegistry = {
  /** Called from services.ts top-level (user app) or registerBuiltinServices (builtin). */
  register(appId: string, def: ServiceDef): void;

  /** Clear all services for an app. Called from installer.uninstall and
   *  hot-reload paths. Also drops the cached bootstrap handle. */
  unregisterApp(appId: string): void;

  /** Look up (lazy-bootstrap if needed) and call. Returns a Promise of the
   *  handler's return value, OR rejects with ServiceNotFoundError /
   *  ServiceBootstrapError / the handler's own error. */
  invoke(appId: string, serviceName: string, params?: unknown): Promise<unknown>;

  /** Return all service names registered for an appId. Lazy-bootstraps if
   *  needed (so callers can discover an app's surface before invoking). */
  list(appId: string): Promise<string[]>;
};
```

**懒加载流程（`ensureBootstrapped`）：**

```
ensureBootstrapped(appId):
  1. 已完成？→ return
  2. 有 in-flight Promise？→ return 该 Promise（并发去重）
  3. 新建 Promise:
     a. 从 appRegistry.get(appId) 确认 app 存在 + type
     b. 若 type === 'builtin' → 已在 registerBuiltins 阶段注册完,直接 mark done + return
     c. 若 type === 'user':
        - 从 IDB app-src 读 compiledMap
        - 从 IDB app-meta 读 manifest.services 路径
        - 没有 services 字段 → mark done + return（app 不暴露服务是合法的）
        - 有 → createUserAppRuntime(compiledMap, manifest.services, resolveModule, appId)
          （synchronous; runtime 顶层执行 services.ts; registerService 调用落入本 Map）
        - 缓存 RuntimeHandle（下次不重新 eval）
     d. 标记 done；.finally 清理 in-flight map
     e. 失败时不 mark done,允许下次重试
```

**执行包装（`invoke`）：**

```
invoke(appId, name, params):
  await ensureBootstrapped(appId)
  const def = registry.get(appId)?.get(name)
  if (!def) throw new ServiceNotFoundError(...)
  return await withUserAppContext(appId, () => def.execute(params))
```

关键点：**`withUserAppContext` 把 appId 推到 `src/platform/userApp/sdk/context.ts` 的 stack 上** —— handler 内部 `@hiphone/storage.get()` 调 `getCurrentAppId()` 拿到栈顶 `appId`，正确读 callee 的 storage。这套 context 机制 M2 已经铺过。

#### 2. `src/platform/userApp/sdk/services.ts`

**职责：** 暴露给 user app sandbox 的 SDK 表面。

```typescript
import { serviceRegistry, type ServiceDef } from '@/platform/services/serviceRegistry';
import { getCurrentAppId } from './context';

/** Called from services.ts top-level — registers for the *current* app. */
export function registerService(def: ServiceDef): void {
  const appId = getCurrentAppId();  // services.ts is run under withUserAppContext
  serviceRegistry.register(appId, def);
}

export async function invoke(
  targetAppId: string,
  serviceName: string,
  params?: unknown,
): Promise<unknown> {
  return serviceRegistry.invoke(targetAppId, serviceName, params);
}

export async function list(targetAppId: string): Promise<string[]> {
  return serviceRegistry.list(targetAppId);
}
```

**关键：** `registerService` 从 stack 拿 appId（services.ts 被 `withUserAppContext(appId, ...)` 包过跑）；这样 user app 的 services.ts 代码不用显式 ID 自报家门。

#### 3. `src/platform/services/builtinServices.ts`

**职责：** 让内置 app 在启动时急加载服务。

```typescript
export function registerBuiltinServices(
  appId: string,
  defs: ServiceDef[],
): void {
  for (const d of defs) serviceRegistry.register(appId, d);
}
```

**`registerBuiltins.ts` 扩展：** 示例注册 Settings 的 `currentOwnerId`：

```typescript
appRegistry.register({ id: 'settings', ... });
registerBuiltinServices('settings', [
  {
    name: 'currentOwnerId',
    description: '当前视角的角色 id (玩家为 null)',
    execute: async () => usePhoneOwnerStore.getState().phoneOwnerId,
  },
]);
```

本期其他内置 app（XingYu / Notes）**不迁移** —— 等 AI Tool Registry 阶段再做。

#### 4. Installer 集成

`manifest.ts` 加字段（validator 接受非空 string 或 undefined）：

```typescript
services?: string;  // e.g. "services.ts"
```

**installer.install** 路径：已有的 compileTsx 会把 zip 里所有 .tsx / .ts 都编译存进 `compiledMap` —— services.ts 自动进去了，无需额外工作。

**installer.uninstall** 末尾加：
```typescript
serviceRegistry.unregisterApp(appId);
```

### 关键数据流

#### 流 A：user app → user app（懒加载）

```
shop 的 App.tsx
  const [balance, setBalance] = useState(0);
  useEffect(() => {
    invoke('test-wallet', 'balance').then(setBalance);
  }, []);
       │
       ▼
@hiphone/services.invoke  →  serviceRegistry.invoke('test-wallet', 'balance', undefined)
       │
       ▼
ensureBootstrapped('test-wallet'):
  - Map 未命中 + 无 in-flight → 新建 Promise
  - appRegistry.get('test-wallet') → type='user'
  - IDB app-src 读 compiledMap, app-meta 读 manifest.services='services.ts'
  - withUserAppContext('test-wallet', () =>
      createUserAppRuntime(compiledMap, 'services.ts', resolveModule, 'test-wallet')
    )
      ↓
    services.ts 顶层代码执行:
      import { registerService } from '@hiphone/services';
      registerService({ name: 'balance', execute: async () => ... });
      ↓ registerService 内部调 getCurrentAppId() → 栈顶 'test-wallet' → Map 加 entry
  - bootstrapping.delete('test-wallet'); alreadyDone.add('test-wallet')
       │
       ▼
registry.get('test-wallet').get('balance') → ServiceDef
       │
       ▼
withUserAppContext('test-wallet', async () => def.execute(undefined))
  内部 execute:
    const b = await get('balance');  // @hiphone/storage
      ↓
    storage.get 内部 getCurrentAppId() → 'test-wallet'
      ↓
    appStorageGet('test-wallet', 'test-wallet:owner:me:balance') → 700
       │
       ▼
return Promise<700> → shop setBalance(700)
```

wallet **UI 从未挂载** —— services.ts 自己的 runtime，跟 App.tsx 独立，只共享 `@hiphone/storage` IDB 数据。

#### 流 B：user app → builtin（急加载）

```
user-todo 的 App.tsx
  invoke('settings', 'currentOwnerId').then(setOwnerId)
       ▼
serviceRegistry.invoke('settings', 'currentOwnerId')
       ▼
ensureBootstrapped('settings'):
  - 已在 registerBuiltins 阶段 register 过 → mark done + return 立即
       ▼
withUserAppContext('settings', () => def.execute())
  内部: usePhoneOwnerStore.getState().phoneOwnerId  ← 直接访问宿主 Zustand（builtin 是宿主代码）
       ▼
return 'xingchen' → todo
```

**builtin 的 handler 是宿主代码**，可自由访问 Zustand、直接 import 任何模块。这跟 user app handler 语义等价，只是实现层不同（宿主 vs sandbox）。

### 错误路径

| 情况 | 处理 |
|---|---|
| `invoke('app-not-installed', ...)` | `ServiceNotFoundError('app not installed: X')` |
| `invoke('valid-app', 'no-such-service', ...)` | `ServiceNotFoundError('X.Y not registered')` |
| services.ts 顶层抛错 | `ServiceBootstrapError('test-wallet', cause)`；**不 mark done**，下次 invoke 重试 |
| handler 抛错 | 原错误透传给 caller（不 wrap） |
| 并发 invoke 同 app | 共享 in-flight Promise；第二次 caller `await` 第一次 Promise |
| app 注册时 getCurrentAppId() 找不到 appId（services.ts 被直接跑而非通过 bootstrap 包装） | 不会发生 —— bootstrap 强制 withUserAppContext 包裹；但防御性加 assertion |
| unregisterApp 在 invoke 过程中被调用 | invoke 已经查到 def 并开始 execute → 继续执行完；下次 invoke 则 `ServiceNotFoundError` |

## 测试策略

### Unit（`serviceRegistry.test.ts`）

- `register` + `invoke` 基础路径
- `register` 同 name 覆盖（开发热更语义）
- `unregisterApp` 清 Map + 丢弃 runtime handle
- `invoke(unknown app)` → `ServiceNotFoundError`
- `invoke(known app, unknown service)` → `ServiceNotFoundError`
- handler 抛错 → invoke 原样 rejects
- `invoke` 执行时 `getCurrentAppId()` 返 targetAppId（证明 context 包装生效）
- **并发去重**：两个 `invoke` 几乎同时 → spy on doBootstrap → 只调一次；两个 caller 都拿到结果
- bootstrap 失败 → 下次 invoke 重试 bootstrap

### SDK（`services.test.ts`）

- `registerService` 顶层调用 → 平台 Map 正确接收
- `invoke` 转发参数 + 返回值 正确
- `list` 返回已注册 name

### Manifest（`manifest.test.ts` 新 cases）

- 接受 `services: 'services.ts'` 字段
- 拒绝非字符串 `services` 值

### 集成（serviceRegistry 级别,fake-indexeddb）

- 装 wallet fixture（含 services.ts）→ **不开 UI**，直接 `invoke('test-wallet', 'balance')` → 返默认 1000
- IDB 手写 balance=300 → 再 invoke → 返 300
- `uninstall('test-wallet')` → 再 invoke → `ServiceNotFoundError`

### 内置 app（`builtinServices.test.ts`）

- 启动跑完 registerBuiltins → `invoke('settings', 'currentOwnerId')` 立即可用
- 切 phoneOwnerId → invoke 拿到新值（handler live，非快照）

### E2E（`m3.e2e.test.ts` 新增 2-3 测）

- 装 wallet + shop，**只 render shop**（wallet UI 不 mount）
- shop mount 后 `invoke('test-wallet', 'balance')` → state 更新
- 手写 balance=50 → shop re-render → "宝剑 100" 按钮 disabled + 显示 "余额不足"
- UI 可见行为：走完 shop → wallet 支付 → shop 再次 invoke → 余额已扣（证明 services 和 UI 共享 storage 作为单一事实源）

## 文件清单

| 类型 | 路径 | 职责 |
|---|---|---|
| 新 | `src/platform/services/serviceRegistry.ts` | 核心 |
| 新 | `src/platform/services/builtinServices.ts` | 内置注册帮手 |
| 新 | `src/platform/services/__tests__/serviceRegistry.test.ts` | |
| 新 | `src/platform/services/__tests__/builtinServices.test.ts` | |
| 新 | `src/platform/userApp/sdk/services.ts` | SDK 表面 |
| 新 | `src/platform/userApp/sdk/__tests__/services.test.ts` | |
| 新 | `src/platform/userApp/__tests__/fixtures/wallet-app/services.ts` | demo |
| 改 | `src/platform/userApp/manifest.ts` | `services?: string` |
| 改 | `src/platform/userApp/__tests__/manifest.test.ts` | 新字段断言 |
| 改 | `src/platform/userApp/installer.ts` | `uninstall` 末尾 `unregisterApp` |
| 改 | `src/platform/userApp/sdk/index.ts` | moduleMap |
| 改 | `src/platform/userApp/sdk/__tests__/index.test.ts` | resolve 断言 |
| 改 | `src/apps/registerBuiltins.ts` | Settings 的 `currentOwnerId` |
| 改 | `src/platform/userApp/__tests__/fixtures/wallet-app/manifest.json` | 加 `"services"` |
| 改 | `src/platform/userApp/__tests__/fixtures/shop-app/App.tsx` | 消费 balance |
| 改 | `src/platform/userApp/__tests__/m3.e2e.test.ts` | 新 2-3 测 |

**规模：** ~450-550 行（含测试）。单 plan 拿得下。

## 验收清单

**功能：**
- [ ] wallet 不开 UI → shop 能拿到余额
- [ ] 多个并发 invoke 同一个未 bootstrap 的 app → bootstrap 只跑一次
- [ ] 内置 app 注册的服务启动后立即可调
- [ ] 卸载 user app → 对应 services 全部清除 + runtime handle 丢弃
- [ ] services.ts 顶层报错 → 首次 invoke 返 `ServiceBootstrapError`；修复后下次 invoke 成功
- [ ] handler 内部 `@hiphone/storage` 操作正确读写 callee 的 storage

**非功能：**
- [ ] 所有既有测试（M3 完 ~968 个）全绿
- [ ] `pnpm typecheck` 无新错误
- [ ] `pnpm build` 通过
- [ ] bundle size delta < +5 KB gzip（纯 JS，无新依赖）

**手测：**
- `pnpm dev` → App Store 装 wallet + shop → **不开 wallet** → 开 shop → 看到"余额: 1000"状态 → 宝剑按钮可点（100 < 1000）
- 通过 wallet UI 把余额花到 30 → 再开 shop → "宝剑 100" disabled / "药水 30 (最后一件)"

## 未来演进 —— AI Tool Registry

本期的 `ServiceDef` 已经包含 `description?` + `parameters?` 字段，handler 本期不消费。AI Tool Registry 阶段：

- `assembleAiTools(charId)`：遍历所有注册的 services，筛出 `description && parameters` 都有的作为 LLM tool；空的跳过
- 用户开关表：`aiToolsConfigStore.ts` 按 appId + serviceName 存 enable bit
- heartbeat 调用 tool = `serviceRegistry.invoke(appId, name, aiParams)` —— **同一套机制**
- 无需改 service 的注册/执行路径，纯是新消费者

这意味着 AI Tool Registry spec 会很薄（~200 行实现 + 14 个工具的迁移工作）。

## 风险 & 缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| services.ts 顶层有昂贵同步运算 | 首次 invoke 卡顿几十 ms | 警告在文档，开发者习惯问题；未来可加 warn-on-slow-bootstrap 开关 |
| 并发 bootstrap 去重实现有 bug | 偶发状态污染，难以复现 | 单测显式覆盖并发场景（spy + setTimeout）+ 复用 `ensureTwindInstalled` 同款 pattern |
| user app services.ts 试图 import UI 依赖（`@hiphone/ui`） | 浪费内存 + 启动变慢 | 不拦截，文档提示 services 应只 import `@hiphone/storage` / `@hiphone/ai`（M4） |
| 卸载时正在有 invoke 在跑 | 服务返回了但已 unregister | 接受该行为 —— 正在执行的 invoke 正常完成，只是返回后 Map 已空；下次 invoke 报 NotFound |
| 内置 app service handler 内部误用 getCurrentAppId() 拿 caller | 预期与实际不符 | 文档清楚说明 handler 内部 `getCurrentAppId()` = 自己（callee），不是 caller；caller ID 不暴露 |
