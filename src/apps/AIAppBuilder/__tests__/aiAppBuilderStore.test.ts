import { describe, it, expect, beforeEach, vi } from 'vitest';
import { normalizeHydratedDrafts, useAIAppBuilderStore, type Draft } from '../aiAppBuilderStore';

describe('aiAppBuilderStore', () => {
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
  });

  describe('createDraft', () => {
    it('generates a draftId from the user prompt and seeds chat with the user turn', () => {
      const s = useAIAppBuilderStore.getState();
      const id = s.createDraft('我想要一个番茄钟');
      const state = useAIAppBuilderStore.getState();
      expect(id).toMatch(/^ai-app-/);
      expect(state.draftId).toBe(id);
      expect(state.activeDraftId).toBe(id);
      expect(state.draftFiles).toEqual({});
      expect(state.chatHistory).toHaveLength(1);
      expect(state.chatHistory[0]!).toMatchObject({
        kind: 'user',
        text: '我想要一个番茄钟',
      });
      expect(state.drafts[id]).toBeDefined();
    });

    it('two consecutive new drafts produce different ids and BOTH are kept', () => {
      const s = useAIAppBuilderStore.getState();
      const id1 = s.createDraft('番茄钟');
      const id2 = s.createDraft('记账');
      const state = useAIAppBuilderStore.getState();
      expect(id1).not.toBe(id2);
      expect(state.activeDraftId).toBe(id2);
      // Critical: V1.1 requirement — old draft must NOT be wiped.
      expect(state.drafts[id1]).toBeDefined();
      expect(state.drafts[id2]).toBeDefined();
    });

    it('falls back to a generic id when extraction yields nothing', () => {
      const s = useAIAppBuilderStore.getState();
      const id = s.createDraft('!!!@#$');
      expect(id).toMatch(/^ai-app-draft-/);
    });

    it('createDraft("") seeds an empty chat (no user turn)', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('');
      expect(useAIAppBuilderStore.getState().chatHistory).toEqual([]);
      expect(useAIAppBuilderStore.getState().status).toBe('idle');
    });

    it('startNewDraft is an alias for createDraft', () => {
      const s = useAIAppBuilderStore.getState();
      s.startNewDraft('番茄钟');
      expect(useAIAppBuilderStore.getState().draftId).toMatch(/^ai-app-/);
      expect(useAIAppBuilderStore.getState().chatHistory).toHaveLength(1);
    });
  });

  describe('appendUserMessage', () => {
    it('appends a user-kind chat turn to the active draft', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('番茄钟');
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
      s.createDraft('番茄钟');
      s.appendAgentMessage('hi');
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history).toHaveLength(2);
      expect(history[1]).toMatchObject({ kind: 'agent-text', text: 'hi' });
    });

    it('does NOT touch draftFiles', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('番茄钟');
      s.appendAgentMessage('已生成');
      expect(useAIAppBuilderStore.getState().draftFiles).toEqual({});
    });
  });

  describe('setDraftFiles', () => {
    it('replaces draftFiles wholesale', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('番茄钟');
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
      s.createDraft('番茄钟');
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
      s.createDraft('番茄钟');
      s.appendPlanUpdate([{ id: 's1', title: '写manifest', status: 'pending' }]);
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history[1]).toMatchObject({
        kind: 'plan-update',
        steps: [{ id: 's1', title: '写manifest', status: 'pending' }],
      });
    });

    it('appendFinish pushes a finish turn', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('番茄钟');
      s.appendFinish('已生成');
      const history = useAIAppBuilderStore.getState().chatHistory;
      expect(history[1]).toMatchObject({ kind: 'finish', summary: '已生成' });
    });
  });

  describe('setStatus / setError', () => {
    it('setStatus updates status field on the active draft', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('番茄钟');
      s.setStatus('generating');
      expect(useAIAppBuilderStore.getState().status).toBe('generating');
    });

    it('setError stores error and switches status to compile-error', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('番茄钟');
      s.setError('compile failed: foo.tsx');
      const state = useAIAppBuilderStore.getState();
      expect(state.lastError).toBe('compile failed: foo.tsx');
      expect(state.status).toBe('compile-error');
    });

    it('setError(null) clears error and resets status to ready', () => {
      const s = useAIAppBuilderStore.getState();
      s.createDraft('番茄钟');
      s.setError('x');
      s.setError(null);
      expect(useAIAppBuilderStore.getState().lastError).toBeNull();
      expect(useAIAppBuilderStore.getState().status).toBe('ready');
    });
  });

  describe('setActiveDraft', () => {
    it('switches to a known draft and rebuilds the mirror', () => {
      const s = useAIAppBuilderStore.getState();
      const id1 = s.createDraft('番茄钟');
      s.setDraftFiles({ 'App.tsx': 'A' });
      const id2 = s.createDraft('记账');
      s.setDraftFiles({ 'App.tsx': 'B' });
      s.setActiveDraft(id1);
      const state = useAIAppBuilderStore.getState();
      expect(state.activeDraftId).toBe(id1);
      expect(state.draftFiles['App.tsx']).toBe('A');
      // chatHistory is still the old one (the user turn from createDraft)
      expect(state.chatHistory[0]!).toMatchObject({ text: '番茄钟' });
      // Switch back
      s.setActiveDraft(id2);
      expect(useAIAppBuilderStore.getState().draftFiles['App.tsx']).toBe('B');
    });

    it('is a no-op for unknown id', () => {
      const s = useAIAppBuilderStore.getState();
      const id = s.createDraft('番茄钟');
      s.setActiveDraft('does-not-exist');
      expect(useAIAppBuilderStore.getState().activeDraftId).toBe(id);
    });
  });

  describe('deleteDraft', () => {
    it('removes the draft and switches to the next most-recently-updated one', () => {
      const s = useAIAppBuilderStore.getState();
      const idA = s.createDraft('A');
      // bump A's updatedAt slightly later by pushing a turn
      const idB = s.createDraft('B');
      // delete the active (B) → should fall back to A
      s.deleteDraft(idB);
      const state = useAIAppBuilderStore.getState();
      expect(state.drafts[idB]).toBeUndefined();
      expect(state.activeDraftId).toBe(idA);
      expect(state.draftFiles).toEqual({});
    });

    it('deleting the last draft sets activeDraftId to null and clears the mirror', () => {
      const s = useAIAppBuilderStore.getState();
      const id = s.createDraft('only one');
      s.deleteDraft(id);
      const state = useAIAppBuilderStore.getState();
      expect(state.drafts).toEqual({});
      expect(state.activeDraftId).toBeNull();
      expect(state.draftId).toBeNull();
      expect(state.chatHistory).toEqual([]);
    });

    it('deleting an inactive draft leaves the active one in place', () => {
      const s = useAIAppBuilderStore.getState();
      const idA = s.createDraft('A');
      const idB = s.createDraft('B'); // active
      s.deleteDraft(idA);
      const state = useAIAppBuilderStore.getState();
      expect(state.activeDraftId).toBe(idB);
      expect(state.drafts[idA]).toBeUndefined();
    });
  });

  describe('listDrafts', () => {
    it('returns drafts ordered by updatedAt descending', () => {
      const s = useAIAppBuilderStore.getState();
      const idA = s.createDraft('A');
      // switch to A, append a message → bumps updatedAt
      const idB = s.createDraft('B');
      s.setActiveDraft(idA);
      s.appendUserMessage('refine A');
      const list = useAIAppBuilderStore.getState().listDrafts();
      expect(list[0]!.id).toBe(idA); // most recently updated
      expect(list[1]!.id).toBe(idB);
    });
  });

  describe('normalizeHydratedDrafts', () => {
    it('converts persisted generating drafts to idle because reloads drop controllers', () => {
      const now = Date.now();
      const generating: Draft = {
        id: 'draft-a',
        files: {},
        chatHistory: [],
        status: 'generating',
        lastError: null,
        createdAt: now,
        updatedAt: now,
      };
      const ready: Draft = {
        ...generating,
        id: 'draft-b',
        status: 'ready',
      };

      const normalized = normalizeHydratedDrafts({
        [generating.id]: generating,
        [ready.id]: ready,
      });

      expect(normalized['draft-a']!.status).toBe('idle');
      expect(normalized['draft-b']).toBe(ready);
      expect(generating.status).toBe('generating');
    });
  });

  describe('exportDraftAsZip', () => {
    it('looks up the draft and triggers the download helper', async () => {
      const s = useAIAppBuilderStore.getState();
      const id = s.createDraft('番茄钟');
      s.setDraftFiles({
        'manifest.json': JSON.stringify({
          id: 'placeholder',
          name: '番茄',
          version: '1.0.0',
          entry: 'App.tsx',
        }),
        'App.tsx': 'export default () => null;',
      });
      // jsdom doesn't fully wire <a download>, but click + URL.createObjectURL
      // are mockable. Spy on createObjectURL to confirm the helper runs.
      const createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock');
      const revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
      await s.exportDraftAsZip(id);
      expect(createSpy).toHaveBeenCalledOnce();
      expect(revokeSpy).toHaveBeenCalledOnce();
      createSpy.mockRestore();
      revokeSpy.mockRestore();
    });

    it('throws on unknown draft id', async () => {
      const s = useAIAppBuilderStore.getState();
      await expect(s.exportDraftAsZip('does-not-exist')).rejects.toThrow(/unknown draft/);
    });
  });
});
