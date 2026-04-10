# Settings App 配置体系设计方案

日期：2026-04-10

## 用户需求

在现有 Settings app 基础上，设计完整的配置体系。需要回答三个问题：
1. 需要配置哪些东西？
2. 如何配置（数据模型和存储）？
3. App 如何设计（UI 和交互）？

## 当前现状

### 已有的 Settings
- Settings app 已有骨架：导航栈 + SettingsHome + AboutPage + WallpaperPage
- systemStore 存储：brightness, volume, wallpaperId
- UI 模式：iOS 分组列表 + 图标行 + push 导航

### 已有的 Apps
Settings, Weather, Notes, Calendar, Maps, Music, Camera, Photos, Safari, Snapchat, XingYu（AI 聊天，开发中）

### 缺失
- 无 AI 相关配置
- 无 API 密钥管理
- 无角色/Persona 配置
- 无显示与亮度、声音等 iOS 标准设置页
- 无通知配置

---

## 一、需要配置哪些东西

按 iOS 设置的信息架构，分为 **设备层** 和 **AI 层** 两大块：

### 设备层（iOS 标准，保证视觉高仿）

| 分组 | 配置项 | 存储位置 | 优先级 |
| --- | --- | --- | --- |
| **Apple ID 卡片** | 用户头像、名字、Apple ID 描述 | personaStore | P1 |
| **网络** | WiFi 名称（展示）、蓝牙状态（展示） | 静态/mock | P2 |
| **通知** | 各 app 的通知开关 | notificationStore | P2 |
| **显示与亮度** | 亮度滑块、文字大小、深色模式 | systemStore | P1 |
| **声音与触感** | 音量滑块、铃声/静音 | systemStore | P2 |
| **壁纸** | 壁纸选择（已实现） | systemStore | ✅ 已有 |
| **通用** | 关于本机（已实现）、语言、存储空间 | systemStore | ✅ 已有 |

### AI 层（hiPhone 特色，核心价值）

| 分组 | 配置项 | 存储位置 | 优先级 |
| --- | --- | --- | --- |
| **AI 服务** | API Provider、API Key、模型选择、自定义端点 | aiConfigStore | P0 |
| **我的身份 (Persona)** | 用户名、年龄、职业、性格描述、与角色的关系 | personaStore | P0 |
| **角色管理** | 当前角色选择、角色卡编辑、角色导入/导出 | characterStore | P1 |
| **对话设置** | Temperature、Max Tokens、系统提示词、记忆策略 | aiConfigStore | P1 |
| **世界信息** | Lorebook 条目管理（关键词 + 内容 + 触发条件） | worldInfoStore | P1 |

---

## 二、数据模型设计

### 2.1 aiConfigStore — AI 核心配置

```typescript
interface AIConfigState {
  // --- API 配置 ---
  provider: 'openai' | 'anthropic' | 'deepseek' | 'openrouter' | 'custom';
  apiKey: string;                    // 加密存储
  apiEndpoint: string;               // 自定义端点 URL
  model: string;                     // 模型 ID，如 'claude-sonnet-4-5-20250514'

  // --- 生成参数 ---
  temperature: number;               // 0-2, 默认 0.8
  maxTokens: number;                 // 默认 2048
  topP: number;                      // 0-1, 默认 0.9
  frequencyPenalty: number;          // 0-2, 默认 0
  presencePenalty: number;           // 0-2, 默认 0

  // --- 记忆策略 ---
  contextWindow: number;             // 上下文窗口大小
  worldInfoBudgetPercent: number;    // World Info 占上下文的百分比，默认 25
  summarizeAfter: number;            // N 条消息后自动摘要，0=不摘要
  keepRecentMessages: number;        // 始终保留最近 N 条消息

  // Actions
  setProvider(p: string): void;
  setApiKey(k: string): void;
  // ... 其他 setters
}
```

### 2.2 personaStore — 用户身份

