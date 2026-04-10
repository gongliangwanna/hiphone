import { useEffect, useRef, useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNotesNavStore } from './notesNavStore';
import { useNotesDataStore } from './notesDataStore';
import { useAppRuntimeStore, wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { AppScreen, NavBar } from '@/system';

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
  list: NotesList,
  editor: NoteEditor,
};

/** iOS push/pop slide — 350ms, ease-out */
const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

export function NotesApp() {
  const stack = useNotesNavStore((s) => s.stack);
  const activeNoteId = useNotesNavStore((s) => s.activeNoteId);
  const pop = useNotesNavStore((s) => s.pop);
  const reset = useNotesNavStore((s) => s.reset);
  const goHome = useAppRuntimeStore((s) => s.goHome);
  const deleteNote = useNotesDataStore((s) => s.deleteNote);
  const prevLengthRef = useRef(stack.length);

  useEffect(() => {
    if (wasAppKilled('notes')) {
      reset();
      clearAppKilled('notes');
    }
  }, [reset]);

  const currentPage = stack[stack.length - 1] ?? 'list';

  const direction = stack.length > prevLengthRef.current ? 1 : -1;
  useEffect(() => {
    prevLengthRef.current = stack.length;
  }, [stack.length]);

  const handleBack = useCallback(() => {
    if (stack.length <= 1) {
      reset();
      goHome();
    } else {
      pop();
    }
  }, [stack.length, reset, goHome, pop]);

  const handleDelete = useCallback(() => {
    if (activeNoteId) {
      deleteNote(activeNoteId);
    }
    pop();
  }, [activeNoteId, deleteNote, pop]);

  const PageComponent = PAGE_COMPONENTS[currentPage] ?? NotesList;

  const header =
    currentPage === 'list' ? (
      <NavBar title="备忘录" variant="largeTitle" />
    ) : (
      <NavBar
        title=""
        showBack
        onBack={handleBack}
        backLabel="备忘录"
        rightButtons={[
          {
            icon: <ShareIcon />,
            onClick: () => {},
            testId: 'notes-share-btn',
          },
          {
            icon: <EllipsisIcon />,
            onClick: handleDelete,
            testId: 'notes-more-btn',
          },
        ]}
      />
    );

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <div
        className="relative flex-1 overflow-hidden"
        data-testid="notes-app"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={currentPage + (currentPage === 'editor' ? activeNoteId : '')}
            className="absolute inset-0 flex min-h-0 flex-col"
            style={{
              backgroundColor: 'var(--color-systemBackground)',
              willChange: 'transform',
            }}
            initial={{ x: `${direction * 100}%` }}
            animate={{ x: '0%' }}
            exit={{ x: `${direction * -30}%` }}
            transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
          >
            {header}
            <div className="min-h-0 flex-1 overflow-hidden">
              <PageComponent />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}

/** SF Symbol: square.and.arrow.up */
function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M7 8V18a1 1 0 001 1h8a1 1 0 001-1V8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 2v10M8 5l3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SF Symbol: ellipsis.circle */
function EllipsisIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="11" r="1.2" fill="currentColor" />
      <circle cx="11" cy="11" r="1.2" fill="currentColor" />
      <circle cx="15" cy="11" r="1.2" fill="currentColor" />
    </svg>
  );
}
