# M3：App Store UI + 互联 SDK —— 设计文档

> 父 spec: [2026-04-16-app-store-design.md](./2026-04-16-app-store-design.md)
> 前置里程碑: [2026-04-17-m2-user-app-install-design.md](./2026-04-17-m2-user-app-install-design.md)
> 对应里程碑: **M3**（App Store 需求的第三个里程碑）

## 概述

M2 让 hiPhone 能吃真 zip 包（DEV API → installer → IDB → Springboard）；M3 把这条链路暴露给用户可见的 UI 层，并补齐 user app 之间的互联能力。**M3 的目标是"看得见的 App Store + 能跨 app 跳转 + 给用户反馈 + 写 Tailwind 就能样式化"。**

**M3 做什么：**
- **Twind 集成** —— user app 可直接写 `className="flex gap-4 p-4"`，运行时生成 CSS
- **App Store app** —— 内置 app，两页：本地上传（zip 选择 + 拖拽 + 进度）、已装管理（列表 + 卸载）
- **`@hiphone/nav`** —— user app 可 `open(appId, params)` 跳转另一 app 并传参；`goHome()` 回桌面
- **`@hiphone/toast`** —— user app 可 `toast.show('...')` 调用系统 Toast
- E2E 验收：商场 + 钱包两个示例 user app，完整 Deep Link 链路 + toast 反馈

**M3 不做什么：**
- **`@hiphone/fetch`** —— L1 软沙箱挡不住 `new Function('return fetch')()` 逃生，"fetch SDK" 做成薄包装只是形式主义；用户直接用原生 `fetch` 更诚实；等 M5 升级 iframe 沙箱或引入远程商店时，再把 fetch 包成 RPC 统一入口
- **`@hiphone/ai`** —— AI SDK 涉及 provider 选择、token 管理、heartbeat 改造、Tool Registry，是独立一套抽象，留给 M4
- **AI App Builder** —— 依赖 @hiphone/ai，M4
- **Tool Registry 重构** —— 把现有 `heartbeatTools.ts` 拆到各 app 是独立重构任务，M4
- **Remote Store** —— GitHub raw URL 拉 index.json + 下载 zip，M5
- **`manifest.permissions` 强校验** —— M3 阶段 app 的作者 = 装 app 的人，权限系统起不到作用；继续"识别但不消费"（同 M2）；等 M5 引入远程商店（陌生人的 app）再立项
- **内置 app 存储迁移到 app-kv** —— 独立重构，与 M3 无关

## 用户需求

M2 完成后 hiPhone 已经能装真 zip 包，但：
- 用户（开发阶段即开发者）每次安装都要开 DevTools 粘 `globalThis.__hiphoneInstall(file)`，卸载也要手写
- user app 之间无法互相跳转或传参（支付类流程做不了）
- user app 无法给用户发 Toast 反馈（只能 alert / console）
- user app 写样式要纯 inline style 或手写 `<style>`，项目已集成 Tailwind 但 user app 跑不了

M3 解决这四个痛点。完成后 hiPhone 作为 "能装真 app 的平台" 的叙事闭环：**打开 hiPhone → 桌面看到 App Store → 上传 zip → 图标出现 → 打开 app → 用 Tailwind 写的 UI → 点按钮跳另一 app → 回来看到 toast → 在管理页卸载**。

## 关键决策记录

Brainstorming 阶段的两个核心决策：

