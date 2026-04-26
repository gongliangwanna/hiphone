# 翻译 App 设计文档

**日期**：2026-04-26
**分支**：feat/m1-architecture
**状态**：spec — 待 plan 拆解

---

## 1. 用户需求

> 现在我们来做翻译 APP，完全按照用户 APP 的规格来制作，但是内置在系统中，不需要额外上传，翻译直接使用 AI 能力（不需要角色记忆）。
>
> 我们的目的一是做好这个 APP，二是验证用户 APP 的功能上限。

两个并列目标：

1. **交付一个 iOS 仿真度高的翻译工具**——文本输入 → AI 翻译 → 输出，带历史与收藏
2. **验证用户 APP 沙箱+SDK 的上限**——所有能用 SDK 解决的需求都用 SDK，发现的缺口主动补到 `@hiphone/*`，不绕道 import `@/system` / `@/platform`

## 2. 关键决策

### 2.1 实现路径：A — 真·用户 APP

翻译 App 的源码以 TSX 字符串形式存在，启动时走完整 `compile → sandbox → register` 管道，**生产环境也跑**。这意味着：

- 翻译 App 物理上等价于"用户上传的 App"，只是来源是项目内置 TSX 字符串
- Sucrase 必须进入生产 bundle（参见 §6 决策代价）
- 顺手解掉 CLAUDE.md 标注的"M2 才能让 Sucrase 进生产"的债：M2 AppStore 上传功能从此在生产闭环

### 2.2 功能范围：档位 2

- **核心**：双语种选择器（含交换）+ 多行输入 + AI 翻译输出 + 复制
- **历史**：最近 50 条，FIFO，按 (text, srcLang, tgtLang) 去重
- **收藏**：无上限，星标常用条目

不做：语音输入/朗读（档位 3）、对话模式 / 摄像头 OCR（档位 4）。这两块单独立项做更聚焦。

### 2.3 语种：A + C

- **A**：精选 10 种 + "自动检测"——中、英、日、韩、法、西、德、意、俄、阿拉伯
- **C**：底部 sheet 末尾"自定义……"入口，弹小抽屉自由输入语种名（如"古希腊语""文言文"），原样塞进 prompt 交给 AI

### 2.4 存储作用域：per-owner

每个角色（含玩家）拥有独立的翻译历史与收藏。压测 `@hiphone/storage` 的主路径。

### 2.5 SDK 缺口：仅新增 `@hiphone/motion`

经过沙箱实测，遮蔽列表是 `window / document / globalThis / fetch / localStorage / sessionStorage / indexedDB / XMLHttpRequest / WebSocket / Worker`。**未遮蔽** `navigator`、`console`、`setTimeout` 等。

| 原列表 | 重审后 |
|--------|--------|
| ~~`@hiphone/clipboard`~~ | 撤回，`navigator.clipboard.writeText` 直接用 |
| ~~`@hiphone/haptics`~~ | 撤回，`navigator.vibrate` 直接用 |
| ~~`@hiphone/ui` 补 TextArea/List re-export~~ | 撤回，用户用 JSX + Tailwind 自己写 |
| ~~`<SelectionSheet>`~~ | 撤回，用户用 motion + tailwind 自己拼 |
| **`@hiphone/motion`** | **保留**，`motion/react` 是裸 import 模块，必须走 SDK 白名单 |

`@hiphone/motion` 同时暴露稳定版的 spring 预设（从 `@/platform/design-tokens/motion` 镜像），避免每个用户 APP 重新调参。

## 3. 架构设计

### 3.1 注册管道

新增 `src/platform/userApp/builtinUserApps.ts`：

```ts
export interface BuiltinUserApp {
  id: string;
  name: string;
  files: Record<string, string>;  // path → TSX source
  entry: string;                  // 入口文件 path
  perspectiveAware: boolean;
  globalData: boolean;
}

export const BUILTIN_USER_APPS: BuiltinUserApp[] = [
  {
    id: 'translate',
    name: '翻译',
    entry: 'TranslateApp.tsx',
    files: {
      'TranslateApp.tsx': /* see §3.3 */,
      // ... 其他文件
    },
    perspectiveAware: true,   // per-owner 数据
    globalData: false,
  },
];

export async function mountBuiltinUserApps(): Promise<void> { /* ... */ }
```

**调用点**：`App.tsx` 启动序列，紧邻 `mountFakeUserAppIfDev()`。生产/开发都跑。

**实现复用**：`createUserAppRuntime`（已在 `moduleResolver.ts` 实现，支持多文件 import）。

### 3.2 Springboard 接入

`src/shell/Springboard/apps.data.ts` 已有 `{ id: 'translate', name: '翻译', icon: ..., page: 0 }`，无需新增；只需确保 `mountBuiltinUserApps` 在 `apps.data` 渲染前完成（或加 loading 占位，参考 `mountFakeUserAppIfDev` 的 race 处理）。

