# hiPhone 多语言系统设计

**日期**：2026-05-05
**状态**：spec — 已完成设计确认，待 implementation plan
**范围**：一次性全量迁移前端展示文案、提示词、工具型 AI 输出语言约束

---

## 1. 用户需求

用户希望“小手机”支持多语言，覆盖三类文本：

1. 前端展示文案：Shell、系统组件、设置、内置 App、用户可见错误提示、Toast/Banner、App 名称等。
2. 提示词：平台 AI prompt、各内置 App prompt、AI 工坊 prompt、翻译 App prompt、摘要/压缩/角色描述生成 prompt。
3. AI 返回文本：系统型、工具型、生成型 AI 输出应能跟随当前界面语言；聊天类角色互动不需要强制切换语言。

已确认决策：

- 第一版内置 `zh-CN` 和 `en-US`。
- 架构必须可扩展，后续能低成本增加 `ja-JP`、`ko-KR` 等语言。
- 语言偏好是全局一份，所有手机主人/角色视角共享。
- 用户选择“一次性全量替换”路线，而不是分阶段只迁移局部。
- AI 回复语言策略不是主要关注点；设计采用保守默认：聊天类继续跟随用户输入语言，系统/工具型 AI 跟随当前界面语言。

## 2. 关键决策

### 2.1 实现路线：一次性全量迁移

本次不做“只给新功能接 i18n”的轻量方案，而是建立完整 i18n 基建后，全项目用户可见文案和内置 prompt 同步迁移。

代价：

- 改动文件多，review 压力大。
- 需要中文硬编码扫描和白名单机制，否则后续容易回退。
- 需要分目录提交或分阶段执行，避免单个改动不可控。

收益：

- 用户能在一次功能交付中看到完整中英文切换体验。
- Prompt、UI、SDK 边界一次定型，后续新增语言只补字典。
- 能把当前散落在 `src/platform/ai`、`src/apps/*`、`src/system`、`src/shell` 的文案债集中清掉。

### 2.2 Locale 范围

第一版支持：

```ts
type Locale = 'zh-CN' | 'en-US';
```

默认 locale 是 `zh-CN`。不跟随浏览器语言自动切换，避免现有中文体验在首次加载时被意外改成英文。后续如需要“跟随系统/浏览器”，可在同一配置字段上扩展一个 `auto` 选项。

### 2.3 全局共享语言偏好

语言偏好属于设备级设置，存入 `useSystemStore.locale`，所有视角共享，不做 per-owner 配置。切换语言不改变任何业务数据，只触发 UI 和新 prompt 渲染使用新 locale。

### 2.4 聊天类 AI 不强制系统语言

角色聊天、AI-AI 聊天等互动类场景继续保留现有“用用户的语言回复”策略。这里的“用户语言”本身也进入模板，中文界面下用中文规则表达，英文界面下用英文规则表达。

工具型、系统型、生成型 AI 明确跟随当前界面语言，例如：

- AI 工坊的操作说明、总结、错误修复说明。
- 角色描述生成器。
- Presence 场景任务中由系统生成的引导/总结。
- Prompt 压缩、摘要、记忆整理任务。
- 内置 App 的 AI 辅助输出，除非该 App 自身另有目标语言设置。

翻译 App 是例外：译文语言由用户选择的目标语言决定，不受系统 locale 影响；只有 UI、错误提示和辅助说明跟随系统 locale。

## 3. 架构设计

### 3.1 核心目录

新增：

```text
src/platform/i18n/
  locales.ts
  dictionary.ts
  I18nProvider.tsx
  useI18n.ts
  format.ts
  promptTemplates.ts
  __tests__/
```

职责：

- `locales.ts`：定义 `Locale`、默认 locale、locale 展示名、合法性判断。
- `dictionary.ts`：字典注册、key 查询、fallback、变量插值、缺 key 警告。
- `I18nProvider.tsx`：React context，订阅 `useSystemStore.locale`。
- `useI18n.ts`：组件层 API，提供 `t`、`locale`、`setLocale`。
- `format.ts`：日期、时间、数字、列表、相对时间等 locale-aware 格式化。
- `promptTemplates.ts`：prompt 模板注册和渲染，给非 React AI 层使用。