| 决策项 | 选择 | 理由 |
|---|---|---|
| **Q1: M3 范围** | "能用的商店 + app 互联"（5 阶段，砍 AI/Builder/Tool Registry/远程商店） | M2 打通了装&跑；M3 的自然延伸是"看得见的入口 + app 之间能对话"。AI 是独立抽象（provider/heartbeat/工具注册），强塞进 M3 会让验收链太长、上下文切换过频。远程商店是 M5（那时引入 permissions 系统更有意义） |
| **Q2: `@hiphone/fetch` 是否做** | 不做，unshadow 原生 fetch，承认"管不住" | L1 软沙箱（`new Function` 作用域遮蔽）本就能绕过。@hiphone/fetch 做成薄 re-export 只是形式主义。诚实方案：让 user app 直接调 `fetch()`；等升级 iframe 沙箱（L2）时再把 fetch 包成 postMessage RPC，那时才有真实的隔离语义 |
| **Q3: Permissions 是否生效** | 继续"识别不消费"（同 M2） | fetch 砍了之后 permissions 在 M3 没有被校验的动作（nav.open 打开已装 app 属于低风险操作，不值得引入权限层）；等 M5 远程商店时 permissions 字段才会面对"陌生人的 app" 的真实语义需要 |
| **Approach: 实现顺序** | Walking skeleton（每 stage 末尾 `pnpm test` + `pnpm build` 全绿） | 沿用 M2 的做法；Twind 是基础设施，先铺；UI 层 → SDK 层逐层增厚；E2E 做最后一 stage 粘合 |

## 架构

### 目录结构

```
src/apps/AppStore/                     【新】
├── AppStoreApp.tsx                     S2 — app 入口 + 顶部 segmented control 切 tab
├── UploadPage.tsx                      S2 — 上传 tab：文件选择 + 拖拽区 + 进度条
├── ManagePage.tsx                      S3 — 已装 tab：列表 + "-" 按钮 + 确认对话框
├── hooks/
│   └── useInstallProgress.ts           S2 — 订阅 installer 进度事件
└── components/
    ├── InstalledAppRow.tsx             S3 — 单行：图标 + 名称/版本 + "-"
    └── UninstallConfirm.tsx            S3 — "卸载 XXX？同时删除数据" 对话框

src/platform/userApp/
├── twindRuntime.ts                    【新】S1 — Twind 实例 + style 注入
├── installer.ts                       【改】S2 — 带进度事件（InstallProgressEvent）
└── sdk/
    ├── nav.ts                         【新】S4 — @hiphone/nav (open, goHome)
    ├── toast.ts                       【新】S4 — @hiphone/toast (show, warn, error)
    └── index.ts                       【改】S4 — 新增两个模块的 exports

src/apps/registerBuiltins.ts           【改】S2 — 注册 AppStoreApp 到 appRegistry

src/platform/userApp/__tests__/fixtures/
├── shop-app/                          【新】S5 — 商场示例 user app
│   ├── manifest.json
│   ├── App.tsx
│   └── icon.png
└── wallet-app/                        【新】S5 — 钱包示例 user app
    ├── manifest.json
    ├── App.tsx
    └── icon.png
```

**注意：**
- `app-store` 作为 app id 已经在 `apps.data.ts` 第 30 行定义（系统 iTunes Store 图标）；M3 S2 只需通过 `registerBuiltins.ts` 往 appRegistry 里塞一条 entry
- `twind` 依赖通过 `pnpm add twind` 引入（预计 ~12 KB gzip）
- 示例 app fixture 结构严格对齐 M2 的 `todo-app` fixture，以复用 `loadFixtureZip` helper

### 核心模块

#### 1. Twind 运行时（`src/platform/userApp/twindRuntime.ts`）

**职责：** 让 user app 用的 Tailwind class 在运行时被识别并生成 CSS。

**为什么不用宿主的 Vite Tailwind：** 宿主 Tailwind v4 是构建时扫描源码生成 class；user app 的代码在运行时才通过 Sucrase 编译成字符串，构建时不可见。必须用运行时方案。

**实现方式：**
```typescript
// twindRuntime.ts
import { install as installTwind } from 'twind';

let installed = false;
export function ensureTwindInstalled(): void {
  if (installed) return;
  installTwind({
    // Scope 到 user app 根容器，避免污染宿主 shell
    prefix: '.user-app-root ',  // 可选，但推荐做法
    // 允许的 class 模式参考 tailwind 默认 preset
  });
  installed = true;
}
```

**挂载时机：** `UserAppRoot` 在 `useLayoutEffect` 里调 `ensureTwindInstalled()`（复用 M2 里注册 mountedApps 的那次 effect）。全局一次注入，所有 user app 共享。