### 3.3 翻译 App 内部结构（沙箱内的多文件）

```
TranslateApp.tsx                 入口、整体布局、状态机
panels/SourcePanel.tsx           源文本输入面板（多行 textarea + 清空）
panels/TargetPanel.tsx           译文展示面板（loading + 复制 + 收藏）
selectors/LangBar.tsx            顶部语种选择条 + 中央交换按钮
selectors/LangSheet.tsx          底部弹起选择器（精选 10 + 自定义入口）
selectors/CustomLangInput.tsx    自由输入语种的二级抽屉
recents/RecentsSheet.tsx         历史 sheet
recents/FavoritesSheet.tsx       收藏 sheet
recents/RecentRow.tsx            一行历史/收藏 ListRow（自绘）
hooks/useTranslate.ts            ai.complete 调用 + AbortController + 错误
hooks/useHistory.ts              storage 读写 + 去重 + cap
constants/languages.ts           精选 10 个语种 ISO 元数据
```

### 3.4 SDK 新增 `@hiphone/motion`

```ts
// src/platform/userApp/sdk/motion.ts
export {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useSpring,
  useAnimate,
} from 'motion/react';

// 镜像 design-tokens/motion 的稳定 spring 预设
export const springs = {
  bouncy: { type: 'spring', stiffness: 400, damping: 17, mass: 1 },
  snappy: { type: 'spring', stiffness: 500, damping: 35 },
  gentle: { type: 'spring', stiffness: 200, damping: 25 },
} as const;
```

加进 `sdk/index.ts` 的 `moduleMap`（key: `'@hiphone/motion'`），单测覆盖 export 表面 + 未知子路径抛错。

`springs` 的具体参数与 `@/platform/design-tokens/motion` **物理同步**（用 `as const` 镜像，加单测对比两边相等），未来 token 变了 SDK 也能跟上。

### 3.5 AI Prompt 策略

单次 `ai.complete()` 调用，messages 结构：

```ts
[
  {
    role: 'system',
    content:
      `You are a professional translator. ` +
      `Translate the user's text from ${SOURCE_LANG_NAME} to ${TARGET_LANG_NAME}. ` +
      `Output ONLY the translation—no quotes, no commentary, no language labels. ` +
      `Preserve formatting (line breaks, lists). If input is empty, output empty.` +
      (sourceIsAuto ? ' Detect the source language automatically.' : ''),
  },
  { role: 'user', content: sourceText },
]
```

- `temperature: 0.3`（翻译稳定性优先）
- 自由输入语种：直接把字符串塞进 `${SOURCE_LANG_NAME}` / `${TARGET_LANG_NAME}`
- "auto" 源语种：上述追加一行指令
- 无重试。`ai.complete` 抛错 → toast 显示

### 3.6 存储 Schema（per-owner）

两个 key：

```ts
// key: "history"
type HistoryEntry = {
  id: string;          // crypto.randomUUID
  sourceText: string;
  targetText: string;
  sourceLang: string;  // ISO code 或自由文本
  targetLang: string;
  ts: number;
};

