# SillyTavern 世界卡配置层调研

调研日期：2026-04-11
调研范围：**配置 / 存储 / 绑定 / 注入 pipeline**
参考来源：`https://github.com/SillyTavern/SillyTavern`（`release` 分支）
配套文档：运行时激活算法见 `docs/research/sillytavern-worldinfo-deep-dive.md`，本文不重复该内容

## 关键结论

1. ST 世界书在磁盘上是 `{entries: {[uid]: entry}}` 的 JSON，一本书一个文件。顶层的 name/description/scan_depth 等是**可选**字段，实际权威数据存在 `entries` 里。
2. 单个 entry 的字段全集由 `newWorldInfoEntryDefinition` 定义，共 **40+ 字段**。真正必填的只有 `key` 和 `content`，其余都可以使用默认值。
3. ST 与 Character Card V2 规范的 `character_book` 格式**互不相同**：v2 用 snake_case、entries 是 array、ST 扩展字段全部藏在 `extensions.*` 里。双向映射表是 `originalWIDataKeyMap`（40 行静态表）。
4. 绑定关系分 **4 个作用域**（Global / Character / Persona / Chat），分别存在 settings / character card / persona / chat_metadata 里。`charLore` 附加书机制是历史包袱，hiPhone 不该照抄。
5. Prompt 注入 pipeline 由 `Generate() → getWorldInfoPrompt() → checkWorldInfo() → WIPromptResult → preparePromptsForChatCompletion()` 组成。其中 `worldInfoBefore`/`worldInfoAfter` 是两个 system 消息，这是 hiPhone 一期需要复刻的**唯一核心通路**，其他位置（ANTop / ANBottom / EMTop / EMBottom / Outlet / @Depth）都可以缓做。
6. hiPhone 一期建议只做 **System + Character 两种作用域**、18 个字段的精简 entry schema，存储走 localStorage/IDB。v2 spec 兼容放到二期作为 import/export adapter。

## 1. World Info 文件的磁盘 JSON 格式

### 1.1 顶层结构

ST 世界书磁盘文件就是 `public/scripts/world-info.js :: createNewWorldInfo` 给出的空模板：

```ts
// public/scripts/world-info.js  L4318-4332
const worldInfoTemplate = { entries: {} };
```

实际写盘由 `src/endpoints/worldinfo.js :: POST /api/worldinfo/edit` 完成，仅校验了顶层要有 `entries` 字段：

```js
// src/endpoints/worldinfo.js  L134-157
if (!('entries' in request.body.data)) {
  throw new Error('World info must contain an entries list');
}
writeFileAtomicSync(pathToFile, JSON.stringify(request.body.data, null, 4));
```

**关键事实：**

- 文件路径：`{user_directories.worlds}/{sanitize(name)}.json`，一个世界书 = 一个 JSON 文件，文件名即世界书 name。
- `entries` 是 **object（以 uid 为字符串 key 的字典）**，不是 array。这是 ST 与 Character Card v2 规范最大的不同。
- 顶层没有强制的 `name` / `description` / `scan_depth` / `token_budget` / `recursive_scanning` / `extensions` 字段 —— ST 的 list 接口 (`POST /api/worldinfo/list`) 会去尝试读取 `name` 和 `extensions`（见 `src/endpoints/worldinfo.js` L46-64），但不存在也不报错。
- 顶层可能还会出现一个 `originalData` 字段：**当世界书是从 character card 的 `character_book` 导入来的时候**，ST 会把原始的 v2 spec 对象完整保存在 `originalData` 里，后续每次 UI 编辑都会同步写回 `originalData.entries[x]`，便于回导出为 v2 spec（见 `public/scripts/world-info.js` L5481 `convertCharacterBook` 和 L2607-2644 `originalWIDataKeyMap`）。

### 1.2 单个 entry 的完整字段列表

所有字段来自 `public/scripts/world-info.js :: newWorldInfoEntryDefinition`（L3984-4027），这是 ST 官方唯一的 source of truth。

```ts
// 引用：public/scripts/world-info.js L3984-4027
export const newWorldInfoEntryDefinition = {
  key:                        { default: [],                        type: 'array'   },
  keysecondary:               { default: [],                        type: 'array'   },
  comment:                    { default: '',                        type: 'string'  },
  content:                    { default: '',                        type: 'string'  },
  constant:                   { default: false,                     type: 'boolean' },
  vectorized:                 { default: false,                     type: 'boolean' },
  selective:                  { default: true,                      type: 'boolean' },
  selectiveLogic:             { default: 0 /* AND_ANY */,           type: 'enum'    },
  addMemo:                    { default: false,                     type: 'boolean' },
  order:                      { default: 100,                       type: 'number'  },
  position:                   { default: 0 /* before */,            type: 'number'  },
  disable:                    { default: false,                     type: 'boolean' },
  ignoreBudget:               { default: false,                     type: 'boolean' },
  excludeRecursion:           { default: false,                     type: 'boolean' },
  preventRecursion:           { default: false,                     type: 'boolean' },
  matchPersonaDescription:    { default: false,                     type: 'boolean' },
  matchCharacterDescription:  { default: false,                     type: 'boolean' },
  matchCharacterPersonality:  { default: false,                     type: 'boolean' },
  matchCharacterDepthPrompt:  { default: false,                     type: 'boolean' },
  matchScenario:              { default: false,                     type: 'boolean' },
  matchCreatorNotes:          { default: false,                     type: 'boolean' },
  delayUntilRecursion:        { default: 0,                         type: 'number'  },
  probability:                { default: 100,                       type: 'number'  },
  useProbability:             { default: true,                      type: 'boolean' },
  depth:                      { default: 4  /* DEFAULT_DEPTH */,    type: 'number'  },
  outletName:                 { default: '',                        type: 'string'  },
  group:                      { default: '',                        type: 'string'  },
  groupOverride:              { default: false,                     type: 'boolean' },
  groupWeight:                { default: 100 /* DEFAULT_WEIGHT */,  type: 'number'  },
  scanDepth:                  { default: null,                      type: 'number?' },
  caseSensitive:              { default: null,                      type: 'boolean?' },
  matchWholeWords:            { default: null,                      type: 'boolean?' },
  useGroupScoring:            { default: null,                      type: 'boolean?' },
  automationId:               { default: '',                        type: 'string'  },
  role:                       { default: 0 /* SYSTEM */,            type: 'enum'    },
  sticky:                     { default: null,                      type: 'number?' },
  cooldown:                   { default: null,                      type: 'number?' },
  delay:                      { default: null,                      type: 'number?' },
  characterFilterNames:       { default: [],  excludeFromTemplate: true },
  characterFilterTags:        { default: [],  excludeFromTemplate: true },
  characterFilterExclude:     { default: false, excludeFromTemplate: true },
  triggers:                   { default: [],                        type: 'array'   },
};
```

