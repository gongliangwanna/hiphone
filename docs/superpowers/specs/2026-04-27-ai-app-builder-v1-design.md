# AI App Builder V1 — Design

**Date:** 2026-04-27
**Status:** Spec (implementation plan to follow)
**Prereqs:** M4.3 §1+§2+§3 shipped (HEAD `9cdda24`)

---

## Context

User-app pipeline (M2/M3) is mature: TSX → `compileTsx` → `installer.install` → IDB → `appRegistry` → `AppScene`. SDK surface is stable (`@hiphone/{ui,ai,storage,perspective,hooks,nav,toast,banner,services,motion}` + `react` + `lucide-react`). 8 fixture user apps exist as reference implementations.

What's missing: a way for end-users to create user apps **without writing code**. The user describes "我想要一个番茄钟" and gets back a working app installed to their springboard.

V1 of the AI App Builder is the inverse of the existing zip-upload UX: the user describes intent in natural language, an LLM emits a multi-file user app, and the builder pipes it through the existing installer.

---

## Non-goals (V1)

- **Multiple draft history** — single active session; "new" wipes the draft. V1.1 adds a list.
- **Manual TSX editing** — generated code is read-only; refinement happens via chat. V2 adds an editor.
- **Code lint / format** — accept whatever Sucrase compiles.
- **Embedded asset uploading** — no images / fonts / etc. in the generated zip. App icon uses a platform placeholder.
- **Provider-native tool calling** — V1 generates code via prompt-describe + JSON wire format. Native tool_use is a separate workstream (deferred per M4.3 scope doc "Next after").
- **Cross-app library / template marketplace** — out of scope.
- **Test generation** — V1 doesn't try to make the LLM write vitest specs for its output.

---

## Architecture

### Entry point

A new builtin app `ai-app-builder` (display name "AI 工坊"), registered alongside other builtins in `registerBuiltins.ts`. Desktop icon. NOT a user app — it lives in `src/apps/AIAppBuilder/` like Settings or AppStore.

### High-level layout

```
┌─────────────────────────────────┐
│ NavBar: AI 工坊  · [+ 新建]     │
├─────────────────────────────────┤
│                                 │
│  Live preview pane              │
│  (mounts current draft)         │
│                                 │
├─────────────────────────────────┤
│  Chat pane                      │
│  > 用户消息 / builder 回复 /    │
│    系统状态                     │
│  ┌─────────────────────┬─────┐  │
│  │ 描述需求...         │ 发送 │  │
│  └─────────────────────┴─────┘  │
└─────────────────────────────────┘
```

Top half is a live preview of the current draft. Bottom half is the chat. The split can be collapsed (top-only or bottom-only) via a small toggle. Initial state: chat-only (top is empty / "尚未生成").

### Module breakdown

| Path | Responsibility |
|---|---|
| `src/apps/AIAppBuilder/AIAppBuilderApp.tsx` | Top-level component; mounts `BuilderPreview` + `BuilderChat`; provides "新建" / "安装到桌面" actions |
| `src/apps/AIAppBuilder/BuilderChat.tsx` | Chat message list + input box; dispatches send → `builderGenerator` |
| `src/apps/AIAppBuilder/BuilderPreview.tsx` | Mounts the current compiled draft via the user-app sandbox; ErrorBoundary on the result |
| `src/apps/AIAppBuilder/aiAppBuilderStore.ts` | Zustand + IDB persist: `draftFiles` / `chatHistory` / `draftId` / `status` / `lastError` |
| `src/apps/AIAppBuilder/aiAppBuilderConfigStore.ts` | Optional model-override config (per-Settings tweak) |
| `src/apps/AIAppBuilder/builderPrompt.ts` | Build the system prompt: SDK surface + manifest schema + few-shot fixtures |
| `src/apps/AIAppBuilder/builderGenerator.ts` | Call `chatComplete`; parse multi-file JSON; auto-retry on parse / compile failure |
| `src/apps/AIAppBuilder/builderInstaller.ts` | Pack `draftFiles` into JSZip blob; call `installer.install` |
| `src/apps/AIAppBuilder/__tests__/*` | Unit + integration tests |

### Data flow

1. User opens AI 工坊 — sees empty state with prompt suggestions ("番茄钟", "习惯打卡", "记账本", or free-form input).
2. User types description → click send.
3. `builderGenerator`:
   - Constructs system prompt: SDK list + manifest schema + 2 few-shot fixtures (`todo-app` + `ai-translator-app`).
   - Pulls chat history from store.
   - Streams from `chatComplete` (uses `aiAppBuilderConfig.modelOverride` if set, else `aiConfig`).
4. Parses response:
   - Expected: JSON object with `{ files: [{path, content}, ...] }`.
   - Falls back to lenient regex extraction if not pure JSON (similar to `aiChatEngine.recoverReadableText`).
