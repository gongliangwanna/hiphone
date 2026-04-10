# SillyTavern World Info 动态激活系统深度拆解

调研日期：2026-04-10

## 关键结论

1. World Info 的核心是 `WorldInfoBuffer` 类，它维护三个缓冲区：**深度缓冲**（聊天历史按深度切片）、**递归缓冲**（已激活条目反哺的内容）、**注入缓冲**（当前周期的有效注入）。
2. 激活算法是一个**三阶段状态机**：INITIAL（初始扫描）→ RECURSION（递归扫描）→ MIN_ACTIVATIONS（深度扩展），每个阶段的缓冲区组合不同。
3. 关键词匹配有三种模式：**正则优先** → **全词匹配** → **子串匹配**，按优先级回退。
4. 评分系统只做**加法**——主键匹配数 + 次键匹配数，负向逻辑（NOT_ANY/NOT_ALL）只做过滤不影响分数。
5. 时间效果系统（sticky/cooldown/delay）让条目具有**生命周期**，这是实现"活人感"的关键机制之一。

## 1. WorldInfoBuffer 核心架构

### 三个缓冲区

```
#depthBuffer     聊天消息按深度排列（最多 MAX_SCAN_DEPTH=1000 条）
                 ↑ 构造时通过 #initDepthBuffer(messages) 初始化

#recurseBuffer   已激活条目的 content 累积
                 ↑ 通过 addRecurse(message) 追加

#injectBuffer    当前扫描周期的有效注入内容
```

缓冲区拼接时用 `'\x01'`（SOH 字符）作为分隔符，避免跨条目的误匹配。

### 构造参数

```javascript
new WorldInfoBuffer(messages, globalScanData)

globalScanData = {
  trigger: string,                // 触发源文本
  personaDescription: string,     // 用户 Persona 描述
  characterDescription: string,   // 角色描述
  characterPersonality: string,   // 角色性格
  characterDepthPrompt: string,   // 角色深度提示
  scenario: string,               // 情境
  creatorNotes: string            // 创作者笔记
}
```

### 缓冲区组装 (get 方法)

`get(entry, scanState)` 组装当前条目的搜索文本：

```
1. 深度缓冲切片: #startDepth → entry 配置的扫描深度
2. 全局扫描数据（按条目 match 标志选择性追加）:
   ├─ matchPersonaDescription     → 追加 Persona 描述
   ├─ matchCharacterDescription   → 追加角色描述
   ├─ matchCharacterPersonality   → 追加角色性格
   ├─ matchCharacterDepthPrompt   → 追加深度提示
   ├─ matchScenario               → 追加情境
   └─ matchCreatorNotes           → 追加创作者笔记
3. 注入缓冲内容
4. 递归缓冲内容（MIN_ACTIVATIONS 状态下排除！防止反馈循环）
```

## 2. 关键词匹配算法 (matchKeys)

### 三种匹配模式（按优先级）

```
模式 1: 正则匹配（最高优先级）
  IF key 能解析为有效正则 (parseRegexFromString)
  THEN keyRegex.test(haystack)

模式 2: 全词匹配（matchWholeWords 启用时）
  多词 key: 直接子串匹配（经过大小写变换）
  单词 key: 构造词边界正则 /(?:^|\W)(escapedKey)(?:$|\W)/
           ↑ 标点符号不算词边界

模式 3: 子串匹配（默认回退）
  haystack.includes(transformedString)
```

### 大小写处理

```javascript
transformString(str, entry) {
  const caseSensitive = entry.caseSensitive ?? world_info_case_sensitive;
  return caseSensitive ? str : str.toLowerCase();
}
```

每个条目可独立控制大小写敏感，覆盖全局设置。

## 3. 评分算法 (getScore)

