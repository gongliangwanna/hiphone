# AI App Builder V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the "AI 工坊" — a builtin app where users describe an app in natural language and get a working multi-file user app generated, previewed live, and installable through the existing user-app pipeline.

**Architecture:** Independent builtin React app at `src/apps/AIAppBuilder/` with chat-based iteration UX. Generation happens via `chatComplete` with a system prompt that includes SDK surface + manifest schema + 2 fixture few-shots. Output is a JSON `{files: [{path, content}]}` payload, parsed and pumped through `compileTsx` → `createUserAppRuntime` for a live preview. On user approval, the draft is zipped and pushed through the standard `installer.install`.

**Tech Stack:** React + TypeScript strict + Zustand (IDB-persisted) + JSZip + Sucrase (via existing `compileTsx`) + vitest. Reuses `installer.ts` / `moduleResolver.ts` / `compiler.ts` / `sandbox.ts`.

Spec: `docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md`.

---

## File Impact Map

| Stage | File | Action |
|---|---|---|
| S1 | `src/apps/AIAppBuilder/aiAppBuilderStore.ts` | Create |
| S1 | `src/apps/AIAppBuilder/__tests__/aiAppBuilderStore.test.ts` | Create |
| S2 | `src/apps/AIAppBuilder/aiAppBuilderConfigStore.ts` | Create |
| S2 | `src/apps/AIAppBuilder/__tests__/aiAppBuilderConfigStore.test.ts` | Create |
| S3 | `src/apps/AIAppBuilder/builderPrompt.ts` | Create |
| S3 | `src/apps/AIAppBuilder/__tests__/builderPrompt.test.ts` | Create |
| S4 | `src/apps/AIAppBuilder/builderParser.ts` | Create — multi-file JSON parser w/ lenient fallback |
| S4 | `src/apps/AIAppBuilder/__tests__/builderParser.test.ts` | Create |
| S5 | `src/apps/AIAppBuilder/builderGenerator.ts` | Create — chatComplete wrapper + auto-retry |
| S5 | `src/apps/AIAppBuilder/__tests__/builderGenerator.test.ts` | Create |
| S6 | `src/apps/AIAppBuilder/builderInstaller.ts` | Create — pack zip + force draftId |
| S6 | `src/apps/AIAppBuilder/__tests__/builderInstaller.test.ts` | Create |
| S7 | `src/apps/AIAppBuilder/BuilderPreview.tsx` | Create — live preview pane |
| S8 | `src/apps/AIAppBuilder/BuilderChat.tsx` | Create — chat UI |
| S9 | `src/apps/AIAppBuilder/AIAppBuilderApp.tsx` | Create — top-level layout |
| S10 | `src/apps/registerBuiltins.ts` | Add `ai-app-builder` registration |
| S10 | `src/shell/Springboard/apps.data.ts` | Add desktop icon entry |
| S11 | `src/apps/Settings/pages/AIBuilderModelPage.tsx` | Create — model override config |
| S11 | `src/apps/Settings/SettingsApp.tsx` | Wire new page |
| S11 | `src/apps/Settings/SettingsHome.tsx` | Add nav entry |

---

## Stage 1 — `aiAppBuilderStore`

**Why:** Persistent state for the entire builder. Everything downstream reads from this.

### Task 1.1 — Zustand store + IDB persist + 12 unit tests

**Files:**
- Create: `src/apps/AIAppBuilder/aiAppBuilderStore.ts`
- Create test: `src/apps/AIAppBuilder/__tests__/aiAppBuilderStore.test.ts`

- [ ] **Step 1.1.1 — Write failing tests**

Create `src/apps/AIAppBuilder/__tests__/aiAppBuilderStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAIAppBuilderStore } from '../aiAppBuilderStore';

describe('aiAppBuilderStore', () => {
  beforeEach(() => {
    useAIAppBuilderStore.setState({
      draftId: null,
      draftFiles: {},
      chatHistory: [],
      status: 'idle',
      lastError: null,
    });
  });

  describe('startNewDraft', () => {
    it('generates a draftId from the user prompt and resets state', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('我想要一个番茄钟');
      expect(useAIAppBuilderStore.getState().draftId).toMatch(/^ai-app-/);
      expect(useAIAppBuilderStore.getState().draftFiles).toEqual({});
      expect(useAIAppBuilderStore.getState().chatHistory).toHaveLength(1);
      expect(useAIAppBuilderStore.getState().chatHistory[0]!).toMatchObject({
        role: 'user',
        text: '我想要一个番茄钟',
      });
    });

    it('two consecutive new drafts produce different ids', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      const id1 = useAIAppBuilderStore.getState().draftId;
      s.startNewDraft('记账');
      const id2 = useAIAppBuilderStore.getState().draftId;
      expect(id1).not.toBe(id2);
    });

    it('startNewDraft on top of existing draft wipes prior files', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      useAIAppBuilderStore.setState({ draftFiles: { 'App.tsx': 'old' } });
      s.startNewDraft('记账');
      expect(useAIAppBuilderStore.getState().draftFiles).toEqual({});
    });

    it('falls back to a generic id when extraction yields nothing', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('!!!@#$');
      expect(useAIAppBuilderStore.getState().draftId).toMatch(/^ai-app-draft-/);
    });
  });

  describe('appendUserMessage', () => {
    it('appends a user-role chat turn', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendUserMessage('加个暂停');
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({ role: 'user', text: '加个暂停' });
    });

    it('throws if no active draft', () => {
      const s = useAIAppBuilderStore.getState();
      expect(() => s.appendUserMessage('hi')).toThrow();
    });
  });

  describe('appendBuilderMessage', () => {
    it('appends a builder-role chat turn AND updates draftFiles', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendBuilderMessage('已生成,请预览', {
        'manifest.json': '{}',
        'App.tsx': 'export default () => null;',
      });
      const state = useAIAppBuilderStore.getState();
      expect(state.chatHistory).toHaveLength(2);
      expect(state.chatHistory[1]).toMatchObject({ role: 'builder', text: '已生成,请预览' });
      expect(state.draftFiles).toEqual({
        'manifest.json': '{}',
        'App.tsx': 'export default () => null;',
      });
    });

    it('replaces draftFiles entirely (does not merge)', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendBuilderMessage('v1', {
        'manifest.json': '{}',
        'App.tsx': 'old',
        'utils.ts': 'old utils',
      });
      s.appendBuilderMessage('v2', {
        'manifest.json': '{}',
        'App.tsx': 'new',
      });
      // utils.ts removed; full replace
      expect(Object.keys(useAIAppBuilderStore.getState().draftFiles).sort()).toEqual(['App.tsx', 'manifest.json']);
    });

    it('appends builder message without files when files arg omitted', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendBuilderMessage('解析失败,请重试');
      const state = useAIAppBuilderStore.getState();
      expect(state.chatHistory[1]!.text).toBe('解析失败,请重试');
      expect(state.draftFiles).toEqual({});
    });
  });

  describe('setStatus / setError', () => {
    it('setStatus updates status field', () => {
      useAIAppBuilderStore.getState().setStatus('generating');
      expect(useAIAppBuilderStore.getState().status).toBe('generating');
    });

    it('setError stores error and switches status to compile-error', () => {
      useAIAppBuilderStore.getState().setError('compile failed: foo.tsx');
      const state = useAIAppBuilderStore.getState();
      expect(state.lastError).toBe('compile failed: foo.tsx');
      expect(state.status).toBe('compile-error');
    });

    it('setError(null) clears error and resets status to ready', () => {
      useAIAppBuilderStore.getState().setError('x');
      useAIAppBuilderStore.getState().setError(null);
      expect(useAIAppBuilderStore.getState().lastError).toBeNull();
      expect(useAIAppBuilderStore.getState().status).toBe('ready');
    });
  });
});
```

- [ ] **Step 1.1.2 — Verify failing**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/aiAppBuilderStore.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 1.1.3 — Create the store**