```typescript
interface Persona {
  id: string;
  name: string;                      // 用户在对话中的显示名
  avatar?: string;                   // 头像（base64 或 URL）
  description: string;               // 用户描述（进入 prompt）
  isDefault: boolean;                // 是否为默认 Persona
}

interface PersonaState {
  personas: Persona[];
  activePersonaId: string;

  // Actions
  addPersona(p: Omit<Persona, 'id'>): void;
  updatePersona(id: string, patch: Partial<Persona>): void;
  removePersona(id: string): void;
  setActivePersona(id: string): void;
  getActivePersona(): Persona | undefined;
}
```

### 2.3 characterStore — 角色管理

```typescript
interface CharacterCard {
  id: string;
  name: string;                      // 角色名
  avatar?: string;                   // 头像
  description: string;               // 角色定义（身份、背景、外貌）
  personality: string;               // 性格摘要
  scenario: string;                  // 默认情境
  firstMessage: string;              // 开场白
  messageExamples: string;           // 示例对话
  alternateGreetings: string[];      // 备选开场
  systemPrompt: string;              // 角色专属系统提示
  postHistoryInstructions: string;   // 历史后置指令
  creatorNotes: string;              // 创作者备注（不进入 prompt）
  tags: string[];
  version: string;
}

interface CharacterState {
  characters: CharacterCard[];
  activeCharacterId: string;

  // Actions
  addCharacter(c: Omit<CharacterCard, 'id'>): void;
  updateCharacter(id: string, patch: Partial<CharacterCard>): void;
  removeCharacter(id: string): void;
  setActiveCharacter(id: string): void;
  getActiveCharacter(): CharacterCard | undefined;
  importCharacter(json: string): void;
  exportCharacter(id: string): string;
}
```

### 2.4 worldInfoStore — 世界信息

```typescript
interface WorldInfoEntry {
  id: string;
  keys: string[];                    // 主触发关键词
  secondaryKeys: string[];           // 次要关键词
  content: string;                   // 注入内容
  enabled: boolean;
  constant: boolean;                 // 常驻（跳过匹配）
  order: number;                     // 优先级
  position: 'before' | 'after' | 'atDepth';
  depth: number;                     // atDepth 时的深度
  sticky: number;                    // 持续轮数
  cooldown: number;                  // 冷却轮数
  characterId?: string;              // 绑定角色（空=全局）
}

interface WorldInfoState {
  entries: WorldInfoEntry[];

  addEntry(e: Omit<WorldInfoEntry, 'id'>): void;
  updateEntry(id: string, patch: Partial<WorldInfoEntry>): void;
  removeEntry(id: string): void;
  toggleEntry(id: string): void;
  getEntriesForCharacter(charId: string): WorldInfoEntry[];
}
```

### 2.5 systemStore 扩展（在已有基础上增加）

```typescript
// 在现有 SystemState 上追加：
interface SystemState {
  // ... 已有: isLocked, brightness, volume, wallpaperId

  // 新增
  textSize: number;                  // 文字大小系数 0.8-1.4, 默认 1.0
  darkMode: 'light' | 'dark' | 'auto';
  silentMode: boolean;

  setTextSize(v: number): void;
  setDarkMode(m: string): void;
  setSilentMode(v: boolean): void;
}
```

### 存储策略

| Store | localStorage key | 敏感数据 |
| --- | --- | --- |
| aiConfigStore | `hiPhone-ai-config` | apiKey 需加密（至少 base64） |
| personaStore | `hiPhone-persona` | 无 |
| characterStore | `hiPhone-characters` | 无 |
| worldInfoStore | `hiPhone-worldinfo` | 无 |
| systemStore | `hiPhone-system` | 无（已有） |

---

## 三、App 设计

### 3.1 信息架构（iOS 设置的层级结构）