额外，`createWorldInfoEntry`（L4039-4051）会给每个 entry 注入一个 `uid`（整数），`displayIndex`（在 `convertCharacterBook` 里也会出现）存的是 UI 拖拽排序时的显示顺序。

### 1.3 enum 常量一览

```ts
// public/scripts/world-info.js  L27-38, L855-864
world_info_insertion_strategy = { evenly: 0, character_first: 1, global_first: 2 };
world_info_logic              = { AND_ANY: 0, NOT_ALL: 1, NOT_ANY: 2, AND_ALL: 3 };
world_info_position           = {
  before: 0,   // Before Character Defs
  after:  1,   // After Character Defs
  ANTop:  2,   // Author's Note Top
  ANBottom: 3, // Author's Note Bottom
  atDepth: 4,  // @ Depth N (with role)
  EMTop:  5,   // Example Messages Top
  EMBottom: 6, // Example Messages Bottom
  outlet: 7,   // Outlet (macro injection)
};

// public/script.js  L493-497
extension_prompt_roles = { SYSTEM: 0, USER: 1, ASSISTANT: 2 };
```

### 1.4 字段语义分组（给配置层做信息架构参考）

| 语义组 | 字段 |
|---|---|
| 身份 | `uid`, `comment`（memo/标题）, `content`（正文） |
| 关键词匹配 | `key`, `keysecondary`, `selective`, `selectiveLogic` |
| 激活模式 | `constant`, `vectorized`, `disable` |
| 插入位置 | `position`, `depth`, `role`, `order`, `outletName` |
| 预算/概率 | `ignoreBudget`, `probability`, `useProbability` |
| 递归 | `excludeRecursion`, `preventRecursion`, `delayUntilRecursion` |
| 时间效果 | `sticky`, `cooldown`, `delay` |
| 分组（Inclusion Group） | `group`, `groupOverride`, `groupWeight`, `useGroupScoring` |
| 全局参数覆盖 | `scanDepth`, `caseSensitive`, `matchWholeWords` |
| 额外匹配源 | `matchPersonaDescription`, `matchCharacterDescription`, `matchCharacterPersonality`, `matchCharacterDepthPrompt`, `matchScenario`, `matchCreatorNotes` |
| 过滤器 | `characterFilterNames`, `characterFilterTags`, `characterFilterExclude`, `triggers`, `automationId` |
| UI | `addMemo`, `displayIndex` |

### 1.5 最小可用子集 vs 完整字段全集

**最小可用 entry（能跑的 MVP）**

```json
{
  "uid": 0,
  "key": ["魔法"],
  "keysecondary": [],
  "comment": "魔法体系简介",
  "content": "这个世界的魔法来自星辰之力。",
  "constant": false,
  "selective": true,
  "selectiveLogic": 0,
  "order": 100,
  "position": 0,
  "depth": 4,
  "probability": 100,
  "useProbability": true,
  "disable": false
}
```

总共 **13 个字段**（含 uid），其中 `key` / `content` 是真正"必填"。其它都是沿用默认值。

**完整 entry（导出到磁盘时的样子）**

```json
{
  "uid": 0,
  "key": ["魔法", "法师"],
  "keysecondary": [],
  "comment": "魔法体系",
  "content": "这个世界的魔法来自星辰之力。",
  "constant": false,
  "vectorized": false,
  "selective": true,
  "selectiveLogic": 0,
  "addMemo": true,
  "order": 100,
  "position": 0,
  "disable": false,
  "ignoreBudget": false,
  "excludeRecursion": false,
  "preventRecursion": false,
  "matchPersonaDescription": false,
  "matchCharacterDescription": false,
  "matchCharacterPersonality": false,
  "matchCharacterDepthPrompt": false,
  "matchScenario": false,
  "matchCreatorNotes": false,
  "delayUntilRecursion": 0,
  "probability": 100,
  "useProbability": true,
  "depth": 4,
  "outletName": "",
  "group": "",
  "groupOverride": false,
  "groupWeight": 100,
  "scanDepth": null,
  "caseSensitive": null,
  "matchWholeWords": null,
  "useGroupScoring": null,
  "automationId": "",
  "role": 0,
  "sticky": null,
  "cooldown": null,
  "delay": null,
  "triggers": [],
  "displayIndex": 0
}
```

### 1.6 对 hiPhone 的启发

