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

## S4：sheet 接线
- LangSheet：精选 10 + auto + 自定义入口；点击行 → onPick 回调；点击 backdrop → onClose
- CustomLangInput：二级抽屉，构造 `{ code: 'custom:<text>', ... }` Language，code 前缀供 S5 历史区分
- 关闭手势 deferred：M2 SheetGesture 是 system 层，沙箱拿不到；点击 backdrop / 取消按钮已经够 iOS-fidelity

## S5：历史 + 收藏

### 存储 schema（`@hiphone/storage` per-owner namespace）
| 键 | 类型 | 说明 |
|---|---|---|
| `history` | `HistoryEntry[]` | 最多 50 条，FIFO 超出即删最旧；表头为最新 |
| `favorites` | `FavoriteEntry[]` | 无上限，星标即加，再点星即移出 |

**去重 key**：`"${sourceText}|${srcLang.code}|${tgtLang.code}"`。命中时保留原 id，提到表头，更新 targetText + ts。

### HistoryEntry 存完整 Language 对象（非仅 code）
Spec 字面写 `sourceLang: string`，但显示行需要 `.native`，自定义语种又要保留 name。决定存完整 `{ code, name, native }` 对象，避免双向 lookup。偏离 spec 字面，符合 spec 意图。

### Favorite 通过 id 关联 History
- `FavoriteEntry.id` 与 `HistoryEntry.id` 一一对应
- history cap 50 挤出老条目时，**favorite 不受影响**（收藏无上限）
- 取消收藏靠点星（移出 favorites 数组），不删除历史记录

### 左滑删除 —— 仅 history 行
- `motion.div drag="x"` + `dragConstraints={{ left: -88, right: 0 }}` 露出红底"删除"按钮
- 点删除按钮 → 从 history 移除 + storage.set 持久化
- 收藏 sheet 的行**不接 onDelete**，取消收藏靠点星

### 踩坑：持久化 ref 与 React 批量更新
`useHistory` 中 `historyRef.current = history` 在渲染时同步，但同一 act() 内多次 `addEntry` 连续调用时 React 批量 state 导致 ref 落后。解决：在 `persistHistory` 内**提前更新 ref**（`historyRef.current = next`），确保下一次 addEntry 读到最新数组。
