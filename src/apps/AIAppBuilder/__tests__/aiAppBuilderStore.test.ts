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
        kind: 'user',
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
    it('appends a user-kind chat turn', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendUserMessage('加个暂停');
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({ kind: 'user', text: '加个暂停' });
    });

    it('throws if no active draft', () => {
      const s = useAIAppBuilderStore.getState();
      expect(() => s.appendUserMessage('hi')).toThrow();
    });
  });

  describe('appendAgentMessage', () => {
    it('appends an agent-text turn', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendAgentMessage('hi');
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({ kind: 'agent-text', text: 'hi' });
    });

    it('does NOT touch draftFiles', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendAgentMessage('已生成');
      expect(useAIAppBuilderStore.getState().draftFiles).toEqual({});
    });
  });

  describe('setDraftFiles', () => {
    it('replaces draftFiles wholesale', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.setDraftFiles({
        'manifest.json': '{}',
        'App.tsx': 'old',
        'utils.ts': 'old utils',
      });
      s.setDraftFiles({
        'manifest.json': '{}',
        'App.tsx': 'new',
      });
      expect(Object.keys(useAIAppBuilderStore.getState().draftFiles).sort()).toEqual([
        'App.tsx',
        'manifest.json',
      ]);
    });
  });

  describe('appendToolCall / appendPlanUpdate / appendFinish', () => {
    it('appendToolCall pushes a tool-call turn', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendToolCall('write_file', { path: 'a.ts' }, { ok: true }, true);
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history[1]).toMatchObject({
        kind: 'tool-call',
        tool: 'write_file',
        args: { path: 'a.ts' },
        result: { ok: true },
        ok: true,
      });
    });

    it('appendPlanUpdate pushes a plan-update turn', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendPlanUpdate([{ id: 's1', title: '写manifest', status: 'pending' }]);
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history[1]).toMatchObject({
        kind: 'plan-update',
        steps: [{ id: 's1', title: '写manifest', status: 'pending' }],
      });
    });

    it('appendFinish pushes a finish turn', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      s.appendFinish('已生成');
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history[1]).toMatchObject({ kind: 'finish', summary: '已生成' });
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