- **entries 用 object 还是 array？** ST 用 `{ [uid]: entry }`。好处：O(1) 按 uid 查找、增删稳定。坏处：顺序要靠 `displayIndex` / `order` 再算一次。hiPhone 可以考虑直接用 `array` 简化 —— JSON.stringify 后的顺序就是显示顺序，不需要 `displayIndex` 这种附加字段。如果打算未来做 v2 spec 导入导出，用 array 也能减少映射层。
- **必砍的字段：** `vectorized`（向量检索需要后端配合）、`automationId`、`triggers`（hiPhone 不跑 SlashCommand pipeline）、`characterFilter*`（hiPhone 的绑定关系已经由上层 persona/character 决定，不需要 per-entry 过滤）、`outletName`（macro 注入系统 hiPhone 没有）、`role`（OpenAI 的 system/user/assistant 区分可以先统一为 system）、`matchCreatorNotes` / `matchCharacterDepthPrompt`（hiPhone 没有对应概念）。
- **一期先做：** `id`, `keys`, `secondaryKeys`, `comment`, `content`, `enabled`, `constant`, `selective`, `selectiveLogic`, `order`, `position`（简化为 3 档：before_char / after_char / at_depth）, `depth`, `probability`, `excludeRecursion`, `preventRecursion`, `scanDepth`（覆盖全局）, `caseSensitive`, `matchWholeWords`。大约 18 个字段。
- **二期再加：** `sticky`, `cooldown`, `delay`, `group`, `groupWeight`, `groupOverride`, `ignoreBudget`, `delayUntilRecursion`, 额外匹配源（角色描述/人格）。
- **存储位置：** hiPhone 没有 Node 后端，世界书应当存到 `localStorage` / `IndexedDB`（走现有 `src/platform/stores/` 机制），以"世界书对象的 map"形式而非多个文件。
- **顶层必须有 name：** ST 的顶层 name 是可有可无的，这是历史包袱。hiPhone 应该强制顶层 `{ id, name, description, entries }`，避免命名混乱。

## 2. Character Card V2/V3 内嵌的 character_book 格式

### 2.1 V2 官方 Schema

源：`https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md` L84-111

```ts
type CharacterBook = {
  name?: string;
  description?: string;
  scan_depth?: number;        // agnai: "Memory: Chat History Depth"
  token_budget?: number;      // agnai: "Memory: Context Limit"
  recursive_scanning?: boolean;
  extensions: Record<string, any>;
  entries: Array<{
    keys: Array<string>;
    content: string;
    extensions: Record<string, any>;
    enabled: boolean;
    insertion_order: number;   // 对应 ST 的 order，小数字=插入更靠前
    case_sensitive?: boolean;

    // 无 ST 对应物
    name?: string;             // 显示名，不进 prompt
    priority?: number;         // budget 超限时先丢弃的优先级

    // 无 agnai 对应物
    id?: number;               // 不进 prompt
    comment?: string;          // 不进 prompt
    selective?: boolean;
    secondary_keys?: Array<string>;
    constant?: boolean;
    position?: 'before_char' | 'after_char';
  }>;
};
```

### 2.2 ST 内部 ↔ Character Book 字段映射

关键源文件：`public/scripts/world-info.js :: originalWIDataKeyMap`（L2607-2644），以及反向转换 `convertCharacterBook`（L5480-5537）。

| ST 内部字段 | character_book 路径 |
|---|---|
| `key` | `keys` |
| `keysecondary` | `secondary_keys` |
| `comment` | `comment` |
| `content` | `content` |
| `constant` | `constant` |
| `selective` | `selective` |
| `selectiveLogic` | `selectiveLogic`（ST 扩展，非 v2 spec） |
| `order` | `insertion_order` |
| `disable` | `enabled`（取反） |
| `position`（enum） | v2 spec 只有 `'before_char' \| 'after_char'`，其余全部塞进 `extensions.position`（整数） |
| `depth` | `extensions.depth` |
| `role` | `extensions.role` |
| `probability` | `extensions.probability` |
| `useProbability` | `extensions.useProbability` |
| `excludeRecursion` | `extensions.exclude_recursion` |
| `preventRecursion` | `extensions.prevent_recursion` |
| `delayUntilRecursion` | `extensions.delay_until_recursion` |
| `scanDepth` | `extensions.scan_depth` |
| `caseSensitive` | `extensions.case_sensitive` |
| `matchWholeWords` | `extensions.match_whole_words` |
| `useGroupScoring` | `extensions.use_group_scoring` |
| `automationId` | `extensions.automation_id` |
| `vectorized` | `extensions.vectorized` |
| `group` | `extensions.group` |
| `groupOverride` | `extensions.group_override` |
| `groupWeight` | `extensions.group_weight` |
| `sticky` | `extensions.sticky` |
| `cooldown` | `extensions.cooldown` |
| `delay` | `extensions.delay` |
| `triggers` | `extensions.triggers` |
| `ignoreBudget` | `extensions.ignore_budget` |
| `displayIndex` | `extensions.display_index` |
| `matchPersonaDescription` 等 | `extensions.match_persona_description` 等（snake_case） |

**差异要点：**

1. **entries 容器不同** —— v2 spec 是 `Array<entry>`，ST 内存/磁盘是 `{ [uid]: entry }`。导入时 ST 用 `entry.id ?? index` 作为 uid；导出时把 map 转回 array。
2. **命名风格不同** —— v2 用 snake_case (`insertion_order`, `secondary_keys`, `case_sensitive`)，ST 用 camelCase (`order`, `keysecondary`, `caseSensitive`)。
3. **extensions bag** —— v2 spec 强制 `extensions: {}` 必存在；所有 ST 专属字段都藏在 `extensions.*` 里，这样不支持 ST 的前端只加载最小必要字段也能工作。
4. **enabled 取反** —— v2 是 `enabled`，ST 是 `disable`。
5. **position 的 v2 spec 只支持 2 值**，ST 的 8 种 position 全部通过 `extensions.position`（整数）覆盖。

