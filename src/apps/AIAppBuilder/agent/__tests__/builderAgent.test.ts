import { describe, it, expect, beforeEach, vi } from 'vitest';
import { runBuilderAgent } from '../builderAgent';
import { useAIAppBuilderStore } from '../../aiAppBuilderStore';
import { useBuilderPlanStore } from '../builderPlanStore';
import * as chatCompleteMod from '@/platform/ai/chatComplete';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

const VALID_MANIFEST = JSON.stringify({
  id: 'placeholder',
  name: '番茄钟',
  version: '1.0.0',
  entry: 'App.tsx',
});

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
  useAIConfigStore.setState({
    provider: 'openrouter',
    apiKey: 'test',
    model: 'gpt-4',
    apiEndpoint: 'https://example.test',
    maxTokens: 4000,
  });
  vi.restoreAllMocks();
});

describe('runBuilderAgent', () => {
  it('completes a 5-step generation flow end-to-end', async () => {
    const events: unknown[] = [];

    const replies = [
      JSON.stringify({
        tool: 'update_plan',
        args: {
          steps: [
            { id: 's1', title: '写 manifest' },
            { id: 's2', title: '写 App.tsx' },
            { id: 's3', title: '编译检查' },
            { id: 's4', title: '完成' },
          ],
        },
      }),
      JSON.stringify({
        tool: 'write_file',
        args: { path: 'manifest.json', content: VALID_MANIFEST },
      }),
      JSON.stringify({
        tool: 'write_file',
        args: { path: 'App.tsx', content: 'export default function App() { return null; }' },
      }),
      JSON.stringify({ tool: 'compile_check', args: {} }),
      JSON.stringify({ tool: 'finish', args: { summary: '已生成番茄钟' } }),
    ];

    const spy = vi.spyOn(chatCompleteMod, 'chatComplete');
    for (const r of replies) spy.mockResolvedValueOnce(r);

    await runBuilderAgent({
      draftId: 'ai-app-tomato-1234',
      userMessage: '帮我做一个番茄钟',
      onTurn: (e) => events.push(e),
    });

    expect((events[0] as any).kind).toBe('plan-update');
    expect((events[0] as any).steps.map((s: any) => s.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect((events[1] as any).kind).toBe('tool-call');
    expect((events[1] as any).tool).toBe('write_file');
    expect((events[2] as any).kind).toBe('tool-call');
    expect((events[3] as any).kind).toBe('tool-call');
    expect((events[3] as any).tool).toBe('compile_check');
    expect((events[4] as any).kind).toBe('finish');
    expect((events[4] as any).summary).toBe('已生成番茄钟');

    const draftFiles = useAIAppBuilderStore.getState().draftFiles;
    expect(Object.keys(draftFiles).sort()).toEqual(['App.tsx', 'manifest.json']);
    expect(JSON.parse(draftFiles['manifest.json']!).id).toBe('ai-app-tomato-1234');

    expect(useBuilderPlanStore.getState().steps.map((s) => s.id)).toEqual([
      's1',
      's2',
      's3',
      's4',
    ]);

    expect(spy).toHaveBeenCalledTimes(5);
  });

  it('emits a thought as agent-text before the tool-call event', async () => {
    const events: unknown[] = [];
    useAIAppBuilderStore.setState({
      draftFiles: {
        'manifest.json': JSON.stringify({
          id: 'ai-app-x-9999',
          name: '示例',
          version: '1.0.0',
          entry: 'App.tsx',
        }),
        'App.tsx': 'export default function App() { return null; }',
      },
    });

    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce(JSON.stringify({ thought: '先列文件', tool: 'list_files', args: {} }))
      .mockResolvedValueOnce(JSON.stringify({ tool: 'finish', args: { summary: '完成' } }));

    await runBuilderAgent({
      draftId: 'ai-app-x-9999',
      userMessage: '看一下',
      onTurn: (e) => events.push(e),
    });

    expect((events[0] as any).kind).toBe('agent-text');
    expect((events[0] as any).text).toBe('先列文件');
    expect((events[1] as any).kind).toBe('tool-call');
    expect((events[1] as any).tool).toBe('list_files');
    expect((events[2] as any).kind).toBe('finish');
  });

  it('rejects finish until the final compile_check gate passes', async () => {
    const events: unknown[] = [];

    vi.spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce(JSON.stringify({
        tool: 'write_file',
        args: { path: 'manifest.json', content: VALID_MANIFEST },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tool: 'finish',
        args: { summary: '先结束' },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tool: 'write_file',
        args: { path: 'App.tsx', content: 'export default function App() { return null; }' },
      }))
      .mockResolvedValueOnce(JSON.stringify({
        tool: 'finish',
        args: { summary: '已完成' },
      }));

    await runBuilderAgent({
      draftId: 'ai-app-tomato-1234',
      userMessage: '帮我做一个番茄钟',
      onTurn: (e) => events.push(e),
    });

    const gateFailure = events.find(
      (e: any) => e.kind === 'tool-call' && e.tool === 'compile_check' && e.ok === false,
    ) as any;
    expect(gateFailure).toBeDefined();
    expect(JSON.stringify(gateFailure.result)).toMatch(/entry.*not found/);

    const last = events[events.length - 1] as any;
    expect(last.kind).toBe('finish');
    expect(last.summary).toBe('已完成');
  });

  it('retries once on parse failure with a stricter reminder, then exits with agent-text on second failure', async () => {
    const events: unknown[] = [];

    const spy = vi
      .spyOn(chatCompleteMod, 'chatComplete')
      .mockResolvedValueOnce('this is not json')
      .mockResolvedValueOnce('still not json');

    await runBuilderAgent({
      draftId: 'ai-app-x-9999',
      userMessage: '随便来点',
      onTurn: (e) => events.push(e),
    });

    expect(spy).toHaveBeenCalledTimes(2);
    const secondCallMessages = spy.mock.calls[1]![1];
    const lastMsg = secondCallMessages[secondCallMessages.length - 1]!;
    expect(lastMsg.role).toBe('user');
    expect(lastMsg.content).toMatch(/格式不对|JSON/);

    expect(events.length).toBe(1);
    expect((events[0] as any).kind).toBe('agent-text');
    expect((events[0] as any).text).toMatch(/解析失败/);
  });

  it('aborts cleanly when signal is fired before the next iteration', async () => {
    const ac = new AbortController();
    ac.abort();

    const spy = vi.spyOn(chatCompleteMod, 'chatComplete');

    await runBuilderAgent({
      draftId: 'ai-app-x-9999',
      userMessage: '...',
      signal: ac.signal,
      onTurn: () => {},
    });

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not execute a stale tool if the signal is aborted while chatComplete is in flight', async () => {
    const ac = new AbortController();
    const events: unknown[] = [];

    const spy = vi.spyOn(chatCompleteMod, 'chatComplete').mockImplementationOnce(async () => {
      ac.abort();
      return JSON.stringify({
        tool: 'write_file',
        args: { path: 'App.tsx', content: 'export default function App() { return null; }' },
      });
    });

    await runBuilderAgent({
      draftId: 'ai-app-x-9999',
      userMessage: '...',
      signal: ac.signal,
      onTurn: (e) => events.push(e),
    });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
    expect(useAIAppBuilderStore.getState().draftFiles).toEqual({});
  });

  it('continues past the former 25-iteration limit until finish fires', async () => {
    const events: unknown[] = [];
    useAIAppBuilderStore.setState({
      draftFiles: {
        'manifest.json': JSON.stringify({
          id: 'ai-app-x-9999',
          name: '示例',
          version: '1.0.0',
          entry: 'App.tsx',
        }),
        'App.tsx': 'export default function App() { return null; }',
      },
    });

    const spy = vi.spyOn(chatCompleteMod, 'chatComplete');
    for (let i = 0; i < 26; i++) {
      spy.mockResolvedValueOnce(JSON.stringify({ tool: 'list_files', args: {} }));
    }
    spy.mockResolvedValueOnce(JSON.stringify({ tool: 'finish', args: { summary: '完成' } }));

    await runBuilderAgent({
      draftId: 'ai-app-x-9999',
      userMessage: '...',
      onTurn: (e) => events.push(e),
    });

    expect(spy).toHaveBeenCalledTimes(27);
    const last = events[events.length - 1] as any;
    expect(last.kind).toBe('finish');
    expect(last.summary).toBe('完成');
  });
});
