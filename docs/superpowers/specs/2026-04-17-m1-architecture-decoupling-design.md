# M1：架构解耦 + 最小运行时 —— 设计文档

> 父 spec: [2026-04-16-app-store-design.md](./2026-04-16-app-store-design.md)
> 对应里程碑: **M1**（App Store 需求的第一个里程碑）

## 概述

App Store 需求（父 spec）共 4 个里程碑。**M1 的唯一目标**是把 hiPhone 现有的"编译时写死 app"架构改造成"可以接入新 app"的插件式架构，并通过一个硬编码的假用户 app 验证整条加载管道（编译 → 沙箱 → 渲染）能跑通。

**M1 对用户是隐形的：** 所有现有内置 app 的行为、性能、代码路径完全不变；桌面上不会多任何新 app。M1 只在开发模式下暴露一个 `[DEV] 假用户 app` 图标，用于验证管道，生产构建自动剔除。

**M1 不做什么：**
- 不做 zip 上传、manifest 解析、IndexedDB 存储（M2）
- 不做用户 app 管理界面（M3）
- 不做完整 SDK（storage / fetch / AI / toast 都是后续里程碑）
- 不做多文件 app（M2 才有 moduleResolver）

## 用户需求

把 App Store 宏观需求（父 spec）落地的第一阶段。M1 完成后，我们具备：
- 一个统一的 App Registry，所有 app（内置 + 未来的用户 app）通过它登记和分发
- 一个可以把 TSX 字符串编译并安全执行的最小运行时
- 一个可以挂 hook 的生命周期信号系统（给未来 `@hiphone/hooks` 打基础）
- 一个可见的验证入口（dev-only），能看到 user app 管道确实跑通

这些是 M2 "用户 zip 上传 → 桌面出图标 → 点击运行" 的前置依赖，**必须先有 M1 才能做 M2**。

## 关键决策记录

四个决策通过 brainstorming 逐个敲定：

| 决策项 | 选择 | 理由 |
|-------|------|------|
| **Q1: S6 端到端验证的形态** | 桌面 dev-only 图标 + vitest（双轨） | 开发时肉眼可验证"点击 → 运行"完整路径；CI 有自动化防回归；M2 真实 installer 落地后可作为过渡入口 |
| **Q2: 生命周期信号实现** | Zustand state + 单调递增 nonce | 沿用现有 `appRuntimeStore` 架构，零新概念；hooks 用 `useEffect(cb, [nonce])` 订阅；测试可 snapshot |
| **Q3: Registry API 形态 + 内置 app 加载方式** | 内置 eager 不变，用户 app 异步；Registry 始终返回同步 component | M1 零回归风险（内置 app 完全不改加载行为）；React.lazy 的 bundle 收益放到后续按需优化；AppScene 不需要 Suspense |
| **Q4: S6 假 user app 复杂度** | 极简 "Hello"（NavBar + 一行文字） | M1 证明管道通即可；假 app 越简单越易定位问题；完整 demo app 放到 M2 有真 installer 之后 |

## 架构

### 目录结构

新增 `src/platform/userApp/`，这是 M1-M4 用户 app 能力的集中地：

```
src/platform/
├── appRegistry.ts                    # 【新】S1 — app 注册表单例
├── stores/
│   └── appRuntimeStore.ts            # 【改】S3 — 加生命周期 nonce
└── userApp/                          # 【新目录】用户 app 运行时
    ├── compiler.ts                   # S4 — Sucrase TSX→JS（按需动态 import）
    ├── sandbox.ts                    # S4 — Scope 注入 + new Function 执行
    ├── fakeUserApp.ts                # S6 — 硬编码的 TSX 字符串 + manifest
    ├── devIcon.ts                    # S6 — Dev 桌面图标注入（import.meta.env.DEV 守卫）
    └── sdk/
        ├── index.ts                  # S5 — 模块解析器（拦截 @hiphone/* import）
        ├── ui.ts                     # S5 — @hiphone/ui（M1 只暴露 NavBar）
        └── wrap.tsx                  # S5 — 系统自动 AppScreen 包裹

src/apps/
├── AppScene.tsx                      # 【改】S2 — 查 Registry 替代 if-else
└── registerBuiltins.ts               # 【新】S1 — 所有内置 app 的注册入口

src/shell/Springboard/
└── apps.data.ts                      # 【改】S6 — DEV 模式下追加假 app 图标
```