### 2.3 对 hiPhone 的启发

- **核心决策：要不要兼容 v2 spec？** 如果 hiPhone 计划做"导入角色卡里的 lorebook"这一能力，必须直接采用 v2 字段命名，而不是 ST 风格。如果只做独立的"系统内置世界书"，可以完全用 hiPhone 自己的 camelCase schema。建议**一期用 hiPhone 自己的 schema，二期再做 v2 import/export adapter**。
- **snake_case vs camelCase：** JS/TS 项目用 camelCase 更自然。但要做 v2 兼容时就必须维护一个双向映射表，参考 `originalWIDataKeyMap` 这个 40 行的静态表就够了。
- **enabled vs disable：** 选 `enabled: true` 默认值为 true 更符合直觉，避免 ST 那种"默认 false 等于开启"的反直觉。
- **position 简化：** hiPhone 不做 Author's Note / Example Messages 位置，所以 position 可以只保留 `before_char`, `after_char`, `at_depth` 三档。
- **extensions bag 可以保留：** 即使 hiPhone 短期不用，预留 `extensions: Record<string, unknown>` 字段可以让未来的可选能力（插件、实验性字段）不会造成 schema 破坏。

## 3. 世界卡与角色 / 聊天的绑定机制

ST 有 **4 种作用域**，在运行时由 `getSortedEntries()`（`public/scripts/world-info.js` L4460+）合并。每种作用域存储的位置各不相同。

### 3.1 Global 作用域（用户手动选的"默认启用"世界书）

- 存储：`selected_world_info: string[]` —— 世界书名称数组。
- 持久化：ST 的 settings.json 顶层 `world_info.globalSelect` 字段。
- 代码：`public/scripts/world-info.js` L66 `export let selected_world_info = []`，保存逻辑 L84-87：

```js
const saveSettingsDebounced = debounce(() => {
  Object.assign(world_info, { globalSelect: selected_world_info });
  saveSettings();
}, debounce_timeout.relaxed);
```

- 加载：`getGlobalLore()`（L4397-4412）遍历 `selected_world_info`，对每个名字调用 `loadWorldInfo`。

### 3.2 Character 作用域（绑到一个角色的"主世界书 + 附加世界书"）

- **主世界书（primary book）**：存在角色卡 v2 数据里 `characters[chid].data.extensions.world: string`（单个名字）。引用：L5549 `const world = characters[chid]?.data?.extensions?.world;`
- **附加世界书（auxiliary books）**：存在全局 `world_info.charLore` 数组里，与角色文件名（avatar 文件名）关联：

```ts
// public/scripts/world-info.js  L6023-6036
world_info.charLore = [
  { name: 'Seraphina',        // getCharaFilename() 返回的去扩展名的 avatar 文件名
    extraBooks: ['Book A', 'Book B'] },
  ...
];
```

- 加载：`getCharacterLore()`（L4345-4395）先从 `character.data.extensions.world` 取主书，再从 `world_info.charLore.find(e => e.name === fileName).extraBooks` 拿所有附加书，合并去重后返回。
- **为什么主书存在角色卡里而附加书存在全局 settings 里？** 因为主书必须跟着角色卡一起跨设备导入导出（v2 spec 规定），而附加书是用户在本地组装的"偏好"，不该污染分享出去的角色卡。

### 3.3 Persona 作用域（用户人格绑定的世界书）

- 存储：`power_user.persona_description_lorebook: string`
- 引用：L1093、L4436
- 同时，ST 还支持"persona metadata"的形式，`setPersonaDescription()` 会把这个字段写到 persona 的存储里。
- 加载：`getPersonaLore()`（L4434-4458）

### 3.4 Chat 作用域（单个聊天 session 绑定的世界书）

- 存储：`chat_metadata[METADATA_KEY]` 也就是 `chat_metadata['world_info']: string`
- `METADATA_KEY = 'world_info'`（L94）
- 每个聊天 session 都有自己的 `chat_metadata`，保存在 chat 文件里。
- 加载：`getChatLore()`（L4414-4432）

### 3.5 作用域合并策略

`getSortedEntries()`（L4460+）先并行加载 4 种 lore，然后按 `world_info_character_strategy` 决定合并顺序：

- `evenly (0)`：global + character 全部按 `order` 排序，混合。
- `character_first (1)`：character 优先全部排完，再排 global。
- `global_first (2)`：global 优先。
- chat 和 persona **总是以独立 entries 追加**，不受 strategy 影响。
- 还做了**去重** —— 如果同一本世界书在多个作用域都启用，只计第一次（依次按 global → chat → persona 顺序判断）。

### 3.6 对 hiPhone 的启发

- **4 种作用域是 ST 的历史包袱，hiPhone 不用全要。** 建议一期只做 2 种：
  - **System（= Global）**：在"设置 → 世界卡"里勾选启用的世界书。
  - **Character（= Character.primary）**：每个 AI 角色可以选一本"专属世界书"，存在角色数据里。
- **不要做 charLore / extraBooks** —— 这是 ST 为满足"一个角色绑多本书"设计的。hiPhone 可以让角色的 `worldBookIds: string[]` 直接就是数组，避免双层结构。
- **Chat 作用域** 如果 hiPhone 的 chat 是"每个 chat 独立保存状态"，可以后期做；一期可以不做。
- **Persona 作用域** hiPhone 目前没有"用户人格"概念，跳过。
- **绑定关系存哪里：**
  - System 选中列表：`appRuntimeStore` / `aiConfigStore` 里加 `enabledWorldBookIds: string[]`。
  - 角色主书：`src/apps/XingYu/data.ts` 里 idol 对象加 `worldBookIds?: string[]`。
