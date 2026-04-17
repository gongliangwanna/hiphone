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

## 已知 TODO / M2 要做

1. **ErrorBoundary in `wrapUserComponent`** —— 当前用户组件 render 抛错会冒泡到 device 根，白屏风险。M2 必须加 ErrorBoundary 在 wrap.tsx 里。
2. **Sucrase source maps** —— `compileTsx` 目前不生成 source map，用户看编译/运行错误时指向转换后代码而非原 TSX。M2 要把 map 接到 sandbox error 路径。
3. **ModuleResolver async?** —— 当前 `(specifier: string) => unknown` 是同步的。如果 `@hiphone/storage` 等需要异步加载，要先在此处决定：widen 到 `Promise<unknown>`（连带 sandbox 改异步），还是 "所有 SDK 都预加载，同步 resolve" 的策略。
4. **`mountFakeUserAppIfDev` 专项测试** —— 当前只测了内层 `mountFakeUserApp`。DEV-gated 包装 + try/catch 行为没被直接锁定。
5. **Race: apps.data DEV icon 在 `mountFakeUserAppIfDev` 完成前可被点击** —— 现象是会显示 DemoApp 兜底。M1 scope 内可接受；M2 可加 loading 占位。
6. **registerBuiltins 13 个重复调用** —— 如果 M2 要加 capability dimensions，改成 data-driven。
7. **`music-dock` / `safari-dock` 独立 entry** —— 与 non-dock 版本共用组件。可由 AppIcon 通过 prop 传递 source 消除重复。

## 踩坑记录

1. **Sucrase 的 `imports` transform 在所有模式下都会 drop 未引用的 import**（不只是 production 模式）。测试 "resolver errors propagate" 必须让 binding 被实际引用才能保留 `require()` 调用。
2. **`Object.hasOwn` 需要 ES2022 lib**，但 tsconfig 用 ES2020。在用到的地方本地 cast（见 `sdk/index.ts`）或用 `Object.prototype.hasOwnProperty.call`。
3. **Sucrase 的 `_interopRequireDefault` helper 会给 CJS 模块包一层 `{ default: obj }`**。sandbox 的 resolver 返回真实 React namespace，helper 判断 `__esModule` 决定是否包。测试正则匹配时要兼容 `React.createElement` 和 `_react2.default.createElement` 两种形式。
4. **Vite 生产构建下 `import.meta.env.DEV` 被静态替换为 `false`**，整个 DEV-gated 分支被 DCE。这意味着 `mountFakeUserAppIfDev` 的 Sucrase 动态 import 在生产下不存在，Sucrase 包也不会进 bundle。M2 要让 Sucrase 进生产 bundle 必须让某个非 DEV 路径调用它。