### 3.2 字典分域

字典按语言和业务域拆分：

```text
src/platform/i18n/messages/
  zh-CN/
    shell.ts
    system.ts
    settings.ts
    apps.ts
    ai.ts
    errors.ts
  en-US/
    shell.ts
    system.ts
    settings.ts
    apps.ts
    ai.ts
    errors.ts
```

建议 key 命名：

```text
settings.display.title
settings.display.brightness
shell.springboard.searchPlaceholder
system.nav.back
apps.weather.title
ai.prompt.replyFormat.title
errors.ai.notConfigured
```

字典值只放产品文案和 prompt 模板，不放用户数据、角色资料、聊天历史、测试 fixture 或文档内容。

### 3.3 数据流

1. `useSystemStore.locale` 是唯一配置源。
2. `App` 根部包 `I18nProvider`。
3. React 组件使用 `const { t } = useI18n()`。
4. 非 React 代码使用显式 `locale` 参数，或调用只读 helper 读取当前 locale。
5. Prompt 构建函数优先接收 `locale` 参数，测试可显式注入，生产调用默认取当前全局 locale。
6. 切换语言后，Provider 重渲染 UI；后续 AI 请求用新 locale 渲染 prompt。
7. HTML 根节点 `lang` 同步为当前 locale，辅助浏览器无障碍与系统输入法行为。

### 3.4 Settings 入口

语言设置放在设备级设置中。第一版明确放入现有 `设置 > 显示与亮度`，不新增 `语言与地区` 页面，避免为了一个两项选择器扩大导航结构。

- 标题：`语言`
- 当前值：`简体中文` / `English`
- 选择器：iOS List 样式，勾选当前语言。

后续如果语言设置扩展到地区、温度单位、日期格式，再单独立项新增 `语言与地区` 页面。

### 3.5 用户 App SDK

新增 SDK 模块：

```text
@hiphone/i18n
```

第一版暴露：

```ts
useLocale(): Locale
getLocale(): Locale
t(key: string, vars?: Record<string, string | number>): string
formatDate(value: Date | number | string, options?: Intl.DateTimeFormatOptions): string
formatNumber(value: number, options?: Intl.NumberFormatOptions): string
```

用途：

- 内置 translate app 跟随系统语言。
- AI 工坊生成的新 user app 可以读取当前语言。
- 后续用户上传 app 有稳定方式接入系统 locale，不需要 import host 私有模块。

SDK 字典范围只提供平台通用 key。用户 App 自己的业务文案仍应在 App 内自建小字典，避免污染平台字典。

## 4. 迁移范围

### 4.1 必须迁移

- `src/shell/**`：桌面、Dock、状态栏、锁屏、控制中心、App 切换器、Widget 抽屉、Dynamic Island、AssistiveTouch。
- `src/system/**`：NavBar、List、Toast、Banner、Picker、Slider、TextArea、AppScreen 等系统组件。
- `src/platform/appCatalog.ts`、`src/shell/Springboard/apps.data.ts`、`src/apps/registerBuiltins.ts`：App 名称和系统注册名。
- `src/apps/**`：所有内置 App UI 文案、错误提示、空状态、按钮、表单、设置项。
- `src/apps/translate/**`：UI 文案、错误提示、语言选择器辅助文案；翻译目标语言数据保留其原语义。
- `src/platform/ai/**`：promptAssembly、压缩、摘要、记忆、工具注册、错误过滤提示等。
- `src/platform/userApp/**`：SDK 错误信息、AI 工坊能力手册、builder prompt、内置 fixture 中作为推荐样例的可见文案。
- `src/apps/AIAppBuilder/**`：界面文案、agent prompt、工具 observation、导出 prompt。

### 4.2 不强制迁移

以下内容不属于平台展示文案，不应为了 i18n 改写语义：

