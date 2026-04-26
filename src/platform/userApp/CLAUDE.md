# src/platform/userApp/ — User App Runtime

用户 app 执行管道：TSX 字符串 → 编译 → 沙箱执行 → 注册到 appRegistry → 被 AppScene 渲染。

## 文件结构

```
compiler.ts       TSX → CJS JS（Sucrase 按需动态 import）
sandbox.ts        new Function + 遮蔽全局 + 注入 require/React/module/exports
fakeUserApp.ts    M1 DEV-only 硬编码 TSX 源（M2 后可考虑拆到独立 fixtures）
devIcon.ts        mountFakeUserApp (pipeline runner) + mountFakeUserAppIfDev (DEV-gated entry)
sdk/
  index.ts        resolveModule — 用户 app import 白名单（M1: react + @hiphone/ui）
  ui.ts           @hiphone/ui — 从 @/system 再导出给用户 app
  wrap.tsx        wrapUserComponent — 系统自动用 AppScreen 包裹用户组件
```

## 安全边界（L1 软沙箱）

- **目的**：防止用户 app 通过常见全局变量（window/document/fetch/localStorage...）访问宿主数据
- **手段**：`new Function(...shadowedNames, compiledCode)` 用参数名遮蔽全局
- **不是**：对抗性安全边界。逃逸路径存在（`constructor.constructor('return this')()` 等）
- **语境**：M1-M3 用户不看宿主代码，无动机也无信息去 hack
- **升级路径**：M4+ 可加 L2 iframe 沙箱，接口已为此预留（ModuleResolver 可跨 iframe 序列化）

详见 parent spec `docs/superpowers/specs/2026-04-16-app-store-design.md` §4。

## 扩展 SDK 的规则

往 `sdk/index.ts` 的 `moduleMap` 加新模块时：

1. **包名必须是 `@hiphone/xxx`**（保留的命名空间，用户 app 不会自己去 npm 装同名包）
2. **新增一个 `sdk/xxx.ts` 文件**承载该 module 的 export surface，而不是直接 re-export 第三方包
3. **re-export 原则**：只暴露稳定 API，内部实现保留修改自由度
4. **加对应 test**：`resolveModule('@hiphone/xxx')` 返回带预期 export 的对象 + 未知子模块抛错

**禁止**：直接把宿主 store/hook 塞进 moduleMap。用户 app 应该通过结构化 SDK 入口消费能力（如 `@hiphone/storage`），不能直接拿到 Zustand store 引用。

## Perspective 感知（M2 起生效）

M1 的 `mountFakeUserApp` 注册时 `globalData: false` —— 这**模拟典型用户 app 的 per-owner 数据行为**，而非"全局"。M2 真实 installer 应从 manifest 读 `perspectiveAware` 字段。

## 已落地的架构决策

- **ErrorBoundary in `wrapUserComponent`** (M1 follow-up, commit `315af97`). 用户组件 render 抛错由 `UserAppErrorBoundary` 接住 + 渲染 iOS 风格的 "App crashed" fallback，不冒泡到 device 根。`componentDidCatch` 把 stack log 到 console，配合下面的 source maps 可在 devtools 看到原始 TSX 位置。
- **Sucrase source maps** (M1 follow-up, commit `30f013c`). `compileTsx` 在编译结果末尾追加 base64 inline sourceMappingURL，browser devtools 自动把 stack trace 映射回原 TSX。零运行时成本，不引入 source-map 库。`compileTsx(source, filePath?)` 新增可选 filePath 参数，threads 到 source map 的 `sources` 字段（`devIcon` 用 `'fake-user-app.tsx'`）。
- **Built-in user apps via `builtinUserApps.ts`** (S2). 内置 App 如翻译走与上传 App 完全相同的 compile→sandbox→register 链路，注册时 `type: 'builtin'` 防卸载，不进 `installedUserAppsStore` 因此 App Store 不显示。这是用户 APP SDK 上限验证的核心样本。
- **Built-in user apps source layout via Vite `?raw`** (S3). 内置 user app 的源码物理上在 `src/apps/<id>/`，享受 IDE / TS / ESLint。`builtinUserApps.ts` 用 `?raw` query 把每个文件读成字符串塞进沙箱编译。同一份源既可被 host vitest 直接 import 测 hook / pure logic，又能塞进沙箱跑组件级 smoke 测试，**避免双份维护**。
- **ModuleResolver stays synchronous** (M1 follow-up, commit `10beecb`). Rationale:
   - Sucrase-compiled user code does `const x = _interopRequireDefault(require('react'))` — the `require` call is synchronous. Making it async would require the sandbox function itself to be async, cascading into user code changes (they'd need to `await require()` which Sucrase doesn't emit).
   - Future SDK surfaces that have async IO (like `@hiphone/storage` backed by IDB) expose async **methods** (`await storage.get('key')`), not async imports. The module namespace itself is always sync-resolvable.
   - If ever needed, we'd pre-resolve: statically scan compiled code for `require(...)` calls, preload async dependencies into an in-memory map, then inject a sync resolver that reads from the cache. Deferred until proven necessary.

