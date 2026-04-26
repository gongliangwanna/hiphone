/**
 * Build the system prompt for AI 工坊's code-generation LLM call.
 *
 * Includes: output format spec, manifest schema, SDK module list, and
 * 2 fixture user apps as few-shot examples (todo-app + ai-translator-app).
 *
 * Few-shot fixture content is loaded via Vite's `?raw` import so it
 * works in both prod build and tests. The fixtures live in
 * src/platform/userApp/__tests__/fixtures/ and are also used as
 * compile/install regression targets — same source, no drift.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import todoManifest from '@/platform/userApp/__tests__/fixtures/todo-app/manifest.json?raw';
import todoApp from '@/platform/userApp/__tests__/fixtures/todo-app/App.tsx?raw';
import todoUtils from '@/platform/userApp/__tests__/fixtures/todo-app/utils.ts?raw';
import translatorManifest from '@/platform/userApp/__tests__/fixtures/ai-translator-app/manifest.json?raw';
import translatorApp from '@/platform/userApp/__tests__/fixtures/ai-translator-app/App.tsx?raw';

export function buildSystemPrompt(draftId: string): string {
  return `你是 hiPhone 平台的"AI 应用工坊"代码生成助手。用户用自然语言描述想要的 app,你生成完整的多文件 user app 代码。

[输出格式]
你必须只输出一个 JSON 对象,形如:
{
  "files": [
    {"path": "manifest.json", "content": "<JSON 字符串>"},
    {"path": "App.tsx", "content": "<TSX 代码>"},
    {"path": "components/Card.tsx", "content": "..."}
  ]
}
不要任何额外的说明文字,不要 markdown 代码块,直接 JSON 字符串。

[manifest.json 规范]
{
  "id": "${draftId}",  // 必须用这个值,不要改
  "name": "<中文显示名>",
  "version": "1.0.0",
  "entry": "App.tsx",
  "perspectiveAware": <true 或 false; true 表示数据按角色隔离>
}

[可用的 SDK 模块]
- react: 完整 React 命名空间
- lucide-react: 完整图标库
- @hiphone/ui: NavBar
- @hiphone/storage: get(key) / set(key, value) — per-owner KV
- @hiphone/ai: complete(messages) / streamComplete(messages) — 调 LLM
- @hiphone/perspective: useCurrentOwner() — 当前角色 / 玩家视角
- @hiphone/hooks: useOnLaunch / useAppMemory — 生命周期 / 局部状态
- @hiphone/toast: show(text) — 顶部 toast
- @hiphone/banner: show({title,...}) — 顶部横幅通知
- @hiphone/motion: motion.div 等 motion/react 组件 + spring/duration/ease tokens

[App.tsx 必须 default export 一个 React 组件]

[范例 1: 待办 app]
manifest.json:
${todoManifest}

App.tsx:
${todoApp}

utils.ts:
${todoUtils}

[范例 2: AI 翻译 app]
manifest.json:
${translatorManifest}

App.tsx:
${translatorApp}

[当前任务]
你的 manifest.id 必须是 "${draftId}"。其他字段可以自由发挥。每次回复都要输出完整的 files 数组(不要"只更新某个文件"),用户可以基于上一轮迭代要求修改。`;
}
