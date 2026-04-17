# App Store — 用户可上传 App 的开放平台

## 概述

为 hiPhone 添加 App Store 功能，允许开发者编写 React TSX 代码，打包成 zip 上传到小手机中安装运行。支持本地上传和远程商店两种安装方式。

## 需求背景

当前 hiPhone 的 app 系统是编译时强绑定的：

- 所有 app 在 `AppScene.tsx` 中静态 import + if-else 路由
- 所有 app 元数据硬编码在 `apps.data.ts` 中
- 新增 app 必须修改源码并重新构建

**目标：** 让用户（开发者）无需修改 hiPhone 源码，通过上传文件即可创建并运行自定义 app。

## 核心决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 目标用户 | 开发者（懂 React/JS） | 需要写真正的 TSX 代码 |
| 编译方式 | 运行时编译（Sucrase） | 最灵活，无需构建流程；Sucrase ~120KB，编译速度快 |
| 安全模型 | L1 软沙箱（Scope 注入） | 通过遮蔽全局变量 + 注入 SDK 实现隔离；用户看不到宿主代码，实际安全性足够；可渐进升级到 iframe 沙箱 |
| 文件格式 | 多文件 zip 包 | 支持复杂 app 结构，含 manifest.json + 多个 TSX + 资源文件 |
| 商店形态 | 本地上传 + 远程商店 | 本地上传做 MVP，远程商店提供社区分享能力 |
| SDK 范围 | 完整（UI + 存储 + 网络 + AI + 通知） | 最大化用户 app 能力 |
| 数据隔离 | 双层隔离（app + perspective） | hiPhone 有"查看他人手机"能力，AI 与玩家逻辑上是两部手机。用户 app storage 自动按 `phoneOwnerId` 再加一层命名空间，沿用系统现有 `EntityStoreRegistry` 机制。详见 §8 |
| AI 工具注册 | App 注册制（替代硬编码工具清单） | 内置 + 用户 app 统一向 AI 贡献工具；heartbeat 启动时从所有已安装 app 汇总；用户可在设置里按 app 开关 AI 的工具权限。详见 §9 |

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                        hiPhone Device                           │
│                                                                 │
│  ┌──────────────────────┐    ┌────────────────────────────────┐ │
│  │     Springboard       │    │         App Store App          │ │
│  │  [内置app] [用户app]  │    │  [远程商店]       [本地上传]    │ │
│  └──────────┬───────────┘    └──────────┬─────────────────────┘ │
│             │                           │                       │
│             ▼                           ▼                       │
│  ┌──────────────────────┐    ┌─────────────────────────┐       │
│  │    App Registry       │    │     App Installer        │       │
│  │  内置 apps (静态)     │◀───│  解压 zip → 校验 manifest │       │
│  │  用户 apps (IDB)      │    │  → 存储 → 注册 → 上桌面  │       │
│  └──────────┬───────────┘    └─────────────────────────┘       │
│             │                                                   │
│             ▼                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    App Runtime                            │   │
│  │  [Compiler/Sucrase] → [Sandbox/Scope注入] → [SDK注入]    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Storage Layer (IndexedDB)                    │   │
│  │  app-sources/ | compiled-cache/ | app-data/ | app-meta/  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 核心模块

#### 1. App Registry（应用注册表）

替代现有 `AppScene.tsx` 的静态 if-else 路由，统一管理内置 app 和用户 app。

```typescript
// 概念接口
interface AppRegistryEntry {
  id: string;
  type: 'builtin' | 'user';
  // builtin: () => Promise<{ default: ComponentType }>
  // user: 从 IndexedDB 加载源码 → 编译 → 返回组件
  load: () => Promise<ComponentType>;
}
```

- 内置 app 通过 `React.lazy(() => import('./Settings/SettingsApp'))` 注册
- 用户 app 通过 `loadUserApp(id)` 注册（从 IDB 读取 → 编译 → 沙箱执行）
- `AppScene` 改为查询 Registry 获取组件，而非 if-else

#### 2. App Installer（应用安装器）

处理 app 的安装流程：

1. 接收 zip 文件（本地上传）或 URL（远程下载）
2. 使用 JSZip 解压
3. 校验 `manifest.json` 格式和必填字段
4. 将源文件存入 IndexedDB `app-sources` store
5. 将 manifest 元数据存入 `app-meta` store
6. 注册到 App Registry
7. 在 Springboard 添加图标（动态扩展 `apps.data.ts` 的数据源）

#### 3. App Compiler（编译器）

基于 Sucrase 的运行时 TSX→JS 编译器：

- 懒加载 Sucrase（仅在安装或首次打开时加载，~120KB gzip）
- 支持多文件模块解析：解析 import 语句 → 构建依赖图 → 按拓扑序编译
- 编译结果缓存到 IndexedDB `compiled-cache` store
- 源码未变时跳过编译，直接使用缓存

**多文件模块解析策略：**

```
App.tsx: import { TodoList } from './components/TodoList'
         import { formatDate } from './utils'

解析步骤:
1. 正则提取 import 语句中的路径
2. 解析相对路径（支持 ./xxx, ./xxx.tsx, ./xxx/index.tsx）
3. 构建依赖图，拓扑排序
4. 按序编译每个文件，注册到模块表
5. 提供自定义 require() 从模块表中查找
```

#### 4. App Sandbox（沙箱）

L1 级别的软沙箱，通过 Scope 注入实现：

```typescript
function executeSandboxed(compiledCode: string, sdk: AppSDK) {
  const blockedGlobals = {
    window: undefined,
    document: undefined,
    globalThis: undefined,
    fetch: undefined,       // 通过 sdk.fetch 替代
    localStorage: undefined,
    sessionStorage: undefined,
    indexedDB: undefined,   // 通过 sdk.storage 替代
  };

  const fn = new Function(
    ...Object.keys(blockedGlobals),
    'sdk', 'React',
    compiledCode
  );

  return fn(...Object.values(blockedGlobals), sdk, React);
}
```