- **绑定关系 vs 世界书内容要分开存** —— ST 有这个教训：charLore 数组散在 settings 里，重命名世界书时要同步所有引用（L4132-4149 `updateWorldInfoLinks`），很容易漏。hiPhone 应该用稳定的 `worldBookId`（UUID）而不是 name 作为引用，避免 rename 时的级联更新。

## 4. 从磁盘到 Prompt 的完整数据流

### 4.1 写盘路径

```
UI 编辑 → saveWorldInfo(name, data)
  → worldInfoCache.set(name, data)
  → debounced _save(name, data)
    → POST /api/worldinfo/edit { name, data }
      → src/endpoints/worldinfo.js
        → writeFileAtomicSync(worlds/{name}.json, JSON.stringify(data, null, 4))
```

引用：`public/scripts/world-info.js` L4053-4092（`_save` 和 `saveWorldInfo`）；`src/endpoints/worldinfo.js` L134-157。

### 4.2 读盘路径

```
loadWorldInfo(name)
  → 命中 worldInfoCache 直接返回
  → 否则 POST /api/worldinfo/get { name }
    → src/endpoints/worldinfo.js :: readWorldInfoFile
      → fs.readFileSync(worlds/{name}.json) → JSON.parse
  → worldInfoCache.set(name, data)
  → 返回深拷贝
```

`worldInfoCache` 是一个 `StructuredCloneMap`，每次 get 返回深拷贝（L882），保证调用方修改 entry 不会污染缓存。

### 4.3 生成 Prompt 时的调用链

在 `public/script.js` 的 `Generate()`（ST 主生成函数）内部：

```js
// public/script.js  L4546
const {
  worldInfoString, worldInfoBefore, worldInfoAfter,
  worldInfoExamples, worldInfoDepth, outletEntries
} = await getWorldInfoPrompt(chatForWI, this_max_context, dryRun, globalScanData);
```

`getWorldInfoPrompt`（`world-info.js` L892-915）只是 `checkWorldInfo` 的薄包装，返回的 `WIPromptResult` 结构：

```ts
// public/scripts/world-info.js L905-914
{
  worldInfoString:  worldInfoBefore + worldInfoAfter,  // 兼容用
  worldInfoBefore:  string,   // position=before 的 entries 拼成的字符串
  worldInfoAfter:   string,   // position=after  的 entries 拼成的字符串
  worldInfoExamples: Array<{ position: 0|1, content: string }>,  // EMTop/EMBottom
  worldInfoDepth:    Array<{ depth: number, role: number, entries: string[] }>,  // @Depth
  anBefore:         string[], // ANTop
  anAfter:          string[], // ANBottom
  outletEntries:    Record<string, string[]>,  // {outletName: lines}
}
```

### 4.4 每个返回字段在 Prompt 中的落点

基于 `public/script.js` L4546-4646：

| 返回字段 | 注入到 Prompt 哪里 |
|---|---|
| `worldInfoBefore` | 传给 `renderStoryString` 的 `wiBefore` / `loreBefore` 变量 → story string 模板在**角色描述之前**渲染 |
| `worldInfoAfter` | `wiAfter` / `loreAfter` 变量 → 在**角色描述之后**渲染 |
| `worldInfoExamples` | 按 `position` 分别 `unshift`/`push` 到 `mesExamplesArray` → 最终作为**示例对话**拼进 prompt |
| `worldInfoDepth` | 对每个 `{depth, role, entries}` 调 `setExtensionPrompt(CUSTOM_WI_DEPTH_ROLE(...), ..., IN_CHAT, e.depth, false, e.role)` → 作为 **in-chat 注入**从末尾倒数第 depth 条消息处插入 |
| `outletEntries` | 对每个 `setExtensionPrompt(CUSTOM_WI_OUTLET(key), value.join('\n'), NONE, 0)` → 在用户 prompt 里遇到 `{{outlet::key}}` macro 时**文本替换** |
| `anBefore` / `anAfter` | 走 Author's Note pipeline（在 `prepareOpenAIMessages` 中参与拼接），对应 system prompt 的 AN 段落 |

### 4.5 openai.js 里的 ChatCompletion 组装

在 `public/scripts/openai.js :: preparePromptsForChatCompletion`（L1338+）里：

```js
// L1347-1348
{ role: 'system', content: formatWorldInfo(worldInfoBefore), identifier: 'worldInfoBefore' },
{ role: 'system', content: formatWorldInfo(worldInfoAfter),  identifier: 'worldInfoAfter'  },
```

然后在 `addToChatCompletion` 里按 identifier 加入到 ChatCompletion 消息数组。注入顺序由 `prompt_order` 数组（Prompt Manager 配置）决定，`worldInfoBefore` 默认排在 `main` 之后、`charDescription` 之前。

### 4.6 对 hiPhone 的启发

- **数据流完全可以复刻，但要简化。** hiPhone 的 pipeline 建议：

  ```
  worldBookStore (localStorage/IDB)
    → loadEnabledBooks() → [book1, book2, ...]
      → checkWorldInfo(chat, ...) → WIResult
        → injectIntoPrompt(messages, WIResult)
  ```