```
getScore(entry, scanState):
  bufferState = get(entry, scanState)   // 组装搜索文本
  primaryScore = 0
  secondaryScore = 0

  // 统计主键匹配数
  FOR each key in entry.key:
    IF matchKeys(bufferState, key, entry): primaryScore++

  // 无主键 → 零分（立即返回）
  IF entry.key.length == 0: RETURN 0

  // 统计次键匹配数（如果有次键）
  IF entry.keysecondary.length > 0:
    FOR each key in entry.keysecondary:
      IF matchKeys(bufferState, key, entry): secondaryScore++

    SWITCH entry.selectiveLogic:
      AND_ANY:  RETURN primaryScore + secondaryScore
      AND_ALL:  IF secondaryScore == 全部次键数量:
                  RETURN primaryScore + secondaryScore
                ELSE:
                  RETURN primaryScore  // 次键未全中，不加分
      NOT_ANY:  // 不影响分数（仅过滤）
      NOT_ALL:  // 不影响分数（仅过滤）

  RETURN primaryScore
```

**核心原则**：
- 主键是激活的**必要条件**（无主键 = 不可能激活）
- 次键是**加分项**（NOT 逻辑只做过滤不做扣分）
- 分数 = 匹配的关键词数量（不是权重）

## 4. 扫描状态机

### 三种状态

```
INITIAL (1)         初始扫描，使用配置的扫描深度
    ↓
RECURSION (2)       已激活条目 content 加入 recurseBuffer，重新扫描
    ↓
MIN_ACTIVATIONS (3) 如果激活数 < 阈值，扩展深度再扫描
```

### 深度扩展机制

```javascript
getDepth()      → world_info_depth + this.#skew
advanceScan()   → this.#skew++
```

当 `world_info_min_activations > 0` 且激活数不足时：
1. `#skew` 递增 1
2. 重新扫描（更深的历史纳入搜索范围）
3. 重复直到激活数达标或达到 `world_info_min_activations_depth_max`

**关键**：MIN_ACTIVATIONS 状态下**排除递归缓冲**，防止无限循环。

## 5. 递归扫描流程

```
1. 初始扫描激活一批条目
2. IF world_info_recursive 启用:
   ├─ 将已激活条目的 content 加入 #recurseBuffer
   ├─ 重新扫描（包含递归缓冲）
   ├─ 新命中的条目继续反哺
   └─ 受 world_info_max_recursion_steps 限制
3. 递归稳定后输出最终激活集合
```

**用途**：条目 A 的内容包含条目 B 的关键词 → A 激活后自动触发 B。例如：
- 条目"东京"被触发 → content 中提到"新宿" → 条目"新宿"也被激活

## 6. World Info Entry 完整数据结构

```javascript
{
  // 身份
  uid: string,                    // 唯一标识
  world: string,                  // 所属 World Info 文件

  // 触发
  key: string[],                  // 主键（必须，无主键则永远不激活）
  keysecondary: string[],         // 次键（加分/过滤）
  content: string,                // 注入的正文

  // 匹配行为
  caseSensitive: boolean,         // 大小写敏感（覆盖全局）
  matchWholeWords: boolean,       // 全词匹配
  useGroupScoring: boolean,       // 组评分
  selectiveLogic: enum,           // AND_ANY | AND_ALL | NOT_ANY | NOT_ALL

  // 搜索范围（选择性扫描哪些内容）
  matchPersonaDescription: boolean,
  matchCharacterDescription: boolean,
  matchCharacterPersonality: boolean,
  matchCharacterDepthPrompt: boolean,
  matchScenario: boolean,
  matchCreatorNotes: boolean,

  // 控制
  constant: boolean,              // 常驻条目（跳过匹配，始终激活）
  disable: boolean,               // 强制禁用
  order: number,                  // 优先级权重（降序）

  // 角色过滤
  characterFilter: {
    names: string[],              // 角色名列表
    tags: string[],               // 标签 ID 列表
    isExclude: boolean            // true=排除名单, false=包含名单
  },

  // 插入位置
  position: enum,                 // 见下方位置表
  depth?: number,                 // atDepth 模式的深度值

  // 时间效果
  sticky: number,                 // 激活后持续 N 轮
  cooldown: number,               // sticky 结束后冷却 N 轮
  delay: number,                  // 延迟 N 轮后才允许激活

  // 元数据
  comment: string,
  extensions?: object
}
```

