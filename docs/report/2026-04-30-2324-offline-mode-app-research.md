# 线下模式 App 外部调研报告

日期: 2026-04-30 23:24

## 调研问题

hiPhone 计划新增“线下模式 app”：角色和玩家的互动不再使用聊天软件范式，而是模拟两个人在线下真实共处、一起活动、面对面互动。本报告调研现有 AI companion、虚拟角色、AR/VR companion、生活模拟游戏和生成式 agent 研究中的实现方式。

2026-04-30 23:23 补充定义：用户所说的“线下模式”更准确地说是“现场式/小说式互动”。重点不是先做真实 AR，也不是先做完整 The Sims 式生活模拟，而是让角色脱离聊天 App 的气泡范式，处在某个具体场景里与玩家互动。AI 输出应同时包含台词和非语言描写，例如动作、眼神、神态、表情、距离变化、姿态变化；常见文本表达方式是用括号承载非语言内容。

2026-04-30 23:23 再次补充：线下模式不能被设计成死协议。用户明确希望给 AI 自由，不要要求它按固定 JSON 字段、固定枚举或固定动作集合输出。系统要做的是改变 AI 的上下文身份：它不是在聊天软件里回复消息，而是在某个具体场景里面对玩家，可以做任何符合角色、关系和场景的合理行为。括号式非语言描写是推荐表达，不是唯一格式；AI 可以自由组合台词、动作、眼神、神态、姿态、环境互动和主动行为。

## 核心结论

1. 市面 AI companion 大多没有真正摆脱“聊天内核”，而是通过 3D/Live2D 头像、语音/视频通话、AR 放置、主动消息、自拍/短视频和记忆系统增强“在场感”。
2. 真正接近“线下共处”的机制主要来自生活模拟游戏和生成式 agent：场景、时间、角色状态、行动队列、环境 affordance、事件流、日程计划和反思记忆。
3. 适合 hiPhone 的方向不是再做一个聊天 UI，而是做一个“共处场景 app”：主屏是房间/地点，角色以当前状态和动作存在，玩家通过轻量动作、场景物件、活动卡和语音/短句介入。
4. LLM 不应负责每一帧或每个小动作。更稳的架构是本地状态机/效用 AI 负责日常行为，LLM 只负责高语义事件：选择活动、生成回应、总结记忆、解释意图。
5. “角色像真的在生活”需要 offscreen life：即使玩家离开，角色也能按日程、心情和未完成事件推进状态；回来时看到的是“你不在时发生了什么”，而不是空白聊天框。

基于用户补充，第一版优先级应调整为：先做“自由场景叙事”和“非语言现场感”的稳定体验，再做复杂自主生活模拟。也就是说，线下模式的最小可行形态是一个 scene runner，而不是 chat renderer；但 scene runner 不能把 AI 输出锁进硬协议，主数据应是 AI 自由生成的场景文本。

## 案例梳理

### Replika：聊天产品外包一层具身体验

Replika 仍以 AI companion 聊天为核心，但官方把 AR、视频通话、记忆、Diary 和活动作为并列能力。AR 模式从聊天中的 Activities 入口启动，可以把角色放进真实世界，并支持出声对话回应。

可借鉴点：

- 聊天不是唯一入口，AR/视频/活动是“模式切换”。
- 角色有头像、记忆、Diary，能给长期陪伴提供连续性。
- AR 的本质是把“屏幕内的人”放到“用户所处环境”，哪怕交互仍是语音/文本。

局限：

- 多数互动仍然从 chat 输入或 call 开始。
- 没看到完整的场景状态、行动队列或角色自主生活模拟。

### Character.AI：从开放聊天转向多模态内容与结构化剧情

Character.AI 的 Character Calls 提供实时双向语音，低延迟、可打断，并可在文字和语音间切换。2025 年 Stories 则把角色互动转成“结构化、视觉化、多路径”的剧情格式；AvatarFX 负责把角色图像转成带声音和动作的视频。

可借鉴点：

- 语音通话适合模拟“在一起说话”，但仍像电话，不是同处一室。
- Stories 把开放聊天收束成场景节点和选择，能避免对话无限散开。
- 视频/动画负责让角色“做事”，不是只“说话”。

局限：

- Stories 更像互动小说，不是实时生活模拟。
- AvatarFX 偏内容生成，不适合作为实时交互底层。

### Nomi / Kindroid / Digi：记忆、主动性、多人/场景容器

Nomi 提供可选主动消息，角色可在用户离开后主动延续对话。Kindroid 强调多层记忆、可配置人格、自拍、语音/视频和 groupchat。Digi 把 Worlds 定义为跨多场景的地点/剧本容器，一个 world 里可以有一组 digis，本质上已经接近“场景先于聊天”。

可借鉴点：

- 主动消息说明角色不能只被动等输入；需要可配置的主动频率和边界。
- 多层记忆和可视化记忆有利于长期陪伴，但需要分清事实、关系、事件和剧情状态。
- World/scene 是线下模式的关键抽象：同一个角色在不同地点、活动和关系阶段应有不同行为。