**Scope 策略：** Twind 的 `install({ prefix: '.user-app-root ' })` 会把生成的 `.text-blue-500` 变成 `.user-app-root .text-blue-500`。user app 的根 `<div>` 上加 `className="user-app-root"`，保证 class 不泄露到宿主。

**容错：** Twind install 失败（配置错）或 class 名未识别，退化成不生成 CSS（样式失效但 app 不崩）。ErrorBoundary 不拦 Twind 层错误。

#### 2. Installer 进度事件（`installer.ts` 改）

**当前：** `install(file)` 直接返回 `Promise<InstallResult>`；S2 需要把内部阶段（解压 / 校验 / 编译 / 写盘）暴露给 UI 显示进度条。

**新签名：**
```typescript
export type InstallProgressEvent =
  | { stage: 'unzip'; progress: number }         // 0..1
  | { stage: 'validate'; progress: number }
  | { stage: 'compile'; progress: number; fileIndex: number; total: number }
  | { stage: 'persist'; progress: number }
  | { stage: 'done' }
  | { stage: 'error'; error: Error };

export interface InstallOptions {
  onProgress?: (event: InstallProgressEvent) => void;
}

export function install(file: Blob, options?: InstallOptions): Promise<InstallResult>;
```

**实现：** installer.ts 原先的 8 步流水线在每步结束时调 `onProgress?.({ stage, progress })`。**不改变现有语义**，仅叠加回调。已有的 M2 测试不变。

**UI 消费：** `UploadPage.tsx` 用 `useState` 存当前 progress 事件，渲染成阶段性文案 + 百分比条。

#### 3. App Store App 结构

**`AppStoreApp.tsx`：**
```tsx
import { AppScreen, NavBar } from '@/system';
import { useState } from 'react';
import { UploadPage } from './UploadPage';
import { ManagePage } from './ManagePage';

type Tab = 'upload' | 'manage';

export function AppStoreApp() {
  const [tab, setTab] = useState<Tab>('upload');
  return (
    <AppScreen>
      <NavBar title="App Store" />
      <SegmentedControl value={tab} onChange={setTab} options={[
        { value: 'upload', label: '上传' },
        { value: 'manage', label: '已装' },
      ]} />
      {tab === 'upload' ? <UploadPage /> : <ManagePage />}
    </AppScreen>
  );
}
```

**注册：** `src/apps/registerBuiltins.ts` 中：
```typescript
appRegistry.register({
  id: 'app-store',
  type: 'builtin',
  component: AppStoreApp,
  perspectiveAware: false,
  globalData: true,  // App Store 管理的是玩家的安装列表，不随视角切换
});
```

App Store 不跟随 perspective 切换（管理行为属于玩家，不属于角色）。`globalData: true` 意味着查看他人手机时也显示玩家的 App Store（符合"手机属于玩家"语义）；可按需改为 `globalData: false + perspectiveAware: false`，此时查看他人手机显示只读占位（现有 `ReadOnlyAppPlaceholder` 机制），以实际 UX 取舍为准。

#### 4. `@hiphone/nav`（`sdk/nav.ts`）

**API：**
```typescript
export function open(appId: string, params?: Record<string, unknown>): void;
export function goHome(): void;
```

**实现：**
```typescript
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { appRegistry } from '@/platform/appRegistry';
import { useToastStore } from '@/system';

export function open(appId: string, params: Record<string, unknown> = {}): void {
  if (!appRegistry.has(appId)) {
    useToastStore.getState().show(`App 未安装: ${appId}`);
    return;
  }
  // 1. 写 openParams（先写，再切 app，让目标 app 第一次渲染就读到）
  useAppRuntimeStore.setState((s) => ({
    openParams: { ...s.openParams, [appId]: params },
  }));
  // 2. 切到目标 app（bump launch/resume nonce 自动由 openApp 处理）
  useAppRuntimeStore.getState().openApp(appId, null);
}

export function goHome(): void {
  useAppRuntimeStore.getState().goHome();
}
```