Create `src/apps/AIAppBuilder/aiAppBuilderStore.ts`:

```ts
/**
 * AI 工坊 (AI App Builder) state — single active draft.
 *
 * Persists to IDB so users can refine across page reloads. "New draft"
 * wipes the slate. Multiple concurrent drafts (history) are out of
 * scope for V1 — see V1.1 follow-up in the design doc.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

export type BuilderStatus =
  | 'idle'           // no draft yet
  | 'generating'     // chatComplete in flight
  | 'ready'          // draft compiled successfully, preview live
  | 'compile-error'  // last generation produced uncompilable code
  | 'install-error'; // installer.install threw

export interface ChatTurn {
  role: 'user' | 'builder';
  text: string;
  timestamp: number;
}

export interface AIAppBuilderState {
  /** null = no session yet. Locked once startNewDraft fires. */
  draftId: string | null;
  /** path → content. Replaced wholesale on each successful generation. */
  draftFiles: Record<string, string>;
  chatHistory: ChatTurn[];
  status: BuilderStatus;
  lastError: string | null;

  startNewDraft: (firstUserPrompt: string) => void;
  appendUserMessage: (text: string) => void;
  appendBuilderMessage: (text: string, files?: Record<string, string>) => void;
  setStatus: (status: BuilderStatus) => void;
  setError: (error: string | null) => void;
}

/**
 * Heuristic id generation: pick a Chinese noun chunk from the prompt,
 * try to map to a slug; otherwise fall back to "draft-<rand>".
 */
function makeDraftId(prompt: string): string {
  const slug = sluggify(prompt);
  const rand = Math.random().toString(16).slice(2, 6);
  if (!slug) return `ai-app-draft-${rand}`;
  return `ai-app-${slug}-${rand}`;
}

function sluggify(prompt: string): string {
  const cleaned = prompt.toLowerCase().replace(/[^一-鿿 a-z0-9]/g, '');
  const tokens = cleaned.split(/\s+/).filter(Boolean).slice(0, 1);
  if (tokens.length === 0) return '';
  // Replace any non-ASCII (Chinese chars) with their pinyin-less placeholder.
  // For V1 we accept "番茄钟" → "" and fall back to draft-XXX. Keep simple.
  const ascii = tokens[0]!.replace(/[^a-z0-9]/g, '');
  return ascii;
}

export const useAIAppBuilderStore = create<AIAppBuilderState>()(
  persist(
    (set, get) => ({
      draftId: null,
      draftFiles: {},
      chatHistory: [],
      status: 'idle',
      lastError: null,

      startNewDraft: (firstUserPrompt) => {
        set({
          draftId: makeDraftId(firstUserPrompt),
          draftFiles: {},
          chatHistory: [{ role: 'user', text: firstUserPrompt, timestamp: Date.now() }],
          status: 'generating',
          lastError: null,
        });
      },

      appendUserMessage: (text) => {
        if (!get().draftId) {
          throw new Error('appendUserMessage: no active draft (call startNewDraft first)');
        }
        set((s) => ({
          chatHistory: [...s.chatHistory, { role: 'user', text, timestamp: Date.now() }],
        }));
      },

      appendBuilderMessage: (text, files) => {
        set((s) => ({
          chatHistory: [...s.chatHistory, { role: 'builder', text, timestamp: Date.now() }],
          ...(files ? { draftFiles: files } : {}),
        }));
      },

      setStatus: (status) => set({ status }),

      setError: (error) => {
        if (error === null) {
          set({ lastError: null, status: 'ready' });
        } else {
          set({ lastError: error, status: 'compile-error' });
        }
      },
    }),
    {
      name: 'hiPhone-ai-app-builder',
      storage: idbStorage,
      partialize: (s) => ({
        draftId: s.draftId,
        draftFiles: s.draftFiles,
        chatHistory: s.chatHistory,
      }),
    },
  ),
);
```

- [ ] **Step 1.1.4 — Verify tests pass**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/aiAppBuilderStore.test.ts`
Expected: 12 tests PASS.

- [ ] **Step 1.1.5 — Full regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green.

- [ ] **Step 1.1.6 — Commit**

```bash
git add src/apps/AIAppBuilder/aiAppBuilderStore.ts src/apps/AIAppBuilder/__tests__/aiAppBuilderStore.test.ts
git commit -m "$(cat <<'EOF'
feat(ai-builder): aiAppBuilderStore — IDB-persisted draft state

Single-active-session store for the AI 工坊 builtin. Holds:
- draftId (locked at session start; auto-generated from first prompt)
- draftFiles (Record<path, content>; replaced wholesale per turn)
- chatHistory (alternating user/builder turns)
- status + lastError

Stage 1 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 2 — `aiAppBuilderConfigStore`

**Why:** Optional model override (Q5: default sticks to aiConfig, optional separate code model).

### Task 2.1 — Config store + 4 tests

**Files:**
- Create: `src/apps/AIAppBuilder/aiAppBuilderConfigStore.ts`
- Create test: `src/apps/AIAppBuilder/__tests__/aiAppBuilderConfigStore.test.ts`

- [ ] **Step 2.1.1 — Write failing tests**

Create `src/apps/AIAppBuilder/__tests__/aiAppBuilderConfigStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAIAppBuilderConfigStore } from '../aiAppBuilderConfigStore';

describe('aiAppBuilderConfigStore', () => {
  beforeEach(() => {
    useAIAppBuilderConfigStore.setState({ modelOverride: null });
  });

  it('starts with no override (modelOverride === null)', () => {
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toBeNull();
  });

  it('setOverride stores the partial override', () => {
    useAIAppBuilderConfigStore.getState().setOverride({
      provider: 'anthropic',
      model: 'claude-opus-4',
    });
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-4',
    });
  });

  it('setOverride(null) clears the override', () => {
    useAIAppBuilderConfigStore.getState().setOverride({ model: 'x' });
    useAIAppBuilderConfigStore.getState().setOverride(null);
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toBeNull();
  });

  it('successive setOverride calls replace, not merge', () => {
    const s = useAIAppBuilderConfigStore.getState();
    s.setOverride({ provider: 'a', model: 'm1' });
    s.setOverride({ model: 'm2' });
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toEqual({ model: 'm2' });
  });
});
```

- [ ] **Step 2.1.2 — Verify failing**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/aiAppBuilderConfigStore.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 2.1.3 — Create the store**

Create `src/apps/AIAppBuilder/aiAppBuilderConfigStore.ts`:

```ts
/**
 * Optional model override for AI 工坊's code-generation calls. When
 * `modelOverride` is null (default), the builder uses the same provider
 * config as XingYu / heartbeat (`useAIConfigStore`). When set, the
 * specified fields override the corresponding aiConfig values.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

export interface ModelOverride {
  provider?: string;
  model?: string;
  endpoint?: string;
  apiKey?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIAppBuilderConfigState {
  modelOverride: ModelOverride | null;
  setOverride: (o: ModelOverride | null) => void;
}

export const useAIAppBuilderConfigStore = create<AIAppBuilderConfigState>()(
  persist(
    (set) => ({
      modelOverride: null,
      setOverride: (modelOverride) => set({ modelOverride }),
    }),
    {
      name: 'hiPhone-ai-app-builder-config',
      storage: idbStorage,
      partialize: (s) => ({ modelOverride: s.modelOverride }),
    },
  ),
);
```

- [ ] **Step 2.1.4 — Verify tests pass**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/aiAppBuilderConfigStore.test.ts`
Expected: 4 tests PASS.

- [ ] **Step 2.1.5 — Full regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green.

- [ ] **Step 2.1.6 — Commit**

```bash
git add src/apps/AIAppBuilder/aiAppBuilderConfigStore.ts src/apps/AIAppBuilder/__tests__/aiAppBuilderConfigStore.test.ts
git commit -m "$(cat <<'EOF'
feat(ai-builder): aiAppBuilderConfigStore — optional code-model override