局限：

- Nomi/Kindroid 的主要承载还是 chat、call、image。
- Digi 的 Worlds 很有启发，但公开资料不足以确认内部是否有强模拟系统。

### AOi / Live2D companion：让角色“在屏幕里活着”

AOi 的 App Store 页面强调 Live2D 动作、触摸互动、关系等级、每日更新的社交 feed、角色日常照片/视频和 special episodes。

可借鉴点：

- 角色 idle、听、说、害羞、开心等状态可以通过 Live2D/动画承载。
- 日常 feed 是一种 offscreen life 伪装：角色好像在玩家没打开 app 时也有自己的生活。
- 关系等级和 episode 能把亲密度进展变成可解锁内容。

局限：

- 公开信息看，核心仍是 1:1 对话与内容消费。
- 互动自由度可能低于真正的场景模拟。

### Gatebox / Xiora / AR companion：空间存在感

Gatebox 是“虚拟家用机器人”范式：角色出现在盒子中，通过语音识别交流，也可以联动家中灯光和空调；外出时用手机 app 继续联系。Xiora 则是 Meta Quest 上的真人大小 AI companion，把角色放进用户真实房间的混合现实中。

可借鉴点：

- 线下感来自“空间锚定”：角色在房间里、身边、桌边、沙发旁。
- 家居/设备/环境联动会让角色不只是会说话，而是能参与现实生活流程。
- 手机上可以用“房间视图 + 角色站位 + 当前活动”模拟空间锚定，不必一开始做真 AR。

局限：

- 这些方案依赖硬件、摄像头、MR/AR 或专用设备。
- hiPhone 当前更适合先做 2D/轻 3D 场景模拟，再考虑 AR。

### Pokémon GO Buddy / 虚拟宠物：陪伴通过日常活动和需求条建立

Pokémon GO Buddy Adventure 把伙伴放到地图上，通过喂食、一起走路、AR 抚摸、拍照、对战、到访新地点等动作获得 affection。核心不是长对话，而是“共同做事 + 可见进展 + 轻反馈”。

可借鉴点：

- 线下共处可以用低成本动作闭环实现：吃饭、散步、学习、看电影、做饭、休息。
- 需求条/心情/亲密度不是数值装饰，而是决定角色何时出现、何时主动、何时给奖励。
- 现实时间和周期性衰减能制造“陪在身边”的持续感。

局限：

- Buddy 更偏宠物/收集养成，情感复杂度低。
- 需要避免把人形角色做成需要玩家不断喂养的负担。

### The Sims / 生成式 agents：真正的“线下共处”底层

The Sims 的关键不是自然语言，而是角色自主性、需求、物件交互、玩家指令、行动队列和可视化反馈。公开设计文档中提到 autonomy、interaction threshold、priority、player-directed interaction、other-character-initiated interaction 等机制；前 Sims 4 AI 程序员也解释过 Sims 会按 cadence 根据 motives、traits 等重新评估下一步，但不会做深度长期计划，因为过多自主性会让玩家失去叙事控制。

Stanford/Google 的 Generative Agents 则给了 LLM 时代的架构：观察、记忆流、反思、计划，让 agent 在一个类 The Sims 小镇里醒来、吃饭、工作、午餐、聊天、组织活动。论文明确指出 observation、planning、reflection 都对可信行为有贡献。

可借鉴点：

- 本地模拟层负责“现在该做什么”：需求、心情、地点、活动、对象 affordance、行动队列。
- LLM 负责“为什么这么做/怎么说/事件如何变成记忆”：高层语义和社交解释。
- 玩家必须能看懂角色意图：气泡、状态标签、动作动画、短句、日程卡。
- 自主性需要可控，不能让角色完全抢走玩家叙事权。

局限：

- 完整小镇模拟成本高，不适合第一版。
- LLM agent 容易人格漂移、记忆污染、计划不可执行，需要强约束和动作白名单。

## 对 hiPhone 的建议模型

### 产品形态

建议第一版叫“线下模式”或“共处模式”，做成独立 app，也允许从角色详情/聊天 app 进入。首屏不展示消息列表，而展示一个 iOS 风格的场景视图：

- 顶部：居中标题、返回、当前地点、角色状态。
- 主区域：房间/地点背景、角色头像或 Live2D/轻动画、当前动作。
- 底部：Dock 式活动栏，包含聊天、一起做、场景、记忆、设置。
- 事件层：顶部横幅通知展示角色主动事件，例如“她在厨房准备咖啡，问你要不要一起”。

更贴近用户定义的第一版 UI 可以是“小说式现场窗口”：

- 每轮回复不是一条 chat bubble，而是一段场景片段。
- 角色台词和非语言描写可以自然混排；括号内动作/眼神/表情可使用较轻的字体或独立舞台指示样式，但不强制 AI 一定使用括号。
- 角色头像/半身像可以先通过轻量情绪推断切换神态，不要求第一版真实 3D，也不要求模型显式输出枚举。
- 玩家输入不只是“发消息”，可以输入自然语言动作，例如“我走到她旁边坐下”，也可以说话或切换场景。
- UI 要服务自由文本，而不是要求自由文本服务 UI 协议。

