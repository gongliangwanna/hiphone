# AI 酒馆角色资产调研

调研日期：2026-04-07

## 关键结论
1. 在现有 AI 酒馆生态里，真正承载“角色”的核心资产仍然是角色卡。兼容性最稳的公共底座仍是 Character Card V2；Character Card V3 已经把多资产、CHARX 打包、来源追踪等能力补上，更适合做更完整的角色包。
2. SillyTavern 的 UI 层面只要求 `Character Name` 就能创建角色，但那只够“能跑”。如果要做一个可复用、可分享、人格稳定的角色，至少还需要：角色描述、性格摘要、场景、开场白、示例对话。
3. 当角色开始依赖世界设定、名词解释、地点/组织/规则、长期记忆时，Lorebook/World Info 就从“可选增强”变成“实际必需”。否则这些信息只能硬塞进角色描述，既浪费上下文，也难维护。
4. Persona 不是角色卡的附属品，而是“用户如何进入这段关系”的独立资产。恋爱、陪伴、长期互动类角色尤其依赖 Persona，因为它决定 `{{user}}` 在系统里的身份、关系站位和记忆入口。
5. 真正成熟的角色包通常不只是一张卡，还会附带：角色 Lorebook、用户 Persona、提示词覆盖、开场集合、情绪资源、版本与来源元数据，以及平台私有扩展。

## 角色相关资产分层

### 1. 最小可运行资产
这套信息足以让角色开始对话，并且人格不至于完全漂移。

| 资产 | 作用 | 常见字段 |
| --- | --- | --- |
| 角色卡 | 定义角色是谁、怎么说话、在什么情境里出现 | `name` `description` `personality` `scenario` `first_mes` `mes_example` |

### 2. 推荐齐套资产
这套信息适合“可长期使用、可分发、可扩展”的角色。

| 资产 | 作用 | 常见字段 |
| --- | --- | --- |
| 角色卡增强字段 | 控制体验而不只是补人设 | `creator_notes` `system_prompt` `post_history_instructions` `alternate_greetings` `tags` `creator` `character_version` |
| Character Book / 世界卡 | 按触发条件动态插入设定和记忆 | `keys` `content` `enabled` `insertion_order` `scan_depth` `token_budget` |
| Persona | 定义用户在这段关系里的身份 | 名字、头像、描述、注入位置、锁定关系、Persona Lorebook |
| 资源文件 | 让角色更像“住在设备里” | 头像、表情、背景、语音、主题资源 |

### 3. 高阶增强资产
这类内容常常不是跨平台标准，但会显著影响体验。

| 资产 | 用途 |
| --- | --- |
| Character Note / Author's Note | 在固定深度反复注入角色约束或状态 |
| Group-only greetings | 让角色在群聊和单聊里有不同开场 |
| Automation / Script hooks | 触发事件、自动动作、状态机 |
| Asset bundle / CHARX | 把角色卡、资源、背景、表情和附加文件一起打包 |
| Source / creation metadata | 追踪来源、版本和演化历史 |

## 角色卡一般需要哪些信息

### 兼容性最稳的公共基线：Character Card V2
Character Card V2 保留了 Tavern 生态最常见的 6 个基础字段：

1. `name`：角色名。
2. `description`：角色定义主文本，通常放身份、背景、外观、关系、能力边界。
3. `personality`：性格摘要。
4. `scenario`：默认情境或关系起点。
5. `first_mes`：开场白。
6. `mes_example`：示例对话，主要用于塑造语气、篇幅和表达习惯。

V2 在此基础上增加了 6 组非常重要的增强字段：

1. `creator_notes`：给使用者看的备注，不进入 prompt。
2. `system_prompt`：角色自己的系统提示词覆盖位。
3. `post_history_instructions`：历史后置指令覆盖位，通常比前置提示更强。
4. `alternate_greetings`：额外开场，用于 swipe 或多起点场景。
5. `character_book`：直接嵌入角色卡内的 Lorebook。
6. `tags` `creator` `character_version` `extensions`：分类、作者、版本和平台私有扩展。

### 只做“能聊”与做“能长期聊”的差别
SillyTavern 官方文档明确写了：`Character Name is the only required field.` 但这只是创建 UI 的最低门槛，不等于好的角色资产最小集合。

更实用的最小集合应当是：

1. `name`
2. `description`
3. `personality`
4. `scenario`
5. `first_mes`
6. `mes_example`

如果是“伴侣型 AI”或“住在手机里的 AI”，建议默认再加：

1. `system_prompt`
2. `post_history_instructions`
3. `alternate_greetings`
4. `character_book`
5. `creator_notes`

## 世界卡 / Lorebook 一般需要哪些信息

### Lorebook 的职责
Lorebook 不是“第二张角色卡”，而是一个按关键词或规则动态注入上下文的知识层。它特别适合承载：

1. 世界观规则
2. 地点、组织、人物关系
3. 手机系统设定、app 语义、设备能力
4. 长期关系记忆
5. 阶段性剧情状态

### Lorebook 的核心字段
无论叫 World Info、Lorebook 还是 Memory Book，核心结构都接近：

1. `keys`：触发关键词。
2. `content`：被插入 prompt 的正文。
3. `enabled`：是否启用。
4. `insertion_order`：插入顺序/优先级。
5. `extensions`：平台私有扩展。