### S1：App Registry

```typescript
// src/platform/appRegistry.ts
import type { ComponentType } from 'react';

export interface AppRegistryEntry {
  id: string;
  type: 'builtin' | 'user';
  component: ComponentType;  // 始终同步可用
  /** 是否响应"查看他人手机"视角切换 */
  perspectiveAware: boolean;
  /** 查看别人手机时该 app 是否有共享数据（否则显示占位） */
  globalData: boolean;
}

class AppRegistry {
  private entries = new Map<string, AppRegistryEntry>();

  register(entry: AppRegistryEntry): void { /* 覆盖同 id 也允许（用户 app 更新用） */ }
  unregister(id: string): void { /* M2 卸载时调用 */ }
  get(id: string): AppRegistryEntry | undefined;
  list(): AppRegistryEntry[];
  has(id: string): boolean;
}

export const appRegistry = new AppRegistry();
```

**注册时机：**
- 内置 app 通过 `src/apps/registerBuiltins.ts` 在模块 import 时就自注册
- `registerBuiltins.ts` 由 `main.tsx` 或 `Device.tsx` 入口 import 触发
- 用户 app（M2+）在 install 成功后异步 register

**视角语义沉淀：**
当前 `AppScene.tsx` 里硬编码了两个 Set（`PERSPECTIVE_AWARE_APPS`、`GLOBAL_DATA_APPS`），S1 改造时这些信息挪到 Registry entry 的 `perspectiveAware` / `globalData` 字段里，不再维护 Set。

### S2：AppScene 改造

```typescript
// src/apps/AppScene.tsx（改造后骨架）
export function AppScene({ appId }: { appId: string }) {
  const { phoneOwnerId, isViewingOther } = usePerspective();
  const entry = appRegistry.get(appId);

  if (!entry) return <DemoApp appId={appId} />;  // 兜底

  if (isViewingOther && !entry.perspectiveAware && !entry.globalData) {
    return <ReadOnlyAppPlaceholder appId={appId} characterId={phoneOwnerId!} />;
  }

  const Component = entry.component;
  return <Component />;
}
```

**零回归保证：**
- 所有内置 app 的组件函数完全不改
- 渲染路径从 `<SettingsApp />` 变成 `<entry.component />`，运行时等价
- `ReadOnlyAppPlaceholder` 和 `PERSPECTIVE_AWARE_APPS`/`GLOBAL_DATA_APPS` 的语义通过 entry 字段保留
- DemoApp 兜底路径不变

### S3：生命周期信号

改造 `appRuntimeStore`，增加：

```typescript
interface AppEventNonces {
  launch: number;     // 全新启动（kill 后重开 or 首次开）
  resume: number;     // 从后台恢复到前台
  background: number; // 从前台进入后台
  kill: number;       // 上划被杀
}

interface AppRuntimeState {
  // ... 现有字段
  appEvents: Record<string, AppEventNonces>;
}
```

**发射规则（在现有状态转换点追加 emit）：**

| 现有方法 | 现有行为 | 追加信号 |
|---------|---------|---------|
| `openApp(id, origin)` | 打开 app（无论首次还是恢复） | 若之前 kill 过 → `launch++`；否则若之前 active → 忽略；否则 → `resume++` |
| `activateApp(id)` | 从 switcher 激活 | 若之前 kill → `launch++`；否则 `resume++` |
| `goHome()` / `exitAppToHome()` | 退回主屏幕，app 进后台 | 对被退出的 app：`background++` |
| `removeApp(id)` | 上划杀掉 app | `kill++`（同时保留现有 `_killedApps` Set，M1 两者共存，M2 可考虑合并） |

