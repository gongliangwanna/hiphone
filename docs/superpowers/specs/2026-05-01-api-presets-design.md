# API 预设系统设计

**日期**: 2026-05-01
**作者**: brainstorming session
**模块**: `src/apps/Settings` + `src/platform/stores/aiConfigStore`

## 1. 背景与需求

### 用户原始诉求

> "设置里面的 api 设置需要支持预设，也就是可以保存多套设置，以便后续方便切换"

### 现状

`aiConfigStore` 当前已有"按 provider 分桶保存"的机制（`providerConfigs: Record<ProviderId, ProviderConfig>`），切换 provider 时自动恢复对应的 key/endpoint/model。但：

- 同一个 provider 只能存一套配置（无法保存"日常 OR"和"公司 OR"两套 openrouter 配置）
- 用户没法给配置取名字
- 切换需要"先选 provider，再调字段"，没有一键切换入口

### 目标

让用户保存任意多套**命名预设**，每套预设包含一个完整的"连接信息"，并能在 AI 服务页一键切换。

## 2. 关键决策（来自 brainstorming）

| 决策点 | 选择 | 备选 / 理由 |
|--------|------|-------------|
| **预设包含什么** | 仅连接信息：`provider + apiKey + apiEndpoint + model + fetchedModels` | 不含生成参数（避免"换 key 还得记 temperature"），生成参数留全局 |
| **切换入口** | AI 服务页顶部加预设行，点击弹底部 sheet | iOS 风格"切账户"模式，不增加导航层级 |
| **旧配置迁移** | 自动建一个名为「默认」的预设，无感升级 | 不打扰用户，不保留两套数据路径 |
| **编辑语义** | 编辑表单 = 直接写入激活预设，无"未保存"状态 | 心智最简单 |
| **fetchedModels 归属** | 跟随预设保存 | 切预设时缓存的模型列表跟着走，避免反复重拉 |
| **`providerConfigs` 命运** | 迁移完成后废弃删除 | 避免两套机制并存 |

## 3. 数据模型

### 新类型

```ts
// src/platform/stores/aiConfigStore.ts

export interface ApiPreset {
  id: string;                 // uuid，用于稳定引用
  name: string;               // 用户可编辑，默认 "预设 N"
  provider: ProviderId;
  apiKey: string;
  apiEndpoint: string;
  model: string;
  fetchedModels: ModelInfo[]; // 缓存的模型列表，避免重拉
}
```

### Store state 变化

**新增字段**：

```ts
presets: ApiPreset[];
activePresetId: string;
```

**移除字段**：

```ts
- apiKey: string;        // 改为读 active preset
- apiEndpoint: string;
- model: string;
- provider: ProviderId;
- providerConfigs: Record<string, ProviderConfig>;
- fetchedModels: ModelInfo[];
```

**派生 selector**（保持 UI 调用兼容）：

```ts
// hook 选择当前激活预设；UI 继续读 useAIConfigStore(s => s.apiKey) 这种用法
// 通过 selector 改写：useAIConfigStore(s => activePreset(s).apiKey)
```

为了让现有 `AIServicePage` 改动最小化，提供一个内部 helper：

```ts
function activePreset(state: AIConfigState): ApiPreset {
  return state.presets.find(p => p.id === state.activePresetId)!;
}
```

并保留旧的 selector 名字（`s => s.apiKey` 风格）通过 getter 实现 —— **或者**直接让 UI 改成 `useAIConfigStore(s => activePreset(s).apiKey)`。后者更显式，选后者。

### 新增 actions

```ts
// 切换激活预设
setActivePreset(id: string): void;

// 用当前激活预设字段快照成新预设
createPresetFromCurrent(name: string): string;  // 返回新 id

// 创建空预设（管理页"新建空预设"用）
createEmptyPreset(name: string): string;

// 重命名
renamePreset(id: string, name: string): void;

// 删除（删激活预设时自动切到下一个；只剩一个时无操作 / 抛错）
deletePreset(id: string): void;
```

### 现有 actions 改造

| 旧 action | 行为变化 |
|-----------|---------|
| `setProvider` | 改写激活预设的 `provider`；不再触发"恢复其它 provider 配置"的逻辑 |
| `setApiKey` | 改写激活预设的 `apiKey` |
| `setApiEndpoint` | 改写激活预设的 `apiEndpoint` |
| `setModel` | 改写激活预设的 `model` |
| `fetchModels` | 拉取后写入激活预设的 `fetchedModels`；`modelListLoading/Error` 仍在 store 顶层 |