5. For each file:
   - `.tsx` / `.ts` → `compileTsx`.
   - `manifest.json` → `validateManifest`.
6. All compile clean → store updates `draftFiles`; preview pane re-mounts.
7. User iterates via chat (e.g. "把按钮改成蓝色"). Each turn re-generates and re-mounts.
8. User clicks "安装到桌面" → `builderInstaller` packs files into zip → `installer.install` → springboard adds the app icon.

### Wire format (LLM ↔ builder)

The LLM is instructed to emit ONLY a JSON object:

```json
{
  "files": [
    { "path": "manifest.json", "content": "..." },
    { "path": "App.tsx", "content": "..." },
    { "path": "components/Card.tsx", "content": "..." }
  ]
}
```

Why JSON not markdown code fences:
- Avoids escape hell (TSX inside ` ``` ` blocks)
- Trivially parseable
- Each file is one string — no boundary detection needed

Lenient parser fallback for when the LLM disobeys:
- If the response starts with `{` but `JSON.parse` fails → regex-extract `"path":"..."` + `"content":"..."` pairs.
- If the response is markdown code fences instead → extract by language tag (`.tsx` / `.ts` / `.json`) and infer paths from filename comments at the top of each block (`// App.tsx`).
- If both fail → show error message in chat ("生成结果格式不对,正在重试..."), retry once with strict re-prompt.

### Live preview

The preview pane mounts the compiled draft using existing user-app primitives:

```ts
// roughly:
const runtime = createUserAppRuntime(compiledMap);
const Component = executeSandboxed(compiledMap[manifest.entry], runtime.resolveModule);
const Wrapped = wrapUserComponent(Component);  // ErrorBoundary
```

Mounted inside a sandboxed `<div>` in the preview pane. Player perspective. ErrorBoundary catches mount-time exceptions and renders a fallback "App crashed: {message}".

The preview is **ephemeral** — never registered with `appRegistry`, never written to IDB. The full `compiledMap` is rebuilt from scratch on every successful generation (not incrementally patched), so stale modules from a previous turn cannot leak in.

### Identity lock

- At session start, `draftId` is auto-generated from the user's first message:
  - Heuristic: extract a noun → English-ish slug → `ai-app-{slug}-{4-digit-rand}`.
  - Examples: "番茄钟" → `ai-app-tomato-7f3a`; "记账" → `ai-app-budget-x912`.
  - If extraction fails: use `ai-app-draft-{rand}`.
- System prompt instructs LLM to use this id verbatim in every `manifest.json` it emits.
- `builderInstaller` enforces this — even if LLM emits a different id, we overwrite to the locked value before zip.
- Locked for the entire session. "新建" generates a fresh id.

### Error handling

| Failure | Handling |
|---|---|
| LLM doesn't emit valid JSON / files structure | Auto-retry once with stricter "MUST be JSON" reminder; still fails → red error message in chat, user can retry manually |
| `compileTsx` fails on a file | Auto-retry once: send the error back to LLM as next user-role message ("修复:`<path>` 编译失败:`<message>`") |
| `validateManifest` fails | Same auto-retry treatment |
| Component throws on mount | ErrorBoundary catches; preview pane shows fallback; chat continues normally — user can iterate without interrupting |
| `installer.install` fails (id conflict, IDB error) | Toast + chat-side error |

Retry budget: **1 automatic retry per user turn** (= up to 2 LLM calls). After the second failure, control returns to the user; they can resend manually. This mirrors the M4.2.5 `runWithRetries` ceiling but tighter (3 → 1) since each attempt here is a multi-file generation = expensive.

### Persistence

`aiAppBuilderStore`:

```ts
interface AIAppBuilderState {
  draftId: string | null;            // null = no session yet
  draftFiles: Record<string, string>; // path → content
  chatHistory: ChatTurn[];
  status: 'idle' | 'generating' | 'compile-error' | 'ready' | 'install-error';
  lastError: string | null;
  startNewDraft(initialPrompt: string): void;  // generates draftId, wipes state
  appendUserMessage(text: string): void;
  appendBuilderMessage(text: string, files?: Record<string, string>): void;
  // ...
}
```

Persisted to IDB via Zustand's `persist` + `idbStorage` (project pattern).

### Model configuration

`aiAppBuilderConfigStore`:

```ts
interface AIAppBuilderConfig {
  modelOverride: {
    provider?: string;
    model?: string;
    endpoint?: string;
    apiKey?: string;  // empty → fall back to aiConfig.apiKey
    maxTokens?: number;
    temperature?: number;
  } | null;  // null = use aiConfig entirely
  setOverride(o: AIAppBuilderConfig['modelOverride']): void;
}
```

Settings → AI → "工坊代码模型" row pushes to a config page (similar to `ModelSelectPage`). Empty by default — uses whatever `aiConfig` is set to.

Effective config at runtime:
```ts
const cfg = useAIAppBuilderConfigStore.getState().modelOverride;
const ai = useAIConfigStore.getState();
const effective = {
  provider: cfg?.provider ?? ai.provider,
  model: cfg?.model ?? ai.model,
  endpoint: cfg?.endpoint ?? ai.apiEndpoint,
  apiKey: cfg?.apiKey ?? ai.apiKey,
  maxTokens: cfg?.maxTokens ?? ai.maxTokens,
  temperature: cfg?.temperature ?? ai.temperature,
};
```

### System prompt structure (for `builderPrompt.ts`)

The prompt is constructed at runtime — `${draftId}` and the few-shot fixture contents are interpolated by the builder, not seen by the LLM as literal placeholders.

```
你是 hiPhone 平台的"AI 应用工坊"代码生成助手。用户用自然语言描述想要的 app,你生成完整的多文件 user app 代码。

[输出格式]
你必须只输出一个 JSON 对象,形如:
{
  "files": [
    {"path": "manifest.json", "content": "<JSON 字符串>"},
    {"path": "App.tsx", "content": "<TSX 代码>"},
    ...
  ]
}
不要任何额外的说明文字、markdown code fence,直接 JSON 字符串。

[manifest.json 规范]
{
  "id": "<必须用 ${draftId}, 不要改>",   ← 实际拼装时替换为字面字符串
  "name": "<中文显示名>",
  "version": "1.0.0",
  "entry": "App.tsx",
  "perspectiveAware": <true 表示该 app 数据按角色隔离>
}

[可用的 SDK 模块]
- react / lucide-react: 完整支持
- @hiphone/ui: NavBar
- @hiphone/storage: get/set (per-owner KV)
- @hiphone/ai: complete / streamComplete
- @hiphone/perspective: useCurrentOwner
- @hiphone/hooks: useOnLaunch / useAppMemory
- @hiphone/toast: show
- @hiphone/banner: show
- @hiphone/motion: motion components

[App.tsx 必须 default export 一个 React 组件]

[范例 1: todo app]
${TODO_APP_MANIFEST_AND_TSX}    ← 拼装时插入完整文件内容

[范例 2: AI 翻译 app]
${AI_TRANSLATOR_MANIFEST_AND_TSX}

[当前任务]
你的 manifest.id 必须是 "${draftId}"。其他字段可以自由发挥。
```

Few-shot fixtures are pulled from `src/platform/userApp/__tests__/fixtures/` at build time (test fixtures and prompt fixtures share the same source — keeps them in sync).

User messages append to the chat history; previous (assistant + draft files) turns are also threaded through so iteration sees prior code.

### Testing

**Unit:**
- `builderGenerator.parseFiles`:
  - Strict JSON path
  - Lenient regex fallback (broken JSON with extractable path/content pairs)
  - Markdown code-fence fallback
  - Bare prose → null (signals retry)
- `aiAppBuilderStore.startNewDraft`:
  - Generates draftId
  - Wipes prior state
- `builderInstaller.packZip`:
  - Produces a Blob containing manifest.json + entry file
  - Forces `manifest.id` to the locked `draftId`

**Integration:**
- Mock `chatComplete` to return a known-good multi-file response; assert:
  - Files compile via `compileTsx`
  - `BuilderPreview` mounts without throwing
  - Component renders the expected text (e.g. "我的待办")

**E2E manual checklist (V1 release):**
- Generate a tomato timer; iterate ("加个暂停按钮"); install; open from springboard; verify it actually counts.
- Generate a memo app; uninstall; verify cleanup.
- Test with malformed LLM response; verify auto-retry recovers.

---

## Decision log

| # | Decision | Choice | Reason |
|---|---|---|---|
| Q1 | Entry point | Independent app | Roomier UX vs cramming into AppStore tab |
| Q2 | Iteration | Chat-based | Single-shot fails too often, breaks UX |
| Q3 | File structure | Multi-file | User chose; lets LLM use components/ when warranted |
| Q4 | Preview | Live iframe | Reuses sandbox infra; closes the iteration feedback loop |
| Q5 | Code model | Default `aiConfig`, optional override | Most users won't bother; experts can pick a stronger model |

---

## Follow-ups (V1.1+)

- **Draft history**: list of past sessions; switch / delete.
- **Manual TSX editor**: code panel allowing direct edits, then "fold back" into the chat (like Cursor's "compose" mode).
- **Asset embedding**: upload images / fonts / data files as part of the draft; LLM references them by path.
- **Test generation**: ask the LLM to also emit `__tests__/App.test.tsx`; run via vitest in worker.
- **Provider-native tool calling**: when M4.4 lands, the builder can use `tool_use` for the file-emission step (more robust than JSON wire format).
- **Library hints**: pre-canned templates ("番茄钟", "记账", "习惯打卡") that pre-fill the system prompt with a starting skeleton.