**兼容性：**
- `wasAppKilled(id)` 模块级 Set 继续存在，M1 不改现有消费者
- nonce 是**新增**字段，现有代码不看就不受影响
- 未来 `@hiphone/hooks` 的 `useOnLaunch` 内部：`useEffect(cb, [useAppRuntimeStore(s => s.appEvents[id]?.launch ?? 0)])`

### S4：编译器 + 沙箱

**编译器（`compiler.ts`）：**

```typescript
let sucrasePromise: Promise<typeof import('sucrase')> | null = null;

export async function compileTsx(source: string): Promise<string> {
  if (!sucrasePromise) sucrasePromise = import('sucrase');
  const { transform } = await sucrasePromise;
  const result = transform(source, {
    transforms: ['typescript', 'jsx', 'imports'],
    production: true,
  });
  return result.code;
}
```

- Sucrase 首次调用时才动态 import，不影响 hiPhone 启动速度
- M1 不做多文件模块解析（M2 做），只编译单个 TSX 字符串
- `transforms: ['imports']` 把 ES module import 转成 CommonJS 风格的 `require`，便于沙箱注入

**沙箱（`sandbox.ts`）：**

```typescript
export function executeSandboxed(
  compiledCode: string,
  moduleResolver: (specifier: string) => unknown,
): ComponentType {
  const blocked = {
    window: undefined, document: undefined, globalThis: undefined,
    fetch: undefined, localStorage: undefined, sessionStorage: undefined,
    indexedDB: undefined,
  };

  const module = { exports: {} };
  const require = moduleResolver;

  const fn = new Function(
    ...Object.keys(blocked),
    'module', 'exports', 'require', 'React',
    compiledCode,
  );

  fn(...Object.values(blocked), module, module.exports, require, React);
  return (module.exports as { default: ComponentType }).default;
}
```

- 遮蔽常见全局变量（软沙箱 L1，父 spec 已评估安全性）
- 注入 `require` 作为模块解析入口，转发给 SDK
- 假设用户代码 `export default MyApp` → 经 Sucrase `imports` transform 转成 `module.exports.default = MyApp`
- **注意**：Sucrase `imports` transform 会生成 `_interopRequireDefault` 调用以处理 ESM/CJS 互操作。模块解析器需要保证 `require('react')` 返回的对象带 `default` 属性（`{ default: React, ...React }`）或依赖 `__esModule: true` 标记——具体实现细节在 S4 plan 中确定

### S5：最小 SDK

**模块解析器（`sdk/index.ts`）：**

```typescript
const moduleMap: Record<string, unknown> = {
  'react': React,
  '@hiphone/ui': { NavBar },  // M1 只暴露 NavBar
};

export function resolveModule(specifier: string): unknown {
  if (specifier in moduleMap) return moduleMap[specifier];
  throw new Error(`Module not found in M1 SDK: ${specifier}`);
}
```

- M1 只支持 `react` 和 `@hiphone/ui`（NavBar 一个 export）
- 不支持的 import 直接抛错（M2 逐步扩展）

**AppScreen 自动包裹（`sdk/wrap.tsx`）：**

```typescript
export function wrapUserComponent(UserComp: ComponentType): ComponentType {
  return function WrappedUserApp() {
    return (
      <AppScreen>
        <UserComp />
      </AppScreen>
    );
  };
}
```

- 系统自动把用户组件塞进 `AppScreen`，用户无需手动包
- 调用点：user app 加载完成 → `wrapUserComponent(default)` → `appRegistry.register({ component: wrapped })`

### S6：假用户 app + Dev 桌面图标

**假 app 源码（`fakeUserApp.ts`）：**

```typescript
export const FAKE_USER_APP_SOURCE = `
import React from 'react';
import { NavBar } from '@hiphone/ui';

