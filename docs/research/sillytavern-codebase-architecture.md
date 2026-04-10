# SillyTavern 代码架构与配置体系调研

调研日期：2026-04-10

## 关键结论

1. SillyTavern 是一个本地部署的 AI 聊天前端，后端 Node.js + Express，前端 Vanilla JS + jQuery，AGPL-3.0 协议。
2. 核心架构围绕**prompt 组装管线**设计：角色卡 → 世界信息 → Persona → 自定义提示 → 聊天历史 → 宏展开 → 格式化 → 发送给 LLM。
3. 配置分四层：服务器配置（config.yaml）、用户设置（settings.json）、角色级覆盖、聊天级覆盖。
4. 扩展系统基于 Git 仓库，支持生命周期钩子、斜杠命令注册、UI 注入和 prompt 管线干预。
5. 数据全本地存储，聊天用 JSONL 格式（每行一条 JSON），角色卡嵌入 PNG 元数据。

## 1. 目录结构概览

```
/
├── src/                          # 后端
│   ├── server-main.js           # Express 入口
│   ├── character-card-parser.js # PNG 元数据提取
│   ├── endpoints/               # 47+ API 路由
│   │   ├── characters.js        # 角色 CRUD + 缓存
│   │   ├── chats.js             # 聊天持久化 (JSONL)
│   │   ├── groups.js            # 群聊
│   │   ├── worldinfo.js         # Lorebook API
│   │   ├── openai.js            # 多供应商聊天补全
│   │   ├── presets.js           # 生成预设
│   │   ├── settings.js          # 用户设置
│   │   └── extensions.js        # 扩展管理
│   ├── middleware/              # 中间件栈
│   └── tokenizers/              # Token 计数
│
├── public/                       # 前端 SPA
│   └── scripts/
│       ├── power-user.js        # 主设置对象
│       ├── personas.js          # 用户人格
│       ├── world-info.js        # Lorebook 激活与上下文注入
│       ├── PromptManager.js     # Prompt 注入系统
│       ├── authors-note.js      # 浮动作者笔记
│       ├── macros.js            # 宏引擎
│       ├── variables.js         # 变量系统
│       └── slash-commands.js    # 斜杠命令框架
│
├── default/config.yaml          # 服务器默认配置
├── data/                        # 运行时数据（用户创建）
│   ├── characters/              # 角色 PNG
│   ├── chats/{charId}/*.jsonl   # 聊天记录
│   ├── worlds/                  # World Info JSON
│   ├── presets/                 # 按 API 类型分目录
│   └── users/{username}/        # 用户隔离目录
└── plugins/                     # 扩展系统
```

## 2. 配置体系

### 2.1 服务器配置 (default/config.yaml)

```yaml
server:
  port: 8000
  listen: false
  whitelist: ["::1", "127.0.0.1"]

security:
  csrf: true
  basicAuth: false
  multiUserMode: false

cache:
  characterCards:
    memory: 100MB      # MemoryLimitedMap
    disk: true          # node-persist
    diskSyncInterval: 5min

api:
  openai: { apiKey, modelName, reverseProxy }
  anthropic: { apiKey }
  mistral: { apiKey }
  google: { apiKey }
  ollama: { apiUrl }
  # 20+ 供应商

features:
  autoBackup: { enabled, maxBackups: 50 }
  thumbnails: { enabled }
  extensions: { auto-update }
```

### 2.2 用户设置 (power_user 对象 → settings.json)

| 类别 | 关键配置 |
| --- | --- |
| UI/显示 | avatar_style, chat_display (default/bubbles/document), theme, fontSize, compactMode |
| 行为 | autoSwipe, streamingFps, hotkeys, messageEditing |
| 生成 | tokenPadding, instruct mode, context template |
| 流式 | framerate, fadeInEffect, partial messages |

### 2.3 角色级覆盖

角色卡可通过 `system_prompt`、`post_history_instructions` 覆盖全局提示词，通过 `character_book` 嵌入专属 Lorebook，通过 `regex_scripts` 做输出正则替换。

### 2.4 聊天级覆盖

每个聊天的 `chat_metadata` 可覆盖：World Info 深度、Token 预算、局部变量、摘要频率、钉选消息。

## 3. 角色卡数据模型 (Character Card V2)

```json
{
  // 核心身份
  "name": "角色名",
  "description": "人格、外貌、背景",
  "personality": "行为特征",
  "scenario": "当前情境/关系起点",
  "first_mes": "开场白",
  "mes_example": "示例对话 (<START> 分隔)",
  "alternate_greetings": ["备选开场1", "备选开场2"],

  // 提示词覆盖
  "system_prompt": "角色专属系统提示",
  "post_history_instructions": "历史后置指令",

  // 元数据
  "creator_notes": "仅编辑器可见的备注",
  "tags": ["标签"],
  "creator": "作者",
  "character_version": "1.0",

  // 嵌入 Lorebook
  "character_book": {
    "entries": [{
      "keys": ["关键词"],
      "content": "注入内容",
      "selective": true,
      "constant": false
    }]
  },

  // 正则脚本
  "regex_scripts": [{ "findRegex": "pattern", "replaceString": "replacement" }],

  // 平台扩展
  "extensions": { "命名空间/字段": "值" }
}
```