- `docs/**` 文档。
- 测试 fixture 中专门用于中文能力验证的内容。
- 默认角色资料、世界书条目、聊天 seed、历史消息、用户生成内容。
- 注释和开发者说明，除非它们会进入 UI 或 prompt。
- 第三方 API 返回的地点名、天气描述等原始数据；展示层可格式化，但不修改源数据。

### 4.3 硬编码扫描

新增 Vitest 扫描测试，随 `pnpm test` 运行，扫描 `src/**` 中的中文字符串。扫描不是简单禁止所有中文，而是结合集中白名单：

- 允许字典文件存在中文。
- 允许测试 fixture 和 seed 数据。
- 允许注释。
- 允许正则、中文分词或中文语言检测相关代码。
- 禁止 UI 组件、prompt 拼接、错误提示里新增未登记中文文案。

扫描结果必须进入 `pnpm test`。白名单集中放在 i18n 测试目录下，不在业务文件旁边散落豁免。

## 5. Prompt 设计

### 5.1 Prompt 模板接口

`promptTemplates.ts` 提供两类入口：

```ts
renderPrompt(locale, key, vars)
renderChatProtocol(locale, input)
```

`renderPrompt` 负责具体任务模板：

- `ai.translate.system`
- `ai.presence.scene`
- `ai.gomoku.system`
- `ai.builder.system`
- `ai.compression.passA`
- `ai.compression.passB`
- `ai.compression.passC`
- `ai.characterDescription.system`

`renderChatProtocol` 负责平台统一协议：

- 回复格式。
- JSON 数组结构。
- 工具调用 wire format。
- 可用动作说明。
- 表情包规则。
- 签名更新规则。
- “只输出 JSON，不要额外说明”等约束。

### 5.2 KV cache 约束

现有 `src/platform/ai/AGENTS.md` 要求 System prompt 保持稳定。Locale 是全局低频设置，切换语言时 prompt 前缀变化可接受，但实现仍要遵守：

- 高频变化内容不放入 System block。
- app 专属协议不混入全局 System block。
- tool dynamicContext 不因 i18n 增加副作用。
- Prompt section label 可国际化，但 section 结构不能因语言切换而改变。

### 5.3 Prompt Viewer

Prompt Viewer 的 UI label 跟随 locale。实际 prompt 内容也按当前 locale 渲染，便于用户确认当前发给模型的文本。测试要覆盖同一输入在 `zh-CN` 和 `en-US` 下 section 数量一致、关键结构一致、语言不同。

### 5.4 AI 返回语言

工具型 AI 模板增加明确输出语言变量：

```text
Current interface language: English.
Answer user-visible text in English unless the task explicitly asks for another language.
```

中文模板对应：

```text
当前界面语言：简体中文。
除非任务明确要求其他语言，面向用户展示的文本请使用简体中文。
```

聊天类角色模板保留：

- 中文：`用用户的语言回复，保持角色性格`
- 英文：`Reply in the user's language while staying in character.`

## 6. 错误处理

- 不支持的 locale：回落 `zh-CN`。
- 缺 key：开发环境 `console.warn` 并显示 key；生产环境先 fallback `zh-CN`，再失败显示 key。
- 缺变量：开发环境 warn，渲染时保留 `{var}` 占位，避免静默吞内容。
- Prompt 模板缺失：抛明确错误，不能静默发送空 prompt。
- 字典 key 在某个 locale 缺失：测试失败；运行时 fallback `zh-CN`。
- 切换语言中途有 AI 请求在飞：不取消旧请求。旧请求按发起时 locale 返回，新请求用新 locale。
- 历史数据、摘要、记忆不因 locale 切换自动重写，避免破坏上下文一致性。

## 7. 测试计划

### 7.1 单元测试

- `platform/i18n`：
  - locale 合法性与 fallback。
  - key 查询与变量插值。
  - 缺 key、缺变量行为。
  - `I18nProvider` 对 store 更新的响应。
  - 非 React helper 在测试中可显式 locale。
- `systemStore`：
  - `locale` 默认值。
  - `setLocale` 合法值持久化。
  - 非法 locale 回落。