export default function FakeUserApp() {
  return (
    <div>
      <NavBar title="假用户 app" />
      <div style={{ padding: 20 }}>Hello from sandbox!</div>
    </div>
  );
}
`;

export const FAKE_USER_APP_ID = 'dev-fake-user-app';
```

**Dev 图标注入（`devIcon.ts`）：**

```typescript
// 在 main.tsx 或 Device.tsx 入口调用
export async function mountFakeUserAppIfDev() {
  if (!import.meta.env.DEV) return;

  const compiled = await compileTsx(FAKE_USER_APP_SOURCE);
  const Component = executeSandboxed(compiled, resolveModule);
  const wrapped = wrapUserComponent(Component);

  appRegistry.register({
    id: FAKE_USER_APP_ID,
    type: 'user',
    component: wrapped,
    perspectiveAware: false,
    globalData: true,  // 查别人手机时也显示（方便调试）
  });
}
```

**桌面图标（`apps.data.ts`）：**

```typescript
if (import.meta.env.DEV) {
  cnApps.push({
    id: FAKE_USER_APP_ID,
    name: '[DEV] 假用户 app',
    icon: '/resource/icons/dev-fake.svg',
    page: 1,
  });
}
```

- 生产 build 时 Vite 的 dead-code elimination 会剔除整个 DEV 分支
- 图标用一个简单占位 SVG（或现有某个图标）

## 交付清单

| 阶段 | 交付物 | 验收标准 |
|------|--------|---------|
| **S1** | `src/platform/appRegistry.ts`、`src/apps/registerBuiltins.ts`、单元测试 | 注册/查询/卸载/重复注册覆盖；所有内置 app 通过 `registerBuiltins` 登记 |
| **S2** | 改造后的 `AppScene.tsx`；删除两个 Set 硬编码 | 所有现有 app 测试通过；`PERSPECTIVE_AWARE_APPS`/`GLOBAL_DATA_APPS` 字段迁移到 Registry entry |
| **S3** | 改造后的 `appRuntimeStore`、单元测试 | launch/resume/background/kill nonce 在对应状态转换时递增；`wasAppKilled` 行为不变；covered by unit tests |
| **S4** | `compiler.ts`、`sandbox.ts`、单元测试 | 能编译一段 TSX 字符串；沙箱执行后能拿到导出的组件；全局变量被遮蔽（尝试访问 `window` 返回 `undefined`） |
| **S5** | `sdk/index.ts`、`sdk/ui.ts`、`sdk/wrap.tsx` | 用户代码里 `import { NavBar } from '@hiphone/ui'` 能解析到真实 NavBar；AppScreen 包裹后渲染包含状态栏安全区 |
| **S6** | `fakeUserApp.ts`、`devIcon.ts`、apps.data.ts DEV 分支；集成测试 | **开发模式**：桌面有 `[DEV] 假用户 app` 图标，点击后显示 `NavBar` + "Hello from sandbox!"；**生产 build**：dev 图标和代码被剔除（bundle 分析验证）；vitest 集成测试断言整条管道 |

## 测试计划

### 单元测试（vitest）

```
src/platform/__tests__/appRegistry.test.ts
  - register / get / has / list / unregister
  - 重复注册覆盖
  - unregister 不存在的 id

src/platform/stores/__tests__/appRuntimeStore.lifecycle.test.ts
  - openApp 首次 → launch++
  - openApp 从后台恢复 → resume++
  - goHome → background++
  - removeApp → kill++
  - wasAppKilled 行为不变（回归）

src/platform/userApp/__tests__/compiler.test.ts
  - 简单 TSX 编译成功
  - import 语句转换正确（es module → commonjs style）
  - 语法错误抛异常

src/platform/userApp/__tests__/sandbox.test.ts
  - 正确执行编译后的代码，返回 default export
  - 全局变量被遮蔽（code 尝试访问 window 得 undefined）
  - require('react') 返回真实 React 实例

src/platform/userApp/sdk/__tests__/resolver.test.ts
  - @hiphone/ui 解析到 NavBar
  - 未知模块抛错
```

