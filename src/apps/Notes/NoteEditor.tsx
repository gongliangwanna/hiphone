import { useState, useEffect, useRef } from 'react';
import { useNotesDataStore } from './notesDataStore';
import { useNotesNavStore } from './notesNavStore';

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
        <input
          ref={titleRef}
          type="text"
          placeholder="标题"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          className="w-full bg-transparent outline-none"
          style={{
            fontSize: 'var(--font-size-title2)',
            fontWeight: 'var(--font-weight-bold)',
            color: 'var(--color-label)',
            marginBottom: 8,
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
          }}
          data-testid="note-body-input"
        />
      </div>

      {/* Bottom toolbar */}
      <div
        className="flex items-center justify-around"
        style={{
          height: 44,
          borderTop: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-secondarySystemBackground)',
          flexShrink: 0,
        }}
      >
        <ToolbarButton icon={<TableIcon />} />
        <ToolbarButton icon={<FormatIcon />} />
        <ToolbarButton icon={<ChecklistIcon />} />
        <ToolbarButton icon={<AttachIcon />} />
        <ToolbarButton icon={<MarkupIcon />} />
      </div>
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
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect x="2" y="2" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <line x1="2" y1="8" x2="20" y2="8" stroke="currentColor" strokeWidth="1.2" />
      <line x1="2" y1="14" x2="20" y2="14" stroke="currentColor" strokeWidth="1.2" />
      <line x1="11" y1="2" x2="11" y2="20" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

/** SF Symbol: textformat (Aa) */
function FormatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M3 18L8.5 4h5L19 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="5.5" y1="13" x2="16.5" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** SF Symbol: checklist */
function ChecklistIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path d="M3 5l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="6" x2="19" y2="6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3 12l2 2 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="12" y1="13" x2="19" y2="13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

/** SF Symbol: paperclip */
function AttachIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M10 5v10a3 3 0 006 0V6a5 5 0 00-10 0v10a7 7 0 0014 0V5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SF Symbol: pencil.tip.crop.circle */
function MarkupIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 5v8M8 10l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