### 核心循环

1. 玩家进入场景。
2. 系统根据当前时间、角色日程、心情、关系、最近事件选择一个角色状态。
3. 玩家选择一个动作：靠近、说一句、一起做饭、散步、看电影、学习、休息、换地点。
4. 本地模拟器先校验动作是否可执行，再调用 LLM 生成自然反馈、动作结果和记忆候选。
5. 角色状态和关系数值更新；重要事件进入 memory，普通动作只进入短期 event log。
6. 玩家离开后，offscreen life 按低频 tick 推进，回来时生成“你不在时”的摘要事件。

### 最小技术架构

- `OfflineWorld`: 当前地点、可用物件、可用活动、时间段、天气/氛围。
- `CharacterPresenceState`: 角色位置、姿态、心情、精力、亲密度、当前动作、是否可打断。
- `ActivityDefinition`: 活动 id、地点要求、耗时、参与人数、状态影响、LLM prompt 模板。
- `ActionQueue`: 玩家指令、角色自主动作、其他角色触发动作，按优先级执行。
- `EventLog`: 可回放的短期事件。
- `MemoryCandidate`: 仅保存高价值情感/关系/承诺/偏好事件。
- `SoftSceneGuidance`: prompt 级软约束，告诉 AI 当前不是聊天软件，而是在具体场景中面对玩家，可以自由做合理行为。
- `RendererHints`: 可选后处理，从自由文本中弱推断表情、姿态、语气，用于 UI 增强；推断失败时仍按原文渲染。

针对小说式现场互动，建议把 AI 输出分为“主表达”和“辅助推断”：

- 主表达是自由场景文本，完整保存，不要求 JSON，不要求固定字段。
- prompt 鼓励 AI 在需要时描写动作、眼神、表情、姿态、距离、环境互动和语气。
- prompt 明确 AI 可以主动做合理的事，例如走近、坐下、移开视线、拿起杯子、提议一起出门、改变话题或对环境做反应。
- 本地系统只对安全、角色一致性、场景合理性和不可执行行为做边界处理。
- UI 可以从文本中识别括号、引号、语气词或情绪关键词来做样式和头像变化，但这些只是增强层，不是模型输出协议。

### 第一阶段不要做

- 不要先做完整 3D 小镇。
- 不要让 LLM 每隔几秒自主生成行为。
- 不要把所有事件都写长期记忆。
- 不要让线下模式退化成一个“背景图 + 聊天框”。
- 不要用过强养成需求条制造负担。

## 已证实与待证实

已证实：

- Replika 官方提供 AR、视频通话、记忆、Diary 等 companion 能力。
- Character.AI 官方提供 Character Calls、Stories、AvatarFX 等非纯文本体验。
- Nomi 官方提供主动消息，Kindroid 官方提供多层记忆、自拍、语音/视频和 groupchat。
- Pokémon GO Buddy 官方使用喂食、行走、AR 抚摸、拍照、心情/好感等低成本陪伴机制。
- Stanford/Google Generative Agents 论文采用记忆、反思、计划架构模拟类 The Sims 社会。

待证实：

- Digi Worlds 内部是否真的有自动日程/状态推进，公开页面只确认 world/scenes/group chat 等概念。
- AOi 是否有强 offscreen life 模拟，公开页面更像 daily feed 与 episode。
- Xiora 的实际交互深度、记忆与活动系统，需要设备实测或更多官方技术资料。

## 资料来源

- Replika 官网与帮助中心: https://replika.ai/ , https://help.replika.com/hc/en-us/articles/360046395771-How-do-I-start-AR-Augmented-Reality-with-my-Replika
- Character.AI Calls / Stories / AvatarFX: https://blog.character.ai/introducing-character-calls/ , https://blog.character.ai/introducing-stories-a-new-way-to-create-play-and-share-adventures-with-your-favorite-characters/ , https://blog.character.ai/avatar-fx-cutting-edge-video-generation-by-character-ai/
- Nomi: https://nomi.ai/
- Kindroid: https://landing.kindroid.ai/
- Digi: https://digi.ai/
- AOi App Store: https://apps.apple.com/us/app/aoi-live2d-character-ai/id6451235944
- Gatebox: https://www.j-mediaarts.jp/en/award/single/gatebox/index-2.html
- Xiora: https://xiora.com/
- Pokémon GO Buddy Adventure: https://niantic.helpshift.com/hc/en/6-pokemon-go/faq/2155-buddy-adventure/
- Generative Agents paper: https://arxiv.org/abs/2304.03442
- Stanford HAI summary: https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior
- The Sims 设计文档与访谈: https://donhopkins.com/home/TheSimsDesignDocuments/TheSimsDesignDocumentDraft5-DonsReview.pdf , https://www.pcgamer.com/games/the-sims/sims-dont-plan-anything-says-former-sims-4-developer-though-he-always-wanted-to-program-them-to-its-always-shot-down-rightfully-so/
