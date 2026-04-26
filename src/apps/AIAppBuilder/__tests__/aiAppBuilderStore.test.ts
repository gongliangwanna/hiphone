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