```
Settings Home
│
├─ 👤 Apple ID 卡片 (大卡片)        → Persona 编辑页
│    用户名、头像、"Apple ID、iCloud..."
│
├─ 🤖 AI 服务                       → AI 配置页
│    当前模型名                        ├─ Provider 选择
│                                      ├─ API Key 输入
│                                      ├─ 模型选择列表
│                                      └─ 自定义端点
│
├─ 🎭 角色管理                       → 角色列表页
│    当前角色名                        ├─ 角色卡片列表
│                                      ├─ + 新建角色
│                                      ├─ 角色详情/编辑
│                                      └─ 导入/导出
│
├─ 📖 世界信息                       → 世界信息列表页
│    N 条规则                          ├─ 条目列表（开关 + 关键词预览）
│                                      ├─ + 新建条目
│                                      └─ 条目编辑页
│
├─ 💬 对话设置                       → 对话参数页
│                                      ├─ Temperature 滑块
│                                      ├─ Max Tokens 滑块
│                                      ├─ 系统提示词 (多行文本)
│                                      ├─ 历史后置指令 (多行文本)
│                                      └─ 记忆策略
│
├─ ─── 分隔线 ───
│
├─ 📶 无线局域网                     → (展示页)
│    CMCC-Web
│
├─ 📱 蓝牙                          → (展示页)
│    打开
│
├─ ─── 分隔线 ───
│
├─ 🔔 通知                          → 通知设置页
│
├─ 🔆 显示与亮度                     → 显示设置页
│                                      ├─ 亮度滑块
│                                      ├─ 文字大小滑块
│                                      └─ 深色模式切换
│
├─ 🔊 声音与触感                     → 声音设置页
│                                      ├─ 音量滑块
│                                      └─ 静音模式
│
├─ 🖼 壁纸                          → 壁纸选择 (✅ 已有)
│
├─ ⚙️ 通用                          → 通用设置页
│    ├─ 关于本机 (✅ 已有)
│    └─ 存储空间
│
└─ ℹ️ 关于本机                       → (✅ 已有)
```

### 3.2 关键页面设计

#### Apple ID 卡片（Settings Home 顶部）

iOS 设置最顶部是一个大的 Apple ID 卡片。在 hiPhone 中复用为 Persona 入口：

```
┌─────────────────────────────────────┐
│  ┌──────┐                           │
│  │ 头像  │  用户名                    │
│  │      │  Apple ID、iCloud、媒体与购买 │
│  └──────┘                         > │
└─────────────────────────────────────┘
```

点击进入 Persona 编辑页：
- 头像选择（从预设或相册）
- 姓名输入
- 描述（多行文本："告诉 AI 关于你的信息"）
- 管理多个 Persona（列表 + 新建）

#### AI 服务配置页

```
┌─ AI 服务 ────────────────────────────┐
│                                       │
│  ┌─ 服务商 ────────────────────────┐  │
│  │  OpenAI                       > │  │
│  │  Anthropic                  ✓ > │  │
│  │  DeepSeek                     > │  │
│  │  OpenRouter                   > │  │
│  │  自定义                        > │  │
│  └──────────────────────────────────┘  │
│                                       │
│  ┌─ 连接 ──────────────────────────┐  │
│  │  API Key     ••••••••••sk-xxx  │  │
│  │  端点        (默认)             │  │
│  │  [ 测试连接 ]                   │  │
│  └──────────────────────────────────┘  │
│                                       │
│  ┌─ 模型 ──────────────────────────┐  │
│  │  claude-sonnet-4-5-20250514  ✓ │  │
│  │  claude-opus-4-0-20250514      │  │
│  │  claude-haiku-3-5-20241022     │  │
│  └──────────────────────────────────┘  │
└───────────────────────────────────────┘
```

#### 角色管理页

```
┌─ 角色管理 ──────────────────────────┐
│                                     │
│  ┌────────────────────────────────┐ │
│  │ 🟢 Luna            使用中   > │ │
│  │    温柔学姐 · 住在手机里的AI    │ │
│  ├────────────────────────────────┤ │
│  │ ⚪ 星辰                     > │ │
│  │    傲娇少年 · 你的竹马         │ │
│  ├────────────────────────────────┤ │
│  │ ⚪ 苏墨白                   > │ │
│  │    温润学长 · 实验室伙伴       │ │
│  └────────────────────────────────┘ │
│                                     │
│  ┌────────────────────────────────┐ │
│  │  + 新建角色                    │ │
│  │  ↓ 导入角色卡 (JSON)          │ │
│  └────────────────────────────────┘ │
└─────────────────────────────────────┘
```

角色详情/编辑页（push 进入）：