**安全性评估：**
- 遮蔽了常见的全局变量访问路径
- 理论上可通过 `constructor.constructor('return this')()` 绕过
- 在此项目语境下足够：用户看不到宿主代码，无动机也无信息去 hack
- 架构上预留了升级到 L2（iframe 沙箱）的空间

#### 5. SDK Provider

SDK 采用 **import 风格**，用户通过 `@hiphone/*` 命名空间和标准包名导入，开发体验与正常 React 项目一致。

**设计原则：**
- 系统自动用 AppScreen 包裹用户组件（处理状态栏安全区），用户无需手动包裹
- `@hiphone/ui` 是可选的 iOS 风格组件库，不是必须的框架约束
- 用户可以完全不用 `@hiphone/ui`，自由编写纯 HTML/CSS 界面

**模块解析器映射表：**

```typescript
// ── 宿主已有依赖（零额外成本，已在内存中） ──
'react'        → 宿主 React 实例
'react-dom'    → 宿主 ReactDOM 实例
'motion'       → framer-motion 动效库
'zustand'      → 状态管理
'lucide-react' → 图标库
'clsx'         → class 合并工具
'date-fns'     → 日期处理

// ── @hiphone/* 平台 SDK 模块 ──
'@hiphone/ui'          → AppScreen, NavBar, List, ListSection, ListRow,
                          Material, Toast, Toggle, Slider, TextArea,
                          WheelPicker, DateTimePicker
'@hiphone/storage'     → get, set, remove, list（per-app + per-perspective 双层隔离；详见 §8）
'@hiphone/fetch'       → 受控的网络请求
'@hiphone/ai'          → AI 能力（消费：纯 AI + 角色对话 + 心跳；供给：向 AI 注册工具。详见下方 AI SDK 章节 + §9）
'@hiphone/toast'       → Toast 通知
'@hiphone/nav'         → 打开其他 app、返回主屏幕、Deep Link 参数传递
'@hiphone/hooks'       → 平台生命周期 hooks（useOpenParams 等）
'@hiphone/perspective' → 查询当前视角（玩家 or 查看某角色手机）；详见 §8

// ── 不暴露的宿主依赖 ──
// leaflet / react-leaflet — 太专用（地图 app）
// @tiptap/* — 太专用（备忘录 app）
```

**用户 App 示例代码：**

```tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Star } from 'lucide-react';
import { NavBar, List, ListRow } from '@hiphone/ui';
import { get, set } from '@hiphone/storage';
import { complete } from '@hiphone/ai';
import { Header } from './Header';  // zip 包内自己的文件

// 不需要 AppScreen 包裹 — 系统自动处理
export default function MyApp() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    get('items').then(data => data && setItems(data));
  }, []);

  return (
    <div>
      <NavBar title="我的App" />
      <List>
        {items.map(item => (
          <ListRow key={item.id} title={item.name} leading={<Heart size={20} />} />
        ))}
      </List>
    </div>
  );
}
```

**样式方案：** 引入 Twind（运行时 Tailwind 引擎，~13KB gzip）。用户可以：
- 使用 Tailwind class：`className="flex gap-4 p-4 rounded-xl"`
- 使用 inline style：`style={{ display: 'flex', gap: 16 }}`
- 混合使用

Twind 按需为用户 app 中的 Tailwind class 动态生成 CSS，与宿主构建时 Tailwind 互不干扰。

**存储隔离：** 双层命名空间，SDK 层透明加前缀：

- **App 层：** `userapp:{appId}:` 前缀，app 之间互不干扰
- **Perspective 层：** 因为 hiPhone 支持"查看他人手机"（AI 和玩家逻辑上是两部手机），同一 app 的数据再按 `phoneOwnerId` 加一层前缀
  - 玩家视角：`userapp:{appId}:owner:me:{key}`
  - 查看角色 `char-001` 时：`userapp:{appId}:owner:char-001:{key}`

底层沿用系统现有的 `EntityStoreRegistry` 机制，不需要动态创建 IndexedDB object store。不希望按视角隔离的全局数据（如 app 自身配置）通过 `globalGet/globalSet` 跳过 perspective 层。详细设计见 §8。

**App 间通信：Deep Link 模式**

采用类 iOS URL Scheme 的跳转通信，app 之间通过打开对方并传参交互：

```tsx
// 商场 app — 发起支付
import { open } from '@hiphone/nav';

function buyItem() {
  open('wallet', {
    action: 'pay',
    amount: 100,
    reason: '购买道具剑',
    callback: 'shop',      // 处理完跳回哪个 app
  });
}

// 钱包 app — 接收参数并处理
import { useOpenParams } from '@hiphone/hooks';
import { open } from '@hiphone/nav';

export default function WalletApp() {
  const params = useOpenParams();  // { action: 'pay', amount: 100, ... }

  const handleConfirm = () => {
    deductBalance(params.amount);
    open(params.callback, { result: 'success', amount: params.amount });
  };

  if (params?.action === 'pay') {
    return <PaymentConfirmPage amount={params.amount} onConfirm={handleConfirm} />;
  }
  return <NormalWalletUI />;
}
```

**用户可见流程：** 商场 → 跳转钱包 → 用户确认支付 → 跳回商场。与真实手机上的支付宝收银台体验一致。

**设计要点：**
- `open(appId, params?)` — 打开目标 app 并传入参数
- `useOpenParams()` — 目标 app 读取调用方传入的参数
- 所有交互对用户可见（app 切换），确保安全性（用户可确认/取消）
- 不需要目标 app 预先在运行，打开即可

