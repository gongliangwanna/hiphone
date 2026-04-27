/**
 * AI 工坊 agent — 9 tool executors invoked one-per-turn by the agent loop.
 *
 * Tool catalog:
 *   - read_file({path})              → {content}
 *   - write_file({path, content})    → ok; manifest.json's id is locked to ctx.draftId
 *   - delete_file({path})            → ok (idempotent)
 *   - list_files({})                 → {paths[]} alphabetically sorted
 *   - compile_check({path?})         → {errors[]}; tsx/ts via Sucrase, manifest.json via validateManifest
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

import { useAIAppBuilderStore } from '../aiAppBuilderStore';
import { useBuilderPlanStore } from './builderPlanStore';
import { compileTsx } from '@/platform/userApp/compiler';
import { validateManifest } from '@/platform/userApp/manifest';
import { moduleMap } from '@/platform/userApp/sdk';
import { resolveRelativePath } from '@/platform/userApp/moduleResolver';

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
  | { ok: false; error: string };

export type ToolHandler = (
  args: unknown,
  ctx: ToolContext,
) => Promise<ToolResult> | ToolResult;

// ───────── helpers ─────────

function isObj(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

function setDraftFile(path: string, content: string): void {
  useAIAppBuilderStore.setState((s) => ({
    draftFiles: { ...s.draftFiles, [path]: content },
  }));
}

function deleteDraftFile(path: string): void {
  useAIAppBuilderStore.setState((s) => {
    if (!(path in s.draftFiles)) return {};
    const next = { ...s.draftFiles };
    delete next[path];
    return { draftFiles: next };
  });
}

// ───────── tool implementations ─────────

function tool_read_file(args: unknown): ToolResult {
  if (!isObj(args) || typeof args.path !== 'string' || args.path.length === 0) {
    return { ok: false, error: 'read_file: path must be a non-empty string' };
  }
  const files = useAIAppBuilderStore.getState().draftFiles;
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
    setDraftFile(path, JSON.stringify(parsed, null, 2));
    return { ok: true };
  }

  setDraftFile(path, content);
  return { ok: true };
}

function tool_delete_file(args: unknown): ToolResult {
  if (!isObj(args) || typeof args.path !== 'string' || args.path.length === 0) {
    return { ok: false, error: 'delete_file: path must be a non-empty string' };
  }
  deleteDraftFile(args.path);
  return { ok: true };
}

function tool_list_files(): ToolResult {
  const files = useAIAppBuilderStore.getState().draftFiles;
  const paths = Object.keys(files).sort();
  return { ok: true, data: { paths } };
}

async function tool_compile_check(args: unknown): Promise<ToolResult> {
  const files = useAIAppBuilderStore.getState().draftFiles;
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
        for (const specifier of extractRequires(compiled)) {
          const importErr = checkImportResolves(specifier, path, files);
          if (importErr) errors.push({ path, message: importErr });
        }
      }
    } else if (path === 'manifest.json') {
      try {
        const parsed = JSON.parse(content);
        validateManifest(parsed);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ path: 'manifest.json', message: msg });
      }
    }
    // other files (assets, etc.) skipped silently
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
