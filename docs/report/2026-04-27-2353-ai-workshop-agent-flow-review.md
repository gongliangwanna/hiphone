# AI 工坊 AGENT 流程复盘报告

## 研究范围

本报告基于当前仓库代码与文档，重点阅读：

- `src/platform/userApp/` user app 运行时、SDK、沙箱、安装链路。
- `src/apps/AIAppBuilder/` AI 工坊与 `agent/` ReAct 循环。
- `src/apps/translate/` 完整翻译内置 user app。
- `src/platform/userApp/__tests__/fixtures/ai-translator-app/` 早期 AI 翻译 fixture。
- `docs/superpowers/specs/2026-04-26-translate-app-design.md`
- `docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md`
- `docs/plan/2026-04-27-0245-ai-app-builder-v1.5-agentic-impl.md`

注意：本轮开始时仓库不存在 `docs/report/` 目录，也未找到既有翻译 demo 报告。因此无法引用用户提到的旧报告内容；本文件是本次新生成的复盘报告。

2026-04-28 补充：用户进一步要求纳入局部修改、主流规划模式、SDK 上下文、多文件生成、Tailwind 默认使用策略。本报告已补充对应分析。

## 当前架构判断

user app 主链路已经成型：TSX 源码字符串经 `compileTsx` 编译为 CommonJS 风格 JS，再由 `executeInSandbox` / `createUserAppRuntime` 执行，裸模块 import 只能命中 SDK 白名单，相对路径只能解析到草稿文件。安装路径通过 `installer.install` 完成 manifest 校验、编译、IDB 持久化、`installedUserAppsStore` 更新和 `appRegistry` 注册。

翻译 App 是当前最有价值的上限样本：它不是普通 host App，而是内置 user app，源码物理在 `src/apps/translate/`，再通过 Vite `?raw` 注入 `BUILTIN_USER_APPS`，启动时走完整 compile → sandbox → register 链路。它覆盖 `@hiphone/ai`、`@hiphone/storage`、`@hiphone/motion`、`@hiphone/toast`、`@hiphone/ui`、多文件相对 import、per-owner 存储、异步状态和 sheet 交互。

AI 工坊 V1.5 已经从一次性 JSON 生成切到私有 ReAct 工具循环。它有 9 个工具：读写删文件、列文件、编译检查、读 fixture、更新计划、标记步骤、finish。UI 也能展示工具调用卡、计划卡和 finish 消息。这是正确方向，但当前 runner 仍偏“工具执行器”，缺少“完成门禁、诊断反馈、样本对齐、持久化上下文”几块能力。

## 主要问题

### P0：finish 没有被硬性绑定到可安装状态

`runBuilderAgent` 收到 `finish` 后直接发出完成事件并返回，没有验证草稿是否包含 `manifest.json`、entry 是否存在、全量 `compile_check` 是否为空错误。`AIAppBuilderApp` 只用 `draftFiles` 非空判断是否展示安装按钮。结果是 agent 可以在未编译通过或甚至缺少 manifest 的情况下结束，用户再点安装才失败。

应优化为：runner 层拦截 `finish`，自动执行一次全量 gate。gate 至少包含 `manifest.json` 存在、`validateManifest` 通过、`manifest.entry` 存在、所有 TS/TSX 编译通过、import 解析通过、dry-render 通过。失败时把结构化错误作为工具结果回灌给模型，禁止进入 ready/install 状态。

### P0：`compile_check` 的成功语义容易误导

`compile_check` 即使发现编译错误，也返回 `{ok: true, data: {errors: [...]}}`。这对 LLM 可读，但 UI 的工具卡会把 `ok: true` 渲染为成功，状态也不会切到 `compile-error`。用户看到的反馈和实际草稿质量不一致。

应优化为：保留 `data.errors`，但当 errors 非空时设置工具结果 `ok: false`，或新增 `severity/status` 字段。UI 和 store 状态都应能明确表现“检查执行成功，但草稿未通过”。

### P0：`compile_check` 未检查 manifest.entry 缺失