常见的全局级字段：

1. `name`
2. `description`
3. `scan_depth`
4. `token_budget`
5. `recursive_scanning`

常见的高级 entry 字段：

1. `secondary_keys` / optional filter：附加触发条件。
2. `use_regex` 或 regex keys：正则触发。
3. `constant`：常驻插入。
4. `case_sensitive`
5. `position` / `depth` / `role`：插入位置和角色。
6. `priority`
7. `comment` / `id` / `name`
8. `group` / inclusion logic / probability
9. `timed effects`
10. `character filter` / `triggers`

### Lorebook 在 SillyTavern 里的四种上下文层级
SillyTavern 已经把 Lorebook 分成不同绑定范围，这对本项目很有参考价值：

1. Global Lore：全局设定。
2. Character Lore：只对某个角色生效，可嵌入角色卡导出。
3. Persona Lore：只对当前用户 Persona 生效。
4. Chat Lore：只对当前对话分支生效。

这意味着“一个角色需要哪些信息”其实不能只问角色卡本身，还要问这些信息属于哪一层。

## Persona 一般需要哪些信息

Persona 解决的是“用户是谁”，不是“角色是谁”。

SillyTavern 官方 Persona 文档里，核心组成是：

1. Name：用户在对话里的显示名。
2. Avatar：用户头像。
3. Description：用户描述，可包含身份、年龄、职业、关系设定、身体特征等。
4. Position：Persona 描述注入 prompt 的位置。
5. Title：展示用附加标题，不进入 prompt。
6. Locks / Connections：和角色或聊天的绑定关系。
7. Persona Lorebook：只随这个 Persona 激活的 Lorebook。

如果你的产品要做“AI 伴侣住在手机里”，Persona 几乎是必备资产。否则系统很难稳定知道用户在这段关系里是恋人、主人、搭档、家人，还是第一次见面的陌生人。

## 生态趋势判断

判断（基于官方文档仍以 CCV2 为兼容底座、而 CCV3 已补充资产与打包能力）：

1. 如果目标是兼容现有 AI 酒馆生态，优先做 `CCV2 + extensions` 最稳。
2. 如果目标是做你自己的前端生态，并且角色会带表情、背景、用户图标、语音或脚本资源，应该从一开始就按“角色包”思维设计，而不是只做一张卡。
3. V3/CHARX 的思路很适合你这个项目，因为“手机里的 AI”天然就是多资产实体，不只是文本设定。

## 对 luna 项目的启发

### 建议的角色资产拆分
建议把一个角色拆成 5 层：

1. `card.json`
   角色人格、关系、说话风格、开场、示例对话。
2. `lorebook.json`
   世界设定、手机系统知识、长期记忆、app 语义、关系里程碑。
3. `persona.json` 或 `persona.md`
   用户自我设定、关系站位、注入位置。
4. `runtime-preset.json`
   系统提示、后置指令、模型偏好、主动性策略。
5. `assets/`
   头像、表情、背景、语音、主题资源。

### 推荐的兼容策略
1. 对外导入导出时，以 CCV2 兼容结构为底座。
2. 平台私有能力统一进 `extensions`，并使用命名空间，例如 `luna/character_note`、`luna/memory_policy`、`luna/device_affordances`。
3. 长期记忆不要全塞进角色卡描述，而是分到 Lorebook 的不同层级。
4. 主动行为、Agent 任务和设备状态不要混进角色人格字段，应该作为独立运行态保存。

### 为什么这对项目很重要
你的目标不是“聊天机器人皮肤”，而是“住在手机里的 AI 伴侣”。这类产品要把静态人格、动态记忆、用户身份、设备上下文、资源表现分层管理。AI 酒馆生态已经证明：只靠一张角色卡很快会撞到上下文、维护性和扩展性的天花板。

## 本次收集到的公开素材

已落盘到 `resource/ai-tavern/` 的公开素材主要分三类：

1. MIT 协议的角色卡生成提示词模板。
2. MIT 协议的 Lorebook 生成提示词模板。
3. Unlicense 的 Lorebook 生成示例脚本。

另外补了 4 份本地模板：

1. `character-card-v2-template.json`
2. `lorebook-v3-template.json`
3. `persona-template.md`
4. `role-asset-bundle-checklist.md`

## 参考来源
1. SillyTavern Docs: Character Design
   https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/Characters/characterdesign.md
2. SillyTavern Docs: World Info
   https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/worldinfo.md
3. SillyTavern Docs: Personas
   https://github.com/SillyTavern/SillyTavern-Docs/blob/main/Usage/personas.md
4. Character Card V2 Specification
   https://github.com/malfoyslastname/character-card-spec-v2/blob/main/spec_v2.md
5. Character Card V2 Explainer
   https://github.com/malfoyslastname/character-card-spec-v2/blob/main/README.md
6. Character Card V3 Specification
   https://github.com/kwaroran/character-card-spec-v3/blob/main/SPEC_V3.md
7. cha1latte/sillytavern-character-generator
   https://github.com/cha1latte/sillytavern-character-generator
8. cha1latte/universal-lorebook-creator
   https://github.com/cha1latte/universal-lorebook-creator
9. TaleirOfDeynai/NAI-Lore-Helper
   https://github.com/TaleirOfDeynai/NAI-Lore-Helper