#### 5.2 AI SDK 详细设计（`@hiphone/ai`）

AI 是 hiPhone 的核心系统能力。`@hiphone/ai` 是**双向**的：app 既可以**消费** AI（让 AI 为自己打工），也可以**供给** AI（把自己的能力注册成工具，让 AI 代用户操作 app）。本节描述消费侧；供给侧（工具注册）详见 §9。

SDK 消费侧分两层：纯 AI（与角色无关）和角色 AI（带人设和记忆）。

**设计原则：**
- 开发者不感知 token 数量、模型提供商、API 端点 — 这些是系统配置
- 提供流式和非流式两种接口
- 角色对话支持写入记忆和不写入记忆
- 多模态预留（当前文本，未来扩展图片/语音/视频）

```typescript
// ═══════════════════════════════════
// 第一层：纯 AI 能力（与角色无关）
// ═══════════════════════════════════

// 非流式 — 一次性返回完整结果
complete(
  messages: Message[],
  options?: CompletionOptions
): Promise<string>

// 流式 — 逐 token 回调
stream(
  messages: Message[],
  onToken: (token: string) => void,
  options?: CompletionOptions
): Promise<void>

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
  // 未来扩展:
  // image?: string;
  // audio?: string;
}

interface CompletionOptions {
  temperature?: number;
  // 不暴露: model, provider, apiKey, maxTokens, endpoint
}

// ═══════════════════════════════════
// 第二层：角色对话（带人设 + 记忆）
// ═══════════════════════════════════

// 非流式
chatWithCharacter(
  characterId: string,
  messages: Message[],
  options?: CharacterChatOptions
): Promise<string>

// 流式
streamWithCharacter(
  characterId: string,
  messages: Message[],
  onToken: (token: string) => void,
  options?: CharacterChatOptions
): Promise<void>

interface CharacterChatOptions {
  persistent?: boolean;   // 默认 false
                          // true: 对话写入角色记忆，影响后续所有对话
                          // false: 临时对话，用完即弃
  temperature?: number;
}

// ═══════════════════════════════════
// 角色查询
// ═══════════════════════════════════

getCharacters(): CharacterInfo[]

interface CharacterInfo {
  id: string;
  name: string;
  avatar: string;
  description: string;
}

// ═══════════════════════════════════
// 角色心跳（自定义工具和提示词）
// ═══════════════════════════════════

triggerHeartbeat(
  characterId: string,
  options?: HeartbeatOptions
): Promise<HeartbeatResult>

interface HeartbeatOptions {
  systemPrompt?: string;        // 追加到角色人设后的自定义提示词
  tools?: ToolDefinition[];     // 自定义工具
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;  // JSON Schema
  execute: (params: any) => Promise<string>;
}

interface HeartbeatResult {
  actions: { tool: string; params: any; result: string }[];
}

// ═══════════════════════════════════
// 未来预留：Agent 封装
// ═══════════════════════════════════
// createAgent(options): Agent
// 提供易用的 ReAct agent 封装，避免用户重复造轮子
```

**使用示例：**

```tsx
import { complete, stream, chatWithCharacter, getCharacters } from '@hiphone/ai';

// 纯 AI — 翻译工具
const translated = await complete([
  { role: 'system', content: '你是翻译助手' },
  { role: 'user', content: '翻译: Hello World' },
]);

// 纯 AI 流式 — 实时打字效果
await stream(
  [{ role: 'user', content: '写一首诗' }],
  (token) => setText(prev => prev + token),
);

// 角色对话（不写入记忆）
const reply = await chatWithCharacter('char-001', [
  { role: 'user', content: '今天心情怎么样？' },
]);

// 角色对话（写入记忆，角色会记住）
await chatWithCharacter('char-001', [
  { role: 'user', content: '明天一起去看电影吧' },
], { persistent: true });
```

**内部实现映射：**
- `complete/stream` → 直接调用 `chatComplete` / `streamChat`，使用系统 aiConfigStore 配置
- `chatWithCharacter/streamWithCharacter` → 调用 `assemblePrompt` 构建三段式 prompt → 调用 AI API
- `getCharacters` → 读取 `characterStore`
- `triggerHeartbeat` → 调用 heartbeatAgent，注入自定义 tools 和 systemPrompt

#### 5.3 生命周期 SDK 详细设计（`@hiphone/hooks`）

React 的 mount/unmount 不等于 app 生命周期。在 hiPhone 中，返回主屏幕时组件卸载（unmount），但 app 并未"关闭"——再次打开时应恢复上次状态。开发者用 `useEffect` 无法区分"首次打开"和"从后台恢复"。SDK 需要弥合这个语义鸿沟。

**生命周期状态：**

```
首次打开 / kill 后重开          返回主屏幕            再次打开
     launching ──▶ active ──▶ background ──▶ resuming ──▶ active
                                  ▲                        │
                                  └────────────────────────┘
                                  │
                             上划关闭(kill)
                                  │
                                  ▼
                            killed(全新启动)
```

**API：**

```typescript
// ── 感知当前状态 ──
useAppState(): 'launching' | 'active' | 'resuming'

// ── 生命周期回调 ──

useOnLaunch(callback: () => void)
// 全新启动时触发（首次打开 or kill 后重开）
// 类比 iOS viewDidLoad / Android onCreate
// 适合：初始化状态、加载持久化数据

useOnResume(callback: () => void)
// 从后台恢复到前台时触发
// 类比 iOS viewWillAppear / Android onResume
// 适合：刷新数据、补上后台流逝时间

useOnBackground(callback: () => void)
// app 进入后台时触发（返回主屏幕）
// 类比 iOS viewDidDisappear / Android onPause
// 适合：保存草稿、暂停计时器

useOnKill(callback: () => void)
// app 被上划关闭时触发
// 类比 iOS applicationWillTerminate / Android onDestroy
// 适合：清理资源、保存最终状态

// ── Deep Link 参数 ──
useOpenParams(): Record<string, any> | null

// ── 跨后台保留的内存状态 ──
useAppMemory<T>(key: string, initial: T): [T, (val: T) => void]
// 类似 useState，但：
//   - 返回主屏幕后值保留（后台不丢失）
//   - kill 后自动重置为 initial
//   - 纯内存，不写入 IndexedDB（比 storage 快）
```