## 7. 常驻条目 vs 触发条目

| 类型 | constant | 激活方式 | 排序优先级 |
| --- | --- | --- | --- |
| 常驻 | true | 始终包含，跳过关键词匹配 | tier 0（最高） |
| 触发 | false | getScore() > 0 才激活 | tier 1 |
| 禁用 | disable=true | 永远不激活 | tier 2（最低） |

**常驻条目的典型用途**：核心世界观规则、系统级约束、角色不可违背的基础设定。

## 8. 时间效果系统 (WorldInfoTimedEffects)

### 三种效果

```
delay       条目被创建/重置后，等待 N 轮才允许激活
  ↓
sticky      条目激活后，持续 N 轮保持激活（即使关键词不再匹配）
  ↓
cooldown    sticky 结束后，进入冷却，N 轮内不可激活
  ↓
normal      冷却结束，回到正常状态
```

### 生命周期

```
[创建] → delay(N轮) → [可激活] → [关键词命中] → sticky(N轮) → cooldown(N轮) → [可激活]
                                                    ↑                                │
                                                    └────────────── 再次命中 ────────┘
```

### 状态存储

存储在 `chat_metadata.timedWorldInfo`，key 格式为 `"${entry.world}.${entry.uid}"`。

每个效果记录：
- hash: 条目哈希
- start: 开始消息序号
- end: 结束消息序号
- protected: 是否受保护（防止 swipe 操作误删）

## 9. 插入位置系统

### 7 种位置

| 值 | 名称 | 说明 | UI 显示 |
| --- | --- | --- | --- |
| 0 | before | 角色定义之前 | ↑Char |
| 1 | after | 角色定义之后 | ↓Char |
| 2 | ANTop | Author's Note 之前 | @AN↑ |
| 3 | ANBottom | Author's Note 之后 | @AN↓ |
| 4 | atDepth | 聊天历史指定深度 | @D |
| 5 | EMTop | 示例消息之前 | @EM↑ |
| 6 | EMBottom | 示例消息之后 | @EM↓ |
| 7 | outlet | 自定义插件注入点 | @OL |

### 分发策略 (world_info_insertion_strategy)

| 策略 | 说明 |
| --- | --- |
| character_first | 角色级条目优先于全局条目 |
| global_first | 全局条目优先 |
| evenly | 交替插入角色和全局条目 |

## 10. Token 预算管理

```
world_info_budget          百分比预算（默认 25%）
world_info_budget_cap      硬性 Token 上限（优先于百分比）
world_info_overflow_alert  超预算时是否警告

执行流程：
1. 按激活顺序累积条目
2. 每条用 getTokenCountAsync() 计算 Token
3. 累积总量 > 预算时：
   ├─ budget_cap > 0: 使用绝对上限
   └─ 否则: 使用百分比上限
4. 超出预算的条目被截断/排除
5. overflow_alert 启用时弹出警告
```

## 11. 角色过滤

```javascript
characterFilter: {
  names: ['alice.png', 'bob.png'],
  tags: ['tag_id_1', 'tag_id_2'],
  isExclude: false
}
```

| isExclude | 含义 |
| --- | --- |
| false | 条目**仅对**名单内的角色生效 |
| true | 条目对**除了**名单内的角色外所有角色生效 |

支持按角色文件名和标签 ID 两种维度过滤。

## 12. 强制激活系统

