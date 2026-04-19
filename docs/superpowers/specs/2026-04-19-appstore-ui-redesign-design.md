# App Store UI/UX 重设计

**日期**：2026-04-19
**范围**：保留现有安装/更新/卸载功能，按 iOS App Store 视觉语言重做 UI 层
**不在范围**：应用商店浏览（Today / 分类），远端 app 仓库，搜索

---

## 1 · 背景

当前 App Store (`src/apps/AppStore/`) 功能完整但视觉粗糙：
- 双 tab 切分（上传 / 已装）像后台管理页，非 iOS 范式
- 上传完成只显示 `✅ 已安装: xxx`，进度条是线性灰色条
- 已装行只展示 `id: xxx`，缺版本、大小、时间
- 卸载用全屏模态 iOS dialog，已装按钮常驻右侧（减号图标）
- 无"发现同 id → 需确认再升级"的保护环节；用户误选错 zip 会静默覆盖
- 大量 inline style，违反项目规范（Tailwind 优先）

**目标**：还原 iOS 真机 App Store "已购" 页的观感，同时保护"防手滑升级"，为未来承载更多元数据（详情页）打地基。

## 2 · 设计决策（经 brainstorming 确认）

| 维度 | 决策 | 关键原因 |
|---|---|---|
| 整体布局 | 单页 · iOS 大标题 · 右上"+" · 主体是已装列表 | iOS App Store "已购"页范式；上传是低频动作，不占视口 |
| 上传入口 | 半屏 Sheet（iOS modal sheet，带 handle） | 原生模式，对齐 Files.app / Photos.app |
| 上传流程 | 4 状态机：初始 → 安装中 → (可选)更新确认 → 完成 | 每状态各占一张卡片，仪式感递进 |
| 更新流程 | 检测同 id → 暂停 → 版本对比卡 + [取消][更新] | 防手滑；数据不清除文案明示 |
| 行信息 | 图标 · 版本 · 大小 · 相对时间 | 替换现在的"ID: xxx" |
| 行操作 | 主视图只有"打开"按钮 + 左滑卸载 + 长按 Context Menu | 两种手势不冲突：左滑快卸载，长按给详情 |
| 空状态 | 大系统图标 + 标题 + 一句话 + CTA 按钮 | 把第一次上传引导做到位 |
| 拖拽 | 整页作为 drop target（桌面拖 zip 到 App Store 任意位置触发） | 桌面用户的自然路径 |

Mockup 保存在 `.superpowers/brainstorm/*/content/`（layout-v2.html, sheet-flow-v2.html, row-and-empty-v2.html）。

## 3 · 架构

```
AppStoreApp (container — 单页，替换现在的双 tab)
├── NavBar (系统大标题 "App Store" + 尾部 "+" 按钮 → 打开 UploadSheet)
├── 页面 drop target layer（透明全屏 overlay，接收 zip）
├── InstalledList  OR  EmptyState（二选一）
│   └── InstalledAppRow × N
│       ├── 主视图 [图标 | 名称·版本·大小·相对时间 | "打开"]
│       ├── 左滑手势 → 露出"卸载"红色 action
│       └── 长按手势 → AppContextMenu（浮层）
├── UploadSheet (modal sheet)
│   └── state 机：idle / installing / needsUpgradeConfirm / success / error
└── AppDetailSheet (模态 — 从 Context Menu 的"查看详情"打开)
```

**文件布局变动**：

```
src/apps/AppStore/
├── AppStoreApp.tsx                    重写 — 去掉 tab，改为单页
├── components/
│   ├── InstalledList.tsx              新 — 分组列表 + section header
│   ├── InstalledAppRow.tsx            重写 — 版本/大小/时间 + 左滑 + 长按
│   ├── EmptyState.tsx                 新 — 首次空状态引导
│   ├── UploadSheet.tsx                新 — 半屏 sheet + 内部状态机
│   │   └── views/
│   │       ├── DropZoneView.tsx       初始态（拖放区）
│   │       ├── InstallProgressView.tsx 圆形进度环 + 阶段文字
│   │       ├── UpgradeConfirmView.tsx 版本对比 + [取消][更新]
│   │       ├── InstallSuccessView.tsx 大勾 + [继续][打开]
│   │       └── InstallErrorView.tsx   红叉 + 错误摘要 + [查看详情][重试]
│   ├── AppContextMenu.tsx             新 — 长按浮层菜单
│   ├── AppDetailSheet.tsx             新 — manifest 全量信息
│   └── SwipeRow.tsx                   新 — 左滑行手势容器（可复用）
└── __tests__/
    └── *.test.tsx                     组件测试 + 集成测试

src/apps/AppStore/UploadPage.tsx       删除（并入 UploadSheet）
src/apps/AppStore/ManagePage.tsx       删除（并入 AppStoreApp）
src/apps/AppStore/components/UninstallConfirm.tsx  删除（左滑手势替代）
```