- **一期只返回 `worldInfoBefore` + `worldInfoAfter`** 就够用了（对应 position=before/after）。`worldInfoDepth` 是 ST 为"让 lore 跟着消息走"设计的，hiPhone 一期可以跳过。`outletEntries` 不要做。`worldInfoExamples` 不做。
- **缓存层：** ST 的 `worldInfoCache` 的两个关键设计值得抄：(a) 命中就返回深拷贝，防止调用方污染；(b) 写入时不深拷贝（save 侧自己保证不会再改）。hiPhone 可以用同样的 pattern。
- **注入位置：** hiPhone 的 AI 请求 pipeline 应该明确一个"prompt 装配函数"（类似 `preparePromptsForChatCompletion`），让 WI 注入作为其中一步；**不要散布在 chat handler 里**。推荐把它放在 `src/platform/ai/providers.ts` 的 message 构造函数之前。
- **system 消息还是 user 消息？** ST 的 WI before/after 都是 system role。hiPhone 建议同样用 system role（多个 system 块），或者用 `<world_info>...</world_info>` XML 包裹后塞进第一个 system 消息里（更 Claude 友好）。
- **API 换成 store 调用：** hiPhone 没有 Node 后端，所以 ST 的 `/api/worldinfo/*` 那层全部换成 zustand store 里的函数即可：`worldBookStore.list()`, `worldBookStore.get(id)`, `worldBookStore.save(book)`, `worldBookStore.delete(id)`。

## 5. 配置 UI 字段清单

### 5.1 全局设置面板（World Info Activation Settings）

引用：`public/index.html` L4665-4780

| UI 标题 | DOM ID | 类型 | 范围 | 默认 | tooltip / 说明 |
|---|---|---|---|---|---|
| Scan Depth | `world_info_depth` | slider | 0-1000 | 2 | 扫描最后 N 条消息 |
| Context % | `world_info_budget` | slider | 1-100 | 25 | WI 最多占 context 的百分比 |
| Budget Cap | `world_info_budget_cap` | slider | 0-65536 | 0 | 硬上限 token 数，0 = 不限制（用百分比） |
| Min Activations | `world_info_min_activations` | slider | 0-100 | 0 | 至少要激活 N 条 entries，否则继续往前扫 |
| Max Depth | `world_info_min_activations_depth_max` | slider | 0-100 | 0 | 配合 Min Activations，最多往前扫多少条 |
| Max Recursion Steps | `world_info_max_recursion_steps` | slider | 0-10 | 0 | 递归扫描最多几轮 |
| Insertion Strategy | `world_info_character_strategy` | select | 0/1/2 | 1 | 三种合并策略（见 §3.5） |
| Include Names | `world_info_include_names` | checkbox | - | true | 扫描时是否把发言人名字也当作 chat 文本 |
| Recursive Scan | `world_info_recursive` | checkbox | - | false | 激活的 entry content 能否再触发其它 entry |
| Case-sensitive | `world_info_case_sensitive` | checkbox | - | false | 关键词匹配是否区分大小写 |
| Match Whole Words | `world_info_match_whole_words` | checkbox | - | false | 单词匹配是否需要整词 |
| Use Group Scoring | `world_info_use_group_scoring` | checkbox | - | false | Inclusion Group 是否按 key 命中数计分 |
| Alert On Overflow | `world_info_overflow_alert` | checkbox | - | false | 预算溢出时弹警告 |

分组（iOS 设置风格的等价映射）：
- **扫描**：Scan Depth / Include Names / Case-sensitive / Match Whole Words
- **预算**：Context % / Budget Cap / Alert On Overflow
- **最小激活**：Min Activations / Max Depth
- **递归**：Recursive Scan / Max Recursion Steps
- **多书合并**：Insertion Strategy / Use Group Scoring

### 5.2 单个 Entry 编辑表单

引用：`public/index.html` L6761-7094（`#entry_edit_template`）

按 DOM 里的排列顺序列出（等同于 ST 默认分组顺序）：

#### 第 1 行：关键词
- `key`（必填，多选 tag 输入） —— Primary Keywords
- `selectiveLogic`（AND ANY / AND ALL / NOT ALL / NOT ANY） —— Logic
- `keysecondary`（多选 tag 输入） —— Optional Filter

#### 第 2 行：Per-Entry Overrides
- `outletName`（text）
- `scanDepth`（number, placeholder="Use global"）
- `caseSensitive`（select: null/true/false） —— Use global / Yes / No
- `matchWholeWords`（select: 同上）
- `useGroupScoring`（select: 同上）
- `automationId`（text）
- `delayUntilRecursion`（number, 叫"Recursion Level"）

#### 第 3 行：Content
- 右上角 4 个 checkbox：`excludeRecursion`（Non-recursable）, `preventRecursion`, `delay_until_recursion`, `ignoreBudget`
- `content`（textarea，8 行，带 token 计数器）

#### 第 4 行：Inclusion Group
- `group`（text） + `groupOverride`（checkbox Prioritize）
- `groupWeight`（number, default 100）
- `sticky`（number, default null）
- `cooldown`（number, default null）
- `delay`（number, default null）

#### 第 5 行：Filter
- `characterFilter`（角色多选 select） + `character_exclusion`（checkbox Exclude）
- `triggers`（多选 select: normal / continue / impersonate / swipe / regenerate / quiet）

#### 第 6 行：底部 Bottom Controls
- `selective`（checkbox）
- `useProbability`（checkbox）
- `addMemo`（checkbox）

#### 第 7 行：Additional Matching Sources（抽屉，默认收起）
- `matchCharacterDescription`
- `matchCharacterPersonality`
- `matchScenario`
- `matchPersonaDescription`
- `matchCharacterDepthPrompt`（Character's Note）
- `matchCreatorNotes`

#### Entry 卡片 header（折叠态，L7095+）
- `comment`（textarea 单行，entry 标题）
- `entryStateSelector`：Constant(🔵) / Normal(🟢) / Vectorized(🔗)
- `position`（radio group：before / after / ANTop / ANBottom / @Depth / EMTop / EMBottom / Outlet）
- `depth`（只有 position=@Depth 时显示）
- `role`（只有 position=@Depth 时显示）
- `order`（number）
- `probability`（number + 百分号）
- 启/禁按钮 `entryKillSwitch`