**使用示例：**

```tsx
import React from 'react';
import { useOnLaunch, useOnResume, useOnBackground, useAppMemory } from '@hiphone/hooks';
import { get } from '@hiphone/storage';

export default function TimerApp() {
  const [seconds, setSeconds] = useAppMemory('seconds', 0);
  const [isRunning, setIsRunning] = useAppMemory('isRunning', false);

  useOnLaunch(() => {
    // 全新启动 — 从持久存储加载历史
    get('history').then(data => { /* ... */ });
  });

  useOnResume(() => {
    // 从后台恢复 — 补上流逝的时间
    if (isRunning) {
      const elapsed = Date.now() - pausedAt;
      setSeconds(s => s + Math.floor(elapsed / 1000));
    }
  });

  useOnBackground(() => {
    // 进入后台 — 记录暂停时间点
    pausedAt = Date.now();
  });

  return (/* timer UI */);
}
```

**与 iOS/Android 对照：**

| hiPhone SDK | iOS | Android | 触发时机 |
|-------------|-----|---------|---------|
| `useOnLaunch` | `viewDidLoad` | `onCreate` | 全新启动 |
| `useOnResume` | `viewWillAppear` | `onResume` | 后台恢复 |
| `useOnBackground` | `viewDidDisappear` | `onPause` | 进入后台 |
| `useOnKill` | `applicationWillTerminate` | `onDestroy` | 被关闭 |
| `useAppMemory` | ViewController 属性 | ViewModel | 跨后台保留的内存状态 |

**内部实现：** 系统在 `appRuntimeStore` 中发出生命周期信号（`launch` / `resume` / `background` / `kill`），SDK hooks 内部监听这些信号并触发对应回调。

#### 6. App Store UI

作为内置 app（id: `app-store`，已在 `apps.data.ts` 注册），提供：

- **远程商店页** — 浏览/搜索远程仓库中的 app，一键下载安装
- **本地上传页** — 文件选择器上传 zip，显示安装进度
- **已安装页** — 展示用户已安装的 app 列表，支持卸载/更新
- **App 详情** — 名称、描述、作者、版本、权限列表、截图

**远程商店后端：** 使用 GitHub 仓库作为 app 分发源。仓库结构：

```
hiphone-app-store/
├── index.json          ← app 列表索引
├── apps/
│   ├── todo-app/
│   │   ├── manifest.json
│   │   └── todo-app.zip
│   ├── calculator/
│   │   ├── manifest.json
│   │   └── calculator.zip
│   └── ...
```

App Store 通过 GitHub raw URL 获取 `index.json`，展示可用 app 列表。

#### 7. AI App Builder（AI 应用生成器）

内置 app，用户通过聊天描述需求，AI 自动生成 app 代码并安装。

**用户流程：**

```
用户: "帮我做一个计算器"
  ↓
AI 理解需求 → 生成 manifest.json + App.tsx（+ 可能的子文件）
  ↓
自动编译验证 → 如果报错则 AI 自动修复
  ↓
调用 Installer 安装 → 桌面出现图标
  ↓
用户: "加一个历史记录功能"
  ↓
AI 读取现有代码 → 修改 → 重新安装（更新）
```

**核心设计：**

- **System Prompt 注入 SDK 文档** — AI 需要知道 `@hiphone/ui`、`@hiphone/storage` 等全部 SDK API 才能生成正确的代码
- **编译验证环节** — 生成的代码先过一遍 Sucrase 编译，如果报错则将错误信息回传给 AI 自动修复
- **迭代式开发** — 保留对话历史，用户可以追加需求，AI 在已有代码上修改
- **代码可见** — 用户可以查看/编辑 AI 生成的源码（学习 + 微调）

**两个阶段：**

| 阶段 | 实现方式 | 能力 |
|------|---------|------|
| **V1（简单版）** | 单轮 `complete()` 调用 | 一句话生成整个 app；编译不过则重试 1-2 次 |
| **V2（Agent 版）** | ReAct Agent + 工具链 | 多步推理；自动拆分文件；自动测试；读取现有 app 代码修改 |

**V2 Agent 工具集（未来）：**

```typescript
tools = [
  { name: 'createFile',   description: '创建或覆盖一个文件' },
  { name: 'readFile',     description: '读取已有文件内容' },
  { name: 'compile',      description: '编译当前所有文件，返回成功/错误信息' },
  { name: 'install',      description: '打包并安装到桌面' },
  { name: 'listSDK',      description: '查询可用的 SDK API 文档' },
]
```

#### 8. 数据隔离与 Perspective SDK

hiPhone 支持"查看他人手机"——玩家可以切换视角查看某个 AI 角色的手机（消息、朋友圈、便签等都是该角色自己的）。**逻辑上 AI 和玩家的数据分属不同的两部手机**，这是系统层面已经存在的设计（见 `src/platform/hooks/usePerspective.ts` + `src/platform/storage/entityStoreRegistry.ts`）。

**用户 app 必须尊重这个隔离。** 否则 AI 角色用"计算器"存的历史会和玩家混在一起，"待办事项"里玩家会看到角色的 todo。

##### 8.1 双层命名空间

所有 `@hiphone/storage` 的读写由 SDK 层透明加**两层前缀**：