## 4 · 关键组件规格

### 4.1 AppStoreApp（主容器）

- 使用 `@/system/AppScreen` + `@/system/NavBar`
- NavBar 尾部槽位放 "+" 按钮（`lucide-react` 的 `Plus` 图标，蓝色 pill 容器 44×44，满足 HitArea）
- 点 "+" 或拖 zip 到任意位置 → 打开 UploadSheet
- 已装数 0 → 渲染 `<EmptyState>`；否则 `<InstalledList>`
- 页面级 drop handler 监听 dragover/drop，拖入时整页有半透明蓝色边框高亮（需区别于 Sheet 内部拖放）

### 4.2 InstalledAppRow

字段：
- **iconDataUrl** — 有则 img；无则系统默认图标（蓝色渐变）
- **name** — 17pt / 500 weight
- **version** — 来自 manifest.json
- **sizeBytes** — 解压后编译产物的总大小；格式化为 "2.3 MB" / "512 KB"
- **installedAt** — 相对时间（"今天" / "2 天前" / "上周" / "4 月 12 日"）

数据源：扩展 `installedUserAppsStore.InstalledUserApp`：

```ts
// src/platform/stores/installedUserAppsStore.ts
export interface InstalledUserApp {
  id: string;
  name: string;
  iconDataUrl: string | null;
  page: number;
  perspectiveAware: boolean;
  // NEW
  version: string;          // 来自 manifest.version
  installedAt: number;      // 来自 app-meta.installedAt（已存在，未透出到 store）
  sizeBytes: number;        // 新增 — install 时计算编译产物总字节数
}
```

这些字段 `installer.ts` 装配 AppMeta 时就能取到，但目前没写进 IDB + store。

交互：
- **点行任意位置 / 点 "打开" 按钮** → 打开 App（与桌面点图标等价）。"打开"按钮只是视觉亲和性的指示，整行都是大命中区
- **左滑** → 通过新的 `<SwipeRow>` 容器展开红色"卸载"action（92px 宽，触达 > 44）。点击 → 直接调 `uninstall(id)`（不再弹 UninstallConfirm 对话框，手势已经是确认动作）
- **长按 500ms** → 通过 `useLongPress`（若项目无此 hook，新增到 `src/platform/gesture/`）触发 `<AppContextMenu>`
- 手势互斥：长按进入识别后取消左滑；左滑位移 > 阈值后取消长按

### 4.3 AppContextMenu

iOS 13+ 范式：
- 半透明毛玻璃 backdrop (`<Material>` 组件，backdrop-filter 只能来自它)
- 浮层定位：原行向上浮起，顶部显示当前行的缩略卡（icon + name + version）
- 菜单 item：
  - **打开**（默认样式 + `ArrowUpRight` 图标）
  - **查看详情** → 关闭菜单、打开 AppDetailSheet (`Info` 图标)
  - **卸载**（destructive 红色 + `Trash2` 图标）
- 点菜单外区域关闭；haptic feedback（若 `@hiphone/haptics` 存在，否则先跳过）

### 4.4 AppDetailSheet

半屏模态（与 UploadSheet 同样尺寸），展示：
- Hero 区：大图标 + name + version
- 信息段落（iOS 分组列表样式）：
  - Bundle ID
  - 版本 / 大小 / 安装时间
  - 入口路径 (manifest.entry)
  - 内嵌文件数 / sha（便于 debug）
  - Perspective-aware: 是/否
- 底部：[卸载] destructive 按钮（走和左滑一样的 `uninstall(id)`）

### 4.5 UploadSheet 状态机

```
state =
  | { phase: 'idle' }
  | { phase: 'installing'; file: File; event: InstallProgressEvent }
  | { phase: 'needsUpgradeConfirm'; file: File; existing: InstalledUserApp; incoming: ManifestPreview }
  | { phase: 'success'; result: InstallResult; appName: string; isUpgrade: boolean }
  | { phase: 'error'; error: InstallError; canRetry: boolean }
```