### 持久化

`partialize` 改为：

```ts
{
  presets,
  activePresetId,
  // 生成参数、上下文、prompt 等保持原样，全局共享
  temperature, maxTokens, topP, ...
}
```

### 迁移逻辑

利用 zustand persist 的 `version` + `migrate`：

```ts
{
  name: 'hiPhone-ai-config',
  version: 2,                  // 旧版无 version 视为 0/1
  migrate: (persisted, version) => {
    if (version < 2) return migrateToPresets(persisted);
    return persisted;
  }
}
```

`migrateToPresets` 规则：

1. 若旧 state 有 `apiKey/apiEndpoint/model/provider` → 用这 4 项 + 旧 `fetchedModels`（若有）建一个名为「默认」的预设
2. 若旧 `providerConfigs` 中还有其它 provider 的非空配置 → 每个 provider 建一个预设，命名「默认 - openrouter」「默认 - siliconflow」之类
3. `activePresetId` 设为旧 `provider` 对应的那个预设
4. 全部都没有（全新用户 / 干净 state）→ 建一个空预设「预设 1」并设为激活
5. 删除旧顶层字段和 `providerConfigs`

**兜底**（防 persist 损坏）：store 初始化后若 `presets.length === 0` 自动补一个空「预设 1」。

## 4. UI 与交互

### 4.1 AIServicePage 顶部新增预设行

位置：在「服务商」section 之上，作为新的第一个 section。

```
┌── 预设 ─────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │ 日常 OR              ▾  │  ⋯   │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- **左半区**（约 80% 宽度，含名字 + provider 徽章 + 下拉箭头）：tap → 弹底部 sheet
- **右半区 ⋯**：tap → push 到「预设管理」子页

下方所有现有表单（API Key / 端点 / 拉取模型 / 模型列表 / 测试连接）**结构和行为不变**，只是底层 setter 改写为操作激活预设。

### 4.2 底部 Sheet：切换预设

使用 `system/` 层已有的 Sheet 组件（与其它底部弹层一致的毛玻璃 + iOS 风格分组列表）。

```
┌─ 切换预设 ──────────────────── 取消 ┐
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ✓ 日常 OR                       │ │
│ │   openrouter · claude-3.5...    │ │
│ │ ─────────────                   │ │
│ │   便宜 SF                       │ │
│ │   siliconflow · qwen-72b        │ │
│ │ ─────────────                   │ │
│ │   公司 Key                      │ │
│ │   openrouter · gpt-4o           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ＋ 用当前配置新建预设            │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- 点某行 → `setActivePreset(id)`，关 sheet，下方表单立即反映新值
- 点「+ 用当前配置新建预设」→ 弹 iOS 风格 alert input（「为预设命名」），确认后调 `createPresetFromCurrent(name)` 并切到新预设；取消则不动

### 4.3 预设管理子页 `AIPresetsPage`

iOS 标准分组列表，每行一个预设：

