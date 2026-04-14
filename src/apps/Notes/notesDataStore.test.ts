import { describe, it, expect, beforeEach } from 'vitest';
import { useNotesDataStore, notesRegistry, selectFilteredNotes } from './notesDataStore';

function resetStore() {
  useNotesDataStore.setState({
    notes: [
      {
        id: 'n1',
        title: 'First',
        body: 'Body one',
        createdAt: 1000,
        updatedAt: 3000,
      },
      {
        id: 'n2',
        title: 'Second',
        body: 'Body two',
        createdAt: 2000,
        updatedAt: 2000,
      },
    ],
    searchQuery: '',
  });
}

describe('notesDataStore', () => {
  beforeEach(resetStore);

  it('addNote creates a note and returns its id', () => {
    const id = useNotesDataStore.getState().addNote('New', 'Content');
    expect(id).toBeTruthy();
    const note = useNotesDataStore.getState().notes.find((n) => n.id === id);
    expect(note).toBeDefined();
    expect(note!.title).toBe('New');
    expect(note!.body).toBe('Content');
    expect(note!.createdAt).toBeGreaterThan(0);
    expect(note!.updatedAt).toBe(note!.createdAt);
  });

  it('updateNote changes title, body, and bumps updatedAt', () => {
    const before = useNotesDataStore.getState().notes.find((n) => n.id === 'n1')!;
    useNotesDataStore.getState().updateNote('n1', 'Updated', 'New body');
    const after = useNotesDataStore.getState().notes.find((n) => n.id === 'n1')!;
    expect(after.title).toBe('Updated');
    expect(after.body).toBe('New body');
    expect(after.updatedAt).toBeGreaterThanOrEqual(before.updatedAt);
  });

  it('deleteNote removes the note', () => {
    useNotesDataStore.getState().deleteNote('n1');
    const notes = useNotesDataStore.getState().notes;
    expect(notes).toHaveLength(1);
    expect(notes[0]!.id).toBe('n2');
  });

  it('setSearchQuery updates the query', () => {
    useNotesDataStore.getState().setSearchQuery('hello');
    expect(useNotesDataStore.getState().searchQuery).toBe('hello');
  });
});

describe('selectFilteredNotes', () => {
  beforeEach(resetStore);

  it('returns notes sorted by updatedAt descending', () => {
    const result = selectFilteredNotes(useNotesDataStore.getState());
    expect(result[0]!.id).toBe('n1'); // updatedAt=3000
    expect(result[1]!.id).toBe('n2'); // updatedAt=2000
  });

  it('filters by title match (case-insensitive)', () => {
    useNotesDataStore.getState().setSearchQuery('first');
    const result = selectFilteredNotes(useNotesDataStore.getState());
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('n1');
  });

  it('filters by body match', () => {
    useNotesDataStore.getState().setSearchQuery('two');
    const result = selectFilteredNotes(useNotesDataStore.getState());
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('n2');
  });

  it('returns empty array when no matches', () => {
    useNotesDataStore.getState().setSearchQuery('zzzzz');
    const result = selectFilteredNotes(useNotesDataStore.getState());
    expect(result).toHaveLength(0);
  });
});

describe('notesRegistry (EntityStoreRegistry)', () => {
  it('player store is the same as useNotesDataStore', () => {
    const playerStore = notesRegistry.getStore(null);
    expect(playerStore).toBe(useNotesDataStore);
  });

  it('AI character store is separate from player store', () => {
    const aiStore = notesRegistry.getStore('soren');
    expect(aiStore).not.toBe(useNotesDataStore);
  });

  it('AI store starts with empty notes', () => {
    const aiStore = notesRegistry.getStore('test-ai-empty');
    expect(aiStore.getState().notes).toHaveLength(0);
  });

  it('stores are isolated — adding to one does not affect the other', () => {
    const storeA = notesRegistry.getStore('char-a');
    const storeB = notesRegistry.getStore('char-b');

    storeA.getState().addNote('A note', 'A body');
    expect(storeA.getState().notes.length).toBeGreaterThan(0);
    expect(storeB.getState().notes).toHaveLength(0);
  });

  it('same entity always returns the same store instance', () => {
    const s1 = notesRegistry.getStore('same-id');
    const s2 = notesRegistry.getStore('same-id');
    expect(s1).toBe(s2);
  });
});