全量 `compile_check` 中 dry-render 如果发现 `compiledMap[entry]` 不存在会直接跳过，而不是报错。这个错误会推迟到 `installer.install` 的 `entry-missing`，不利于 agent 自修。

应优化为：全量检查时 manifest 有效后必须校验 `entry` 在草稿文件中存在；缺失时返回 `{path:'manifest.json', message:'manifest.entry ... not found'}`。

### P1：AGENT 上下文没有真正使用完整 chatHistory

V1.5 计划文档写的是“system prompt + state digest + history + tool calls flattened”，但当前 `runBuilderAgent` 每轮启动只组装当前 userMessage 和简短 state digest。它能让模型通过 `read_file` 看当前代码，但看不到之前用户的长期意图、约束和取舍，跨多轮 refinement 会退化。

应优化为：把 persisted chatHistory 压缩成短 transcript，至少保留最近 N 个用户需求、finish summary、失败诊断和关键 plan 状态。工具调用可以摘要化，不要把大文件内容直接塞进历史。

### P1：缺少局部修改语义，容易演变成全局改写

当前工具只有 `write_file({path, content})`，agent 修改一个按钮颜色也要重写整个文件。虽然这比 V1 的全量文件 JSON 好，但仍然缺少“只改这一段”的操作边界，也缺少 diff 预览。实际结果会倾向全文件重写，带来两类风险：一是丢失用户上一轮局部调整，二是大文件越写越不稳定。

应优化为：引入局部编辑工具，而不是只靠 `write_file`。

- `replace_range({path, startLine, endLine, content})`：按行替换，适合小范围修复。
- `replace_text({path, oldText, newText})`：精确文本替换，要求 oldText 唯一匹配，否则失败。
- `append_to_file({path, content})` / `insert_before` / `insert_after`：适合补 helper、补导出、补样式常量。
- UI 上展示“局部 diff 卡”，默认折叠，用户能看见本轮改动范围。

长期可以让 agent 在修改前输出 `edit_intent`：目标文件、预计修改区域、为什么只改这些区域。这样“局部修改”不只是工具层能力，也进入规划和用户可见反馈。

### P1：工具结果回灌格式太弱

当前工具调用和结果都作为普通 `assistant` / `user` 消息追加。没有 provider-native tool role，也没有统一 envelope，例如 `TOOL_RESULT compile_check: ...`。对模型来说，这更像用户自然语言，不像严格的工具观测。

短期应规范成明确的文本协议；长期可接入 provider-native tool calling 或项目统一工具 wire format。

### P1：AI 工坊引用的翻译 fixture 落后于真实翻译 demo

`read_fixture('ai-translator-app')` 读取的是 `src/platform/userApp/__tests__/fixtures/ai-translator-app/`，只有 `manifest.json` 和一个简易 `App.tsx`，主要验证 `@hiphone/ai.complete`。真实翻译 demo 在 `src/apps/translate/`，已经验证了多文件结构、语言选择、历史收藏、per-owner 存储和 motion sheet。

应优化为：把真实翻译 demo 提炼成可供 agent 读取的高质量 blueprint。不要直接给全量文件轰炸上下文，可以拆成：

- `translate-core`: AI 调用、状态机、错误处理。
- `translate-storage`: per-owner history/favorites schema。
- `translate-ui`: iOS 风格 NavBar、面板、sheet、motion 模式。
- `translate-sandbox-rules`: 禁止 host import、CSS module、外部 npm 等。

### P1：SDK 能力上下文不足，模型不知道“该用 SDK 还是自己写”

当前 prompt 只列了 SDK 名称和少量函数，例如 `@hiphone/storage: get/set`、`@hiphone/ai: complete/streamComplete`。但对 agent 来说，这还不够：它不知道每个 SDK 的能力边界、典型用法、反例，以及哪些 UI/业务能力应该自己实现。

应优化为构建 `user-app-capability-manual`，作为 agent 可读取的上下文，而不是把所有说明塞进 system prompt：