- `promptTemplates`：
  - 每个 prompt key 在 `zh-CN` / `en-US` 都存在。
  - 关键变量插值完整。
  - chat protocol 结构跨语言一致。

### 7.2 UI 冒烟测试

- Settings 切换 `en-US` 后：
  - 设置首页标题、DisplayPage 文案、语言选择项变英文。
  - 桌面 App 名称变英文。
  - NavBar back 文案和系统组件文案变英文。
  - Toast/Banner 常见文案变英文。
- 切回 `zh-CN` 后恢复中文。

### 7.3 Prompt 测试

覆盖：

- `promptAssembly` legacy 和 unified 两条路径。
- Presence prompt。
- Gomoku prompt。
- AI 工坊 agent prompt 和工具说明。
- Translate app prompt。
- 角色描述生成器 prompt。
- compression pass A/B/C。
- heartbeat agent prompt 和工具 observation。

断言重点：

- `zh-CN` 和 `en-US` 输出语言不同。
- JSON wire format 示例结构一致。
- 工具 type、param 名称不被翻译。
- 用户内容、角色名、App id 不被误翻译。

### 7.4 SDK 测试

- `@hiphone/i18n` 在 sandbox 内可 import。
- user app 中 `useLocale()` 随系统切换更新。
- `t()` 只能访问平台通用 key，未知 key 有 fallback。
- 内置 translate app 使用 SDK 后仍能通过 sandbox smoke test。

### 7.5 扫描测试

新增硬编码中文扫描，至少覆盖：

- UI 组件文件。
- AI prompt 文件。
- SDK 错误信息文件。
- App 注册和 catalog 文件。

白名单文件集中维护，避免散落豁免。

## 8. 里程碑

由于用户选择一次性全量替换，整体功能仍应拆成可验证里程碑执行，每个里程碑对应独立 `docs/plan/yyyy-mm-dd-hhmm-*.md`。

### M1：i18n 基建与设置入口

- 新增 `src/platform/i18n`。
- `useSystemStore.locale`。
- `I18nProvider` 接入根组件。
- Settings 语言选择入口。
- `@hiphone/i18n` SDK 骨架。
- 基础单测。

### M2：Shell/System/Catalog 全量迁移

- Shell 和系统组件文案迁移。
- App catalog、注册名、桌面 App 名、Dock 名迁移。
- 系统 Toast/Banner 文案迁移。
- UI 冒烟测试覆盖中英文切换。

### M3：内置 App UI 全量迁移

- Settings 全部页面。
- Weather、Maps、Calendar、Photos、Notes、Safari、Music、Camera、App Store。
- XingYu、Presence、Gomoku、AI App Builder。
- Translate 内置 user app。
- 每个 App 保持现有 iOS 风格，不因文案替换改变布局。

### M4：AI Prompt 全量迁移

- `promptAssembly`。
- `platform/ai` 压缩、摘要、记忆、心跳、工具注册。
- Presence、Gomoku、AI 工坊、翻译、角色描述生成。
- Prompt Viewer 国际化。
- Prompt 结构测试。

### M5：扫描、收口和回归

- 中文硬编码扫描和白名单。
- 全量测试。
- 关键页面手动/Playwright 截图检查。
- 文档更新：`src/platform/i18n/AGENTS.md`、相关目录 `AGENTS.md` 记录踩坑。

## 9. 验收标准

功能验收：

- 用户可在设置中切换 `简体中文` / `English`。
- 切换语言后，Shell、系统组件、设置、内置 App、App 名称、错误提示同步变化。
- 内置 translate app 和沙箱 user app 能读取当前 locale。
- 系统型/工具型 AI 输出跟随当前界面语言。
- 聊天类 AI 不因系统语言破坏“跟随用户输入语言”的自然行为。

工程验收：

- `pnpm test` 通过。
- 关键 i18n 单测和 prompt 单测通过。
- 扫描测试能阻止新增未登记中文 UI/prompt 文案。
- 不改写用户数据、历史消息、角色资料、世界书、测试 seed 的语义内容。
- 相关目录新增或更新 `AGENTS.md`，记录 i18n key、prompt 模板和白名单规则。