```
userapp:{appId}:owner:{phoneOwnerId}:{用户key}
         │                │
         │                └── 'me' (玩家) 或 'char-xxx' (某角色)
         └── app 之间隔离
```

**示例：** 某 todo app 在玩家视角存 `items`，在查看 `char-001` 的手机时也存 `items`，对应的 IDB key 分别是：
- `userapp:todo-app:owner:me:items`
- `userapp:todo-app:owner:char-001:items`

两份数据完全独立。app 代码无感知——调用 `set('items', ...)` 即可，系统根据当前 `phoneOwnerId` 自动路由。底层沿用系统现有的 `EntityStoreRegistry` 机制。

##### 8.2 绕过 perspective 层（全局数据）

少数数据是 app 自己的全局配置（如主题、语言偏好），不应该按视角分开。SDK 提供逃生出口：

```typescript
import { get, set, globalGet, globalSet } from '@hiphone/storage';

await set('items', [...]);          // 按 perspective 隔离
await globalSet('theme', 'dark');   // 跨 perspective 共享
```

底层 key：
- `set('items', ...)` → `userapp:todo-app:owner:me:items`
- `globalSet('theme', ...)` → `userapp:todo-app:global:theme`

##### 8.3 `@hiphone/perspective` SDK

App 需要感知当前视角时用：

```typescript
import { useCurrentOwner, getCurrentOwner } from '@hiphone/perspective';

function MyApp() {
  const { ownerId, ownerName, isViewingOther } = useCurrentOwner();
  // ownerId: null (玩家) | 'char-001' (某角色)
  // isViewingOther: true 表示正在看别人的手机

  return (
    <NavBar title={isViewingOther ? `${ownerName} 的待办` : '我的待办'} />
  );
}
```

内部实现直接包 `usePerspective()` hook，不引入新状态。

##### 8.4 `perspectiveAware` 字段

用户 app 在 manifest 里声明是否参与 perspective 切换：

- `perspectiveAware: true` — app 会响应视角切换，storage 按 owner 隔离，组件随视角切换 re-mount
- `perspectiveAware: false`（默认）— 查看角色手机时显示只读占位（与系统内置 app 的 `PERSPECTIVE_AWARE_APPS` 白名单外行为一致）

**默认 false 的理由：** 大多数新手开发者不会一开始就考虑视角隔离；默认关闭后看到占位会意识到需要显式开启，避免数据污染事故。

##### 8.5 卸载时的清理

卸载 app 时按 `userapp:{appId}:` 前缀批量删除，覆盖所有 owner 和 global 数据，不会残留。

#### 9. App → AI 工具注册（Tool Registry）

##### 9.1 为什么需要改造

当前（改造前）`src/platform/ai/heartbeatTools.ts` 里硬编码了 14 个工具：`post_moment`、`view_notes`、`chat_with_character`……这些其实是 **XingYu** 和 **Notes** 两个 app 的能力被糊在一个平台文件里。

正确的抽象是：**每个 app（内置 + 用户）向 AI 注册自己贡献的工具，系统在 heartbeat 启动时汇总**。这样：

- 用户 app 也能给 AI 加工具（与内置 app 完全对称）
- 用户可以按 app 开关 AI 的工具权限
- AI 能力随 app 安装/卸载动态伸缩
- 未来支持用户自定义 ad-hoc 工具（无需打包成 app）

##### 9.2 Tool Registry 架构

```
┌──────────────────────────────────────────────┐
│              Tool Registry (平台)              │
│                                              │
│   按 app 分组的工具表 + 用户启用状态            │
│                                              │
│   xingyu:    [post_moment, view_moments, …]  │
│   notes:     [view_notes, create_note]       │
│   user-todo: [add_todo, list_todos]          │
│   __user__:  [自定义工具 A, 自定义工具 B]       │
└────────────┬─────────────────────────────────┘
             │
     heartbeat 启动
             │
             ▼
   assembleTools(charId) → 注入 agent prompt
```

平台文件：`src/platform/ai/toolRegistry.ts` — 提供 `register(appId, tools)` / `unregister(appId)` / `assembleTools(charId)`。

##### 9.3 注册方式

**内置 app：** 在 app 目录下放 `aiTools.ts`，系统启动时自动加载并注册：

```typescript
// src/apps/XingYu/aiTools.ts
import type { ToolDefinition } from '@hiphone/ai';

export default [
  {
    name: 'post_moment',
    description: '发布一条朋友圈',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: async ({ text }) => { /* 调用 xingYuDataStore */ },
  },
  // …
];
```

**用户 app：** manifest 声明 `aiTools` 字段指向 zip 包内文件，Installer 编译并注册；卸载时反注册：

```json
{ "id": "my-todo", "aiTools": "AITools.tsx" }
```

```typescript
// AITools.tsx （用户 app 内）
import { get, set } from '@hiphone/storage';

export default [
  {
    name: 'add_todo',
    description: '在待办 app 中添加一项',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    execute: async ({ text }) => {
      const items = (await get('items')) ?? [];
      await set('items', [...items, { id: Date.now(), text, done: false }]);
      return `已添加：${text}`;
    },
  },
];
```

##### 9.4 工具执行的 Perspective 绑定

Heartbeat 是**某个角色**的心跳。当 AI 调用 `add_todo` 工具时，`execute` 内部调用的 `get('items')` 必须作用在**这个角色的视角下**——也就是说，工具执行时系统自动把 `phoneOwnerId` 设成触发 heartbeat 的角色。

这意味着工具函数不需要手动处理 perspective，自动继承 `@hiphone/storage` 的隔离逻辑即可，与 §8 完全对齐。

##### 9.5 用户管理 UI

`设置 → AI → 可用工具` 页面：