**存储格式**：PNG 文件元数据块内嵌 JSON（V2/V3）；导入导出支持 JSON/YAML/CharX (ZIP)。

**缓存策略**：内存 MemoryLimitedMap（100MB）+ 磁盘 node-persist（5 分钟同步），key 为 `{filename, mtime}`。

## 4. Prompt 组装管线

这是 SillyTavern 最核心的设计。LLM 收到的完整 prompt 由以下层按顺序组装：

```
┌─────────────────────────────────────────────────┐
│ 1. SYSTEM PROMPT                                │
│    角色 system_prompt 或全局默认                   │
├─────────────────────────────────────────────────┤
│ 2. CHARACTER DEFINITION                         │
│    name + description + scenario + mes_example  │
├─────────────────────────────────────────────────┤
│ 3. WORLD INFO / LOREBOOK（动态注入）              │
│    关键词匹配 → 递归扫描 → 按优先级+位置插入       │
│    位置: before_char / after_char / in_note /    │
│          arbitrary depth / custom outlet         │
├─────────────────────────────────────────────────┤
│ 4. PERSONA（用户身份）                            │
│    描述 + 位置(before/after) + 关联 Lorebook      │
├─────────────────────────────────────────────────┤
│ 5. CUSTOM PROMPTS (PromptManager)               │
│    角色级覆盖 / 集合组织 / 注入位置控制 /          │
│    Token 跟踪                                    │
├─────────────────────────────────────────────────┤
│ 6. AUTHOR'S NOTES（浮动提示）                     │
│    三级: 聊天级 > 角色级 > 默认                    │
│    按间隔插入 / 角色分配(system/user/assistant)   │
├─────────────────────────────────────────────────┤
│ 7. INSTRUCT MODE FORMATTING                     │
│    输入/输出序列包装 / 停止序列 / 按模型自动选择    │
├─────────────────────────────────────────────────┤
│ 8. CHAT HISTORY                                  │
│    Token 预算分配 → 老消息裁剪 → 钉选消息保留      │
├─────────────────────────────────────────────────┤
│ 9. MACRO EXPANSION                               │
│    {{time}} {{date}} {{random}} {{roll 2d20}}    │
│    {{getvar::name}} {{setvar::name::value}}      │
├─────────────────────────────────────────────────┤
│ 10. → 发送给 LLM                                 │
└─────────────────────────────────────────────────┘
```

### Token 预算管理

```
总预算 = 模型上下文窗口 (如 Claude 200k)
├─ 预留区: 系统提示 + 角色定义 + World Info + Author's Notes + 自定义提示
├─ 历史区: 剩余预算填充聊天历史（从新到旧）
└─ 生成区: 响应 Token（从模型限制中扣除）

溢出策略: 移除最老消息, 保留钉选消息
```

## 5. World Info / Lorebook 系统

### Entry 结构

```json
{
  "keys": ["触发词1", "触发词2"],
  "secondary_keys": ["上下文关键词"],
  "content": "注入的正文",

  "case_sensitive": false,
  "match_whole_words": true,
  "use_regex": false,

  "insertion_order": 100,
  "depth": 4,
  "position": "before_char",

  "sticky": 3,           // 触发后持续 N 轮
  "cooldown": 0,         // 冷却轮数

  "group": "location_group",
  "group_scoring": true,

  "enabled": true,
  "order": 0
}
```

### 激活流程 (WorldInfoBuffer)

1. 对聊天历史 + 角色数据分词
2. 关键词匹配（支持正则、大小写、全词）
3. 计算激活深度和频率
4. 注入最高分条目
5. 处理递归触发（条目 A 触发条目 B）
6. 应用 sticky/cooldown 效果
7. 按 depth/position 定位插入

### 四种上下文层级

| 层级 | 作用域 |
| --- | --- |
| Global Lore | 全局，所有角色共享 |
| Character Lore | 绑定角色，随角色卡导出 |
| Persona Lore | 绑定用户 Persona |
| Chat Lore | 绑定当前对话分支 |

## 6. Persona 系统

```json
{
  "name": "用户显示名",
  "avatar": "avatar.png",
  "description": "用户身份描述（进入 prompt）",

  "descriptionPosition": "before | after",
  "descriptionDepth": 1,

  "chat_lock": false,
  "character_lock": "charId",
  "defaultPersona": true,

  "associatedLorebook": "world_id.json"
}
```

**自动选择逻辑**：聊天锁定 → 角色绑定 → 默认 Persona。

