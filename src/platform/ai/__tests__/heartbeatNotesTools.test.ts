import { describe, it, expect, beforeEach } from 'vitest';
import { executeHeartbeatTool, resetHeartbeatLimits } from '../heartbeatTools';
import { notesRegistry } from '@/apps/Notes/notesDataStore';

const CHAR_ID = 'test-notes-char';

function getCharStore() {
  return notesRegistry.getStore(CHAR_ID);
}

describe('heartbeat notes tools', () => {
  beforeEach(() => {
    resetHeartbeatLimits(CHAR_ID);
    // Clear any notes from previous tests
    getCharStore().setState({ notes: [] });
  });

  describe('view_notes', () => {
    it('returns empty message when no notes exist', async () => {
      const result = await executeHeartbeatTool('view_notes', { page: 1 }, CHAR_ID);
      expect(result.done).toBe(false);
      expect(result.observation).toContain('还没有写过备忘录');
    });

    it('returns paginated notes with aliases', async () => {
      const store = getCharStore();
      store.getState().addNote('Note A', 'Body A');
      store.getState().addNote('Note B', 'Body B');

      const result = await executeHeartbeatTool('view_notes', { page: 1 }, CHAR_ID);
      expect(result.done).toBe(false);
      expect(result.observation).toContain('[n1]');
      expect(result.observation).toContain('[n2]');
      expect(result.observation).toContain('共2条');
    });

    it('returns page-out-of-range message', async () => {
      const store = getCharStore();
      store.getState().addNote('Only one', 'Single note');

      const result = await executeHeartbeatTool('view_notes', { page: 99 }, CHAR_ID);
      expect(result.observation).toContain('没有更多备忘录了');
    });

    it('defaults to page 1 when no page given', async () => {
      const store = getCharStore();
      store.getState().addNote('Default page', 'Body');

      const result = await executeHeartbeatTool('view_notes', {}, CHAR_ID);
      expect(result.observation).toContain('[n1]');
    });
  });

  describe('create_note', () => {
    it('creates a note and pushes heartbeat log', async () => {
      const result = await executeHeartbeatTool(
        'create_note',
        { title: 'My Diary', body: 'Today was a good day.' },
        CHAR_ID,
      );
      expect(result.done).toBe(false);
      expect(result.observation).toContain('备忘录已创建');

      const notes = getCharStore().getState().notes;
      expect(notes).toHaveLength(1);
      expect(notes[0]!.title).toBe('My Diary');
      expect(notes[0]!.body).toBe('Today was a good day.');
    });

    it('rejects empty title and body', async () => {
      const result = await executeHeartbeatTool(
        'create_note',
        { title: '', body: '' },
        CHAR_ID,
      );
      expect(result.observation).toContain('不能都为空');
      expect(getCharStore().getState().notes).toHaveLength(0);
    });

    it('accepts title-only note', async () => {
      const result = await executeHeartbeatTool(
        'create_note',
        { title: 'Quick thought', body: '' },
        CHAR_ID,
      );
      expect(result.observation).toContain('备忘录已创建');
      expect(getCharStore().getState().notes).toHaveLength(1);
    });

    it('accepts body-only note', async () => {
      const result = await executeHeartbeatTool(
        'create_note',
        { title: '', body: 'Just a body' },
        CHAR_ID,
      );
      expect(result.observation).toContain('备忘录已创建');
      expect(getCharStore().getState().notes).toHaveLength(1);
    });
  });

  describe('alias reset', () => {
    it('resetHeartbeatLimits clears note aliases', async () => {
      const store = getCharStore();
      store.getState().addNote('Alias test', 'body');

      // First view registers aliases
      await executeHeartbeatTool('view_notes', { page: 1 }, CHAR_ID);

      // Reset clears aliases — new view should re-register
      resetHeartbeatLimits(CHAR_ID);

      const result = await executeHeartbeatTool('view_notes', { page: 1 }, CHAR_ID);
      expect(result.observation).toContain('[n1]');
    });
  });
});