**openParams 清理：** 目标 app 通过 `useOpenParams()` 读到数据后，SDK 不自动清理（让 app 自己决定什么时候算"消费完"）。连续 `open('x', paramsA)` → `open('x', paramsB)` 覆盖上一次。

**安全：** 只能跳已注册的 appId（内置 + user app），未注册时 toast 报错不崩。

#### 5. `@hiphone/toast`（`sdk/toast.ts`）

**API：**
```typescript
export function show(message: string): void;
export function warn(message: string): void;
export function error(message: string): void;
```

**实现：**
```typescript
import { useToastStore } from '@/system';

export function show(message: string): void {
  useToastStore.getState().show(message);
}
export function warn(message: string): void { show(`⚠️ ${message}`); }
export function error(message: string): void { show(`❌ ${message}`); }
```

Toast UI 已在 Device 顶层渲染，无需 user app 操心。`duration` 由 Toast 内部统一控制（M3 不引入可配参数；等 Toast 系统需要 duration 能力时一并重构）。

### 数据流

#### 流 1：上传安装

```
用户 tap App Store 图标
   ↓
AppStoreApp 渲染 tab=upload
   ↓
UploadPage 显示 <input type=file> + 拖拽区
   ↓
用户选文件 / 拖文件
   ↓
UploadPage 调 installer.install(file, { onProgress })
   ↓
installer 8 步执行，每步发 progress 事件
   ↓
UploadPage setState(progress) → 渲染 "编译中 3/5 文件..."
   ↓
安装成功 → 显示 "✅ 已安装：Todo"
   ↓
installedUserAppsStore.add(app) → Springboard subscribe → 重渲染桌面
   ↓
（用户回桌面即看到新图标）
```

#### 流 2：Deep Link 跳转

```
商场 app 点"立即购买"
   ↓
调 open('wallet', { action: 'pay', amount: 100, callback: 'shop', item: '宝剑' })
   ↓
nav.ts：
  1. appRegistry.has('wallet') → 通过
  2. setState: openParams.wallet = { action: 'pay', amount: 100, ... }
  3. appRuntimeStore.openApp('wallet', null) → activeAppId='wallet' + bump launch nonce
   ↓
AppHost 检测 activeAppId 变化，播放切换动画
   ↓
wallet app 渲染，useOpenParams() 读到 params
   ↓
useOpenParams 返回 { action: 'pay', ... }，wallet 展示支付确认页
   ↓
用户按"确认"
   ↓
wallet 调 open('shop', { result: 'success', amount: 100 })
   ↓
相同流程切回 shop
   ↓
shop 的 useOpenParams 读到 { result: 'success' }，调 toast.show('支付成功')
```

#### 流 3：卸载

```
用户 tap App Store → 切 "已装" tab
   ↓
ManagePage 订阅 installedUserAppsStore.apps
   ↓
列表渲染 [Todo, Shop, Wallet, ...]
   ↓
用户 tap 某行右侧 "-" 按钮
   ↓
UninstallConfirm 弹"卸载 Todo？同时清除所有数据"
   ↓
用户确认
   ↓
installer.uninstall('todo')
  → 清 app-meta / app-src / app-kv (by-app-id index 扫)
  → installedUserAppsStore.remove('todo')
  → appRegistry.unregister('todo')
   ↓
ManagePage 列表立即缩减
   ↓
Springboard 桌面图标消失
```

### 分阶段交付

| 阶段 | 内容 | 交付物 | 验收标准 |
|------|------|--------|---------|
| **S1** | Twind 集成 | `twindRuntime.ts` + 宿主集成点 | fixture app 中 `className="flex bg-red-500 p-4"` 渲染后 computed style 正确；宿主 shell 视觉无任何变化 |
| **S2** | App Store app + 上传页 | `AppStoreApp.tsx`, `UploadPage.tsx`, installer progress events | 桌面 tap App Store 图标 → 选 zip → 进度条显示 → 安装成功 → 回桌面看到新图标 |
| **S3** | 已装管理页 | `ManagePage.tsx`, `InstalledAppRow.tsx`, `UninstallConfirm.tsx` | 切到"已装" tab → 列表显示 → tap "-" → 确认 → 卸载完成 → 列表 + Springboard 同步更新 |
| **S4** | `@hiphone/nav` + `@hiphone/toast` | `sdk/nav.ts`, `sdk/toast.ts`, SDK index 更新 | user app 可 `open(appId, params)` + `useOpenParams` 读回；`toast.show(msg)` 触发系统 Toast；单元测试覆盖 |
| **S5** | E2E 验收 | shop/wallet 两个 fixture + e2e 测试 | 上传两个 app → 打开 shop → 点支付 → 跳 wallet 读到 params → 确认支付 → 跳回 shop → 读到结果 + toast → vitest 全程可重现 |

