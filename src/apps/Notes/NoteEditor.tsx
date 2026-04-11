import { useState, useEffect, useRef } from 'react';
import { useNotesDataStore } from './notesDataStore';
import { useNotesNavStore } from './notesNavStore';
import { Material } from '@/system';
import { format } from 'date-fns';

const AUTO_SAVE_DELAY = 500;

export function NoteEditor() {
  const activeNoteId = useNotesNavStore((s) => s.activeNoteId);
  const setActiveNoteId = useNotesNavStore((s) => s.setActiveNoteId);
  const addNote = useNotesDataStore((s) => s.addNote);
  const updateNote = useNotesDataStore((s) => s.updateNote);

  const existingNote = useNotesDataStore((s) =>
    activeNoteId ? s.notes.find((n) => n.id === activeNoteId) : undefined,
  );

  const [localTitle, setLocalTitle] = useState(existingNote?.title ?? '');
  const [localBody, setLocalBody] = useState(existingNote?.body ?? '');
  const titleRef = useRef<HTMLInputElement>(null);
  const noteIdRef = useRef(activeNoteId);
  const savedRef = useRef(false);

  // Auto-focus title on new note
  useEffect(() => {
    if (!activeNoteId) {
      titleRef.current?.focus();
    }
  }, [activeNoteId]);

  // Auto-save with debounce
  useEffect(() => {
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
  }, [localTitle, localBody, addNote, updateNote, setActiveNoteId]);

  // Clean up empty note on unmount (back navigation)
  const cleanupRef = useRef({ localTitle, localBody });
  cleanupRef.current = { localTitle, localBody };

  useEffect(() => {
    return () => {
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

      {/* Bottom toolbar */}
      <Material
        variant="chrome"
        className="flex items-center justify-around shrink-0 relative"
        style={{
          height: 49,
          paddingBottom: 'var(--app-safe-bottom, 0px)',
          borderTop: '0.5px solid var(--color-separator)',
        }}
      >
        <ToolbarButton icon={<TableIcon />} />
        <ToolbarButton icon={<FormatIcon />} />
        <ToolbarButton icon={<ChecklistIcon />} />
        <ToolbarButton icon={<AttachIcon />} />
        <ToolbarButton icon={<MarkupIcon />} />
      </Material>
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

/** SF Symbol: tablecells */
function TableIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 12h18M12 5v14" />
    </svg>
  );
}

/** SF Symbol: textformat (Aa) */
function FormatIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19L8.5 7h1.5L14.5 19" />
      <path d="M6 15h7" />
      <circle cx="18" cy="16.5" r="2.5" />
      <path d="M20.5 14v5" />
    </svg>
  );
}

/** SF Symbol: checkmark.circle */
function ChecklistIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

/** SF Symbol: camera */
function AttachIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h4l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

/** SF Symbol: pencil.tip.crop.circle */
function MarkupIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 4l-3 7v6h6v-6z" />
      <path d="M12 4v13" />
      <path d="M9 11h6" />
    </svg>
  );
}