## 已知 TODO / M2 要做

1. **`mountFakeUserAppIfDev` 专项测试** —— 当前只测了内层 `mountFakeUserApp`。DEV-gated 包装 + try/catch 行为没被直接锁定。
2. **Race: apps.data DEV icon 在 `mountFakeUserAppIfDev` 完成前可被点击** —— 现象是会显示 DemoApp 兜底。M1 scope 内可接受；M2 可加 loading 占位。
3. **registerBuiltins 13 个重复调用** —— 如果 M2 要加 capability dimensions，改成 data-driven。
4. **`music-dock` / `safari-dock` 独立 entry** —— 与 non-dock 版本共用组件。可由 AppIcon 通过 prop 传递 source 消除重复。

## 踩坑记录

1. **Sucrase 的 `imports` transform 在所有模式下都会 drop 未引用的 import**（不只是 production 模式）。测试 "resolver errors propagate" 必须让 binding 被实际引用才能保留 `require()` 调用。
2. **`Object.hasOwn` 需要 ES2022 lib**，但 tsconfig 用 ES2020。在用到的地方本地 cast（见 `sdk/index.ts`）或用 `Object.prototype.hasOwnProperty.call`。
3. **Sucrase 的 `_interopRequireDefault` helper 会给 CJS 模块包一层 `{ default: obj }`**。sandbox 的 resolver 返回真实 React namespace，helper 判断 `__esModule` 决定是否包。测试正则匹配时要兼容 `React.createElement` 和 `_react2.default.createElement` 两种形式。
4. **(S2 已解决)** Vite 生产构建下 `import.meta.env.DEV` 被静态替换为 `false`，整个 DEV-gated 分支被 DCE。M1 阶段这导致 Sucrase 不进生产 bundle。**S2 后**：`mountBuiltinUserApps()` 在 `App.tsx` 启动序列里**无条件**调用 `compileTsx`，把 Sucrase 拉进生产 chunk graph。验证脚本：`pnpm verify:prod-sucrase`。

## SDK 表面（截至 2026-04-26）

| 模块 | 来源 | 说明 |
|------|------|------|
| `react` | host React | 完整命名空间 |
| `lucide-react` | host lucide | 完整图标库 |
| `@hiphone/ui` | `sdk/ui.ts` | NavBar |
| `@hiphone/ai` | `sdk/ai.ts` | complete / streamComplete / chatWithCharacter |
| `@hiphone/storage` | `sdk/storage.ts` | per-owner + global KV |
| `@hiphone/perspective` | `sdk/perspective.ts` | useCurrentOwner / getCurrentOwner |
| `@hiphone/hooks` | `sdk/hooks.ts` | 跨层 React hook |
| `@hiphone/nav` | `sdk/nav.ts` | 应用内导航 |
| `@hiphone/toast` | `sdk/toast.ts` | show |
| `@hiphone/banner` | `sdk/banner.ts` | 顶部横幅 |
| `@hiphone/services` | `sdk/services.ts` | 服务注册 |
| `@hiphone/motion` | `sdk/motion.ts` | motion/react 表面 + design-token spring/duration/ease |

新增 `@hiphone/motion` 的动机：用户 APP 写 iOS-fidelity 动效需要 motion/react，
但裸 import 在沙箱里会被 resolveModule 拒绝。motion/react 在 host 已经被 bundle，
re-export 是零额外成本。spring/duration/ease 直接 re-export 自
`@/platform/design-tokens/motion`，不复制数值，token 演进自动跟随。

