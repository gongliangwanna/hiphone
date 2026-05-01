/**
 * AI 工坊 agent — private tool executors invoked one-per-turn by the agent loop.
 *
 * Tool catalog:
 *   - read_file({path})              → {content}
 *   - write_file({path, content})    → ok; manifest.json's id is locked to ctx.draftId
 *   - delete_file({path})            → ok (idempotent)
 *   - list_files({})                 → {paths[]} alphabetically sorted
 *   - compile_check({path?})         → {errors[]}; tsx/ts via Sucrase, manifest.json via validateManifest
 *   - replace_text({path, oldText, newText}) → targeted unique text replacement
 *   - replace_range({path, startLine, endLine, content}) → targeted 1-based line replacement
 *   - append_to_file({path, content}) → append exact content to an existing file
 *   - read_capability({topic?})      → read SDK/sandbox/style/multifile guidance with examples
 *   - read_fixture({name})           → {files} for 'todo-app' | 'ai-translator-app'
 *   - update_plan({steps[]})         → ok; writes builderPlanStore
 *   - mark_step({id, status})        → ok; mutates builderPlanStore
 *   - finish({summary})              → {finished:true, summary} — agent loop exit marker
 *
 * No imports from heartbeat/aiChatEngine/toolRegistry/disabledToolsStore/parseReply —
 * the agent's tool surface is private and never registered globally.
 *
 * See docs/plan/2026-04-27-0245-ai-app-builder-v1.5-agentic-impl.md S4
 */

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useAIAppBuilderStore } from '../aiAppBuilderStore';
import { useBuilderPlanStore } from './builderPlanStore';
import { compileTsx } from '@/platform/userApp/compiler';
import { validateManifest } from '@/platform/userApp/manifest';
import { moduleMap, resolveModule } from '@/platform/userApp/sdk';
import {
  resolveRelativePath,
  evaluateUserAppModule,
} from '@/platform/userApp/moduleResolver';
import { withUserAppContext } from '@/platform/userApp/sdk/context';

import todoManifest from '@/platform/userApp/__tests__/fixtures/todo-app/manifest.json?raw';
import todoApp from '@/platform/userApp/__tests__/fixtures/todo-app/App.tsx?raw';
import todoUtils from '@/platform/userApp/__tests__/fixtures/todo-app/utils.ts?raw';
import todoTodoItem from '@/platform/userApp/__tests__/fixtures/todo-app/components/TodoItem.tsx?raw';
import translatorManifest from '@/platform/userApp/__tests__/fixtures/ai-translator-app/manifest.json?raw';
import translatorApp from '@/platform/userApp/__tests__/fixtures/ai-translator-app/App.tsx?raw';

export interface ToolContext {
  /** Locked draft id; write_file enforces this on manifest.json. */
  draftId: string;
}

export type ToolResult =
  | { ok: true; data?: unknown }
  | { ok: false; error: string; data?: unknown };

export type ToolHandler = (
  args: unknown,
  ctx: ToolContext,
) => Promise<ToolResult> | ToolResult;

// ───────── helpers ─────────

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function getDraftFiles(draftId: string): Record<string, string> {
  const state = useAIAppBuilderStore.getState();
  return state.drafts[draftId]?.files ?? state.draftFiles;
}

function setDraftFile(path: string, content: string, draftId: string): void {
  useAIAppBuilderStore.setState((s) => ({
    ...(s.drafts[draftId]
      ? {
          drafts: {
            ...s.drafts,
            [draftId]: {
              ...s.drafts[draftId],
              files: { ...s.drafts[draftId].files, [path]: content },
              updatedAt: Date.now(),
            },
          },
        }
      : {}),
    ...(s.activeDraftId === draftId || !s.drafts[draftId]
      ? { draftFiles: { ...getDraftFiles(draftId), [path]: content } }
      : {}),
  }));
}

function deleteDraftFile(path: string, draftId: string): void {
  useAIAppBuilderStore.setState((s) => {
    const files = s.drafts[draftId]?.files ?? s.draftFiles;
    if (!(path in files)) return {};
    const next = { ...files };
    delete next[path];
    return {
      ...(s.drafts[draftId]
        ? {
            drafts: {
              ...s.drafts,
              [draftId]: {
                ...s.drafts[draftId],
                files: next,
                updatedAt: Date.now(),
              },
            },
          }
        : {}),
      ...(s.activeDraftId === draftId || !s.drafts[draftId] ? { draftFiles: next } : {}),
    };
  });
}

function getDraftFile(path: string, draftId: string): string | null {
  const files = getDraftFiles(draftId);
  return Object.prototype.hasOwnProperty.call(files, path) ? files[path]! : null;
}

// ───────── tool implementations ─────────