Lets users pick a stronger model for code generation than the one they
use for chat. Defaults to null (sticks with useAIConfigStore values);
when set, listed fields override those values.

Stage 2 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 3 — `builderPrompt`

**Why:** Build the system prompt with SDK surface + manifest schema + 2 fixture few-shots.

### Task 3.1 — Prompt builder + 5 tests

**Files:**
- Create: `src/apps/AIAppBuilder/builderPrompt.ts`
- Create test: `src/apps/AIAppBuilder/__tests__/builderPrompt.test.ts`

- [ ] **Step 3.1.1 — Write failing tests**

Create `src/apps/AIAppBuilder/__tests__/builderPrompt.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../builderPrompt';

describe('buildSystemPrompt', () => {
  it('includes draftId in the manifest constraint', () => {
    const prompt = buildSystemPrompt('ai-app-tomato-abcd');
    expect(prompt).toContain('ai-app-tomato-abcd');
  });

  it('mentions the JSON {files:[{path,content}]} output format', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    expect(prompt).toContain('files');
    expect(prompt).toContain('path');
    expect(prompt).toContain('content');
    expect(prompt).toContain('JSON');
  });

  it('lists the available SDK modules', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    expect(prompt).toContain('@hiphone/storage');
    expect(prompt).toContain('@hiphone/ai');
    expect(prompt).toContain('@hiphone/perspective');
    expect(prompt).toContain('@hiphone/hooks');
    expect(prompt).toContain('react');
    expect(prompt).toContain('lucide-react');
  });

  it('includes the todo-app fixture as few-shot example 1', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    // todo-app's App.tsx imports useAppMemory — this string is unique to it
    expect(prompt).toContain('useAppMemory');
  });

  it('includes the ai-translator-app fixture as few-shot example 2', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    // ai-translator-app uses streamComplete
    expect(prompt).toContain('streamComplete');
  });

  it('explicitly forbids markdown code fences in the response', () => {
    const prompt = buildSystemPrompt('ai-app-x-1234');
    expect(prompt).toMatch(/不要.*markdown|markdown.*不要|代码块|code fence/i);
  });
});
```

- [ ] **Step 3.1.2 — Verify failing**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderPrompt.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3.1.3 — Create the prompt builder**

Create `src/apps/AIAppBuilder/builderPrompt.ts`:

```ts
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
```

- [ ] **Step 3.1.4 — Verify tests pass**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderPrompt.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 3.1.5 — Full regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green. Note: Vite's `?raw` imports work in both vite build and vitest (vitest inherits the same plugin pipeline). If the build fails because of `?raw` not being recognized, we may need to add the `vite-plugin-raw` package — but Vite has built-in support since 2.0, so this should just work.

- [ ] **Step 3.1.6 — Commit**

```bash
git add src/apps/AIAppBuilder/builderPrompt.ts src/apps/AIAppBuilder/__tests__/builderPrompt.test.ts
git commit -m "$(cat <<'EOF'
feat(ai-builder): builderPrompt — system prompt with SDK + 2 few-shots

The prompt instructs the LLM to emit a JSON {files: [...]} payload
with a fixed manifest.id, lists the SDK module surface, and inlines
two complete fixture user apps (todo-app + ai-translator-app) as
few-shot examples. Fixtures loaded via Vite's `?raw` import so they
share a single source of truth with the test fixture compile path.

Stage 3 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 4 — `builderParser`

**Why:** Parse the LLM's response into a `Record<path, content>`. Supports strict JSON + lenient regex fallback.

### Task 4.1 — Parser + 8 tests

**Files:**
- Create: `src/apps/AIAppBuilder/builderParser.ts`
- Create test: `src/apps/AIAppBuilder/__tests__/builderParser.test.ts`

- [ ] **Step 4.1.1 — Write failing tests**

Create `src/apps/AIAppBuilder/__tests__/builderParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseGeneratedFiles } from '../builderParser';

describe('parseGeneratedFiles', () => {
  it('parses strict JSON with files array', () => {
    const raw = JSON.stringify({
      files: [
        { path: 'manifest.json', content: '{"id":"x"}' },
        { path: 'App.tsx', content: 'export default () => null;' },
      ],
    });
    expect(parseGeneratedFiles(raw)).toEqual({
      'manifest.json': '{"id":"x"}',
      'App.tsx': 'export default () => null;',
    });
  });

  it('handles JSON wrapped in stray prose ("好的:{...}")', () => {
    const raw = '好的,这是结果:' + JSON.stringify({
      files: [{ path: 'App.tsx', content: 'x' }],
    });
    expect(parseGeneratedFiles(raw)).toEqual({ 'App.tsx': 'x' });
  });

  it('handles JSON wrapped in markdown ```json fence', () => {
    const raw = '```json\n' + JSON.stringify({
      files: [{ path: 'App.tsx', content: 'x' }],
    }) + '\n```';
    expect(parseGeneratedFiles(raw)).toEqual({ 'App.tsx': 'x' });
  });

  it('returns null on totally non-JSON output', () => {
    expect(parseGeneratedFiles('Sure, here is your app: it has a button.')).toBeNull();
  });

  it('returns null on JSON that lacks a files array', () => {
    expect(parseGeneratedFiles('{"foo": "bar"}')).toBeNull();
  });

  it('skips files entries missing path or content', () => {
    const raw = JSON.stringify({
      files: [
        { path: 'App.tsx', content: 'a' },
        { path: 'broken' },                   // missing content
        { content: 'broken' },                // missing path
        { path: '', content: 'empty path' },  // empty path
        { path: 'utils.ts', content: 'b' },
      ],
    });
    expect(parseGeneratedFiles(raw)).toEqual({
      'App.tsx': 'a',
      'utils.ts': 'b',
    });
  });

  it('returns null when files array is present but completely invalid', () => {
    const raw = JSON.stringify({ files: [{ wrong: 'shape' }] });
    expect(parseGeneratedFiles(raw)).toBeNull();
  });

  it('returns null on truly empty input', () => {
    expect(parseGeneratedFiles('')).toBeNull();
    expect(parseGeneratedFiles('   ')).toBeNull();
  });
});
```

- [ ] **Step 4.1.2 — Verify failing**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderParser.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 4.1.3 — Create the parser**

Create `src/apps/AIAppBuilder/builderParser.ts`:

```ts
/**
 * Parse the LLM's response into a `Record<path, content>`.
 *
 * Strategy (in order):
 *   1. Direct JSON.parse of the trimmed reply.
 *   2. Strip ```json fences if present, retry.
 *   3. Find the first `{` and last `}` and parse the substring between
 *      (handles "好的:{...}" prefixes).
 *   4. Return null → caller treats as parse failure (auto-retry once).
 *
 * On any successful parse, validate the shape:
 *   - Top-level object has `files` array.
 *   - Each entry has non-empty string `path` and string `content`.
 *   - At least 1 valid entry must remain after filtering.
 */

interface FileEntry {
  path: string;
  content: string;
}

export function parseGeneratedFiles(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const candidates: string[] = [trimmed];

  // Strip ```json fence if present
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/);
  if (fenceMatch?.[1]) candidates.push(fenceMatch[1].trim());

  // Slice between first `{` and last `}`
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    const result = tryParseFiles(candidate);
    if (result) return result;
  }
  return null;
}

