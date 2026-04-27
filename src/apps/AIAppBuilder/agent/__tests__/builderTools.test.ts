import { describe, it, expect, beforeEach } from 'vitest';
import { executeTool, TOOLS } from '../builderTools';
import { useAIAppBuilderStore } from '../../aiAppBuilderStore';
import { useBuilderPlanStore } from '../builderPlanStore';

const ctx = { draftId: 'ai-app-test-1234' };

beforeEach(() => {
  useAIAppBuilderStore.setState({ draftFiles: {} });
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
    expect(r.ok).toBe(true);
    if (r.ok) {
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
    expect(r.ok).toBe(true);
    if (r.ok) {
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
    expect(r.ok).toBe(true);
    if (r.ok) {
      const data = r.data as { errors: { path: string; message: string }[] };
      expect(data.errors.length).toBeGreaterThan(0);
      expect(data.errors[0]!.message).toMatch(/lodash/);
      expect(data.errors[0]!.message).toMatch(/SDK whitelist/);
    }
  });

  it('compile_check: accepts a valid relative import that resolves to a sibling file', async () => {
    useAIAppBuilderStore.setState({
      draftFiles: {
        'App.tsx':
          'import { greet } from "./utils";\nexport default function App() { return greet() ? null : null; }',
        'utils.ts': 'export function greet() { return "hi"; }',
      },
    });
    const r = await executeTool('compile_check', {}, ctx);
    expect(r).toEqual({ ok: true, data: { errors: [] } });
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

  it('TOOLS: registers all 9 expected tools', () => {
    expect(Object.keys(TOOLS).sort()).toEqual([
      'compile_check',
      'delete_file',
      'finish',
      'list_files',
      'mark_step',
      'read_file',
      'read_fixture',
      'update_plan',
      'write_file',
    ]);
  });
});