### 集成测试

```
src/platform/userApp/__tests__/fakeUserApp.integration.test.ts
  - 调用 mountFakeUserAppIfDev()
  - 断言 appRegistry.has(FAKE_USER_APP_ID)
  - render(<AppScene appId={FAKE_USER_APP_ID} />)
  - 断言 DOM 包含 "Hello from sandbox!" 和 NavBar 元素
```

### 手工回归

- 逐个打开所有内置 app（settings / xingyu / notes / weather / maps / music / camera / safari / photos / calendar / gomoku），确认行为完全不变
- 查看他人手机时确认 PERSPECTIVE_AWARE_APPS 语义正确（xingyu/settings/notes 正常渲染，其他显示占位）
- 上划杀 app → 再次打开 → 确认 `wasAppKilled` 消费者（app 内部 reset 逻辑）仍然工作

### 生产 build 验证

- `pnpm build` 后运行 `grep -r "Hello from sandbox" dist/ || echo OK` 应输出 `OK`
- `grep -r "dev-fake-user-app" dist/ || echo OK` 应输出 `OK`
- 部署到 Cloudflare Pages（按 `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md` 流程）后访问 `https://mini-iphone.pages.dev/`，确认桌面无 `[DEV]` 图标

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| Sucrase 包太大拖慢首屏 | 启动变慢 | 按需动态 import；M1 开发模式才会触发首次编译，生产 build 中无调用点 |
| 沙箱能被轻易逃逸 | 恶意用户 app 访问宿主数据 | 父 spec 已评估：M1-M3 阶段语境下软沙箱足够（用户看不到宿主代码）；M4+ 可升级 iframe 沙箱 |
| Dev 图标被意外打进生产 | 用户看到莫名其妙的图标 | `import.meta.env.DEV` 守卫 + build 后 bundle 字符串扫描验证 |
| 内置 app 的 Perspective 语义迁移出错 | 查看他人手机时某些 app 显示异常 | S2 改造前先补一个针对 PERSPECTIVE_AWARE_APPS 行为的回归测试；迁移后确认测试通过 |
| S3 的 nonce 递增时机判断错误 | 生命周期事件乱序或漏发 | 列出所有现有状态转换路径的真值表（launch/resume/background/kill 4×多条路径），单元测试全覆盖 |

## 里程碑验收

**M1 完成 = 满足以下全部条件：**

1. 所有现有内置 app 的行为、性能、视觉 100% 不变（手工回归 + 单元测试）
2. App Registry 上注册了所有内置 app，AppScene 改为查表分发
3. `appRuntimeStore` 在 4 类状态转换时正确发射 nonce
4. 编译器能把硬编码 TSX 编译成可执行 JS
5. 沙箱能执行编译后的 JS 并返回 React 组件，遮蔽了常见全局变量
6. `@hiphone/ui` 的 NavBar 能被沙箱内的用户代码 import 到
7. **开发模式** 下桌面有 `[DEV] 假用户 app` 图标，点击后走完"Registry → 编译 → 沙箱 → 挂载组件"完整链路，显示 `Hello from sandbox!`
8. **生产构建** 中无任何 Dev 图标/假 app 代码
9. 所有 S1-S6 单元测试 + 集成测试绿灯
10. 部署到 Cloudflare Pages 验证通过（按 `docs/skills/hiphone-cloudflare-pages-deploy/SKILL.md`）

**计划文档：** 本设计文档之后，writing-plans skill 会在 `docs/plan/2026-04-17-HHMM-m1-architecture-decoupling.md` 产出逐阶段的具体实施计划（S1-S6 每个阶段的 TDD 步骤、涉及文件、验收检查单）。

达到这 10 条后，M1 宣告完成，进入 M2（完整安装流程 + 基础 SDK）。