function tryParseFiles(text: string): Record<string, string> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !Array.isArray((parsed as { files?: unknown }).files)
  ) {
    return null;
  }

  const filesArr = (parsed as { files: unknown[] }).files;
  const out: Record<string, string> = {};
  for (const entry of filesArr) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      typeof (entry as FileEntry).path === 'string' &&
      typeof (entry as FileEntry).content === 'string' &&
      (entry as FileEntry).path.length > 0
    ) {
      const e = entry as FileEntry;
      out[e.path] = e.content;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
```

- [ ] **Step 4.1.4 — Verify tests pass**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderParser.test.ts`
Expected: 8 tests PASS.

- [ ] **Step 4.1.5 — Full regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green.

- [ ] **Step 4.1.6 — Commit**

```bash
git add src/apps/AIAppBuilder/builderParser.ts src/apps/AIAppBuilder/__tests__/builderParser.test.ts
git commit -m "$(cat <<'EOF'
feat(ai-builder): builderParser — multi-file LLM response parser

Three-tier parse strategy: direct JSON.parse, ```json fence strip,
brace-slice fallback. Returns Record<path, content> or null. Filters
out malformed entries; null only when nothing salvageable.

Stage 4 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 5 — `builderGenerator`

**Why:** Orchestrates the full generation flow: build prompt → call chatComplete → parse → validate → return.

### Task 5.1 — Generator + 6 tests

**Files:**
- Create: `src/apps/AIAppBuilder/builderGenerator.ts`
- Create test: `src/apps/AIAppBuilder/__tests__/builderGenerator.test.ts`

- [ ] **Step 5.1.1 — Write failing tests**

Create `src/apps/AIAppBuilder/__tests__/builderGenerator.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDraft } from '../builderGenerator';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useAIAppBuilderConfigStore } from '../aiAppBuilderConfigStore';
import * as chatCompleteMod from '@/platform/ai/chatComplete';

describe('generateDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAIConfigStore.setState({
      apiKey: 'sk',
      provider: 'openrouter',
      apiEndpoint: 'https://api.test',
      model: 'gpt',
      maxTokens: 4000,
      temperature: 0.7,
    } as never);
    useAIAppBuilderConfigStore.setState({ modelOverride: null });
  });

  it('returns parsed files on success', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValueOnce(
      JSON.stringify({
        files: [
          { path: 'manifest.json', content: '{"id":"x"}' },
          { path: 'App.tsx', content: 'export default () => null;' },
        ],
      }),
    );
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: '番茄钟', timestamp: 1 }],
    });
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.files).toEqual({
        'manifest.json': '{"id":"x"}',
        'App.tsx': 'export default () => null;',
      });
    }
  });

  it('retries once on parse failure, succeeds second try', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('totally not JSON, here is some prose')
      .mockResolvedValueOnce(JSON.stringify({
        files: [{ path: 'App.tsx', content: 'ok' }],
      }));
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'x', timestamp: 1 }],
    });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result.kind).toBe('success');
  });

  it('returns parse-error after 1 retry exhausts', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValue('not JSON');
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'x', timestamp: 1 }],
    });
    expect(result.kind).toBe('parse-error');
  });

  it('returns api-error if chatComplete throws', async () => {
    vi.spyOn(chatCompleteMod, 'chatComplete').mockRejectedValue(new Error('rate limit'));
    const result = await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'x', timestamp: 1 }],
    });
    expect(result.kind).toBe('api-error');
    if (result.kind === 'api-error') {
      expect(result.message).toContain('rate limit');
    }
  });

  it('uses modelOverride when set', async () => {
    useAIAppBuilderConfigStore.getState().setOverride({
      model: 'special-code-model',
      maxTokens: 8000,
    });
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValueOnce(
      JSON.stringify({ files: [{ path: 'App.tsx', content: 'x' }] }),
    );
    await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [{ role: 'user', text: 'y', timestamp: 1 }],
    });
    const call = spy.mock.calls[0]!;
    expect(call[0]!.model).toBe('special-code-model');
    expect(call[2]!.maxTokens).toBe(8000);
  });

  it('threads chat history into the messages array', async () => {
    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockResolvedValueOnce(
      JSON.stringify({ files: [{ path: 'App.tsx', content: 'x' }] }),
    );
    await generateDraft({
      draftId: 'ai-app-x-1234',
      chatHistory: [
        { role: 'user', text: '番茄钟', timestamp: 1 },
        { role: 'builder', text: '已生成', timestamp: 2 },
        { role: 'user', text: '加暂停按钮', timestamp: 3 },
      ],
    });
    const messages = spy.mock.calls[0]![1];
    // System prompt + 3 history-derived messages
    expect(messages.length).toBeGreaterThanOrEqual(4);
    expect(messages[0]!.role).toBe('system');
    // The first chat turn surfaces as user
    expect(messages.some((m) => m.role === 'user' && m.content === '番茄钟')).toBe(true);
    expect(messages.some((m) => m.role === 'user' && m.content === '加暂停按钮')).toBe(true);
  });
});
```

- [ ] **Step 5.1.2 — Verify failing**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderGenerator.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 5.1.3 — Create the generator**

Create `src/apps/AIAppBuilder/builderGenerator.ts`:

```ts
/**
 * Drives the LLM call for AI 工坊's code generation.
 *
 * Flow:
 *   1. Build system prompt from builderPrompt
 *   2. Build messages array: system + threaded chat history
 *   3. Call chatComplete (uses aiAppBuilderConfig override if set,
 *      else aiConfig)
 *   4. Parse via builderParser
 *   5. On parse failure: retry once with stricter reminder
 *   6. Return tagged result
 *
 * Auto-retry budget: 1 (= up to 2 LLM calls per generateDraft call).
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { chatComplete } from '@/platform/ai/chatComplete';
import type { Message } from '@/platform/userApp/sdk/ai';
import { useAIAppBuilderConfigStore } from './aiAppBuilderConfigStore';
import { buildSystemPrompt } from './builderPrompt';
import { parseGeneratedFiles } from './builderParser';
import type { ChatTurn } from './aiAppBuilderStore';

export type GenerateResult =
  | { kind: 'success'; files: Record<string, string> }
  | { kind: 'parse-error'; rawReply: string }
  | { kind: 'api-error'; message: string };

export interface GenerateInput {
  draftId: string;
  chatHistory: ChatTurn[];
  signal?: AbortSignal;
}

export async function generateDraft(input: GenerateInput): Promise<GenerateResult> {
  const messages = buildMessages(input.draftId, input.chatHistory);
  const cfg = effectiveConfig();

  // Attempt 1
  const first = await callOnce(messages, cfg, input.signal);
  if (first.kind === 'api-error') return first;
  if (first.kind === 'success') return first;

  // Retry once with a stricter system reminder appended as a user-role nudge.
  const stricterMessages: Message[] = [
    ...messages,
    {
      role: 'assistant',
      content: first.rawReply,
    },
    {
      role: 'user',
      content: '上一条回复格式不对。请只输出一个 JSON 对象 {"files":[{"path":"...","content":"..."}]},不要任何说明文字。',
    },
  ];
  return callOnce(stricterMessages, cfg, input.signal);
}

function buildMessages(draftId: string, chatHistory: ChatTurn[]): Message[] {
  const messages: Message[] = [
    { role: 'system', content: buildSystemPrompt(draftId) },
  ];
  for (const turn of chatHistory) {
    messages.push({
      role: turn.role === 'user' ? 'user' : 'assistant',
      content: turn.text,
    });
  }
  return messages;
}

interface EffectiveConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  providerId: string;
  maxTokens: number;
  temperature?: number;
}

function effectiveConfig(): EffectiveConfig {
  const ai = useAIConfigStore.getState();
  const o = useAIAppBuilderConfigStore.getState().modelOverride ?? {};
  return {
    endpoint: o.endpoint ?? ai.apiEndpoint ?? '',
    apiKey: o.apiKey ?? ai.apiKey ?? '',
    model: o.model ?? ai.model ?? '',
    providerId: o.provider ?? ai.provider ?? '',
    maxTokens: o.maxTokens ?? ai.maxTokens ?? 4000,
    temperature: o.temperature ?? ai.temperature,
  };
}

async function callOnce(
  messages: Message[],
  cfg: EffectiveConfig,
  signal?: AbortSignal,
): Promise<GenerateResult> {
  let raw: string;
  try {
    raw = await chatComplete(
      { endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model, providerId: cfg.providerId },
      messages,
      { maxTokens: cfg.maxTokens, temperature: cfg.temperature },
      signal,
    );
  } catch (e) {
    return {
      kind: 'api-error',
      message: e instanceof Error ? e.message : String(e),
    };
  }
  const files = parseGeneratedFiles(raw);
  if (files) return { kind: 'success', files };
  return { kind: 'parse-error', rawReply: raw };
}
```

- [ ] **Step 5.1.4 — Verify tests pass**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderGenerator.test.ts`
Expected: 6 tests PASS.

- [ ] **Step 5.1.5 — Full regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green.

- [ ] **Step 5.1.6 — Commit**

```bash
git add src/apps/AIAppBuilder/builderGenerator.ts src/apps/AIAppBuilder/__tests__/builderGenerator.test.ts
git commit -m "$(cat <<'EOF'
feat(ai-builder): builderGenerator — chatComplete wrapper + 1-retry

Threads chatHistory + system prompt into messages, calls chatComplete
(respecting modelOverride), parses via builderParser. On parse
failure, retries once with a stricter "must be JSON" reminder.
Returns tagged GenerateResult: success / parse-error / api-error.

Stage 5 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 6 — `builderInstaller`

**Why:** Pack the current draftFiles into a JSZip blob and run them through `installer.install`. Force the locked draftId.

### Task 6.1 — Installer + 5 tests

**Files:**
- Create: `src/apps/AIAppBuilder/builderInstaller.ts`
- Create test: `src/apps/AIAppBuilder/__tests__/builderInstaller.test.ts`

- [ ] **Step 6.1.1 — Write failing tests**

Create `src/apps/AIAppBuilder/__tests__/builderInstaller.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import JSZip from 'jszip';
import { packDraftZip, installDraft } from '../builderInstaller';
import * as installerMod from '@/platform/userApp/installer';

describe('packDraftZip', () => {
  it('produces a Blob containing all draftFiles', async () => {
    const blob = await packDraftZip('ai-app-tomato-abcd', {
      'manifest.json': '{"id":"old","name":"X","version":"1.0.0","entry":"App.tsx","perspectiveAware":false}',
      'App.tsx': 'export default () => null;',
    });
    const zip = await JSZip.loadAsync(blob);
    expect(zip.file('App.tsx')).not.toBeNull();
    expect(zip.file('manifest.json')).not.toBeNull();
  });

  it('forces manifest.id to the locked draftId', async () => {
    const blob = await packDraftZip('ai-app-tomato-abcd', {
      'manifest.json': '{"id":"some-other-id","name":"X","version":"1.0.0","entry":"App.tsx","perspectiveAware":false}',
      'App.tsx': 'export default () => null;',
    });
    const zip = await JSZip.loadAsync(blob);
    const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'));
    expect(manifest.id).toBe('ai-app-tomato-abcd');
  });

  it('throws when draftFiles has no manifest.json', async () => {
    await expect(
      packDraftZip('ai-app-tomato-abcd', { 'App.tsx': 'x' }),
    ).rejects.toThrow(/manifest.json/);
  });

  it('throws when manifest.json is invalid JSON', async () => {
    await expect(
      packDraftZip('ai-app-tomato-abcd', {
        'manifest.json': 'not json',
        'App.tsx': 'x',
      }),
    ).rejects.toThrow();
  });
});

describe('installDraft', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('packs and pipes through installer.install', async () => {
    const installSpy = vi.spyOn(installerMod, 'install').mockResolvedValue({
      id: 'ai-app-tomato-abcd',
      installedAt: 0,
      isUpgrade: false,
    });
    await installDraft('ai-app-tomato-abcd', {
      'manifest.json': '{"id":"x","name":"X","version":"1.0.0","entry":"App.tsx","perspectiveAware":false}',
      'App.tsx': 'export default () => null;',
    });
    expect(installSpy).toHaveBeenCalled();
    const arg = installSpy.mock.calls[0]![0];
    // Blob arrives at installer.install
    expect(arg).toBeInstanceOf(Blob);
  });
});
```

- [ ] **Step 6.1.2 — Verify failing**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderInstaller.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 6.1.3 — Create the installer**

Create `src/apps/AIAppBuilder/builderInstaller.ts`:

```ts
/**
 * Pack the current draft into a JSZip Blob and pipe through the
 * standard user-app `installer.install`. Forces manifest.id to the
 * locked draftId so the LLM cannot accidentally rename the app
 * mid-session.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import JSZip from 'jszip';
import { install, type InstallResult } from '@/platform/userApp/installer';

export async function packDraftZip(
  draftId: string,
  files: Record<string, string>,
): Promise<Blob> {
  const manifestSrc = files['manifest.json'];
  if (!manifestSrc) {
    throw new Error('packDraftZip: draftFiles missing manifest.json');
  }

  // Force manifest.id; rewrite manifest with the locked draftId.
  const manifest = JSON.parse(manifestSrc);
  manifest.id = draftId;
  const lockedManifest = JSON.stringify(manifest, null, 2);

  const zip = new JSZip();
  zip.file('manifest.json', lockedManifest);
  for (const [path, content] of Object.entries(files)) {
    if (path === 'manifest.json') continue;
    zip.file(path, content);
  }
  return zip.generateAsync({ type: 'blob' });
}

export async function installDraft(
  draftId: string,
  files: Record<string, string>,
): Promise<InstallResult> {
  const blob = await packDraftZip(draftId, files);
  return install(blob);
}
```

- [ ] **Step 6.1.4 — Verify tests pass**

Run: `pnpm test src/apps/AIAppBuilder/__tests__/builderInstaller.test.ts`
Expected: 5 tests PASS.

- [ ] **Step 6.1.5 — Full regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green.

- [ ] **Step 6.1.6 — Commit**

```bash
git add src/apps/AIAppBuilder/builderInstaller.ts src/apps/AIAppBuilder/__tests__/builderInstaller.test.ts
git commit -m "$(cat <<'EOF'
feat(ai-builder): builderInstaller — pack draft + force id + install

packDraftZip wraps draftFiles into JSZip Blob, rewriting manifest.id
to the locked draftId. installDraft = packDraftZip + installer.install.

Stage 6 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 7 — `BuilderPreview`

**Why:** Live in-app preview of the current compiled draft. Reuses user-app sandbox primitives.

### Task 7.1 — Preview component

**Files:**
- Create: `src/apps/AIAppBuilder/BuilderPreview.tsx`

- [ ] **Step 7.1.1 — Create the component**

Create `src/apps/AIAppBuilder/BuilderPreview.tsx`:

```tsx
/**
 * Live preview pane: compiles the current draftFiles via Sucrase,
 * mounts the entry component inside an ErrorBoundary. Re-mounts whenever
 * draftFiles changes.
 *
 * The preview is ephemeral — never registered with appRegistry, never
 * written to IDB. The compiledMap is rebuilt from scratch each time.
 *
 * See docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md
 */

import React, { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import { compileTsx } from '@/platform/userApp/compiler';
import { createUserAppRuntime } from '@/platform/userApp/moduleResolver';
import { resolveModule } from '@/platform/userApp/sdk';
import { wrapUserComponent } from '@/platform/userApp/sdk/wrap';
import { validateManifest, ManifestError } from '@/platform/userApp/manifest';
import { useAIAppBuilderStore } from './aiAppBuilderStore';

export function BuilderPreview() {
  const draftId = useAIAppBuilderStore((s) => s.draftId);
  const draftFiles = useAIAppBuilderStore((s) => s.draftFiles);

  const [Component, setComponent] = useState<ComponentType | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Need a stable JSON-stringified key to know when files actually changed
  const filesKey = useMemo(() => JSON.stringify(draftFiles), [draftFiles]);

  useEffect(() => {
    let cancelled = false;
    if (!draftId || Object.keys(draftFiles).length === 0) {
      setComponent(null);
      setError(null);
      return;
    }

    (async () => {
      try {
        // Validate manifest first
        const manifestSrc = draftFiles['manifest.json'];
        if (!manifestSrc) {
          throw new Error('草稿缺少 manifest.json');
        }
        const manifest = validateManifest(JSON.parse(manifestSrc));

        // Compile every .tsx / .ts file
        const compiledMap: Record<string, string> = {};
        for (const [path, content] of Object.entries(draftFiles)) {
          if (path === 'manifest.json') continue;
          if (path.endsWith('.tsx') || path.endsWith('.ts')) {
            compiledMap[path] = await compileTsx(content, `${draftId}/${path}`);
          }
        }

        // Run sandbox
        const runtime = createUserAppRuntime(compiledMap, manifest.entry, resolveModule, draftId);
        const Raw = (runtime as unknown as { default?: ComponentType; [k: string]: unknown }).default;
        if (typeof Raw !== 'function') {
          throw new Error('App.tsx 必须 default export 一个 React 组件');
        }

        if (cancelled) return;
        setComponent(() => wrapUserComponent(Raw));
        setError(null);
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ManifestError) {
          setError(`manifest.json 无效: ${e.message}`);
        } else {
          setError(e instanceof Error ? e.message : String(e));
        }
        setComponent(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [draftId, filesKey, draftFiles]);

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          color: 'var(--color-systemRed)',
          backgroundColor: 'var(--color-secondarySystemBackground)',
          height: '100%',
          overflow: 'auto',
          fontSize: 13,
          lineHeight: 1.5,
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 8 }}>预览编译失败</div>
        <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
          {error}
        </pre>
      </div>
    );
  }

  if (!Component) {
    return (
      <div
        style={{
          padding: 16,
          color: 'var(--color-secondaryLabel)',
          textAlign: 'center',
          fontSize: 13,
        }}
      >
        尚未生成 — 在下方对话区描述你想要的 app
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'hidden' }}>
      <Component />
    </div>
  );
}
```

- [ ] **Step 7.1.2 — Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 7.1.3 — Commit**

```bash
git add src/apps/AIAppBuilder/BuilderPreview.tsx
git commit -m "$(cat <<'EOF'
feat(ai-builder): BuilderPreview — live in-app draft preview

Compiles draftFiles via Sucrase, mounts entry component through the
existing user-app sandbox infra (createUserAppRuntime + wrapUserComponent),
ErrorBoundary-wrapped. Rebuilds compiledMap from scratch on every
draftFiles change — no stale module leakage. Shows compile error
fallback when validation / Sucrase / sandbox throws.

Stage 7 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 8 — `BuilderChat`

**Why:** Chat UI: message list + input + send.

### Task 8.1 — Chat component

**Files:**
- Create: `src/apps/AIAppBuilder/BuilderChat.tsx`

- [ ] **Step 8.1.1 — Create the component**

Create `src/apps/AIAppBuilder/BuilderChat.tsx`:

```tsx
/**
 * Chat UI for the AI 工坊. Displays alternating user/builder turns
 * plus a status banner (generating / parse-error / etc.) and an input
 * box at the bottom.
 *
 * Send button dispatches:
 *   - First message in session → store.startNewDraft
 *   - Subsequent → store.appendUserMessage
 * Then triggers generateDraft via the parent (AIAppBuilderApp) which
 * pumps the result back into the store.
 */

import { useState, useRef, useEffect, type KeyboardEvent } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useAIAppBuilderStore, type ChatTurn } from './aiAppBuilderStore';

interface BuilderChatProps {
  onSend: (text: string) => void;
}

export function BuilderChat({ onSend }: BuilderChatProps) {
  const chatHistory = useAIAppBuilderStore((s) => s.chatHistory);
  const status = useAIAppBuilderStore((s) => s.status);
  const lastError = useAIAppBuilderStore((s) => s.lastError);

  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new turns
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory.length, status]);

  const isGenerating = status === 'generating';
  const canSend = input.trim().length > 0 && !isGenerating;

  const handleSend = () => {
    if (!canSend) return;
    const text = input.trim();
    setInput('');
    onSend(text);
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'auto',
          padding: '12px 16px',
          backgroundColor: 'var(--color-secondarySystemBackground)',
        }}
      >
        {chatHistory.length === 0 && (
          <EmptyState />
        )}
        {chatHistory.map((turn, i) => (
          <ChatBubble key={i} turn={turn} />
        ))}
        {isGenerating && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              color: 'var(--color-secondaryLabel)',
              fontSize: 13,
              padding: '8px 0',
            }}
          >
            <Loader2 size={14} className="animate-spin" />
            生成中...
          </div>
        )}
        {status === 'compile-error' && lastError && (
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              backgroundColor: 'rgba(255,59,48,0.1)',
              color: 'var(--color-systemRed)',
              fontSize: 13,
              marginTop: 8,
            }}
          >
            编译失败: {lastError}
          </div>
        )}
      </div>

      <div
        style={{
          borderTop: '0.5px solid var(--color-separator)',
          padding: 12,
          backgroundColor: 'var(--color-tertiarySystemBackground)',
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={chatHistory.length === 0 ? '描述你想要的 app...' : '继续完善...'}
            rows={2}
            style={{
              flex: 1,
              resize: 'none',
              fontSize: 14,
              padding: '8px 12px',
              borderRadius: 8,
              border: '0.5px solid var(--color-separator)',
              backgroundColor: 'var(--color-systemBackground)',
              color: 'var(--color-label)',
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              border: 'none',
              backgroundColor: canSend ? 'var(--color-systemBlue)' : 'var(--color-separator)',
              color: 'white',
              cursor: canSend ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        textAlign: 'center',
        color: 'var(--color-secondaryLabel)',
        fontSize: 14,
        padding: '40px 16px',
        lineHeight: 1.6,
      }}
    >
      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--color-label)' }}>
        AI 工坊
      </div>
      <div>
        用一句话描述你想要的 app — AI 会生成代码,你预览满意后一键安装。
      </div>
      <div style={{ marginTop: 12, fontSize: 13 }}>
        例如:
        <br />· 番茄钟,25 分钟工作 5 分钟休息
        <br />· 习惯打卡,每天最多 5 个习惯
        <br />· 简易记账,按分类汇总
      </div>
    </div>
  );
}

function ChatBubble({ turn }: { turn: ChatTurn }) {
  const isUser = turn.role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 8,
      }}
    >
      <div
        style={{
          maxWidth: '80%',
          padding: '8px 12px',
          borderRadius: 14,
          fontSize: 14,
          lineHeight: 1.5,
          backgroundColor: isUser
            ? 'var(--color-systemBlue)'
            : 'var(--color-tertiarySystemBackground)',
          color: isUser ? 'white' : 'var(--color-label)',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {turn.text}
      </div>
    </div>
  );
}
```

- [ ] **Step 8.1.2 — Typecheck**

Run: `pnpm typecheck`
Expected: 0 errors.

- [ ] **Step 8.1.3 — Commit**

```bash
git add src/apps/AIAppBuilder/BuilderChat.tsx
git commit -m "$(cat <<'EOF'
feat(ai-builder): BuilderChat — chat UI with bubbles + input

Renders user/builder turns as iMessage-style bubbles, surfaces
generating / compile-error status as inline indicators, exposes
an onSend callback for the parent to drive generateDraft. Empty
state suggests prompts for first-time users.

Stage 8 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 9 — `AIAppBuilderApp`

**Why:** Top-level — composes Preview + Chat, owns generation orchestration, install action.

### Task 9.1 — Top-level component

**Files:**
- Create: `src/apps/AIAppBuilder/AIAppBuilderApp.tsx`

- [ ] **Step 9.1.1 — Create the component**

Create `src/apps/AIAppBuilder/AIAppBuilderApp.tsx`:

```tsx
/**
 * AI 工坊 builtin app — top-level composition.
 *
 * Layout:
 *   ┌──────── NavBar (新建 + 安装到桌面) ────────┐
 *   │ Preview pane (50%)                       │
 *   ├──────────────────────────────────────────┤
 *   │ Chat pane    (50%)                       │
 *   └──────────────────────────────────────────┘
 *
 * Owns the generate-orchestrate-store glue. BuilderChat reports
 * onSend; this component decides startNewDraft vs appendUserMessage,
 * fires generateDraft, and threads the result back into the store.
 */

import { useCallback } from 'react';
import { Plus, Download } from 'lucide-react';
import { AppScreen, NavBar } from '@/system';
import { show as toastShow } from '@/platform/userApp/sdk/toast';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { useAIAppBuilderStore } from './aiAppBuilderStore';
import { generateDraft } from './builderGenerator';
import { installDraft } from './builderInstaller';
import { BuilderPreview } from './BuilderPreview';
import { BuilderChat } from './BuilderChat';

export function AIAppBuilderApp() {
  const draftId = useAIAppBuilderStore((s) => s.draftId);
  const draftFiles = useAIAppBuilderStore((s) => s.draftFiles);
  const status = useAIAppBuilderStore((s) => s.status);
  const goHome = useAppRuntimeStore((s) => s.goHome);

  const handleSend = useCallback(async (text: string) => {
    const store = useAIAppBuilderStore.getState();
    if (!store.draftId) {
      // First message → start new draft
      store.startNewDraft(text);
    } else {
      store.appendUserMessage(text);
      store.setStatus('generating');
    }

    const { draftId: id, chatHistory } = useAIAppBuilderStore.getState();
    if (!id) return; // shouldn't happen

    const result = await generateDraft({ draftId: id, chatHistory });

    const after = useAIAppBuilderStore.getState();
    switch (result.kind) {
      case 'success':
        after.appendBuilderMessage('已生成,请在上方预览', result.files);
        after.setStatus('ready');
        break;
      case 'parse-error':
        after.appendBuilderMessage('生成结果格式不对,自动重试也失败了。请重新描述或换个说法。');
        after.setStatus('idle');
        break;
      case 'api-error':
        after.appendBuilderMessage(`API 错误: ${result.message}`);
        after.setError(result.message);
        break;
    }
  }, []);

  const handleNewDraft = useCallback(() => {
    if (status === 'generating') {
      toastShow('生成中,无法新建');
      return;
    }
    if (!confirm('新建会丢弃当前草稿,确定继续吗?')) return;
    useAIAppBuilderStore.setState({
      draftId: null,
      draftFiles: {},
      chatHistory: [],
      status: 'idle',
      lastError: null,
    });
  }, [status]);

  const handleInstall = useCallback(async () => {
    if (!draftId) return;
    if (Object.keys(draftFiles).length === 0) {
      toastShow('当前没有可安装的草稿');
      return;
    }
    try {
      await installDraft(draftId, draftFiles);
      toastShow('已安装到桌面');
      goHome();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toastShow(`安装失败: ${msg}`);
      useAIAppBuilderStore.getState().appendBuilderMessage(`安装失败: ${msg}`);
    }
  }, [draftId, draftFiles, goHome]);

  const canInstall = draftId !== null && Object.keys(draftFiles).length > 0 && status !== 'generating';

  // NavBar's rightButtons[] takes {icon, onClick}. Conditional render for the
  // install button so it just disappears when not available — NavBar doesn't
  // surface a disabled state visually.
  const rightButtons = [
    { icon: <Plus size={18} />, onClick: handleNewDraft, testId: 'builder-new-draft' },
    ...(canInstall
      ? [{ icon: <Download size={18} />, onClick: handleInstall, testId: 'builder-install' }]
      : []),
  ];

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <NavBar title="AI 工坊" rightButtons={rightButtons} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ flex: 1, minHeight: 0, borderBottom: '0.5px solid var(--color-separator)' }}>
          <BuilderPreview />
        </div>
        <div style={{ flex: 1, minHeight: 0 }}>
          <BuilderChat onSend={handleSend} />
        </div>
      </div>
    </AppScreen>
  );
}
```

- [ ] **Step 9.1.2 — Typecheck + build**

Run: `pnpm typecheck && pnpm build`
Expected: all green. NavBar's actual API is `rightButtons: NavBarButton[]` where `NavBarButton = {icon: ReactNode, onClick: () => void, testId?: string}` — the implementation above already matches.

- [ ] **Step 9.1.3 — Commit**

```bash
git add src/apps/AIAppBuilder/AIAppBuilderApp.tsx
git commit -m "$(cat <<'EOF'
feat(ai-builder): AIAppBuilderApp — top-level composition