- `sdk-capabilities`: 每个 `@hiphone/*` 模块的导出、参数、返回值、常见错误。
- `when-to-use-sdk`: AI、storage、toast、banner、motion、nav、services 必须走 SDK；列表、面板、表单、sheet、卡片、业务状态通常自己用 React + Tailwind 实现。
- `sandbox-limits`: 禁止 window/document/fetch/localStorage/CSS imports/npm 包。
- `patterns`: per-owner KV、AI complete、stream/cancel、history/favorites、bottom sheet、multi-file component split。

工具层可新增 `read_capability({topic})`，让 agent 按需读取，而不是每次把完整手册塞入上下文。

### P1：多文件生成没有被流程强制，导致实际输出偏单文件

虽然 runtime 支持多文件相对 import，翻译 demo 也是多文件结构，但 AI 工坊 prompt 只说“可以逐个写入代码文件”，没有明确模块拆分标准。模型为了省轮次，容易把所有逻辑、样式、hook 都塞进 `App.tsx`。

应优化为默认多文件 scaffolding：

- 小应用最少：`manifest.json`、`App.tsx`、`components/*` 或 `hooks/*`。
- 涉及持久化：必须拆 `hooks/useXxx.ts` 或 `storage.ts`。
- 涉及常量/选项：拆 `constants/*.ts`。
- 涉及复杂 UI：拆 `components/` 或 `panels/`。
- 只有极小 demo 才允许单文件，且需要在 plan 里说明原因。

可以新增 `scaffold_app({kind, files})` 或让 plan gate 检查“非 trivial 需求是否至少 3 个文件”。

### P1：Tailwind 应成为默认样式路径

当前 prompt 提到“inline style 或 Tailwind className”，但没有偏好顺序。翻译 demo 大量使用 Tailwind utility + CSS 变量，这也是沙箱里最稳的样式方式。生成 app 如果大量写 inline style，会让文件变长、局部修改困难、视觉一致性变差。

应优化为：prompt 和 capability manual 明确“默认使用 Tailwind utility + hiPhone CSS 变量，只有动态值或复杂计算才用 inline style”。同时要求：

- 背景、文字、分隔线优先用 `var(--color-*)`。
- 常规布局优先 Tailwind：`flex`、`gap-*`、`px-*`、`rounded-*`、`text-*`。
- 不 import CSS 文件，不用 CSS module。
- 组件内少量 keyframes 或极特殊样式才允许 `<style>`，并在 compile/design check 中标记。

### P1：规划模式需要从 TODO 升级为“研究→澄清→计划→确认→执行”

当前 `update_plan` 只是让模型列 3-6 个步骤，缺少主流 agent 规划模式里的几个关键环节：先只读研究代码/能力，再提出计划，允许用户修改计划，确认后才写文件，执行中动态更新计划。

外部对标的共同点：

- Claude Code Plan Mode 强调 read-only 分析，先澄清目标，再提出计划，用户确认后执行。
- Cursor Planning 强调 agent 自动生成 TODO、依赖关系、实时更新，并把计划显示在聊天界面；Cursor 2025 Plan Mode 还强调可编辑 Markdown 计划和代码库研究。

AI 工坊应实现更轻量但同构的版本：

1. `research`：只允许 `list_files`、`read_file`、`read_fixture/read_capability`，不允许写文件。
2. `clarify`：需求不完整时问 1-3 个关键问题。
3. `plan`：产出可编辑计划，包含文件清单、数据结构、SDK 使用、需要自己实现的模块、验收标准。
4. `approve`：用户确认或修改计划后进入执行；简单需求可自动跳过确认，但仍要生成 plan。
5. `execute`：按 plan 局部修改，持续 mark_step。
6. `review`：finish 前执行 compile/design gate，总结改动和剩余风险。

### P1：没有生成后预览，文档与 UI 文案仍残留“预览”

当前 `AIAppBuilderApp` 注释明确说半屏 preview 已移除，流程是 chat → install → springboard。但 release note 和 `BuilderChat` empty state 仍说 preview。实际用户要安装后才能打开，反馈回路变长。

建议分两步：先修正文档和 UI 文案；再补一个“沙箱全屏预览/临时打开草稿”模式，而不是半屏嵌入。这样既不破坏窄屏布局，又能在安装前观察实际渲染。

### P1：计划状态没有和 agent session 一起恢复