```
外部激活 Map: WorldInfoBuffer.externalActivations
Key: "${entry.world}.${entry.uid}"

触发方式:
- WORLDINFO_FORCE_ACTIVATE 事件
- @@activate 装饰器（强制激活）
- @@dont_activate 装饰器（强制禁用）
```

外部激活跳过正常的评分流程，直接标记条目为已激活。

## 13. 条目排序与冲突解决

三级排序：

```
1. 主排序: 评分（搜索分数 / 自定义索引 / order 字段 / 指定排序字段）
2. 次排序: order 字段降序 (b.order - a.order)
3. 决胜: uid 升序

示例:
  条目 A: score=5, order=100, uid='a'
  条目 B: score=5, order=100, uid='b'
  条目 C: score=3, order=150, uid='c'

  最终顺序: A → B → C（A/B 同分同 order，uid 决胜）
```

## 14. 完整激活流程 (checkWorldInfo)

```
1. 创建 WorldInfoBuffer(chat, globalScanData)
   ├─ 初始化深度缓冲
   └─ 存储全局扫描数据

2. 加载条目
   ├─ structuredClone() 防止原始数据被修改
   ├─ addMissingWorldInfoFields() 补全缺失字段
   └─ 按 order/uid 排序

3. 初始扫描 (INITIAL)
   FOR each entry:
   ├─ 检查 characterFilter → 不匹配则跳过
   ├─ 检查 disable → true 则跳过
   ├─ 检查 externalActivations → 有则强制激活
   ├─ getScore(entry, INITIAL) → 评分
   ├─ 检查时间效果 (sticky/cooldown/delay)
   ├─ score > 0 或 强制激活 → 加入已激活集合
   └─ 激活的条目 content → 加入 #recurseBuffer

4. 递归扫描 (RECURSION)
   IF world_info_recursive 启用:
   ├─ 用包含 recurseBuffer 的扩展缓冲重新扫描
   ├─ 限制: world_info_max_recursion_steps
   └─ 新命中继续反哺

5. 最小激活数扫描 (MIN_ACTIVATIONS)
   IF world_info_min_activations > 0:
   WHILE 已激活数 < 阈值:
   ├─ advanceScan() → #skew++
   ├─ 用扩展深度重新扫描
   ├─ 排除递归缓冲（防循环）
   └─ 受 min_activations_depth_max 限制

6. Token 预算执行
   ├─ 累加所有已激活条目的 Token
   ├─ 超预算则截断/排除
   └─ 触发 overflow_alert（如启用）

7. 按位置分组
   ├─ 按 7 种 position 分类
   └─ 应用 insertion_strategy

8. 返回 WIPromptResult
   {
     worldInfoBefore:   位于角色定义之前的内容,
     worldInfoAfter:    位于角色定义之后的内容,
     worldInfoExamples: 示例消息位置的内容,
     worldInfoDepth:    深度注入的内容,
     anBefore:          Author's Note 之前,
     anAfter:           Author's Note 之后,
     outletEntries:     自定义注入点映射
   }
```

## 15. 全局配置项汇总

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `world_info_depth` | - | 默认扫描深度（往回看几条消息） |
| `world_info_budget` | 25 | Token 预算百分比 |
| `world_info_budget_cap` | 0 | 硬性 Token 上限（0=仅用百分比） |
| `world_info_recursive` | false | 是否启用递归扫描 |
| `world_info_max_recursion_steps` | - | 最大递归步数 |
| `world_info_min_activations` | 0 | 最小激活条目数（0=不强制） |
| `world_info_min_activations_depth_max` | - | 深度扩展上限 |
| `world_info_case_sensitive` | false | 全局大小写敏感 |
| `world_info_overflow_alert` | false | 超预算警告 |
| `world_info_insertion_strategy` | - | 分发策略 |

## 参考来源

- SillyTavern/public/scripts/world-info.js (WorldInfoBuffer, checkWorldInfo, matchKeys, getScore)
- SillyTavern/src/endpoints/worldinfo.js (后端 CRUD)