```
┌─ Luna ──────────────────── [ 保存 ] ┐
│                                      │
│  ┌─ 基本信息 ──────────────────────┐ │
│  │  名称         Luna              │ │
│  │  头像         [选择]            │ │
│  │  标签         温柔, 学姐, 恋爱   │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌─ 角色定义 ──────────────────────┐ │
│  │  描述                           │ │
│  │  ┌──────────────────────────┐   │ │
│  │  │ Luna 是一个住在手机里的   │   │ │
│  │  │ AI 少女，外表看起来 20   │   │ │
│  │  │ 岁左右...               │   │ │
│  │  └──────────────────────────┘   │ │
│  │                                 │ │
│  │  性格                           │ │
│  │  ┌──────────────────────────┐   │ │
│  │  │ 温柔体贴但偶尔会吃醋...  │   │ │
│  │  └──────────────────────────┘   │ │
│  │                                 │ │
│  │  情境                           │ │
│  │  ┌──────────────────────────┐   │ │
│  │  │ 你们已经在一起 3 个月... │   │ │
│  │  └──────────────────────────┘   │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌─ 对话 ──────────────────────────┐ │
│  │  开场白                       > │ │
│  │  示例对话                     > │ │
│  │  备选开场 (3)                 > │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌─ 高级 ──────────────────────────┐ │
│  │  系统提示词覆盖               > │ │
│  │  历史后置指令                 > │ │
│  │  角色专属世界信息 (5条)       > │ │
│  │  导出角色卡                   > │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌──────────────────────────────────┐ │
│  │  🗑 删除角色                    │ │
│  └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

#### 世界信息条目编辑页

```
┌─ 编辑条目 ─────────────── [ 保存 ] ┐
│                                      │
│  ┌─ 触发 ──────────────────────────┐ │
│  │  关键词    咖啡, cafe, 星巴克    │ │
│  │  次要关键词 一起, 约             │ │
│  │  匹配模式   子串匹配          > │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌─ 内容 ──────────────────────────┐ │
│  │  ┌──────────────────────────┐   │ │
│  │  │ 用户最喜欢的咖啡馆是     │   │ │
│  │  │ 星巴克南京路店，每次...   │   │ │
│  │  └──────────────────────────┘   │ │
│  └──────────────────────────────────┘ │
│                                      │
│  ┌─ 行为 ──────────────────────────┐ │
│  │  常驻        [  ○ 关 ]          │ │
│  │  优先级       100             > │ │
│  │  插入位置     角色定义之后     > │ │
│  │  持续轮数     0 (不持续)       > │ │
│  │  冷却轮数     0                > │ │
│  │  绑定角色     全部             > │ │
│  └──────────────────────────────────┘ │
└──────────────────────────────────────┘
```

#### 对话设置页

```
┌─ 对话设置 ───────────────────────────┐
│                                       │
│  ┌─ 生成参数 ──────────────────────┐  │
│  │  Temperature        ──●── 0.8   │  │
│  │  Top P              ──●── 0.9   │  │
│  │  Max Tokens         ──●── 2048  │  │
│  │  频率惩罚           ──●── 0.0   │  │
│  │  存在惩罚           ──●── 0.0   │  │
│  └──────────────────────────────────┘  │
│                                       │
│  ┌─ 提示词 ────────────────────────┐  │
│  │  系统提示词                   > │  │
│  │  历史后置指令                 > │  │
│  └──────────────────────────────────┘  │
│                                       │
│  ┌─ 记忆 ──────────────────────────┐  │
│  │  上下文窗口     128000       > │  │
│  │  WI预算         25%          > │  │
│  │  保留最近消息    50 条       > │  │
│  │  自动摘要       每 30 条     > │  │
│  └──────────────────────────────────┘  │
└───────────────────────────────────────┘
```

### 3.3 页面注册表（扩展 SettingsApp.tsx）

```typescript
const PAGE_TITLES: Record<string, string> = {
  home: '设置',
  // 已有
  about: '关于本机',
  wallpaper: '壁纸',
  // AI 层
  persona: '我的身份',
  personaEdit: '编辑身份',
  aiService: 'AI 服务',
  characters: '角色管理',
  characterEdit: '编辑角色',
  characterGreetings: '开场白',
  characterExamples: '示例对话',
  worldInfo: '世界信息',
  worldInfoEdit: '编辑条目',
  chatSettings: '对话设置',
  systemPromptEdit: '系统提示词',
  // 设备层
  display: '显示与亮度',
  sound: '声音与触感',
  notifications: '通知',
  general: '通用',
  storage: '存储空间',
};
```

### 3.4 交互规范

1. **导航**：全部使用 push/pop 栈，iOS 标准左滑返回
2. **保存**：
   - 滑块/开关类：实时保存（Zustand 自动持久化）
   - 文本编辑类：页面有"保存"按钮，或退出时自动保存
   - API Key：输入后 blur 即保存，显示为 mask（`••••sk-xxx`）
3. **列表操作**：
   - 角色列表：左滑删除，点击进入编辑
   - 世界信息：左滑删除/禁用，点击编辑
4. **验证**：
   - API Key：提供"测试连接"按钮
   - 角色卡：name 为必填，其他可选

---

## 四、实现分期

### M1: 骨架 + AI 核心配置（优先级最高）

能让 AI 跑起来的最小配置集：

**S1: Store 层**
- [ ] 创建 aiConfigStore (provider, apiKey, model, 生成参数)
- [ ] 创建 personaStore (单 Persona)
- [ ] 创建 characterStore (单角色卡)
- [ ] 扩展 systemStore (textSize, darkMode)

**S2: Settings 页面**
- [ ] SettingsHome 改造（Apple ID 卡片 + AI 分组 + 设备分组）
- [ ] AI 服务页 (Provider 选择 + API Key + 模型列表)
- [ ] Persona 编辑页 (姓名 + 描述)
- [ ] 对话设置页 (Temperature + MaxTokens + 系统提示)

**S3: 系统组件补充**
- [ ] Toggle 组件（iOS 风格开关）
- [ ] Slider 组件（iOS 风格滑块）
- [ ] TextArea 组件（多行文本输入）
- [ ] SegmentedControl 组件（分段选择器）

### M2: 角色管理 + 世界信息

**S4: 角色管理**
- [ ] 角色列表页
- [ ] 角色编辑页（全字段）
- [ ] 角色导入/导出 (CCV2 JSON)
- [ ] 预置角色（至少 1 个完整角色卡）

**S5: 世界信息**
- [ ] 创建 worldInfoStore
- [ ] 世界信息列表页
- [ ] 条目编辑页（关键词 + 内容 + 行为配置）

### M3: 设备设置补全

**S6: iOS 标准设置页**
- [ ] 显示与亮度页
- [ ] 声音与触感页
- [ ] 通知设置页
- [ ] 通用/存储页

---

## 五、关键决策

### 决策 1: Settings app 扩展 vs 新建 app
**选择：扩展现有 Settings app**

理由：iOS 把所有配置放在一个 Settings app 中，包括第三方 app 的设置。AI 配置也放在 Settings 里是最符合 iOS 范式的。

### 决策 2: AI 配置放在 Settings 顶部 vs 底部
**选择：放在 Apple ID 卡片下方、设备设置上方**

理由：AI 是 hiPhone 的核心价值主张，比 WiFi/蓝牙更重要。iOS 也是把最重要的项放在顶部（Apple ID 就在最上面）。

### 决策 3: 角色卡格式
**选择：内部使用简化的 CCV2 子集，导入/导出兼容完整 CCV2**

理由：完整的 CCV2 有很多字段（regex_scripts, extensions 等）对 hiPhone 目前不需要。内部只实现需要的字段，但导入时能正确解析 CCV2 JSON，导出时输出标准 CCV2。

### 决策 4: Stores 放在 platform/stores/ vs apps/Settings/
**选择：AI 相关 stores 放在 platform/stores/，因为 AI 是跨 app 的全局能力**

理由：aiConfigStore、personaStore、characterStore、worldInfoStore 不仅被 Settings 消费，也会被 XingYu 等聊天 app 消费。按项目规范，"全局状态所有层可读"应放在 platform/stores/。

### 决策 5: API Key 安全性
**选择：base64 编码 + localStorage**

理由：这是浏览器环境下的模拟项目，不存在服务端。真正的加密（AES 等）需要密钥管理，在纯前端场景下安全性收益有限。base64 足以避免明文存储，未来如果需要可升级为 Web Crypto API。