`builderPlanStore` 是 memory-only，chatHistory 持久化但 plan store 不持久化。刷新后 UI 里旧 plan-update 还在聊天记录中，但 state digest 里的 plan 为空，下一轮 agent 也丢失计划状态。

应优化为：启动 runner 前从最近一个 `plan-update` turn 恢复 plan store，或让 `buildStateDigest` 直接从 chatHistory 推导最新计划。

### P2：缺少“需求澄清/范围确认”阶段

当前 prompt 默认马上 update_plan 和写文件。对模糊需求（例如“做个记账 app，好看点”）容易过早实现，缺少目标用户、数据结构、核心流程、是否需要 AI/存储/服务等决策。

可引入轻量澄清策略：当需求缺少关键字段时，允许 agent 先输出一个 `finish` 之外的 `agent-text` 澄清问题，或新增 `ask_user` 状态。但要限制数量，避免把生成体验拖慢。

### P2：缺少面向生成 app 的 lint/UX guard

现有 compile_check 能抓语法、import、部分 render-time 错误，但无法抓 iOS 设计约束、文本溢出、按钮可点面积、背景色对比、使用卡片嵌套、营销式 hero 等问题。翻译 demo 的价值就在于它建立了一套可复用 UI 模式。

建议新增 `design_check` 或把检查拆进 `compile_check` 的扩展诊断：

- 禁止 host 私有 import。
- 检查明显不合规的 CSS/DOM/global API。
- 检查页面是否包含 `NavBar` 或合理的全屏 edge-to-edge 声明。
- 生成 app 默认用 CSS 变量和 Tailwind utility，不硬编码大面积非系统色。
- 对按钮、输入区、底部 sheet 给出最小尺寸和可访问名称建议。

## 推荐路线

### 短期补强

1. 给 `finish` 加强制 gate：全量 compile_check + manifest.entry 存在 + dry-render 通过。
2. 修正 `compile_check` 结果语义：errors 非空时 UI 和 runner 都视为未通过。
3. 在 `compile_check` 补 entry-missing 检查。
4. 修正文档和 UI 中“preview”残留文案。
5. 将最近 chatHistory 和 latest plan 纳入下一轮 agent state digest。

### 下一阶段架构

1. 把完整翻译 demo 提炼成 agent blueprint，替换或补强早期 `ai-translator-app` fixture。
2. 增加“临时预览草稿”入口，使用真实 user-app runtime 全屏打开，不恢复半屏 preview。
3. 增加 `diagnose` / `repair` 风格的内部循环：每轮写文件后自动检查，失败自动把诊断喂回模型。
4. 给 agent 工具结果定义统一 envelope，减少模型把工具结果当普通用户指令的概率。
5. 增加局部编辑工具和 diff 展示，让 refinement 默认小范围修改。
6. 增加 `read_capability` / SDK 能力手册，明确 SDK 使用边界与自实现边界。
7. 将 plan 升级为 research/clarify/plan/approve/execute/review 状态机。

### 长期方向

1. Provider-native tool calling。
2. 生成 app 的可视化 QA：Playwright 打开临时草稿、截图、console error、基础可点击流。
3. 生成测试：至少让 agent 产出 hook/pure logic 的 vitest，平台负责运行。
4. 多草稿历史与版本 diff，让用户能回退到上一个可用版本。
5. 为生成 app 建立 blueprint library：翻译、todo、记账、计时器、AI 小工具、列表型 CRUD、游戏型 app。

## 验证

已运行：

```bash
npm test -- src/apps/AIAppBuilder/agent src/apps/AIAppBuilder/__tests__ src/apps/translate src/platform/userApp/__tests__/translate.sandbox.test.ts src/platform/userApp/__tests__/builtinUserApps.test.ts
```

结果：14 个测试文件通过，109 个测试通过。

## 外部规划模式参考

- Claude Code Plan Mode / common workflows：read-only 分析、澄清目标、提出计划、用户确认后执行。
- Cursor Planning / Plan Mode：自动 TODO、依赖关系、实时更新、计划可见，可编辑 Markdown 计划，执行前研究代码库。