### 5.3 世界书列表页

引用：L4640 附近 `world_editor_select`，以及 `world-info.js` L2336 附近的 UI 绑定。

主要控件：
- 下拉框列出所有磁盘上的 `.json`（由 `/api/worldinfo/list` 返回）
- "+" 新建按钮 → `createNewWorldInfo`
- 导入按钮（file input，支持 ST/v2/Agnai/Risu/Novel 四种格式）
- 重命名 / 复制 / 删除 / 导出 按钮
- 右侧区域是搜索框 + 批量操作 + sort order

### 5.4 绑定关系的 UI

- **Global 选择器**：多选 select `#world_info`，同时绑定 `selected_world_info`。
- **Character 主书**：角色编辑面板里的 `#character_world` select。
- **Character 附加书**：`#world_button` 弹窗里的 `charLore` 编辑。
- **Chat book**：`chatLorebook.html` 模板里的 `.chat_world_info_selector` select，挂载到 chat 的工具栏。
- **Persona book**：`personaLorebook.html` 模板里的 `.persona_world_info_selector` select，挂载到 user persona 编辑面板。

### 5.5 对 hiPhone 的启发

- **iOS 设置风格的分组建议**（参考 CLAUDE.md 要求"系统 UI 高仿 iOS"）：

  ```
  设置 → 世界卡
  ├─ 启用的世界卡（List，带勾选）
  │   └─ [新建世界卡]
  ├─ 全局激活参数
  │   ├─ 扫描深度            2
  │   ├─ 最大字数占比         25%
  │   ├─ 最少激活条数         0
  │   ├─ 区分大小写          [ ]
  │   ├─ 匹配整词            [ ]
  │   ├─ 递归扫描            [ ]
  │   └─ 最大递归轮数         0
  └─ 高级
      ├─ 合并策略            角色优先 ›
      └─ 分组计分            [ ]

  点进一个世界卡 →
  ├─ 名称、描述（顶部 header 区）
  ├─ 条目（List，每条可点进编辑）
  │   └─ [+ 添加条目]
  └─ 删除世界卡

  点进一个条目 →
  （分 3 个 Section）
  ├─ 基本
  │   ├─ 标题（comment）
  │   ├─ 关键词（key，标签输入）
  │   ├─ 次要关键词（keysecondary）
  │   ├─ 匹配逻辑（selectiveLogic，picker）
  │   └─ 内容（content，多行文本）
  ├─ 激活
  │   ├─ 模式（Normal / Constant，segmented）
  │   ├─ 位置（Before / After / @Depth，picker）
  │   ├─ 深度 N（@Depth 时显示）
  │   ├─ 顺序 order
  │   └─ 概率 %（probability）
  └─ 高级
      ├─ 忽略预算
      ├─ 禁止被递归
      ├─ 禁止递归他人
      ├─ Sticky（留空=关闭）
      ├─ Cooldown
      └─ 覆盖全局扫描参数（展开时显示 scanDepth/caseSensitive/matchWholeWords 三项）
  ```

- **砍掉的 UI 元素（不做）：**
  - Outlet Name
  - Automation ID
  - Recursion Level
  - Vectorized（🔗）模式
  - Inclusion Group + GroupWeight + GroupOverride（一期不做，二期视需求）
  - Character Filter / Exclude
  - Generation Triggers
  - Additional Matching Sources 整个抽屉（6 个 match* 字段）
  - `addMemo` / `useProbability` 这两个 "is this field enabled" 开关 —— hiPhone 直接用"空=禁用"的约定
  - Author's Note Top/Bottom, Example Messages Top/Bottom 位置
- **字段默认值要让用户改得动但默认就可用** —— ST 默认 `selective: true` 但很多新手不懂这意味着什么，建议 hiPhone 默认 `selective: false`，即主关键词命中就触发，次要关键词默认为空。
- **Tooltip 怎么做** —— iOS 风格不该用 hover tooltip，改用 section 下方的灰色说明文字（iOS Settings 的 footer text 风格）。ST 的 tooltip 内容可以原样移植。
- **编辑器的保存策略** —— ST 用的是 debounced 自动保存（写得改着）。hiPhone 的 Notes 应用是返回按钮触发保存，建议世界卡也沿用这个模式（返回即存），更符合 iOS 直觉，省掉"保存按钮"。
- **token 计数器** —— ST 对每个 entry 的 content 都做实时 token 估算。hiPhone 可以先用简单的 `text.length / 2.5` 估算（Claude 的英文经验值），后期再接真实 tokenizer。

## 6. 决策速查：hiPhone v1 推荐 schema