### Walking skeleton 保证

**每个 stage 末尾：**
- `pnpm test` 全绿（含既有 M1/M2 测试 + 本 stage 新增）
- `pnpm build` 通过（含 `tsc -b` 和 `vite build`）
- 手测验收清单（spec 每阶段定义的"验收标准"）可跑通

**绿基线维护：**
- S1 只加 Twind，不动 installer/SDK → 既有 M2 测试全绿
- S2 改 installer 仅叠加回调，不改语义 → 既有测试全绿
- S3 新增 UI，installer 已支持 uninstall → 既有测试全绿
- S4 新增 SDK 模块，不改既有 → 既有测试全绿
- S5 E2E 锁定全链路，暴露集成问题

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Twind 样式穿透到宿主 shell | 宿主视觉 regression | Twind `install({ prefix: '.user-app-root ' })` 生成的 CSS 带 scope；user app 根容器 className 加 `user-app-root`；视觉 regression 通过 stage-1 独立截图检查 |
| Twind 与 user app 自带的 `<style>` 冲突 | 样式优先级错乱 | user app 写 `<style>` 的 CSS 优先级天然高于 twind 注入的（twind 是类名选择器，`<style>` 内如果更 specific 会赢）；这符合常规 CSS 语义，不另行处理 |
| Deep Link 调用方传入不存在 appId | 调用 crash | `nav.open` 预检 `appRegistry.has(id)`，未注册时 `toast.show('App 未安装')` 且 return，不崩 |
| 连续 `open` 导致 openParams 错乱 | 目标 app 收到错误参数 | openParams 是 per-appId 的覆盖语义；M2 的 useOpenParams 已通过单测；M3 不改其语义 |
| 上传 UI 在 mobile WebView 体验差（`<input type=file>` 样式） | 用户体验打折 | M3 MVP 用原生 input 样式；后续（M5）按需改进；不 block M3 验收 |
| 拖拽区与 app 切换手势冲突 | 拖拽区吞掉下拉回桌面手势 | AppStoreApp 内部手势层不接管下拉（已有 Shell GestureLayer 机制）；拖拽只接管 drop 事件不接管 touch |
| 重装同 id 的 app | 数据丢失或错误合并 | M2 已定义为"升级"语义：覆盖 manifest + source，保留 app-kv；M3 UI 无需新逻辑，仅在 UploadPage 成功 toast 改成 "已更新：Todo" |
| 进度事件回调错漏阶段 | 进度条跳变或卡住 | installer 进度事件枚举封闭（5 个 stage + error）；UI 层兜底 "正在安装..." 文案；单测覆盖所有 stage 发一遍 |

## 测试计划

### 单元测试

**S1 Twind：**
- `twindRuntime.test.ts`
  - `ensureTwindInstalled` 幂等（多次调用仅 install 一次）
  - install 后 document.head 里有 twind style 标签
  - 失败时不抛（只 warn）

**S2 上传页：**
- `installer.progress.test.ts`
  - 每阶段发 progress 事件（unzip → validate → compile → persist → done）
  - 每事件 progress 在 [0, 1]
  - error stage 带 Error 对象
- `UploadPage.test.tsx`
  - mock installer → progress 回调依次触发 → 文案/百分比更新
  - 成功后 toast + 3 秒后自动清进度
  - 失败后 error toast + 保留 "重新选择" 按钮