Owns the generate-orchestrate-store glue: handles "new draft" /
"send message" / "install to desktop" actions. Composes BuilderPreview
(top half) + BuilderChat (bottom half).

Stage 9 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 10 — Register builtin + add desktop icon

**Why:** Wire the builder into the app system so the user can actually open it.

### Task 10.1 — registerBuiltins + apps.data

**Files:**
- Modify: `src/apps/registerBuiltins.ts`
- Modify: `src/shell/Springboard/apps.data.ts`

- [ ] **Step 10.1.1 — Register the builtin**

Edit `src/apps/registerBuiltins.ts`. Find the import block at the top, add:

```ts
import { AIAppBuilderApp } from './AIAppBuilder/AIAppBuilderApp';
```

In the `registerBuiltins` function body, add a new registration (place near other "Global data" entries):

```ts
  appRegistry.register({ id: 'ai-app-builder', name: 'AI 工坊', type: 'builtin', component: AIAppBuilderApp, perspectiveAware: false, globalData: false });
```

- [ ] **Step 10.1.2 — Add desktop icon**

Edit `src/shell/Springboard/apps.data.ts`. Find the `cnApps` array (the section with xingyu / gomoku). Add a new entry:

```ts
  { id: 'ai-app-builder', name: 'AI 工坊', icon: `${SYSTEM_ICON_BASE}/shortcuts.jpg`, page: 1 },
```