```ts
// 建议放 src/platform/worldBook/types.ts

export interface WorldBook {
  id: string;                   // UUID，稳定引用
  name: string;                 // 显示名
  description?: string;
  createdAt: number;
  updatedAt: number;
  entries: WorldBookEntry[];    // 用 array 而非 map
  extensions?: Record<string, unknown>;  // 预留
}

export interface WorldBookEntry {
  id: string;                   // UUID
  comment: string;              // 标题/memo
  keys: string[];               // 主关键词
  secondaryKeys: string[];      // 次要关键词
  selective: boolean;           // 默认 false
  selectiveLogic: 'AND_ANY' | 'AND_ALL' | 'NOT_ALL' | 'NOT_ANY';
  content: string;
  enabled: boolean;             // 默认 true（不用 ST 的 disable）
  constant: boolean;            // 默认 false
  position: 'before_char' | 'after_char' | 'at_depth';
  depth: number;                // 默认 4，只有 position='at_depth' 时生效
  order: number;                // 默认 100，越大越前
  probability: number;          // 默认 100 (%)
  excludeRecursion: boolean;    // 默认 false
  preventRecursion: boolean;    // 默认 false
  ignoreBudget: boolean;        // 默认 false
  // 覆盖全局（null = 使用全局）
  scanDepth: number | null;
  caseSensitive: boolean | null;
  matchWholeWords: boolean | null;
  // 时间效果（一期可缓上）
  sticky: number | null;
  cooldown: number | null;
  delay: number | null;
  extensions?: Record<string, unknown>;
}

export interface WorldBookGlobalSettings {
  scanDepth: number;              // 默认 2
  contextPercent: number;         // 默认 25 (1-100)
  budgetCap: number;              // 默认 0（0=不限制）
  minActivations: number;         // 默认 0
  maxScanDepth: number;           // 默认 0 (0=不限)
  maxRecursionSteps: number;      // 默认 0 (0=不限)
  insertionStrategy: 'evenly' | 'character_first' | 'global_first'; // 默认 character_first
  includeNames: boolean;          // 默认 true
  recursive: boolean;             // 默认 false
  caseSensitive: boolean;         // 默认 false
  matchWholeWords: boolean;       // 默认 false
  useGroupScoring: boolean;       // 默认 false
  overflowAlert: boolean;         // 默认 false
}

// 绑定关系
// 在 aiConfigStore 里：
//   enabledWorldBookIds: string[]      // Global 作用域
// 在 XingYu idol 对象里：
//   worldBookIds?: string[]             // Character 作用域（允许多本）
```

## 附：引用源文件一览

| 文件 | 核心内容 |
|---|---|
| `public/scripts/world-info.js` L27-38 | `world_info_insertion_strategy`, `world_info_logic` enum |
| `public/scripts/world-info.js` L62-100 | 常量 `DEFAULT_DEPTH=4`, `DEFAULT_WEIGHT=100`, `MAX_SCAN_DEPTH=1000`, `METADATA_KEY='world_info'` |
| `public/scripts/world-info.js` L65-82 | 全局 settings 变量 (`world_info_depth/budget/...`) |
| `public/scripts/world-info.js` L855-869 | `world_info_position`, `wi_anchor_position` enum |
| `public/scripts/world-info.js` L892-915 | `getWorldInfoPrompt` 入口 + `WIPromptResult` 返回结构 |
| `public/scripts/world-info.js` L917-990 | `setWorldInfoSettings` 全局设置读写 |
| `public/scripts/world-info.js` L1086-1181 | `getPersonaBookCallback` / `getCharBookCallback` / `getChatBookCallback`（4 种作用域入口） |
| `public/scripts/world-info.js` L2607-2644 | `originalWIDataKeyMap` 内部 ↔ v2 spec 字段映射表 |
| `public/scripts/world-info.js` L3984-4031 | `newWorldInfoEntryDefinition` + `newWorldInfoEntryTemplate`（**entry 字段全集 source of truth**） |
| `public/scripts/world-info.js` L4039-4051 | `createWorldInfoEntry` |
| `public/scripts/world-info.js` L4053-4092 | `_save` + `saveWorldInfo`（写盘 pipeline） |
| `public/scripts/world-info.js` L4094-4180 | `renameWorldInfo` + `updateWorldInfoLinks`（rename 级联更新所有引用） |
| `public/scripts/world-info.js` L4318-4343 | `createNewWorldInfo`（空模板 = `{ entries: {} }`） |
| `public/scripts/world-info.js` L4345-4458 | `getCharacterLore` / `getGlobalLore` / `getChatLore` / `getPersonaLore` |
| `public/scripts/world-info.js` L4460-4510 | `getSortedEntries` 4 种作用域合并 |
| `public/scripts/world-info.js` L5340-5478 | `convertAgnaiMemoryBook` / `convertRisuLorebook` / `convertNovelLorebook`（第三方格式导入器） |
| `public/scripts/world-info.js` L5480-5537 | `convertCharacterBook`（**v2 spec → ST 内部格式转换**） |
| `public/scripts/world-info.js` L5540-5633 | `setWorldInfoButtonClass` / `checkEmbeddedWorld` / `importEmbeddedWorldInfo` |
| `public/scripts/world-info.js` L5713-5760 | `importWorldInfo`（文件上传分发到 4 个 converter） |
| `public/scripts/world-info.js` L6023-6036 | `charLore` 附加书存储结构 |
| `src/endpoints/worldinfo.js` 全文 | 后端 CRUD `/api/worldinfo/{list,get,delete,import,edit}` |
| `public/script.js` L493-497 | `extension_prompt_roles` enum |
| `public/script.js` L4546 | `getWorldInfoPrompt` 在 Generate() 中被调用的唯一点 |
| `public/script.js` L4549-4592 | worldInfoExamples / worldInfoDepth / outletEntries 如何注入 extension prompt |
| `public/script.js` L4614-4633 | `storyStringParams` 包装 wiBefore/wiAfter 供 story string 模板渲染 |
| `public/scripts/openai.js` L1183-1185, L1338-1348 | ChatCompletion 模式下 `worldInfoBefore`/`worldInfoAfter` 作为 system 消息加入 prompt 数组 |
| `public/index.html` L4665-4780 | 全局 WI 设置面板 HTML |
| `public/index.html` L6761-7094 | `#entry_edit_template` 单条目表单完整 HTML |
| `public/scripts/templates/chatLorebook.html` | chat 作用域绑定 UI |
| `public/scripts/templates/personaLorebook.html` | persona 作用域绑定 UI |
| `malfoyslastname/character-card-spec-v2/spec_v2.md` L84-111 | Character Card v2 `CharacterBook` TypeScript 定义 |