```
┌─ ← AI 服务   预设管理 ──────────────┐
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 日常 OR              ✓          │ │
│ │ openrouter · claude-3.5         │ │
│ │ ─────────────                   │ │
│ │ 便宜 SF                         │ │
│ │ siliconflow · qwen-72b          │ │
│ │ ─────────────                   │ │
│ │ 公司 Key                        │ │
│ │ openrouter · gpt-4o             │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ＋ 新建空预设                    │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

- **点行** → 弹 alert input 重命名
- **行右滑** → 红色「删除」按钮（iOS swipe-to-delete，参考项目内已有的 swipe 实现，如 NotesApp 列表）
- **激活预设**：行右侧显示蓝色 ✓
- **只剩 1 个预设时**：删除手势禁用（视觉灰化或不响应）
- **新建空预设**：调 `createEmptyPreset('预设 N')`，立即切换为激活，自动 pop 回 AI 服务页让用户填字段

### 4.4 导航接入

`settingsNavStore`（项目已有的设置内部导航栈）注册新 page key：`'ai-presets'`，AI 服务页右上 ⋯ 按钮 push 这个 key。

## 5. 边界与错误处理

### 5.1 至少一个预设激活

- store 初始化后兜底
- `deletePreset` 在 `presets.length === 1` 时返回 `false`/抛错（实现选其一，UI 只看是否成功提示）
- 删激活预设：先把 active 切到列表中下一个（无下一个则上一个），再删

### 5.2 名字处理

- 不强制唯一（id 区分）
- trim 后为空 → 兜底为 `预设 N`（N = `presets.length + 1`，碰撞时递增）
- 长度上限：50 字符（input maxLength 兜住）

### 5.3 模型列表与测试连接

- `fetchedModels` 写入激活预设
- `modelListLoading / modelListError / testStatus / testOutput` 留 store 顶层（瞬态）
- **切预设时清空这些瞬态字段**，避免上一个预设的错误信息带进新预设

### 5.4 字段并发

- setter 在 `set` 闭包里通过 `get().activePresetId` 读取当前激活预设；用户在编辑同一刻切预设的极端场景下，编辑写入"切换前"的预设，UI 读到"切换后"的值，对用户表现为输入丢弃 —— 可接受

### 5.5 迁移幂等

- `migrate` 只在 `version < 2` 时跑
- 幂等检查：若 persisted 已有 `presets` 数组直接返回，不再处理旧字段

## 6. 测试策略

### 6.1 Store 层

`src/platform/stores/__tests__/aiConfigStore.test.ts`（扩展）：

- **迁移**：persist 塞旧 schema → 初始化产生预设、旧字段清除、active 正确
  - 单 provider：仅有顶层 `apiKey/model/provider` → 1 个「默认」
  - 多 provider：顶层 + `providerConfigs` → 多个预设
- **空 persist**：1 个空「预设 1」激活
- **setActivePreset**：切换后字段反映新预设
- **setApiKey 等编辑**：仅修改激活预设，其它预设不动
- **createPresetFromCurrent**：快照当前字段成新预设并设为 active
- **createEmptyPreset**：所有连接字段为空、`fetchedModels: []`
- **renamePreset**：trim 空字符串 → 兜底名
- **deletePreset**：
  - 删非激活 → 直接删
  - 删激活 → 自动切换
  - 列表只剩 1 个 → 拒绝
- **兜底**：`presets = []` → 自动补一个

### 6.2 UI 层

- `src/apps/Settings/__tests__/AIServicePage.test.tsx`（**新建**）
  - 顶部预设行渲染当前激活预设名 + provider 徽章
  - 点预设行 → 出现 sheet
  - 点 sheet 中另一项 → store 切换、API Key input value 同步更新
  - 点「+ 用当前配置新建预设」→ 出现 alert input，确认后 store 多一项 + 切换
  - 编辑 API Key → store 中激活预设 apiKey 同步
- `src/apps/Settings/__tests__/AIPresetsPage.test.tsx`（**新建**）
  - 列表渲染所有预设；激活预设有 ✓
  - 点行 → 重命名 alert，确认后名字更新
  - 右滑 → 出现删除按钮，点击后从列表移除
  - 只剩 1 个时删除按钮禁用 / 不出现
  - 点「+ 新建空预设」→ store 多一项 + 切换为激活 + 自动 pop 回 AI 服务页

### 6.3 不测

- Sheet 动画 / 手势细节（system 层已覆盖）
- 底层 `fetchModels` 网络（已有测试）
- iOS 风格视觉 token（design-tokens 已覆盖）

## 7. 实施范围摘要

| 改动类型 | 文件 |
|---------|------|
| **改造** | `src/platform/stores/aiConfigStore.ts`（数据模型 + 迁移 + setter 重写 + 新 actions）|
| **改造** | `src/apps/Settings/pages/AIServicePage.tsx`（顶部预设行 + 底部 sheet 唤起 + selector 切换为 active preset）|
| **新建** | `src/apps/Settings/pages/AIPresetsPage.tsx`（管理页）|
| **改造** | `src/apps/Settings/SettingsApp.tsx` / `settingsNavStore.ts`（注册新 page key）|
| **新建** | `src/apps/Settings/__tests__/AIServicePage.test.tsx` |
| **新建** | `src/apps/Settings/__tests__/AIPresetsPage.test.tsx` |
| **扩展** | `src/platform/stores/__tests__/aiConfigStore.test.ts` |

## 8. 非范围（Out of Scope）

- 跨设备同步预设
- 预设导入 / 导出（JSON 分享）
- 预设设置生成参数（temperature 等）
- 预设设置上下文 / 记忆参数
- 预设级别的系统提示词
- 默认/出厂预设模板