**S3 管理页：**
- `ManagePage.test.tsx`
  - 订阅 `installedUserAppsStore.apps` → 列表渲染
  - tap "-" → `UninstallConfirm` 弹出
  - 确认 → `installer.uninstall` 被调 → 列表缩减
  - 取消 → 无副作用

**S4 SDK：**
- `nav.test.ts`
  - `open('known-id', {x:1})` → appRuntimeStore.openParams 写入 + activeAppId 切换
  - `open('unknown-id')` → toast + 不切 app
  - `goHome()` → activeAppId=null
- `toast.test.ts`
  - `show/warn/error` 分别调 `useToastStore.show` 的对应变体

### 集成测试（S5 E2E）

**`m3.e2e.test.ts`：**
1. 装 shop fixture → `installedUserAppsStore.apps` 含 `shop`
2. 装 wallet fixture → 列表含两个
3. render Springboard → 两个图标都可见
4. click shop → shop app 渲染
5. shop 内部触发 `open('wallet', { action: 'pay', amount: 100 })`
6. assert appRuntimeStore.openParams.wallet = 预期对象
7. assert activeAppId = 'wallet'
8. wallet 渲染 → 断言文案包含 "100"
9. wallet 内部触发 `open('shop', { result: 'success' })`
10. shop 重渲染 → `useOpenParams` 读到 result
11. shop 调 `toast.show('支付成功')`
12. assert `useToastStore` 状态变化

### 构建验证

- 每 stage `pnpm typecheck` + `pnpm test` + `pnpm build` 三件套
- M3 最终交付后，bundle size 变化 < +20 KB gzip（Twind ~12 KB + SDK ~3 KB + AppStore UI ~5 KB 估算）

## 验收标准

**完成 M3 后，以下流程全部可手工复现：**

1. 打开 hiPhone → 桌面第 0 页看到 App Store 图标
2. tap App Store → 进入，默认"上传" tab
3. 选一个 zip → 看到 "编译中 3/5..." 进度 → "✅ 已安装：Todo"
4. 返回桌面 → 新图标在 Springboard 中出现
5. 切回 App Store → 切 "已装" tab → 列表含 Todo
6. 上传 shop + wallet 两个 app
7. 打开 shop → 看到"购买宝剑 [100]"按钮
8. tap 按钮 → 跳 wallet 支付确认页，文案含"100"
9. wallet tap "确认" → 跳回 shop，toast 弹"支付成功"
10. 回 App Store → 已装页长按 shop → "-" → 确认 → shop 从桌面 + 管理页消失；Todo 和 wallet 不受影响

**回归标准：**
- M1 所有测试通过（架构 + Registry + Runtime）
- M2 所有测试通过（Installer + SDK + e2e）
- M3 新增测试通过
- `pnpm build` 产物可在 Chrome + Safari 桌面 + 移动浏览器打开，功能正常

## 与父 spec 的差异

父 spec 的 M3 列了 S1-S13 共 13 阶段；本 spec 实现其中的子集：

| 父 spec 阶段 | 本 spec | 位置 |
|---|---|---|
| S1: App Store UI 上传页 | ✅ | S2 |
| S2: App Store UI 已装管理页 | ✅ | S3 |
| S3: @hiphone/nav + Deep Link | ✅ | S4 |
| S4: @hiphone/fetch SDK | ❌ | 砍掉（见 Q2） |
| S5: @hiphone/ai 纯 AI | ⏸️ | M4 |
| S6: @hiphone/ai 角色对话 | ⏸️ | M4 |
| S7: @hiphone/toast SDK | ✅ | S4 |
| S8: 端到端验证 | ✅ | S5 |
| S9: AI App Builder V1 | ⏸️ | M4 |
| S10: AI App Builder 迭代 | ⏸️ | M4 |
| S11: Tool Registry + 内置工具迁移 | ⏸️ | M4 |
| S12: 用户 app 的 AI 工具注册 | ⏸️ | M4 |
| S13: AI 工具管理 UI | ⏸️ | M4 |
| （父 M2.S6）Twind | ✅ | S1 |
