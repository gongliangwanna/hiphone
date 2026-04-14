import { useState, useEffect, useRef } from 'react';
import { useActiveNotesStore, useNotesDataStore } from './notesDataStore';
import { useNotesNavStore } from './notesNavStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { Material } from '@/system';
import { format } from 'date-fns';
import { Grid3X3, ALargeSmall, ListChecks, Camera, PenTool } from 'lucide-react';

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

  // Auto-focus title on new note (skip in read-only mode)
  useEffect(() => {
    if (!activeNoteId && !isViewingOther) {
      titleRef.current?.focus();
    }
  }, [activeNoteId, isViewingOther]);

  // Auto-save with debounce (skip in read-only mode)
  useEffect(() => {
    if (isViewingOther) return;
    if (localTitle === '' && localBody === '') return;

    const timer = setTimeout(() => {
      if (noteIdRef.current) {
        updateNote(noteIdRef.current, localTitle, localBody);
      } else {
        const newId = addNote(localTitle, localBody);
        noteIdRef.current = newId;
        setActiveNoteId(newId);
      }
      savedRef.current = true;
    }, AUTO_SAVE_DELAY);

    return () => clearTimeout(timer);
  }, [localTitle, localBody, addNote, updateNote, setActiveNoteId, isViewingOther]);

  // Clean up empty note on unmount (back navigation) — skip in read-only mode
  const cleanupRef = useRef({ localTitle, localBody, isViewingOther });
  cleanupRef.current = { localTitle, localBody, isViewingOther };

  useEffect(() => {
    return () => {
      if (cleanupRef.current.isViewingOther) return;
      const { localTitle: t, localBody: b } = cleanupRef.current;
      const id = noteIdRef.current;
      if (id && t === '' && b === '') {
        useNotesDataStore.getState().deleteNote(id);
      } else if (id && (t !== '' || b !== '')) {
        // Final save on unmount
        useNotesDataStore.getState().updateNote(id, t, b);
      }
    };
  }, []);

  return (
    <div className="flex h-full flex-col" data-testid="note-editor">
      {/* Content area */}
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
          {existingNote?.updatedAt ? format(existingNote.updatedAt, 'yyyy年M月d日 HH:mm') : format(Date.now(), 'yyyy年M月d日 HH:mm')}
        </div>
        <input
          ref={titleRef}
          type="text"
          placeholder="标题"
          value={localTitle}
          readOnly={isViewingOther}
          onChange={(e) => setLocalTitle(e.target.value)}
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
        <textarea
          placeholder="正文"
          value={localBody}
          readOnly={isViewingOther}
          onChange={(e) => setLocalBody(e.target.value)}
          className="w-full flex-1 resize-none bg-transparent outline-none"
          style={{
            fontSize: 'var(--font-size-body)',
            color: 'var(--color-label)',
            lineHeight: 1.5,
            minHeight: 200,
            paddingTop: 8,
          }}
          data-testid="note-body-input"
        />
      </div>

      {/* Bottom toolbar (hidden in read-only mode) */}
      {!isViewingOther && (
        <Material
          variant="chrome"
          className="flex items-center justify-around shrink-0 relative"
          style={{
            height: 49,
            paddingBottom: 'var(--app-safe-bottom, 0px)',
            borderTop: '0.5px solid var(--color-separator)',
          }}
        >
          <ToolbarButton icon={<Grid3X3 size={22} strokeWidth={1.5} />} />
          <ToolbarButton icon={<ALargeSmall size={22} strokeWidth={1.5} />} />
          <ToolbarButton icon={<ListChecks size={22} strokeWidth={1.5} />} />
          <ToolbarButton icon={<Camera size={22} strokeWidth={1.5} />} />
          <ToolbarButton icon={<PenTool size={22} strokeWidth={1.5} />} />
        </Material>
      )}
    </div>
  );
}

function ToolbarButton({ icon }: { icon: React.ReactNode }) {
  return (
    <button
      type="button"
      className="flex items-center justify-center"
      style={{
        minWidth: 44,
        minHeight: 44,
        color: 'var(--color-systemYellow)',
        opacity: 0.4,
      }}
      disabled
    >
      {icon}
    </button>
  );
}