```
┌──────────────────────────────────┐
│  可用工具                   [AI] │
├──────────────────────────────────┤
│  星语  (内置)                ●  │
│    ● 发朋友圈                    │
│    ● 查看未读消息                │
│    ○ 与其他角色聊天              │
├──────────────────────────────────┤
│  便签  (内置)                ●  │
│    ● 查看便签                    │
│    ● 创建便签                    │
├──────────────────────────────────┤
│  待办  (my-todo, 用户 app)   ●  │
│    ● 添加待办                    │
│    ● 列出待办                    │
├──────────────────────────────────┤
│  自定义工具 [＋ 新建]             │
└──────────────────────────────────┘
```

- 按 app 分组展示
- 每个工具独立开关 + 整个 app 一键开关
- 持久化在 `aiToolsConfigStore`（IDB）
- `assembleTools(charId)` 汇总时只包含启用的
- 底部"自定义工具"入口对应 M4+ 的用户 ad-hoc 工具能力（见 §9.7）

##### 9.6 权限与安全

- 用户 app 注册工具须在 manifest `permissions` 声明 `ai-tools` 权限
- 工具 `execute` 跑在沙箱里，只能用 `@hiphone/*` SDK
- 远程商店下载时权限列表展示给用户确认
- 恶意工具最多只能操作该 app 自己的数据（storage 已隔离）+ 返回字符串给 AI

##### 9.7 未来：用户自定义 ad-hoc 工具（M4+）

不依赖完整 app，用户可在设置里直接新建一个工具（如"查询天气并告诉我"），类似 Shortcuts。形式：

- 工具名 + description
- 参数 JSON Schema
- execute 代码（在沙箱中执行，能用所有 `@hiphone/*` SDK）

这些工具归属到虚拟 app id `__user__`，与 app 贡献的工具并列。

##### 9.8 迁移清单

M3 阶段需把现有 `heartbeatTools.ts` 的 14 个工具拆到对应 app：

| 工具 | 目标 app |
|------|---------|
| `send_message`, `view_unread_messages`, `view_unread_interactions`, `chat_with_character`, `view_characters` | `src/apps/XingYu/aiTools.ts` |
| `post_moment`, `view_moments`, `like_moment`, `comment_moment` | 同上 |
| `update_signature`, `view_user_signature`, `view_user_signature_history` | 同上 |
| `view_notes`, `create_note` | `src/apps/Notes/aiTools.ts` |
| `done` | 平台保留（不属于任何 app，永远启用） |

`heartbeatAgent` 不再直接 import 工具清单，改为调用 `toolRegistry.assembleTools(charId)` 在启动时汇总。

## App 文件格式

### zip 包结构

```
my-app.zip
├── manifest.json       ← 必须，app 元数据
├── App.tsx             ← 必须，入口文件（manifest.entry 指定）
├── components/         ← 可选，子组件
│   ├── Header.tsx
│   └── Footer.tsx
├── utils.tsx           ← 可选，工具函数
└── icon.png            ← 可选，app 图标（无则使用默认图标）
```

### manifest.json

```json
{
  "id": "my-todo",
  "name": "待办事项",
  "version": "1.0.0",
  "entry": "App.tsx",
  "icon": "icon.png",
  "author": "developer@example.com",
  "description": "一个简单的待办事项管理 app",
  "permissions": ["storage", "fetch", "ai", "ai-tools", "notification"],
  "perspectiveAware": true,
  "aiTools": "AITools.tsx"
}
```

**必填字段：** `id`, `name`, `version`, `entry`
**可选字段：** `icon`, `author`, `description`, `permissions`, `perspectiveAware`, `aiTools`

- `perspectiveAware` (boolean, 默认 `false`) — 设为 `true` 表示 app 会响应"查看他人手机"的视角切换，storage 按 owner 隔离；`false` 时查看角色手机显示只读占位。详见 §8.4
- `aiTools` (string) — 指向 zip 包内的工具注册文件（例：`"AITools.tsx"`），文件 default export 一组 `ToolDefinition`。需配合 `permissions: ["ai-tools"]` 使用。详见 §9

**id 规则：** 小写字母 + 数字 + 连字符，不能与内置 app id 冲突。以 `user-` 前缀为建议但不强制。

### 用户 App 入口文件

```tsx
// App.tsx — 用户编写的入口
import React, { useState, useEffect } from 'react';
import { CheckCircle, Plus } from 'lucide-react';
import { NavBar, List, ListRow } from '@hiphone/ui';
import { get, set } from '@hiphone/storage';

// 不需要 AppScreen — 系统自动包裹
export default function TodoApp() {
  const [todos, setTodos] = useState([]);

  useEffect(() => {
    get('todos').then(data => {
      if (data) setTodos(data);
    });
  }, []);

  const addTodo = (text) => {
    const next = [...todos, { id: Date.now(), text, done: false }];
    setTodos(next);
    set('todos', next);
  };

  return (
    <div>
      <NavBar title="待办事项" />
      <List>
        {todos.map(t => (
          <ListRow key={t.id} title={t.text} leading={<CheckCircle size={20} />} />
        ))}
      </List>
    </div>
  );
}
```

**约定：**
- 入口文件必须 `export default` 一个 React 组件
- 通过标准 `import` 语法导入 SDK 模块（模块解析器拦截 `@hiphone/*` 和宿主依赖）
- 子文件通过标准 `import` 语法互相引用（由模块解析器处理）
- 样式使用 inline style 或 Tailwind class（Twind 运行时生成 CSS）

## App 生命周期