## 7. 聊天数据模型 (JSONL)

```
第 1 行: chat_metadata (名称、角色 ID、API 设置、局部变量、摘要、钉选消息)
第 2+ 行: 消息 { name, is_user, mes, swipes[], extra{image, api_data} }
```

## 8. 群聊系统

```json
{
  "name": "群名",
  "members": ["char_id_1", "char_id_2"],
  "activation": "natural | list | pooled | manual",
  "generationMode": "SWAP | APPEND | APPEND_DISABLED",
  "autoMode": { "enabled": false, "delay": 1500 }
}
```

**生成策略**：
- natural: 分析消息提及 + 角色健谈度
- list: 按固定顺序轮流
- pooled: 从最近未发言者随机
- manual: 随机单个成员

## 9. 预设系统

按 API 类型分目录（koboldai / novelai / openai / textgen），每个预设包含：

```json
{
  "name": "预设名",
  "temperature": 0.8,
  "top_p": 0.9,
  "frequency_penalty": 0.5,
  "presence_penalty": 0.5,
  "stop_sequences": ["###"],
  "max_tokens": 2048
}
```

## 10. 扩展/插件系统

### Manifest 结构

```json
{
  "name": "extension-name",
  "version": "1.0.0",
  "js": "index.js",
  "css": ["styles.css"],
  "requires": { "clientVersion": ">=1.10.0", "dependencies": [] },
  "hooks": { "install", "update", "delete", "enable", "disable", "activate" }
}
```

### 扩展能力
- 注册斜杠命令
- 添加 UI 元素
- 钩入生成管线
- 监听服务器事件
- 修改 prompt 和变量
- 存储独立设置

### 三种作用域
- System: 内置系统扩展
- Global: 全局扩展（admin 管理）
- Local: 用户本地扩展

## 11. 宏与变量系统

| 类别 | 示例 |
| --- | --- |
| 替换宏 | `{{time}}` `{{date}}` `{{random::a,b,c}}` |
| 骰子 | `{{roll 2d20}}` `{{roll 1d100%}}` |
| 变量读写 | `{{getvar::name}}` `{{setvar::name::value}}` |
| 聊天上下文 | `{{getLastMessage}}` `{{getMessageCount}}` |
| 控制流 | `/if` `/while` `/times` (最多 100 次迭代) |

**变量作用域**：
- Local: 存储在 chat_metadata.variables，聊天级
- Global: 存储在 extension_settings.variables.global，用户级

## 12. Instruct Mode

```json
{
  "name": "模型名",
  "input_sequence": "### Instruction:\n",
  "output_sequence": "### Response:\n",
  "system_sequence_prefix": "### System:\n",
  "stop_sequence": "###",
  "names_behavior": "NONE | FORCE | ALWAYS"
}
```

按模型 ID 正则自动选择对应的 instruct 预设。

## 13. 安全与性能

### 安全中间件栈
Helmet.js → CSRF → CORS → Basic Auth → Host 白名单 → Cookie Session → 请求大小限制(500MB) → DOMPurify

### 性能优化
- 角色浅加载（列表只加载 name/avatar/chat_count，选中才加载完整数据）
- Lorebook 懒加载（仅生成时按需加载）
- 设置防抖保存（聚合多次变更）
- 备份节流（最多 10 分钟一次）
- 磁盘缓存 5 分钟同步间隔

## 对 hiPhone 项目的启发

### 1. Prompt 管线是核心架构
SillyTavern 的分层 prompt 组装管线值得借鉴：每层有明确职责和插入位置，而不是把所有东西塞进一个字符串。hiPhone 如果做 AI 角色，应该在架构层面就设计类似的分层注入机制。

### 2. World Info 的动态激活模式
关键词触发 + 递归扫描 + sticky/cooldown 的设计非常成熟。hiPhone 可以用类似思路管理"设备上下文"——当用户打开某个 app、到达某个位置、到达某个时间时，动态注入对应的设定。

### 3. Persona 独立于角色
SillyTavern 把 Persona 做成独立资产并支持锁定/绑定，说明"用户是谁"在角色扮演中是一等公民。hiPhone 如果做"住在手机里的 AI"，用户 Persona 是必须的。

### 4. 四层配置覆盖
全局 → 角色 → 聊天 → 扩展，每层都可以覆盖上层。这种设计让默认体验简单，深度定制也有空间。

### 5. JSONL 聊天存储
每行一条 JSON，append-only，第一行是元数据。比单个 JSON 文件更适合长对话，避免每次写全量。

### 6. 角色卡嵌入 PNG
用 PNG 元数据块存储角色 JSON，一个文件既是头像又是完整角色数据，非常适合分享和导入。

## 参考来源
1. SillyTavern GitHub: https://github.com/SillyTavern/SillyTavern
2. SillyTavern Docs: https://docs.sillytavern.app
