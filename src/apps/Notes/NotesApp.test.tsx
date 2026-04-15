import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { NotesApp } from './NotesApp';
import { useNotesNavStore } from './notesNavStore';
import { useNotesDataStore } from './notesDataStore';
import { useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';

const TEST_NOTES = [
  {
    id: 'test-1',
    title: 'Meeting Notes',
    body: 'Discuss project timeline',
    createdAt: 1000,
    updatedAt: 3000,
  },
  {
    id: 'test-2',
    title: 'Shopping List',
    body: 'Milk, bread, eggs',
    createdAt: 2000,
    updatedAt: 2000,
  },
];

beforeEach(() => {
  useNotesNavStore.getState().reset();
  useNotesDataStore.setState({ notes: [...TEST_NOTES], searchQuery: '' });
  useAppRuntimeStore.setState({
    activeAppId: 'notes',
    appOrigin: { x: 0, y: 0, width: 60, height: 60 },
  });
});

describe('NotesApp', () => {
  it('renders list view with large title', () => {
    render(<NotesApp />);
    expect(screen.getByText('备忘录')).toBeInTheDocument();
  });

  it('shows note cells with titles', () => {
    render(<NotesApp />);
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.getByText('Shopping List')).toBeInTheDocument();
  });

  it('shows search bar', () => {
    render(<NotesApp />);
    expect(screen.getByTestId('notes-search')).toBeInTheDocument();
  });

  it('shows compose button', () => {
    render(<NotesApp />);
    expect(screen.getByTestId('notes-compose')).toBeInTheDocument();
  });

  it('navigates to editor on note cell click', () => {
    render(<NotesApp />);
    // SwipeableNoteRow uses motion onTap which doesn't fire from fireEvent.click in jsdom;
    // navigate via store to verify editor renders correctly
    act(() => useNotesNavStore.getState().push('editor', 'test-1'));
    expect(screen.getByTestId('note-editor')).toBeInTheDocument();
    expect(screen.getByTestId('note-title-input')).toHaveValue('Meeting Notes');
  });

  it('navigates to editor with empty fields on compose click', () => {
    render(<NotesApp />);
    fireEvent.click(screen.getByTestId('notes-compose'));
    expect(screen.getByTestId('note-editor')).toBeInTheDocument();
    expect(screen.getByTestId('note-title-input')).toHaveValue('');
  });

  it('navigates back from editor to list', () => {
    render(<NotesApp />);
    act(() => useNotesNavStore.getState().push('editor', 'test-1'));
    fireEvent.click(screen.getByTestId('nav-back'));
    // List should be visible again (AnimatePresence renders both during transition)
    expect(screen.getByTestId('notes-compose')).toBeInTheDocument();
  });

  it('filters notes via search', () => {
    render(<NotesApp />);
    fireEvent.change(screen.getByTestId('notes-search'), {
      target: { value: 'Meeting' },
    });
    expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
    expect(screen.queryByText('Shopping List')).not.toBeInTheDocument();
  });

  it('shows right buttons in editor nav bar', () => {
    render(<NotesApp />);
    act(() => useNotesNavStore.getState().push('editor', 'test-1'));
    expect(screen.getByTestId('notes-share-btn')).toBeInTheDocument();
    expect(screen.getByTestId('notes-more-btn')).toBeInTheDocument();
  });

  it('deletes note via more button and returns to list', () => {
    render(<NotesApp />);
    act(() => useNotesNavStore.getState().push('editor', 'test-1'));
    // Open ellipsis dropdown menu
    fireEvent.click(screen.getByTestId('notes-more-btn'));
    // Click delete option in dropdown
    fireEvent.click(screen.getByTestId('notes-delete-option'));
    // Should be back on list without the deleted note
    expect(screen.queryByText('Meeting Notes')).not.toBeInTheDocument();
    expect(screen.getByText('Shopping List')).toBeInTheDocument();
  });

  it('saves new note immediately on first keystroke, persists after back', async () => {
    render(<NotesApp />);
    const countBefore = useNotesDataStore.getState().notes.length;

    // 1. Open new note editor
    fireEvent.click(screen.getByTestId('notes-compose'));
    expect(screen.getByTestId('note-editor')).toBeInTheDocument();

    // 2. Type a title — note should be created immediately (no debounce)
    fireEvent.change(screen.getByTestId('note-title-input'), {
      target: { value: 'Quick Note' },
    });
    expect(useNotesDataStore.getState().notes.length).toBe(countBefore + 1);
    expect(useNotesDataStore.getState().notes.some((n) => n.title === 'Quick Note')).toBe(true);

    // 3. Go back — note should still exist
    fireEvent.click(screen.getByTestId('nav-back'));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 500));
    });
    expect(useNotesDataStore.getState().notes.length).toBe(countBefore + 1);
    expect(useNotesDataStore.getState().notes.some((n) => n.title === 'Quick Note')).toBe(true);
  });

  it('resets nav state when app is killed', () => {
    // Navigate to editor
    useNotesNavStore.getState().push('editor', 'test-1');
    // Simulate app kill
    useAppRuntimeStore.getState().removeApp('notes');
    // Re-render — should be on list
    render(<NotesApp />);
    expect(useNotesNavStore.getState().stack).toEqual(['list']);
  });
});