```
  安装                  首次打开                  运行中
┌──────┐ 存入IDB     ┌──────────┐ 编译+缓存   ┌──────────┐
│ .zip │ ─────────▶ │ 已安装    │ ─────────▶ │ 运行中    │
│      │ 注册元数据  │ (未编译)  │ mount组件   │ (已挂载)  │
└──────┘ 添加到桌面  └──────────┘             └────┬─────┘
                          ▲                        │
                          │                    返回主屏幕
                     上划关闭(kill)                 │
                     reset状态                     ▼
                          ▲              ┌──────────────────┐
                          │              │ 后台              │
                          └──────────────│ (组件卸载,        │
                                         │  store状态保留)   │
                                         └────────┬─────────┘
                                                  │
                                             卸载(uninstall)
                                                  ▼
                                         ┌──────────────┐
                                         │ 已删除        │
                                         │ 清除所有数据   │
                                         └──────────────┘
```

**关键行为：**
- **已安装但未打开：** 代码不执行，只是文本存在 IndexedDB 中
- **首次打开：** 触发编译（Sucrase），编译结果缓存
- **再次打开：** 使用缓存的编译结果，不重新编译
- **后台恢复：** 与内置 app 一致，组件重新 mount 但读取保留的状态
- **kill 后重开：** 通过 `wasAppKilled()` 检测，重置 app 内部状态
- **卸载：** 清除源码、编译缓存、持久化数据、从桌面和 Registry 移除

## 新增依赖

| 依赖 | 用途 | 体积（gzip） |
|------|------|-------------|
| `sucrase` | 运行时 TSX→JS 编译 | ~120KB |
| `jszip` | 解压用户上传的 zip 包 | ~45KB |
| `twind` | 运行时 Tailwind CSS 引擎 | ~13KB |

## 里程碑拆解

这是一个超级大需求，拆为 4 个里程碑（M1-M4），每个里程碑独立可测试可交付。每个里程碑内再拆阶段（S1/S2/...），每阶段对应一个 plan + 具体开发。

### M1：架构解耦 + 最小运行时

**目标：** 现有系统完成插件化改造，并能运行一个硬编码的用户 app（不涉及上传/安装流程）。

| 阶段 | 内容 | 交付物 | 验收标准 |
|------|------|--------|---------|
| **S1** | App Registry | `src/platform/appRegistry.ts` | 内置 app 通过注册表加载，行为与改造前完全一致；所有现有测试通过 |
| **S2** | AppScene 动态化 | 改造 `AppScene.tsx` | 用 Registry lookup 替代 if-else；内置 app 改为 `React.lazy` 懒加载；DemoApp 作为 fallback 不变 |
| **S3** | 生命周期信号 | 改造 `appRuntimeStore` | 发出 launch/resume/background/kill 信号；现有 `wasAppKilled` 行为不变；为用户 app hooks 打基础 |
| **S4** | 最小编译器 + 沙箱 | `src/platform/userApp/compiler.ts`, `sandbox.ts` | 能将一段硬编码的 TSX 字符串编译并在沙箱中执行，渲染出 React 组件 |
| **S5** | 最小 SDK（@hiphone/ui 只） | `src/platform/userApp/sdk/` | 沙箱中可 `import { NavBar } from '@hiphone/ui'`；系统自动 AppScreen 包裹 |
| **S6** | 端到端验证 | 测试用例 | 在 Registry 中手动注册一个"假用户 app"（TSX 字符串），点击图标后编译运行，显示 NavBar + 内容 |

**现有系统改造清单：**
- `AppScene.tsx` — if-else → Registry lookup + React.lazy
- `apps.data.ts` — 导出接口不变，但 Registry 作为新的消费方
- `appRuntimeStore` — 增加生命周期信号发射
- 新增 `sucrase` 依赖

**里程碑验收：** 所有内置 app 行为不变 + 一个硬编码的 TSX 字符串能在沙箱中跑起来。

---

### M2：完整安装流程 + 基础 SDK

**目标：** 用户可以上传 zip 文件安装 app，安装后出现在桌面，点击可运行。

| 阶段 | 内容 | 交付物 | 验收标准 |
|------|------|--------|---------|
| **S1** | 多文件模块解析器 | `src/platform/userApp/moduleResolver.ts` | 支持 import 图构建、拓扑排序编译、自定义 require |
| **S2** | App Installer（zip 解析 + IDB 存储） | `src/platform/userApp/installer.ts` | 接收 zip File → 解压 → 校验 manifest → 源码存入 IDB → 元数据存入 IDB |
| **S3** | Springboard 动态化 | 改造 Springboard 相关组件 | 用户 app 图标出现在桌面；支持 IDB 中的 data URL 图标；支持卸载后从桌面移除 |
| **S4** | @hiphone/storage + @hiphone/perspective SDK | `src/platform/userApp/sdk/storage.ts`, `sdk/perspective.ts` | per-app + per-perspective 双层前缀隔离的 get/set/remove/list；`globalGet/globalSet` 跳过 perspective 层；`useCurrentOwner()` hook；manifest `perspectiveAware` 字段生效（false 时显示占位）；卸载时按前缀批量清除所有 owner 数据 |
| **S5** | @hiphone/hooks SDK | `src/platform/userApp/sdk/hooks.ts` | useOnLaunch/useOnResume/useOnBackground/useOnKill/useAppMemory/useOpenParams |
| **S6** | Twind 集成 | 运行时 CSS 引擎 | 用户 app 中 Tailwind class 生效 |
| **S7** | 端到端验证 | 示例 app zip + 测试 | 上传一个多文件 todo-app.zip → 桌面出现图标 → 点击运行 → 数据持久化 → 卸载清除 |

**新增依赖：** `jszip`, `twind`

**里程碑验收：** 准备一个示例 todo-app.zip，走完 上传 → 安装 → 桌面图标 → 点击运行 → 使用 storage → 后台恢复 → kill 重置 → 卸载 的完整流程。

---

### M3：App Store UI + 扩展 SDK

**目标：** 有一个完整的 App Store 界面（本地上传 + 已安装管理），SDK 具备网络、AI、通知、跨 app 通信能力。