Reuse the `shortcuts.jpg` icon (already in the resource folder; "shortcuts" semantically = creating things). If you'd rather a different existing icon, swap. Don't add new asset files in this stage.

- [ ] **Step 10.1.3 — Run regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green.

- [ ] **Step 10.1.4 — Commit**

```bash
git add src/apps/registerBuiltins.ts src/shell/Springboard/apps.data.ts
git commit -m "$(cat <<'EOF'
feat(ai-builder): register 'ai-app-builder' builtin + desktop icon

App is now openable from the springboard. Uses shortcuts.jpg as a
placeholder icon (semantically: creating things).

Stage 10 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 11 — Settings model-override page

**Why:** Optional per-builder model config (Q5: default sticks to aiConfig, advanced users can override).

### Task 11.1 — AIBuilderModelPage + nav wiring

**Files:**
- Create: `src/apps/Settings/pages/AIBuilderModelPage.tsx`
- Modify: `src/apps/Settings/SettingsApp.tsx`
- Modify: `src/apps/Settings/SettingsHome.tsx`

- [ ] **Step 11.1.1 — Create the model page**

Create `src/apps/Settings/pages/AIBuilderModelPage.tsx`:

```tsx
import { useState } from 'react';
import { useAIAppBuilderConfigStore } from '@/apps/AIAppBuilder/aiAppBuilderConfigStore';

