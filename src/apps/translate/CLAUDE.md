# src/apps/translate/

翻译 App 的源码物理位置。每个 .tsx / .ts 文件被 `builtinUserApps.ts`
通过 Vite `?raw` import 拉成字符串塞进沙箱编译。同一份代码同时被
host vitest 直接当 module 引（用于 hook / pure-logic 单测）。

## 双重身份的代价
- 不能 `import` host 的内部模块（`@/system` / `@/platform` 都不行），
  只能 import 公开 SDK：`@hiphone/*` + `react` + `lucide-react`。沙箱
  resolver 不识别其他 specifier，编译时不报错但运行时抛 ReferenceError。
- 不能用 css module / scss — 只用 inline style + tailwind utility。
- 状态只用 `useState` / `useRef`，不引 Zustand。持久化走 `@hiphone/storage`。

## 单测约定
hook 和 pure logic 文件可以直接被 host 测试（`*.test.ts(x)` 走 vitest）。
组件级测试在 `src/platform/userApp/__tests__/` 用沙箱 smoke 跑（验证字符串
源能 compile + render，不抛错就算通过）。
