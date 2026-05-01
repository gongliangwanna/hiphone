import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool, TOOLS } from '../builderTools';
import { useAIAppBuilderStore } from '../../aiAppBuilderStore';
import { useBuilderPlanStore } from '../builderPlanStore';

const ctx = { draftId: 'ai-app-test-1234' };

beforeEach(() => {
  useAIAppBuilderStore.setState({
    drafts: {},
    activeDraftId: null,
    draftId: null,
    draftFiles: {},
    chatHistory: [],
    status: 'idle',
    lastError: null,
  });
  useBuilderPlanStore.getState().clear();
});

describe('builderTools', () => {
  it('read_file: returns content when path exists', async () => {
    useAIAppBuilderStore.setState({ draftFiles: { 'App.tsx': 'export default () => null' } });
    const r = await executeTool('read_file', { path: 'App.tsx' }, ctx);
    expect(r).toEqual({ ok: true, data: { content: 'export default () => null' } });
  });

  it('read_file: returns not-found error when path missing', async () => {
    const r = await executeTool('read_file', { path: 'missing.tsx' }, ctx);
    expect(r).toEqual({ ok: false, error: 'not found' });
  });

  it('write_file: stores content verbatim for non-manifest paths', async () => {
    const r = await executeTool('write_file', { path: 'App.tsx', content: 'X' }, ctx);
    expect(r).toEqual({ ok: true });
    expect(useAIAppBuilderStore.getState().draftFiles['App.tsx']).toBe('X');
  });

  it('write_file: persists to the active draft so later chat turns do not wipe files', async () => {
    const draftId = useAIAppBuilderStore.getState().createDraft('复现文件丢失');
    const activeCtx = { draftId };

    const write = await executeTool(
      'write_file',
      { path: 'App.tsx', content: 'export default function App() { return null; }' },
      activeCtx,
    );
    expect(write).toEqual({ ok: true });

    useAIAppBuilderStore
      .getState()
      .appendToolCall('write_file', { path: 'App.tsx' }, write, true);

    const list = await executeTool('list_files', {}, activeCtx);
    expect(list).toEqual({ ok: true, data: { paths: ['App.tsx'] } });

    const state = useAIAppBuilderStore.getState();
    expect(state.draftFiles['App.tsx']).toContain('export default');
    expect(state.drafts[draftId]!.files['App.tsx']).toContain('export default');
  });

  it('write_file: locks manifest.id to ctx.draftId, ignoring whatever the LLM wrote', async () => {
    const userManifest = JSON.stringify({
      id: 'wrong-id',
      name: '番茄',
      version: '1.0.0',
      entry: 'App.tsx',
    });
    const r = await executeTool('write_file', { path: 'manifest.json', content: userManifest }, ctx);
    expect(r).toEqual({ ok: true });
    const stored = useAIAppBuilderStore.getState().draftFiles['manifest.json']!;
    const parsed = JSON.parse(stored);
    expect(parsed.id).toBe('ai-app-test-1234');
    expect(parsed.name).toBe('番茄');
  });

  it('write_file: returns error when manifest.json content is invalid JSON', async () => {
    const r = await executeTool('write_file', { path: 'manifest.json', content: 'not json' }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/manifest\.json/);
  });

  it('delete_file: idempotent — succeeds even if path was never written', async () => {
    const r = await executeTool('delete_file', { path: 'never-existed.tsx' }, ctx);
    expect(r).toEqual({ ok: true });
  });

  it('list_files: returns paths sorted alphabetically', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: { 'utils.ts': '', 'App.tsx': '', 'manifest.json': '' },
    });
    const r = await executeTool('list_files', {}, ctx);
    expect(r).toEqual({ ok: true, data: { paths: ['App.tsx', 'manifest.json', 'utils.ts'] } });
  });

  it('compile_check: returns empty errors array for a valid TSX file', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: { 'App.tsx': 'export default function App() { return null; }' },
    });
    const r = await executeTool('compile_check', { path: 'App.tsx' }, ctx);
    expect(r).toEqual({ ok: true, data: { errors: [] } });
  });

  it('compile_check: surfaces a compile error from broken TSX', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: { 'App.tsx': 'export default function App() { return <broken><<<; }' },
    });
    const r = await executeTool('compile_check', { path: 'App.tsx' }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const data = r.data as { errors: { path: string; message: string }[] };
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.errors[0]!.path).toBe('App.tsx');
    }
  });

  it('compile_check: rejects an unresolvable relative import (e.g. ./App.css)', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: {
        'App.tsx':
          'import "./App.css";\nexport default function App() { return null; }',
      },
    });
    const r = await executeTool('compile_check', { path: 'App.tsx' }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const data = r.data as { errors: { path: string; message: string }[] };
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.errors[0]!.path).toBe('App.tsx');
      expect(data.errors[0]!.message).toMatch(/cannot resolve.*App\.css/);
    }
  });

  it('compile_check: rejects a bare specifier outside the SDK whitelist', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: {
        'App.tsx':
          'import _ from "lodash";\nexport default function App() { return _ ? null : null; }',
      },
    });
    const r = await executeTool('compile_check', { path: 'App.tsx' }, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const data = r.data as { errors: { path: string; message: string }[] };
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.errors[0]!.message).toMatch(/lodash/);
      expect(data.errors[0]!.message).toMatch(/SDK whitelist/);
    }
  });

  it('compile_check (full tree): catches an unbound name (e.g. useCallback used without import) via dry-render', async () => {
    const manifest = JSON.stringify({
      id: 'placeholder',
      name: '游戏',
      version: '1.0.0',
      entry: 'App.tsx',
    });
    useAIAppBuilderStore.setState({
      draftFiles: {
        'manifest.json': manifest,
        // useCallback referenced but never imported. Sucrase compiles fine,
        // but the first render throws ReferenceError.
        'App.tsx':
          'import React from "react";\n' +
          'export default function Game() {\n' +
          '  const onTap = useCallback(() => {}, []);\n' +
          '  return React.createElement("div", { onClick: onTap }, "hi");\n' +
          '}\n',
      },
    });
    const r = await executeTool('compile_check', {}, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const data = r.data as { errors: { path: string; message: string }[] };
      expect(data.errors.length).toBeGreaterThan(0);
      const err = data.errors[0]!;
      expect(err.path).toBe('App.tsx');
      expect(err.message).toMatch(/runtime render failed/);
      expect(err.message).toMatch(/useCallback/);
    }
  });

  it('compile_check (full tree): passes dry-render for a well-formed component', async () => {
    const manifest = JSON.stringify({
      id: 'placeholder',
      name: '示例',
      version: '1.0.0',
      entry: 'App.tsx',
    });
    useAIAppBuilderStore.setState({
      draftFiles: {
        'manifest.json': manifest,
        'App.tsx':
          'import React, { useState } from "react";\n' +
          'export default function App() {\n' +
          '  const [n] = useState(0);\n' +
          '  return React.createElement("div", null, String(n));\n' +
          '}\n',
      },
    });
    const r = await executeTool('compile_check', {}, ctx);
    expect(r).toEqual({ ok: true, data: { errors: [] } });
  });

  it('compile_check (full tree): rejects a missing manifest entry file', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: {
        'manifest.json': JSON.stringify({
          id: 'ai-app-test-1234',
          name: 'Missing',
          version: '1.0.0',
          entry: 'Missing.tsx',
        }),
      },
    });
    const r = await executeTool('compile_check', {}, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const data = r.data as { errors: { path: string; message: string }[] };
      expect(data.errors[0]!.path).toBe('manifest.json');
      expect(data.errors[0]!.message).toMatch(/entry.*not found/);
    }
  });

  it('compile_check: accepts a valid relative import that resolves to a sibling file', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: {
        'manifest.json': JSON.stringify({
          id: 'ai-app-test-1234',
          name: '示例',
          version: '1.0.0',
          entry: 'App.tsx',
        }),
        'App.tsx':
          'import { greet } from "./utils";\nexport default function App() { return greet() ? null : null; }',
        'utils.ts': 'export function greet() { return "hi"; }',
      },
    });
    const r = await executeTool('compile_check', {}, ctx);
    expect(r).toEqual({ ok: true, data: { errors: [] } });
  });

  it('replace_text: replaces exactly one matching snippet', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: { 'App.tsx': 'export default function App() { return <button>Red</button>; }' },
    });
    const r = await executeTool(
      'replace_text',
      { path: 'App.tsx', oldText: 'Red', newText: 'Blue' },
      ctx,
    );
    expect(r).toEqual({ ok: true });
    expect(useAIAppBuilderStore.getState().draftFiles['App.tsx']).toContain('Blue');
  });

  it('replace_text: rejects ambiguous snippets', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: { 'App.tsx': 'const x = "same"; const y = "same";' },
    });
    const r = await executeTool(
      'replace_text',
      { path: 'App.tsx', oldText: 'same', newText: 'new' },
      ctx,
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/matched 2 times/);
  });

  it('replace_range: replaces a 1-based inclusive line range', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: { 'App.tsx': 'line1\nline2\nline3' },
    });
    const r = await executeTool(
      'replace_range',
      { path: 'App.tsx', startLine: 2, endLine: 2, content: 'new2' },
      ctx,
    );
    expect(r).toEqual({ ok: true });
    expect(useAIAppBuilderStore.getState().draftFiles['App.tsx']).toBe('line1\nnew2\nline3');
  });

  it('append_to_file: appends exact content to an existing file', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: { 'utils.ts': 'export const a = 1;' },
    });
    const r = await executeTool(
      'append_to_file',
      { path: 'utils.ts', content: '\nexport const b = 2;' },
      ctx,
    );
    expect(r).toEqual({ ok: true });
    expect(useAIAppBuilderStore.getState().draftFiles['utils.ts']).toContain('b = 2');
  });

  it('read_capability: returns topic list and selected topic content', async () => {
    const topics = await executeTool('read_capability', {}, ctx);
    expect(topics.ok).toBe(true);
    if (topics.ok) {
      const topicList = (topics.data as { topics: string[] }).topics;
      expect(topicList).toContain('sdk');
      expect(topicList).toContain('styling');
      expect(topicList).toContain('sdk.storage');
      expect(topicList).toContain('sdk.ai');
      expect(topicList).toContain('sdk.hooks');
      expect(topicList).toContain('sdk.nav');
    }

    const styling = await executeTool('read_capability', { topic: 'styling' }, ctx);
    expect(styling.ok).toBe(true);
    if (styling.ok) {
      expect((styling.data as { content: string }).content).toContain('Tailwind');
    }
  });

  it('read_capability(storage): documents async hydrate and overwrite pitfalls', async () => {
    const storage = await executeTool('read_capability', { topic: 'sdk.storage' }, ctx);
    expect(storage.ok).toBe(true);
    if (storage.ok) {
      const content = (storage.data as { content: string }).content;
      expect(content).toContain('全部返回 Promise');
      expect(content).toContain('await');
      expect(content).toContain('返回桌面');
      expect(content).toContain('unmount');
      expect(content).toContain('不要在 useState 初始化函数里同步调用 get');
      expect(content).toContain('不要 JSON.parse(get(...))');
      expect(content).toContain('hydrate 完成前');
      expect(content).toContain('覆盖旧数据');
      expect(content).toContain('~~~tsx');
      expect(content).toContain("import { get, set } from '@hiphone/storage'");
    }
  });

  it('read_capability: every SDK topic includes a concrete usage example', async () => {
    const sdkTopics = [
      'sdk.storage',
      'sdk.ai',
      'sdk.hooks',
      'sdk.nav',
      'sdk.toast',
      'sdk.banner',
      'sdk.motion',
      'sdk.perspective',
      'sdk.services',
      'sdk.ui',
      'sdk.react',
    ];

    for (const topic of sdkTopics) {
      const result = await executeTool('read_capability', { topic }, ctx);
      expect(result.ok).toBe(true);
      if (result.ok) {
        const content = (result.data as { content: string }).content;
        expect(content).toContain('示例');
        expect(content).toContain('~~~');
      }
    }
  });

  it('read_fixture: returns the todo-app file map', async () => {
    const r = await executeTool('read_fixture', { name: 'todo-app' }, ctx);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const data = r.data as { files: Record<string, string> };
      expect(Object.keys(data.files).sort()).toEqual([
        'App.tsx',
        'components/TodoItem.tsx',
        'manifest.json',
        'utils.ts',
      ]);
      expect(data.files['App.tsx']).toContain('useAppMemory');
    }
  });

  it('update_plan + mark_step: writes through to builderPlanStore', async () => {
    const u = await executeTool(
      'update_plan',
      { steps: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }] },
      ctx,
    );
    expect(u).toEqual({ ok: true });
    expect(useBuilderPlanStore.getState().steps).toEqual([
      { id: 'a', title: 'A', status: 'pending' },
      { id: 'b', title: 'B', status: 'pending' },
    ]);
    const m = await executeTool('mark_step', { id: 'a', status: 'done' }, ctx);
    expect(m).toEqual({ ok: true });
    expect(useBuilderPlanStore.getState().steps[0]!.status).toBe('done');
  });

  it('finish: returns finished:true marker for the agent loop', async () => {
    const r = await executeTool('finish', { summary: '已生成' }, ctx);
    expect(r).toEqual({ ok: true, data: { finished: true, summary: '已生成' } });
  });

  it('executeTool: returns error for unknown tool name', async () => {
    const r = await executeTool('does_not_exist', {}, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('does_not_exist');
  });

  it('TOOLS: registers all expected tools', () => {
    expect(Object.keys(TOOLS).sort()).toEqual([
      'append_to_file',
      'compile_check',
      'delete_file',
      'finish',
      'list_files',
      'mark_step',
      'read_capability',
      'read_file',
      'read_fixture',
      'replace_range',
      'replace_text',
      'update_plan',
      'write_file',
    ]);
  });
});