function tool_read_file(args: unknown, ctx: ToolContext): ToolResult {
  if (!isObj(args) || typeof args.path !== 'string' || args.path.length === 0) {
    return { ok: false, error: 'read_file: path must be a non-empty string' };
  }
  const files = getDraftFiles(ctx.draftId);
  if (!(args.path in files)) {
    return { ok: false, error: 'not found' };
  }
  return { ok: true, data: { content: files[args.path]! } };
}

function tool_write_file(args: unknown, ctx: ToolContext): ToolResult {
  if (!isObj(args) || typeof args.path !== 'string' || args.path.length === 0) {
    return { ok: false, error: 'write_file: path must be a non-empty string' };
  }
  if (typeof args.content !== 'string') {
    return { ok: false, error: 'write_file: content must be a string' };
  }
  const { path, content } = args as { path: string; content: string };

  if (path === 'manifest.json') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return { ok: false, error: `manifest.json: invalid JSON: ${msg}` };
    }
    if (!isObj(parsed)) {
      return { ok: false, error: 'manifest.json: must be a JSON object' };
    }
    parsed.id = ctx.draftId;
    setDraftFile(path, JSON.stringify(parsed, null, 2), ctx.draftId);
    return { ok: true };
  }

  setDraftFile(path, content, ctx.draftId);
  return { ok: true };
}

function tool_delete_file(args: unknown, ctx: ToolContext): ToolResult {
  if (!isObj(args) || typeof args.path !== 'string' || args.path.length === 0) {
    return { ok: false, error: 'delete_file: path must be a non-empty string' };
  }
  deleteDraftFile(args.path, ctx.draftId);
  return { ok: true };
}

function tool_list_files(_args: unknown, ctx: ToolContext): ToolResult {
  const files = getDraftFiles(ctx.draftId);
  const paths = Object.keys(files).sort();
  return { ok: true, data: { paths } };
}

async function tool_compile_check(
  args: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const files = getDraftFiles(ctx.draftId);
  const targetPath =
    isObj(args) && typeof args.path === 'string' && args.path.length > 0
      ? args.path
      : null;

  let entries: [string, string][];
  if (targetPath !== null) {
    if (!(targetPath in files)) {
      return { ok: false, error: 'not found' };
    }
    entries = [[targetPath, files[targetPath]!]];
  } else {
    entries = Object.entries(files);
  }

  const errors: { path: string; message: string }[] = [];
  const compiledMap: Record<string, string> = {};
  for (const [path, content] of entries) {
    if (path.endsWith('.tsx') || path.endsWith('.ts')) {
      let compiled: string | null = null;
      try {
        compiled = await compileTsx(content, path);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ path, message: msg });
      }
      if (compiled !== null) {
        compiledMap[path] = compiled;
        for (const specifier of extractRequires(compiled)) {
          const importErr = checkImportResolves(specifier, path, files);
          if (importErr) errors.push({ path, message: importErr });
        }
      }
    }
    // other files (assets, etc.) skipped silently
  }

  if (targetPath === null || targetPath === 'manifest.json') {
    const manifestRaw = files['manifest.json'];
    if (typeof manifestRaw !== 'string') {
      errors.push({ path: 'manifest.json', message: 'manifest.json not found' });
    } else {
      try {
        const manifest = validateManifest(JSON.parse(manifestRaw));
        if (!Object.prototype.hasOwnProperty.call(files, manifest.entry)) {
          errors.push({
            path: 'manifest.json',
            message: `manifest.entry "${manifest.entry}" not found in draft files`,
          });
        } else if (!manifest.entry.endsWith('.tsx') && !manifest.entry.endsWith('.ts')) {
          errors.push({
            path: 'manifest.json',
            message: `manifest.entry "${manifest.entry}" must point to a .tsx or .ts file`,
          });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ path: 'manifest.json', message: msg });
      }
    }
  }

  // Full-tree check (no targetPath) AND no per-file errors so far → also do a
  // dry render. SSR pass catches ReferenceError-class bugs (e.g. `useCallback`
  // used without being imported) that compile fine syntactically but throw at
  // first render. Skipped on single-file checks because we wouldn't have a
  // complete compiled map.
  if (targetPath === null && errors.length === 0) {
    const renderErr = tryDryRender(files, compiledMap, ctx.draftId);
    if (renderErr) errors.push(renderErr);
  }

  if (errors.length > 0) {
    return { ok: false, error: 'compile_check failed', data: { errors } };
  }
  return { ok: true, data: { errors } };
}

// Sucrase emits CommonJS `require("specifier")` calls. Pull every literal
// specifier out of the compiled JS so we can validate it against the SDK
// whitelist + the in-progress draft tree — this catches LLM mistakes like
// `import './App.css'` (no CSS support in the sandbox) BEFORE the user
// installs and the moduleResolver throws at mount time.
function extractRequires(compiled: string): string[] {
  const out: string[] = [];
  const re = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(compiled)) !== null) out.push(m[1]!);
  return out;
}