每个 phase 渲染一个 View 组件，父 Sheet 只负责 handle + title + phase 切换。

### 4.6 installer.ts 改造

**新增升级确认回调**（向后兼容，老调用方不受影响）：

```ts
// src/platform/userApp/installer.ts
export interface InstallOptions {
  onProgress?: (event: InstallProgressEvent) => void;
  /**
   * 若提供：在 manifest 校验完成但写入前，检测到同 id 已装时调用。
   * 返回 false → 中止安装（抛 InstallError('user-cancelled')，不算失败）
   * 返回 true → 继续升级
   * 未提供 → 保持当前行为（自动升级）
   */
  onUpgradeDetected?: (info: {
    existing: InstalledUserApp;
    incoming: { id: string; name: string; version: string };
  }) => boolean | Promise<boolean>;
}

export type InstallErrorKind =
  | 'bad-zip' | 'bad-manifest' | 'id-conflict' | 'entry-missing'
  | 'compile' | 'uninstall-builtin' | 'io'
  | 'user-cancelled';  // NEW
```

在 installer.ts 现有的 line ~126 `isUpgrade = !!existing && existing.type === 'user'` 之后插入回调。UploadSheet 从 `installing` 过渡到 `needsUpgradeConfirm`，`onUpgradeDetected` 返回一个 Promise，在用户点"更新"或"取消"时 resolve。

### 4.7 进度环（InstallProgressView）

SVG 圆环，conic-gradient 驱动百分比。阶段映射：

| stage | 显示文字 | progress base |
|---|---|---|
| unzip | "正在解压…" | 0–15% |
| validate | "校验 manifest…" | 15–20% |
| compile N/M | "编译 N/M" + "filename" | 20–90% |
| persist | "写入本地存储…" | 90–100% |

将 `InstallProgressEvent.progress` 按阶段权重映射到 0–1 全局百分比，避免进度跳跃。

### 4.8 成功/错误 View

- **SuccessView**：大勾（spring 动画从 scale 0 → 1.1 → 1），标题 "已安装 {name}" 或 "已更新到 {version}"，副标题 "桌面的 {name} 已刷新"。按钮：[继续安装 secondary][打开 App primary]。点"打开"走桌面打开 App 的现有通道。
- **ErrorView**：大红叉 + 错误文案（按 `InstallError.kind` 分档）：
  - `bad-zip` → "这个 zip 打不开"
  - `bad-manifest` → "manifest.json 格式不对"
  - `id-conflict` → "ID 与内置 App 冲突，无法安装"
  - `entry-missing` → "入口文件找不到"
  - `compile` → "编译失败：{filename}"
  - `io` → "存储出错，请重试"
  - `user-cancelled` → 直接关 Sheet 回 idle，不显示错误
- 按钮：[查看详情 secondary]→展开 error.message 全文；[重试 primary]→回到 idle（保留上次文件选择）

### 4.9 EmptyState

- 中心布局（justify: center）
- `ArrowDownToLine` lucide icon 在蓝色渐变方块里（104×104）
- 标题"还没装 App"
- 副标题"上传一个 zip 包体验你自己的 user app，或拖拽文件到任意位置自动安装。"
- CTA "上传 zip" → 打开 UploadSheet

## 5 · 数据流

```
用户点 "+" 或拖入 zip
  → AppStoreApp setState { uploadSheetOpen: true, pendingFile?: File }
  → UploadSheet 挂载，若有 pendingFile 直接进 installing
  → installer.install(file, {
       onProgress: e => setPhase({ installing, event: e }),
       onUpgradeDetected: ({ existing, incoming }) => new Promise(resolve => {
         setPhase({ needsUpgradeConfirm, ..., resolve });
       }),
     })
  → installer 完成 → setPhase(success)
  → 点"打开" → close sheet + 跳桌面打开 App
  → 点"继续" → reset 到 idle
```

`installedUserAppsStore` 在 installer 完成后已经由现有路径更新（`mountUserApp` → `addInstalledApp`），列表自动重渲染。

## 6 · 错误处理

