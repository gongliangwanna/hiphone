import { useState, useEffect, useRef, useCallback } from 'react';
import { useActiveNotesStore, useNotesDataStore } from './notesDataStore';
import { useNotesNavStore } from './notesNavStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { format } from 'date-fns';
import { RichTextEditor } from './RichTextEditor';
import { stripHtml } from './richTextUtils';

const AUTO_SAVE_DELAY = 500;

export function NoteEditor() {
  const { isViewingOther } = usePerspective();
  const activeNoteId = useNotesNavStore((s) => s.activeNoteId);
  const setActiveNoteId = useNotesNavStore((s) => s.setActiveNoteId);
  const addNote = useActiveNotesStore((s) => s.addNote);
  const updateNote = useActiveNotesStore((s) => s.updateNote);

  const existingNote = useActiveNotesStore((s) =>
    activeNoteId ? s.notes.find((n) => n.id === activeNoteId) : undefined,
  );

  const [localTitle, setLocalTitle] = useState(existingNote?.title ?? '');
  const [localBody, setLocalBody] = useState(existingNote?.body ?? '');
  const titleRef = useRef<HTMLInputElement>(null);
  const noteIdRef = useRef(activeNoteId);
  const savedRef = useRef(false);
  const isNewNote = useRef(!activeNoteId);
  // Defer heavy work (TipTap mount + keyboard) until after the slide animation (350ms)
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setSettled(true), 380);
    return () => clearTimeout(id);
  }, []);

  // Auto-focus title on new note — wait for animation to finish
  useEffect(() => {
    if (!settled) return;
    if (isNewNote.current && !isViewingOther) {
      titleRef.current?.focus();
    }
  }, [settled, isViewingOther]);

  // Create the note immediately on first non-empty change (no debounce).
  const ensureCreated = useCallback(
    (title: string, body: string) => {
      if (noteIdRef.current) return;
      if (title === '' && stripHtml(body).trim() === '') return;
      if (isViewingOther) return;
      const newId = addNote(title, body);
      noteIdRef.current = newId;
      setActiveNoteId(newId);
    },
    [addNote, setActiveNoteId, isViewingOther],
  );

  // Debounced update for existing notes (skip in read-only mode)
  useEffect(() => {
    if (isViewingOther) return;
    if (!noteIdRef.current) return;
    if (localTitle === '' && stripHtml(localBody).trim() === '') return;

    const timer = setTimeout(() => {
      if (noteIdRef.current) {
        updateNote(noteIdRef.current, localTitle, localBody);
      }
      savedRef.current = true;
    }, AUTO_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [localTitle, localBody, updateNote, isViewingOther]);

  // Clean up on unmount: delete empty notes, final-save non-empty ones
  const cleanupRef = useRef({ localTitle, localBody, isViewingOther });
  cleanupRef.current = { localTitle, localBody, isViewingOther };

  useEffect(() => {
    return () => {
      if (cleanupRef.current.isViewingOther) return;
      const { localTitle: t, localBody: b } = cleanupRef.current;
      const id = noteIdRef.current;
      if (id && t === '' && stripHtml(b).trim() === '') {
        useNotesDataStore.getState().deleteNote(id);
      } else if (id) {
        useNotesDataStore.getState().updateNote(id, t, b);
      }
    };
  }, []);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalTitle(v);
    ensureCreated(v, localBody);
  };

  const handleBodyUpdate = useCallback(
    (html: string) => {
      setLocalBody(html);
      ensureCreated(localTitle, html);
    },
    [ensureCreated, localTitle],
  );

  return (
    <div className="flex h-full flex-col" data-testid="note-editor">
      <div
        className="flex flex-1 flex-col overflow-auto"
        style={{ padding: 'var(--spacing-4)' }}
      >
        <div
          className="w-full text-center"
          style={{
            fontSize: 'var(--font-size-caption1)',
            color: 'var(--color-secondaryLabel)',
            marginBottom: 16,
          }}
        >
          {existingNote?.updatedAt
            ? format(existingNote.updatedAt, 'yyyy年M月d日 HH:mm')
            : format(Date.now(), 'yyyy年M月d日 HH:mm')}
        </div>
        <input
          ref={titleRef}
          type="text"
          placeholder="标题"
          value={localTitle}
          readOnly={isViewingOther}
          onChange={handleTitleChange}
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: '28px',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-label)',
            marginBottom: 0,
            lineHeight: 1.2,
          }}
          data-testid="note-title-input"
        />
        <div style={{ paddingTop: 8, flex: 1, display: 'flex', flexDirection: 'column' }}>
          {settled ? (
            <RichTextEditor
              content={localBody}
              editable={!isViewingOther}
              noteId={activeNoteId}
              onUpdate={handleBodyUpdate}
            />
          ) : (
            <div
              className="w-full flex-1"
              style={{
                fontSize: 'var(--font-size-body)',
                color: 'var(--color-label)',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
              }}
            >
              {stripHtml(localBody)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