// key: "favorites"
type FavoriteEntry = HistoryEntry & { favoritedAt: number };
```

- 历史 cap 50，FIFO，按 `(sourceText, sourceLang, targetLang)` 去重——命中则把旧条目提到表头而非新增
- 收藏无上限
- 写入路径：每次成功翻译 → 写历史；用户点星标 → 写/删收藏
- 加载路径：进入 sheet 时一次性 `storage.get`

### 3.7 关键交互与动效（iOS 对标）

| 交互 | 行为 | 动效（用 `springs.*` 预设） |
|------|------|---------------|
| 输入文本 | 实时绑定 state | 无 |
| 点"翻译" | loading → 结果 | TargetPanel 字符 staggered fadeIn (`gentle`) |
| 交换语种 | 源/目标互换 + 文本互换 | 中央交换按钮 180° 旋转 (`bouncy`) + 两侧 panel cross-fade |
| 选语种 | 底部 sheet | y 100% → 0 (`snappy`) |
| "自定义..." | 二级抽屉 | y 100% → 0 (`snappy`)，sheet 上层叠加 |
| 复制 | clipboard | 按钮 scale 1→1.15→1 (`bouncy`) + `navigator.vibrate(10)` + toast |
| 收藏 | 星标切换 | 星 scale 1→1.3→1 + 颜色过渡 |
| 历史/收藏 sheet | 同语种 sheet | 同 |
| 删历史 | 滑动删除 | x → -100% + height collapse |

iOS 一致性细节：

- 字号：标题 17pt 半粗、正文 17pt 常规、placeholder 系统灰
- 颜色：全部走 `var(--color-systemBackground)` / `var(--color-label)` / `var(--color-systemBlue)` 等 CSS 变量
- 圆角：sheet 16px、卡片 12px、按钮 10px
- 毛玻璃：sheet 顶部抓手栏不强求 backdrop-filter（CLAUDE.md 限制只在 `system/Material/`），用 SDK 已暴露的色值搭配阴影即可

### 3.8 错误处理

| 失败模式 | 行为 |
|---------|------|
| `AIUnavailableError` | toast "请先在设置里配置 AI" + 翻译按钮禁用 |
| AI 网络/超时 | toast 错误 message，保留输入框内容 |
| `AbortError`（用户切语种或离开页面） | 静默忽略 |
| storage 读失败 | history/favorites 显示空，控制台 warn |
| storage 写失败 | toast "保存失败"，UI 不阻塞 |

## 4. 测试策略

### 4.1 单测

- `sdk/motion.ts`：`resolveModule('@hiphone/motion')` 返回 `motion` / `AnimatePresence` / `springs.*` 等预期 export，未知子路径抛错
- `springs` 与 `@/platform/design-tokens/motion` 数值同步测试
- `builtinUserApps.ts`：`mountBuiltinUserApps()` 注册成功 + 失败时降级（catch 不影响其他 app）
- `useTranslate`（独立 hook 测试，mock `ai.complete`）：成功路径、错误路径、abort
- `useHistory`：mock `storage.*`，验证 cap、去重、收藏增删
- `constants/languages.ts`：10 个语种 ISO 元数据完整性

### 4.2 集成测试

沙箱里编译运行翻译 App 的 smoke test：

- 编译不报错（Sucrase 拿到完整源码）
- 渲染 NavBar + SourcePanel + LangBar
- 打开语种 sheet → 选中一项 → sheet 关闭 + LangBar 文字更新
- mock `ai.complete` 返回 "Hello" → 点翻译 → TargetPanel 显示 "Hello" + 历史多一条

### 4.3 生产构建验证

`pnpm build` 后：

- `dist/assets` 目录里 grep 到 sucrase chunk（证明 Sucrase 进了生产 bundle）
- bundle 总大小报告（确认增量在 ~50KB gzipped 量级，超出则需 plan 阶段排查）
- 启动 `pnpm preview`，桌面找到"翻译"图标，能开能关，能完成一次翻译流程

## 5. 里程碑拆解（指引性，由 plan 阶段细化）

按 §3 模块大致 5 个阶段：

1. **S1**：SDK `@hiphone/motion` 落地 + 单测
2. **S2**：`builtinUserApps.ts` 注册管道 + Sucrase 进生产构建（不依赖翻译 App 内容，先打通管道，可用最小 placeholder TSX 验证）
3. **S3**：翻译 App 核心—LangBar / SourcePanel / TargetPanel / `useTranslate`，端到端跑通一次翻译
4. **S4**：LangSheet（精选 10）+ CustomLangInput（自定义）+ 交换动效
5. **S5**：history + favorites + RecentsSheet/FavoritesSheet + 完整动效打磨

每阶段对应一个 plan 文档（`docs/plan/yyyy-mm-dd-hhmm-translate-sX-*.md`）。

## 6. 决策代价 / 取舍记录

### 6.1 Sucrase 进生产 bundle

- 代价：~40-60KB gzipped、首屏 TTI 多几十毫秒
- 收益：A 路径成立 + M2 AppStore 上传功能从此真生产可用 + 用户 APP 上限验证有真实样本

### 6.2 内置 App 走沙箱管道而非系统 App

- 代价：开发体验比 Settings/XingYu 更糟（TSX 在字符串里，IDE 高亮不友好；Sucrase 编译多一道）
- 收益：项目目标"验证用户 APP 上限"的硬性要求；将来用户从 AppStore 装的 App 走完全相同的代码路径

### 6.3 SDK 极简：除 motion 外不补 UI 组件

- 代价：用户 APP 自己拼 TextArea / List / Sheet，每个 App 都要重写一遍
- 收益：证明用户 APP 不需要被宿主 UI 组件库绑架；SDK 表面收窄，未来重构成本低
- 风险：iOS 视觉一致性靠"开发者自觉"——靠的是 CSS 变量 + tailwind 风格约定，不是组件锁定

## 7. 不做的事

- 语音输入 / TTS 朗读（档位 3）
- 对话模式（双向实时听写）
- 摄像头 OCR / 拍照取词（档位 4）
- 离线翻译 / 本地模型
- 全选/部分选中翻译
- 翻译记忆（不同于角色记忆，是行业术语指 segment-level translation memory）
- 跨设备同步（IDB 本来就是本地）