function checkImportResolves(
  specifier: string,
  fromPath: string,
  files: Record<string, string>,
): string | null {
  if (specifier.startsWith('.')) {
    try {
      resolveRelativePath(fromPath, specifier, files);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }
  if (Object.prototype.hasOwnProperty.call(moduleMap, specifier)) return null;
  return (
    `import "${specifier}" not in SDK whitelist. ` +
    `Available: ${Object.keys(moduleMap).join(', ')}.`
  );
}

// Dry-render: actually mount the entry component once via SSR. Sucrase only
// catches syntax + we already validate imports, but unbound names (e.g.
// `useCallback` referenced without importing) and undefined-deref bugs only
// surface at runtime. SSR pass evaluates module bodies + renders the default
// export once, catching ReferenceError / TypeError before install.
//
// Returns null if the render succeeds (or preconditions aren't met — silently
// skipped); otherwise returns a {path, message} error to push into the
// compile_check errors array.
function tryDryRender(
  files: Record<string, string>,
  compiledMap: Record<string, string>,
  draftId: string,
): { path: string; message: string } | null {
  const manifestRaw = files['manifest.json'];
  if (typeof manifestRaw !== 'string') return null; // no manifest → skip
  let entry: string;
  try {
    const m = validateManifest(JSON.parse(manifestRaw));
    entry = m.entry;
  } catch {
    return null; // manifest invalid → already surfaced as a separate error
  }
  if (!compiledMap[entry]) return null; // entry not compiled → likewise

  try {
    const exports = evaluateUserAppModule(
      compiledMap,
      entry,
      resolveModule,
      draftId,
    );
    const Component = exports.default as unknown;
    if (typeof Component !== 'function') {
      return {
        path: entry,
        message: `entry "${entry}" must default-export a React component (got ${typeof Component})`,
      };
    }
    withUserAppContext(draftId, () => {
      renderToStaticMarkup(
        React.createElement(Component as React.ComponentType),
      );
    });
    return null;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { path: entry, message: `runtime render failed: ${message}` };
  }
}

function tool_read_fixture(args: unknown): ToolResult {
  if (!isObj(args) || typeof args.name !== 'string') {
    return {
      ok: false,
      error: 'read_fixture: name must be a string',
    };
  }
  const name = args.name;
  if (name === 'todo-app') {
    return {
      ok: true,
      data: {
        files: {
          'manifest.json': todoManifest,
          'App.tsx': todoApp,
          'utils.ts': todoUtils,
          'components/TodoItem.tsx': todoTodoItem,
        },
      },
    };
  }
  if (name === 'ai-translator-app') {
    return {
      ok: true,
      data: {
        files: {
          'manifest.json': translatorManifest,
          'App.tsx': translatorApp,
        },
      },
    };
  }
  return {
    ok: false,
    error: `unknown fixture: ${name}. Available: todo-app, ai-translator-app`,
  };
}

function tool_replace_text(args: unknown, ctx: ToolContext): ToolResult {
  if (
    !isObj(args) ||
    typeof args.path !== 'string' ||
    typeof args.oldText !== 'string' ||
    typeof args.newText !== 'string'
  ) {
    return {
      ok: false,
      error: 'replace_text: args must be {path: string, oldText: string, newText: string}',
    };
  }
  if (args.oldText.length === 0) {
    return { ok: false, error: 'replace_text: oldText must be non-empty' };
  }
  const current = getDraftFile(args.path, ctx.draftId);
  if (current === null) return { ok: false, error: 'not found' };

  const matchCount = current.split(args.oldText).length - 1;
  if (matchCount === 0) {
    return { ok: false, error: 'replace_text: oldText not found' };
  }
  if (matchCount > 1) {
    return {
      ok: false,
      error: `replace_text: oldText matched ${matchCount} times; provide a more specific snippet`,
    };
  }
  setDraftFile(args.path, current.replace(args.oldText, args.newText), ctx.draftId);
  return { ok: true };
}

function tool_replace_range(args: unknown, ctx: ToolContext): ToolResult {
  if (
    !isObj(args) ||
    typeof args.path !== 'string' ||
    !Number.isInteger(args.startLine) ||
    !Number.isInteger(args.endLine) ||
    typeof args.content !== 'string'
  ) {
    return {
      ok: false,
      error:
        'replace_range: args must be {path: string, startLine: number, endLine: number, content: string}',
    };
  }
  const current = getDraftFile(args.path, ctx.draftId);
  if (current === null) return { ok: false, error: 'not found' };

  const startLine = args.startLine as number;
  const endLine = args.endLine as number;
  const lines = current.split('\n');
  if (startLine < 1 || endLine < startLine || endLine > lines.length) {
    return {
      ok: false,
      error: `replace_range: invalid line range ${startLine}-${endLine} for ${lines.length} line file`,
    };
  }

  const next = [
    ...lines.slice(0, startLine - 1),
    ...args.content.split('\n'),
    ...lines.slice(endLine),
  ].join('\n');
  setDraftFile(args.path, next, ctx.draftId);
  return { ok: true };
}

function tool_append_to_file(args: unknown, ctx: ToolContext): ToolResult {
  if (!isObj(args) || typeof args.path !== 'string' || typeof args.content !== 'string') {
    return {
      ok: false,
      error: 'append_to_file: args must be {path: string, content: string}',
    };
  }
  const current = getDraftFile(args.path, ctx.draftId);
  if (current === null) return { ok: false, error: 'not found' };
  setDraftFile(args.path, current + args.content, ctx.draftId);
  return { ok: true };
}

const CAPABILITY_SDK_INDEX = String.raw`
SDK 索引:
- sdk.react: React 与 lucide-react 的用法边界。
- sdk.ui: @hiphone/ui, 当前主要是 NavBar。
- sdk.storage: @hiphone/storage 异步 KV, per-owner/global, hydrate 示例。
- sdk.ai: @hiphone/ai complete/streamComplete/chatWithCharacter 等。
- sdk.hooks: @hiphone/hooks 生命周期、深链参数、临时内存。
- sdk.nav: @hiphone/nav open/goHome 与 useOpenParams 配套。
- sdk.toast: @hiphone/toast show/warn/error。
- sdk.banner: @hiphone/banner show/dismiss。
- sdk.motion: @hiphone/motion 动画组件、hooks、token。
- sdk.perspective: @hiphone/perspective 当前手机主人视角。
- sdk.services: @hiphone/services app 间服务注册与调用。

决策规则:
- 需要持久化用户数据: 查 sdk.storage。
- 需要调用模型做翻译/总结/生成: 查 sdk.ai, 优先 complete。
- 需要角色聊天与记忆: 查 sdk.ai, 使用 chatWithCharacter。
- 需要跨 app 打开并传参: 查 sdk.nav + sdk.hooks。
- 需要提示用户: 简短确认用 sdk.toast, 系统通知样式用 sdk.banner。
- 需要动画: 查 sdk.motion, 不要 import motion/react。
- 普通列表、表单、卡片、sheet、业务状态优先自己用 React + Tailwind 实现。
`.trim();

const CAPABILITY_SANDBOX = String.raw`
沙箱限制:
- 不要 import host 私有路径, 例如 @/system 或 @/platform。
- 不要 import CSS/SCSS/LESS、图片、字体、任意 npm 包。
- window/document/globalThis/fetch/localStorage/sessionStorage/indexedDB/XMLHttpRequest/WebSocket/Worker 不可用。
- 用 React 事件代替全局事件, 用 @hiphone/storage 代替 localStorage, 用 @hiphone/ai 代替 HTTP 请求。

正确 import:
~~~tsx
import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { get, set } from '@hiphone/storage';
import { Card } from './components/Card';
~~~

错误 import:
~~~tsx
import '@/system';
import axios from 'axios';
import './style.css';
import logo from './logo.png';
~~~
`.trim();

const CAPABILITY_STYLING = String.raw`
默认样式策略:
- 优先 Tailwind utility className + hiPhone CSS 变量。
- 布局用 flex/grid/gap/px/py/rounded/text/min-h 等 className。
- 颜色用 var(--color-systemBackground)、var(--color-secondarySystemBackground)、var(--color-label)、var(--color-secondaryLabel)、var(--color-systemBlue)、var(--color-separator)。
- inline style 只用于动态数值或 Tailwind 不好表达的少量样式。
- 不要 import CSS 文件, 不要写 CSS module。

示例:
~~~tsx
export function EmptyState() {
  return (
    <div className="min-h-screen bg-[var(--color-systemBackground)] px-4 py-6 text-[var(--color-label)]">
      <div className="rounded-2xl bg-[var(--color-secondarySystemBackground)] p-4">
        <div className="text-lg font-semibold">今天</div>
        <div className="mt-1 text-sm text-[var(--color-secondaryLabel)]">还没有记录</div>
      </div>
    </div>
  );
}
~~~
`.trim();

const CAPABILITY_MULTIFILE = String.raw`
默认多文件结构:
- 非 trivial app 默认多文件, 不要把所有代码塞进 App.tsx。
- 推荐: manifest.json + App.tsx + components/* + hooks/* + constants/*。
- 有持久化: 拆 hooks/useXxx.ts 或 storage.ts。
- 有复杂 UI: 拆 components/、panels/、selectors/。
- 有选项/语言/分类: 拆 constants/*.ts。

示例结构:
~~~text
manifest.json
App.tsx
constants/categories.ts
hooks/useRecords.ts
components/AddRecord.tsx
components/RecordList.tsx
components/SummaryCard.tsx
~~~

App.tsx 只负责接线:
~~~tsx
import { useRecords } from './hooks/useRecords';
import { AddRecord } from './components/AddRecord';
import { RecordList } from './components/RecordList';

export default function App() {
  const recordsApi = useRecords();
  return (
    <main className="min-h-screen px-4 py-5">
      <AddRecord onAdd={recordsApi.addRecord} />
      <RecordList records={recordsApi.records} onDelete={recordsApi.deleteRecord} />
    </main>
  );
}
~~~
`.trim();

const CAPABILITY_SDK_STORAGE = String.raw`
用途:
@hiphone/storage 是 user app 的异步 KV 存储。用户可见数据、草稿、历史、收藏、设置都应该用它, 不要用 localStorage。
所有读取/写入 API 全部返回 Promise。user app 返回桌面会 unmount, 再打开会 remount, 所以用户可见数据必须在 mount 后 hydrate。

导出:
- get(key): Promise<unknown>
- set(key, value): Promise<void>
- remove(key): Promise<void>
- list(): Promise<string[]>
- globalGet(key): Promise<unknown>
- globalSet(key, value): Promise<void>

最小 hydrate 示例:
~~~tsx
import { useEffect, useState } from 'react';
import { get, set } from '@hiphone/storage';

interface RecordItem {
  id: string;
  title: string;
}

export function useRecords() {
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let alive = true;
    get('records').then((raw) => {
      if (!alive) return;
      if (Array.isArray(raw)) setRecords(raw as RecordItem[]);
      setHydrated(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const addRecord = (title: string) => {
    const next = [{ id: Date.now().toString(), title }, ...records];
    setRecords(next);
    void set('records', next);
  };

  return { records, hydrated, addRecord };
}
~~~

全局共享数据:
~~~tsx
import { globalGet, globalSet } from '@hiphone/storage';

async function loadTemplate() {
  const raw = await globalGet('template');
  if (typeof raw === 'string') return raw;
  await globalSet('template', '默认模板');
  return '默认模板';
}
~~~

常见错误:
- 不要 const saved = get('records'); get 返回 Promise。
- 不要在 useState 初始化函数里同步调用 get。
- 不要 JSON.parse(get(...)); 例如不要 JSON.parse(get('records'))。
- 不要在 hydrate 完成前把默认 [] 自动 set 回 storage, 会覆盖旧数据。
- storage 可直接保存数组/对象/字符串/数字, 通常不要 JSON.stringify。
- get/set/remove/list 是 per-owner; globalGet/globalSet 是 app 全局共享。
`.trim();

const CAPABILITY_SDK_AI = String.raw`
用途:
@hiphone/ai 用于 user app 调用当前全局 AI 设置。翻译、总结、分类、生成文本优先用 complete; 角色会话和记忆才用 chatWithCharacter。

导出:
- complete(messages, options?): Promise<string>
- streamComplete(messages, options?): AsyncIterable<string>
- getCharacters(): CharacterInfo[]
- extractPlainText(raw): string
- chatWithCharacter(characterId, options?): ChatSession
- AIUnavailableError / AIAbortedError / AICharacterNotFoundError

complete 示例:
~~~tsx
import { complete } from '@hiphone/ai';

export async function translateText(text: string, target = '英文') {
  return complete([
    { role: 'system', content: '你是简洁准确的翻译助手。只输出译文。' },
    { role: 'user', content: '翻译成' + target + ': ' + text },
  ], { temperature: 0.2 });
}
~~~

streamComplete 示例:
~~~tsx
import { streamComplete, AIAbortedError } from '@hiphone/ai';

async function runStream(text: string, onChunk: (chunk: string) => void, signal: AbortSignal) {
  try {
    for await (const chunk of streamComplete([
      { role: 'user', content: text },
    ], { signal })) {
      onChunk(chunk);
    }
  } catch (err) {
    if (err instanceof AIAbortedError) return;
    throw err;
  }
}
~~~

角色会话示例:
~~~tsx
import { chatWithCharacter, getCharacters, extractPlainText } from '@hiphone/ai';

async function askFirstCharacter(text: string) {
  const first = getCharacters()[0];
  if (!first) return '没有可用角色';
  const session = chatWithCharacter(first.id, { persistent: true });
  const reply = await session.send(text);
  return extractPlainText(reply.raw);
}
~~~

常见错误:
- 不要 fetch 外部 LLM API, 沙箱没有 fetch。
- 工具型 app 不要为了翻译/总结接入角色记忆, 用 complete 即可。
- 角色聊天才用 chatWithCharacter; persistent=true 会写入角色记忆。
- UI 中要处理 AI 未配置错误, 给用户可见提示。
`.trim();

const CAPABILITY_SDK_HOOKS = String.raw`
用途:
@hiphone/hooks 让 user app 感知 hiPhone 生命周期、深链参数和临时内存。普通记账/表单 app 通常不需要生命周期 hook; 需要返回前台刷新、跨 app 传参、临时未保存状态时再用。

导出:
- useOnLaunch(callback): void
- useOnResume(callback): void
- useOnBackground(callback): void
- useOnKill(callback): void
- useOpenParams(): Record<string, unknown> | null
- useAppState(): 'launching' | 'active' | 'resuming'
- useAppMemory(key, initial): [value, setValue]

生命周期示例:
~~~tsx
import { useOnLaunch, useOnResume, useOnBackground } from '@hiphone/hooks';
import { show } from '@hiphone/toast';

export function LifecycleStatus() {
  useOnLaunch(() => show('首次打开'));
  useOnResume(() => show('欢迎回来'));
  useOnBackground(() => {
    // 适合保存临时状态, 不要在这里做复杂 UI 更新。
  });
  return null;
}
~~~

深链参数示例:
~~~tsx
import { useEffect, useState } from 'react';
import { useOpenParams } from '@hiphone/hooks';

export function DetailEntry() {
  const params = useOpenParams();
  const [recordId, setRecordId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof params?.recordId === 'string') setRecordId(params.recordId);
  }, [params]);

  return <div>当前记录: {recordId ?? '未选择'}</div>;
}
~~~

临时内存示例:
~~~tsx
import { useAppMemory } from '@hiphone/hooks';

export function DraftBox() {
  const [draft, setDraft] = useAppMemory('draft', '');
  return <textarea value={draft} onChange={(e) => setDraft(e.target.value)} />;
}
~~~

常见错误:
- useAppMemory 不是长期持久化; 用户可见数据用 @hiphone/storage。
- useOpenParams 是 one-shot 深链参数, 不要当全局状态。
- useOnResume 不会在首次 mount 触发; 首次打开用 useOnLaunch。
`.trim();

const CAPABILITY_SDK_NAV = String.raw`
用途:
@hiphone/nav 用于 app 间跳转和回桌面。传参要和 @hiphone/hooks 的 useOpenParams 配套。

导出:
- open(appId, params?): void
- goHome(): void

打开目标 app 并传参示例:
~~~tsx
import { open, goHome } from '@hiphone/nav';

export function Actions({ recordId }: { recordId: string }) {
  return (
    <div className="flex gap-2">
      <button onClick={() => open('notes', { recordId })}>打开备忘</button>
      <button onClick={() => goHome()}>回到桌面</button>
    </div>
  );
}
~~~

目标 app 读取参数示例:
~~~tsx
import { useEffect, useState } from 'react';
import { useOpenParams } from '@hiphone/hooks';

export default function App() {
  const params = useOpenParams();
  const [recordId, setRecordId] = useState('');

  useEffect(() => {
    if (typeof params?.recordId === 'string') setRecordId(params.recordId);
  }, [params]);

  return <div>来自跳转的记录: {recordId || '无'}</div>;
}
~~~

常见错误:
- 不要用 window.location。
- params 必须是可克隆的普通对象。
- 目标 app 不存在时系统会 toast, 不会跳转。
`.trim();

const CAPABILITY_SDK_TOAST = String.raw`
用途:
@hiphone/toast 显示短暂顶部提示, 适合保存成功、删除完成、错误提示等轻量反馈。

导出:
- show(message): void
- warn(message): void
- error(message): void

示例:
~~~tsx
import { show, error } from '@hiphone/toast';

export function SaveButton({ canSave }: { canSave: boolean }) {
  return (
    <button
      onClick={() => {
        if (!canSave) {
          error('请先填写内容');
          return;
        }
        show('已保存');
      }}
    >
      保存
    </button>
  );
}
~~~

常见错误:
- warn/error 目前视觉上等同 show, 不要依赖它们做控制流。
- toast 文案要短, 长状态说明应放在页面里。
`.trim();

const CAPABILITY_SDK_BANNER = String.raw`
用途:
@hiphone/banner 显示 iOS 风格顶部横幅通知, 带来源 app 信息。适合提醒、后台任务完成、跨 app 通知。普通表单反馈用 toast。

导出:
- show({ title, duration?, appIcon?, appName? }): void
- dismiss(): void

示例:
~~~tsx
import { show, dismiss } from '@hiphone/banner';

export function ReminderButton() {
  return (
    <div className="flex gap-2">
      <button onClick={() => show({ title: '番茄钟结束', duration: 4000 })}>
        模拟提醒
      </button>
      <button onClick={() => dismiss()}>关闭提醒</button>
    </div>
  );
}
~~~

常见错误:
- banner 只适合一行标题, 不要塞长正文。
- 不传 appIcon/appName 时系统会用当前 user app 的图标和名称。
`.trim();

const CAPABILITY_SDK_MOTION = String.raw`
用途:
@hiphone/motion 暴露 motion/react 能力和 hiPhone 动效 token。需要动画时从这里 import, 不要 import motion/react。

导出:
- motion
- AnimatePresence
- useMotionValue / useTransform / useSpring / useAnimate / useMotionValueEvent / useScroll / useInView
- spring / duration / ease

按钮按压示例:
~~~tsx
import { motion, spring } from '@hiphone/motion';

export function PrimaryButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      transition={spring.snappy}
      onClick={onClick}
      className="rounded-full bg-[var(--color-systemBlue)] px-4 py-2 text-white"
    >
      完成
    </motion.button>
  );
}
~~~

列表入退场示例:
~~~tsx
import { AnimatePresence, motion, spring } from '@hiphone/motion';

export function Items({ items }: { items: string[] }) {
  return (
    <AnimatePresence>
      {items.map((item) => (
        <motion.div
          key={item}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={spring.smooth}
        >
          {item}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
~~~

常见错误:
- 不要 import { motion } from 'motion/react'。
- 简单 hover/颜色变化用 CSS transition 即可。
`.trim();

const CAPABILITY_SDK_PERSPECTIVE = String.raw`
用途:
@hiphone/perspective 获取当前正在查看谁的手机。适合 perspectiveAware app 根据“我/角色手机”显示不同 UI。存储默认已按 owner 隔离, 普通 per-owner 数据不需要手动拼 ownerId。

导出:
- useCurrentOwner(): { ownerId, ownerName, isViewingOther }
- getCurrentOwner(): { ownerId, ownerName, isViewingOther }

示例:
~~~tsx
import { useCurrentOwner } from '@hiphone/perspective';

export default function App() {
  const owner = useCurrentOwner();
  return (
    <main className="p-4">
      <h1 className="text-xl font-semibold">
        {owner.isViewingOther ? owner.ownerName + '的清单' : '我的清单'}
      </h1>
    </main>
  );
}
~~~

事件处理里取快照:
~~~tsx
import { getCurrentOwner } from '@hiphone/perspective';

function makeOwnerLabel() {
  const owner = getCurrentOwner();
  return owner.isViewingOther ? owner.ownerName : '我';
}
~~~

常见错误:
- 不要自己读取宿主 store。
- manifest.perspectiveAware 为 true 时才应该特别设计多主人体验。
`.trim();

const CAPABILITY_SDK_SERVICES = String.raw`
用途:
@hiphone/services 用于 app 间能力调用。一个 app 注册服务, 另一个 app invoke。普通组件通信、父子状态传递不要用 services。

导出:
- registerService({ name, execute }): void
- invoke(targetAppId, serviceName, params?): Promise<unknown>
- list(targetAppId): Promise<string[]>

注册服务示例:
~~~ts
import { registerService } from '@hiphone/services';

registerService({
  name: 'summary',
  execute: async () => {
    return { count: 3, label: '今日 3 项' };
  },
});
~~~

调用服务示例:
~~~tsx
import { useState } from 'react';
import { invoke } from '@hiphone/services';

export function SummaryButton() {
  const [text, setText] = useState('');
  return (
    <button
      onClick={async () => {
        const result = await invoke('todo-app', 'summary');
        if (result && typeof result === 'object' && 'label' in result) {
          setText(String((result as { label: unknown }).label));
        }
      }}
    >
      {text || '读取摘要'}
    </button>
  );
}
~~~

常见错误:
- 服务返回值应是可克隆的普通数据。
- 不要用 services 替代 storage。
- 不知道目标 app 是否有服务时, 先 await list(targetAppId)。
`.trim();

const CAPABILITY_SDK_UI = String.raw`
用途:
@hiphone/ui 暴露少量系统 UI 组件。当前主要是 NavBar。多数业务 UI 自己用 React + Tailwind 实现。

导出:
- NavBar

示例:
~~~tsx
import { NavBar } from '@hiphone/ui';

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-systemBackground)]">
      <NavBar title="记账" />
      <main className="px-4 py-3">内容</main>
    </div>
  );
}
~~~

常见错误:
- 不要 import @/system。
- 不要假设 @hiphone/ui 暴露 List、Sheet、Button 等组件; 没文档就自己实现。
`.trim();

const CAPABILITY_SDK_REACT = String.raw`
用途:
user app 可以 import React 和 lucide-react。图标优先用 lucide-react, 不要手写复杂 SVG。不要 import 任意其他 npm 包。

示例:
~~~tsx
import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export function TodoInput({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  const canAdd = useMemo(() => text.trim().length > 0, [text]);

  return (
    <div className="flex items-center gap-2">
      <input value={text} onChange={(e) => setText(e.target.value)} />
      <button disabled={!canAdd} onClick={() => onAdd(text.trim())}>
        <Plus size={18} />
      </button>
      <Trash2 size={18} />
    </div>
  );
}
~~~

常见错误:
- 不要 import lodash/dayjs/zod/axios。
- 不要手写复杂 SVG 图标, lucide-react 优先。
`.trim();

const CAPABILITY_TRANSLATE_BLUEPRINT =
  '完整翻译 demo 的结构: TranslateApp.tsx 负责整体状态和接线; constants/languages.ts 存语种; hooks/useTranslate.ts 调 @hiphone/ai.complete 并用 tokenRef 丢弃过期请求; hooks/useHistory.ts 用 @hiphone/storage 做 history/favorites; panels/* 负责输入和输出; selectors/* 负责语种 sheet; recents/* 负责历史收藏列表。它是多文件 + Tailwind + SDK 的推荐样本。需要完整代码时 read_fixture({name:"ai-translator-app"})。';

const CAPABILITY_TOPICS: Record<string, string> = {
  sdk: CAPABILITY_SDK_INDEX,
  sandbox: CAPABILITY_SANDBOX,
  styling: CAPABILITY_STYLING,
  multifile: CAPABILITY_MULTIFILE,
  'sdk.storage': CAPABILITY_SDK_STORAGE,
  'sdk.ai': CAPABILITY_SDK_AI,
  'sdk.hooks': CAPABILITY_SDK_HOOKS,
  'sdk.nav': CAPABILITY_SDK_NAV,
  'sdk.toast': CAPABILITY_SDK_TOAST,
  'sdk.banner': CAPABILITY_SDK_BANNER,
  'sdk.motion': CAPABILITY_SDK_MOTION,
  'sdk.perspective': CAPABILITY_SDK_PERSPECTIVE,
  'sdk.services': CAPABILITY_SDK_SERVICES,
  'sdk.ui': CAPABILITY_SDK_UI,
  'sdk.react': CAPABILITY_SDK_REACT,
  storage: CAPABILITY_SDK_STORAGE,
  ai: CAPABILITY_SDK_AI,
  motion: CAPABILITY_SDK_MOTION,
  'translate-blueprint': CAPABILITY_TRANSLATE_BLUEPRINT,
};

export function getCapabilityTopicNames(): string[] {
  return Object.keys(CAPABILITY_TOPICS).sort();
}

export function getCapabilityTopicContent(topic: string): string | null {
  return CAPABILITY_TOPICS[topic] ?? null;
}

export function getCapabilityTopics(): Record<string, string> {
  return { ...CAPABILITY_TOPICS };
}

function tool_read_capability(args: unknown): ToolResult {
  const topic = isObj(args) && typeof args.topic === 'string' ? args.topic : '';
  if (!topic) {
    return { ok: true, data: { topics: getCapabilityTopicNames() } };
  }
  const content = getCapabilityTopicContent(topic);
  if (!content) {
    return {
      ok: false,
      error: `unknown capability topic: ${topic}. Available: ${getCapabilityTopicNames().join(', ')}`,
    };
  }
  return { ok: true, data: { topic, content } };
}

function tool_update_plan(args: unknown): ToolResult {
  if (!isObj(args) || !Array.isArray(args.steps)) {
    return { ok: false, error: 'update_plan: steps must be an array' };
  }
  const steps: { id: string; title: string }[] = [];
  for (const step of args.steps) {
    if (
      !isObj(step) ||
      typeof step.id !== 'string' ||
      typeof step.title !== 'string'
    ) {
      return {
        ok: false,
        error: 'update_plan: each step must be {id: string, title: string}',
      };
    }
    steps.push({ id: step.id, title: step.title });
  }
  useBuilderPlanStore.getState().setSteps(steps);
  return { ok: true };
}

function tool_mark_step(args: unknown): ToolResult {
  if (!isObj(args) || typeof args.id !== 'string' || args.id.length === 0) {
    return { ok: false, error: 'mark_step: id must be a non-empty string' };
  }
  const status = args.status;
  if (status !== 'pending' && status !== 'done' && status !== 'skipped') {
    return {
      ok: false,
      error: "mark_step: status must be 'pending' | 'done' | 'skipped'",
    };
  }
  useBuilderPlanStore.getState().markStep(args.id, status);
  return { ok: true };
}

function tool_finish(args: unknown): ToolResult {
  const summary =
    isObj(args) && typeof args.summary === 'string' ? args.summary : '';
  return { ok: true, data: { finished: true, summary } };
}

// ───────── public surface ─────────

export const TOOLS: Record<string, ToolHandler> = {
  read_file: tool_read_file,
  write_file: tool_write_file,
  delete_file: tool_delete_file,
  list_files: tool_list_files,
  compile_check: tool_compile_check,
  replace_text: tool_replace_text,
  replace_range: tool_replace_range,
  append_to_file: tool_append_to_file,
  read_capability: tool_read_capability,
  read_fixture: tool_read_fixture,
  update_plan: tool_update_plan,
  mark_step: tool_mark_step,
  finish: tool_finish,
};

export async function executeTool(
  name: string,
  args: unknown,
  ctx: ToolContext,
): Promise<ToolResult> {
  const handler = TOOLS[name];
  if (!handler) {
    return { ok: false, error: `unknown tool: ${name}` };
  }
  return await handler(args, ctx);
}