| 阶段 | 内容 | 交付物 | 验收标准 |
|------|------|--------|---------|
| **S1** | App Store UI — 本地上传页 | `src/apps/AppStore/` | iOS 风格的上传界面；选择 zip → 安装进度 → 完成提示 |
| **S2** | App Store UI — 已安装管理页 | 同上 | 展示已安装用户 app 列表；支持卸载；显示 app 信息（名称/版本/大小） |
| **S3** | @hiphone/nav + Deep Link | `src/platform/userApp/sdk/nav.ts` | open(appId, params) 跳转传参 + useOpenParams 接收 |
| **S4** | @hiphone/fetch SDK | `src/platform/userApp/sdk/fetch.ts` | 受控的 fetch 代理 |
| **S5** | @hiphone/ai SDK — 纯 AI | `src/platform/userApp/sdk/ai.ts` | complete + stream 两个接口；隐藏 provider/token 细节 |
| **S6** | @hiphone/ai SDK — 角色对话 | 同上 | chatWithCharacter + streamWithCharacter；persistent 选项 |
| **S7** | @hiphone/toast SDK | `src/platform/userApp/sdk/toast.ts` | 调用系统 Toast |
| **S8** | 端到端验证 | 多个示例 app | 钱包 app（storage + Deep Link）+ AI 翻译 app（complete/stream）+ 角色互动 app（chatWithCharacter） |

| **S9** | AI App Builder V1 — 聊天生成 app | `src/apps/AppBuilder/` | 用户输入"帮我做一个计算器" → AI 生成代码 → 编译验证 → 自动安装 → 桌面出现图标 |
| **S10** | AI App Builder — 迭代修改 | 同上 | 保留对话历史；用户追加"加一个历史记录" → AI 修改现有代码 → 更新安装 |
| **S11** | Tool Registry 平台 + 内置工具迁移 | `src/platform/ai/toolRegistry.ts`、`src/apps/XingYu/aiTools.ts`、`src/apps/Notes/aiTools.ts`、改造 `heartbeatAgent` | 现有 14 个硬编码工具拆到对应 app；`heartbeatAgent` 改为 `assembleTools(charId)` 汇总；所有现有 heartbeat 行为不变（回归测试） |
| **S12** | 用户 app 的 AI 工具注册 | Installer + 沙箱扩展 | manifest `aiTools` 字段生效；Installer 编译并注册；卸载反注册；`permissions: ["ai-tools"]` 校验 |
| **S13** | AI 工具管理 UI | `src/apps/Settings/pages/AIToolsPage.tsx`、`aiToolsConfigStore` | 按 app 分组展示全部工具；工具级 + app 级开关；持久化；`assembleTools` 读开关状态 |

**里程碑验收：** App Store 可用；三个示例 app 验证 SDK 能力；AI App Builder 能通过聊天生成并安装一个可运行的 app；用户可以在设置里管理 AI 可用的工具（含用户 app 贡献的工具）。

---

### M4：远程商店 + 高级能力

**目标：** 支持从远程仓库浏览/下载 app；支持角色心跳、宿主依赖 import 等高级能力。

| 阶段 | 内容 | 交付物 | 验收标准 |
|------|------|--------|---------|
| **S1** | 远程商店后端 | GitHub 仓库 `hiphone-app-store` | index.json + 至少 3 个示例 app zip |
| **S2** | App Store UI — 远程浏览页 | 改造 `src/apps/AppStore/` | 拉取 index.json → 展示 app 列表 → 点击下载安装 |
| **S3** | App Store UI — 搜索 + 详情 | 同上 | 关键词搜索；app 详情页（描述/截图/权限/版本） |
| **S4** | 宿主依赖暴露 | 模块解析器扩展 | 支持 import motion/zustand/date-fns/clsx/lucide-react |
| **S5** | @hiphone/ai — 心跳 + 自定义工具 | SDK 扩展 | triggerHeartbeat(charId, { tools, systemPrompt }) |
| **S6** | App 更新机制 | Installer 扩展 | 检测已安装 app 的新版本；一键更新 |
| **S7** | AI App Builder V2 — Agent 版 | 改造 `src/apps/AppBuilder/` | ReAct Agent 多步推理；自动拆分多文件；编译错误自动修复；读取现有代码修改 |
| **S8** | 用户自定义 ad-hoc 工具 | `src/apps/Settings/pages/CustomToolsPage.tsx` + `toolRegistry` 扩展 | 用户可在设置里直接新建工具（name + description + 参数 schema + execute 代码）；归属虚拟 app id `__user__`；在沙箱中执行，能用所有 `@hiphone/*` SDK（见 §9.7） |
| **S9** | 开发者文档 | `docs/app-development-guide.md` | 面向用户的 app 开发指南，包含 SDK API 参考、示例、最佳实践 |

**里程碑验收：** 远程商店可浏览下载；AI App Builder Agent 版能多步生成复杂 app；用户能参考文档从零编写一个使用 AI + 动效的 app。

---

### 里程碑依赖关系

```
M1（架构解耦 + 最小运行时）
 │
 ▼
M2（安装流程 + 基础 SDK）
 │
 ▼
M3（App Store UI + 扩展 SDK + AI App Builder V1）
 │
 ▼
M4（远程商店 + 高级能力 + AI App Builder V2 Agent）
```

M1 → M2 → M3 → M4 串行推进，每个里程碑独立可交付。

### 每个阶段的开发流程

遵循项目规范：
1. 阶段开始前写 `docs/plan/yyyy-mm-dd-hhmm-计划名.md`
2. plan 包含：用户需求、关键决策、交付清单、测试计划
3. TDD：先写测试，再实现
4. 阶段完成后验收测试通过，commit + 部署