export function AIBuilderModelPage() {
  const override = useAIAppBuilderConfigStore((s) => s.modelOverride);
  const setOverride = useAIAppBuilderConfigStore((s) => s.setOverride);

  const [draft, setDraft] = useState({
    provider: override?.provider ?? '',
    model: override?.model ?? '',
    endpoint: override?.endpoint ?? '',
    apiKey: override?.apiKey ?? '',
    maxTokens: override?.maxTokens?.toString() ?? '',
  });

  const handleSave = () => {
    const nonEmpty: Record<string, unknown> = {};
    if (draft.provider.trim()) nonEmpty.provider = draft.provider.trim();
    if (draft.model.trim()) nonEmpty.model = draft.model.trim();
    if (draft.endpoint.trim()) nonEmpty.endpoint = draft.endpoint.trim();
    if (draft.apiKey.trim()) nonEmpty.apiKey = draft.apiKey.trim();
    const mt = Number(draft.maxTokens);
    if (Number.isFinite(mt) && mt > 0) nonEmpty.maxTokens = mt;
    setOverride(Object.keys(nonEmpty).length === 0 ? null : nonEmpty);
  };

  const handleClear = () => {
    setOverride(null);
    setDraft({ provider: '', model: '', endpoint: '', apiKey: '', maxTokens: '' });
  };

  return (
    <div style={{ padding: 16, color: 'var(--color-label)' }}>
      <p style={{ fontSize: 13, color: 'var(--color-secondaryLabel)', lineHeight: 1.6, marginBottom: 16 }}>
        AI 工坊默认使用与角色聊天相同的模型配置。如果你想让代码生成用一个更强的模型,
        在下方填入需要覆盖的字段。留空的字段会沿用 AI 设置里的值。
      </p>

      {(['provider', 'model', 'endpoint', 'apiKey', 'maxTokens'] as const).map((field) => (
        <Field
          key={field}
          label={field}
          value={draft[field]}
          onChange={(v) => setDraft((d) => ({ ...d, [field]: v }))}
          placeholder={field === 'maxTokens' ? '例如 8000' : '留空 = 沿用 AI 设置'}
          isPassword={field === 'apiKey'}
        />
      ))}

      <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
        <button
          type="button"
          onClick={handleSave}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'var(--color-systemBlue)',
            color: 'white',
            fontSize: 15,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          保存
        </button>
        <button
          type="button"
          onClick={handleClear}
          style={{
            flex: 1,
            padding: '12px',
            borderRadius: 8,
            border: '0.5px solid var(--color-separator)',
            backgroundColor: 'var(--color-tertiarySystemBackground)',
            color: 'var(--color-systemRed)',
            fontSize: 15,
            cursor: 'pointer',
          }}
        >
          清除覆盖
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  isPassword,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  isPassword?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--color-secondaryLabel)', marginBottom: 4 }}>
        {label}
      </div>
      <input
        type={isPassword ? 'password' : 'text'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 12px',
          borderRadius: 8,
          border: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-systemBackground)',
          color: 'var(--color-label)',
          fontSize: 14,
          outline: 'none',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
```

- [ ] **Step 11.1.2 — Wire into SettingsApp**

Edit `src/apps/Settings/SettingsApp.tsx`:

Add import:
```ts
import { AIBuilderModelPage } from './pages/AIBuilderModelPage';
```

In `PAGE_TITLES`, add (near `aiSettings: 'AI 设置'`):
```ts
aiBuilderModel: '工坊代码模型',
```

In `PAGE_COMPONENTS`, add:
```ts
aiBuilderModel: AIBuilderModelPage,
```

- [ ] **Step 11.1.3 — Add SettingsHome row**

Edit `src/apps/Settings/SettingsHome.tsx`. Find the `AI 工具` ListRow added in M4.3 §2. Add a new ListRow right after it:

```tsx
        <ListRow
          icon={<Wrench size={18} />}
          iconColor="#5AC8FA"
          title="工坊代码模型"
          onClick={() => push('aiBuilderModel')}
          chevron
        />
```

Add `Wrench` to the lucide-react imports at the top if not already there.

- [ ] **Step 11.1.4 — Run regression**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green.

- [ ] **Step 11.1.5 — Commit**

```bash
git add src/apps/Settings/pages/AIBuilderModelPage.tsx src/apps/Settings/SettingsApp.tsx src/apps/Settings/SettingsHome.tsx
git commit -m "$(cat <<'EOF'
feat(ai-builder): Settings → 工坊代码模型 — model override config UI

Optional per-builder model config: lets users specify provider /
model / endpoint / apiKey / maxTokens that override aiConfig. Empty
= sticks with aiConfig. Saved to aiAppBuilderConfigStore (IDB).

Stage 11 of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Stage 12 — Manual smoke + scope close

**Why:** Manual end-to-end verification on real LLM. Plus mark scope done.

### Task 12.1 — Manual smoke test plan

- [ ] **Step 12.1.1 — Confirm test suite + build green**

Run: `pnpm test && pnpm typecheck && pnpm build`
Expected: all green. Total tests should be ≈1296 + (12 + 4 + 6 + 8 + 6 + 5) = 1337 from new test files.

- [ ] **Step 12.1.2 — Manual end-to-end smoke**

Open the dev server (`pnpm dev`) and walk through:

1. Open AI 工坊 app from springboard.
2. Empty state shows; no preview.
3. Type "番茄钟,25 分钟工作 5 分钟休息" → click Send.
4. "生成中..." indicator appears.
5. After 5-30s, builder reply appears + preview pane mounts a working timer UI.
6. Type "把按钮改成蓝色" → Send.
7. Preview re-mounts with the change.
8. Click 安装. Toast "已安装到桌面". Springboard now has the new app icon.
9. Open the new app from springboard. Verify it works.
10. Open AppStore. New app appears in the installed list.
11. Long-press → 详情 → uninstall. App icon disappears from springboard.
12. Reopen AI 工坊. Click 新建. Confirm. State resets.
13. Test parse-error path: in dev mode, modify `chatComplete` to return `'totally not JSON'` once. Builder should auto-retry and either recover or surface the error in chat.
14. Test compile-error path: have the LLM emit a TSX with a syntax error (or modify draftFiles directly). Preview pane shows compile error fallback.

Document any failures in this checklist. If a step blocks, do NOT mark this plan complete.

### Task 12.2 — Add to dev/release notes

**Files:**
- Create: `docs/release-notes/2026-04-27-ai-app-builder-v1.md`

- [ ] **Step 12.2.1 — Create release note**

Create `docs/release-notes/2026-04-27-ai-app-builder-v1.md`:

```markdown
# AI App Builder V1 — Release Notes

**Ship date:** 2026-04-27
**Spec:** `docs/superpowers/specs/2026-04-27-ai-app-builder-v1-design.md`
**Plan:** `docs/plan/2026-04-27-0111-ai-app-builder-v1-impl.md`

## What

A new builtin app, **AI 工坊**, lets users describe an app in natural language and get a working multi-file user app generated, previewed live, and installed to the springboard. No coding required.

## How

- Open AI 工坊 from the springboard.
- Type a description ("番茄钟,25 分钟工作 5 分钟休息").
- Wait for generation; the preview pane mounts the result.
- Refine via chat ("加一个暂停按钮").
- Click 安装 — app icon appears on the springboard.

## Architecture

- New builtin at `src/apps/AIAppBuilder/`.
- Generation: chatComplete + structured JSON wire format (`{files: [{path, content}]}`).
- Preview: reuses existing user-app sandbox (createUserAppRuntime + wrapUserComponent).
- Install: pipes through standard `installer.install`.

## Known limitations (V1.1 / V2 follow-ups)

- Single active draft (no history list).
- No manual TSX editing.
- No asset embedding (images / fonts).
- LLM occasionally emits non-JSON; auto-retry covers many cases but not all.

## Settings

`Settings → 工坊代码模型` for optional per-builder model override. Empty = sticks with the AI 设置 config.
```

- [ ] **Step 12.2.2 — Commit + tag**

```bash
git add docs/release-notes/2026-04-27-ai-app-builder-v1.md
git commit -m "$(cat <<'EOF'
docs(ai-builder): release notes — AI App Builder V1 shipped

Stage 12 / final stage of M4 §AI-App-Builder V1.
EOF
)"
```

---

## Verification Checklist

- [ ] `pnpm test` — all green
- [ ] `pnpm typecheck` — no errors
- [ ] `pnpm build` — succeeds
- [ ] Manual smoke (Task 12.1.2) — all 14 steps pass on real LLM
- [ ] git log shows ≈14 commits, each tagged with stage / feature topic

## Non-goals (recap from spec)

- Multi-session draft history → V1.1
- Manual TSX editing → V2
- Asset embedding (images / fonts) → V1.1+
- Provider-native tool calling for code emission → out of scope (separate workstream)
- Test generation by the LLM → V1.1+
- Library/template marketplace → V2+