| 场景 | UI 反馈 |
|---|---|
| Zip 损坏 / manifest 非法 / 编译失败 | ErrorView，对应文案，[重试]可改文件再试 |
| 内置 app id 冲突 | ErrorView（red），文案"ID 与系统 App 冲突，改一个 id 再试"，无[重试] |
| 用户在"更新确认"点取消 | 静默关闭 Sheet（不走 ErrorView） |
| 卸载失败（IDB 异常） | 顶部 toast（`@/system/Banner` 若存在，否则加到 AppStoreApp 一个简单的顶部提示条） |
| 已装数据加载中 | Sheet 不显示"打开"按钮前的空窗期可接受；AppStoreApp 本身不加 skeleton（loadInstalledApps 很快） |

## 7 · 视觉 token 对齐

- 字号：遵循 `src/platform/design-tokens` 现有命名。大标题 34 / 行标题 17 / 元信息 13
- 颜色：`--color-systemBlue` / `--color-systemRed` / `--color-label` / `--color-secondaryLabel`
- 圆角：Sheet 顶 14、卡片 14、行按钮 16、大图标 20、行图标 13
- 动画 spring：从 `@/platform/design-tokens/motion` import，严禁自定义

## 8 · 样式规范

**必须使用 Tailwind utility**（项目规范），只有 transform/transition 可以 inline。不允许直接写 `backdrop-filter`，毛玻璃背景统一用 `<Material>` 组件（src/system/Material/）。所有图标来自 `lucide-react`，禁止手画 SVG（进度环的 conic-gradient 圆可以 CSS 实现，勾/叉图标走 lucide `Check`/`X`）。

## 9 · 测试计划

新增/修改测试文件：

| 测试 | 覆盖点 |
|---|---|
| `__tests__/AppStoreApp.test.tsx` | 空状态渲染；"+"按钮打开 Sheet；drop event 触发 Sheet |
| `__tests__/InstalledAppRow.test.tsx` | 字段渲染；左滑手势（pointer events + jsdom polyfill）；长按触发菜单 |
| `__tests__/UploadSheet.test.tsx` | 4 个 phase 渲染；进度事件映射；升级回调 resolve 正确 |
| `__tests__/UpgradeConfirmView.test.tsx` | 同 id 检测 → 显示版本对比 → 点击"更新"resolve(true) / "取消"resolve(false) |
| `__tests__/installer.upgradeCallback.test.ts` | installer 新增的 `onUpgradeDetected` 回调在检测到同 id 时调用；返回 false 抛 user-cancelled；返回 true 继续 |
| `__tests__/integration.install.test.tsx` | e2e：拖 zip → sheet 全流程 → store 更新；升级路径完整 |

测试风格遵循项目现有 vitest + jsdom 约定。**手势测试须用 `useRef` 管理 isDragging 避免 React state 异步问题**（见 src/CLAUDE.md 踩坑记录 4）。

## 10 · 迁移 & 兼容

- 老的 `installedUserAppsStore.InstalledUserApp` 增加三个字段 — 需要在 `loadInstalledApps()` 重建 store 时从 `app-meta`（已有 `installedAt`，新加 `sizeBytes` + `version`）填充
- 没这些字段的老数据：`version` 回退 `'1.0.0'`、`sizeBytes` 回退 0（显示 "—"）、`installedAt` 保留现有。无需数据迁移脚本，渐进填充
- `installer.install()` 签名向后兼容（`onUpgradeDetected` 可选）
- 现有 `UninstallConfirm` 组件删除；如被其他地方引用，搜索后一起清理

## 11 · 阶段拆分（给 writing-plans）

这个 spec 预计切成 3 个 plan：

1. **P1 · installer 改造 + store schema 扩展** — 新增字段、升级回调、测试。纯逻辑层，不影响 UI。
2. **P2 · 主屏重构 + 左滑卸载 + 空状态** — AppStoreApp / InstalledList / InstalledAppRow / SwipeRow / EmptyState。
3. **P3 · UploadSheet 完整状态机 + 长按菜单 + 详情 Sheet** — 视觉仪式感密集区，最后做。

## 12 · 不在范围（明确排除）

- 远端 app 商店 / 搜索 / 分类浏览
- 自动更新（项目无远端，无法实现）
- 订阅 / 付费 / 评分评论
- 国际化（目前中文写死，与项目现状一致）
- iPad/桌面宽视口特化（AppStore 运行在 PhoneFrame 里，尺寸受 viewportProfile 约束）
