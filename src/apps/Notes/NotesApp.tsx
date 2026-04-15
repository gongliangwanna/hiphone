import { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useNotesNavStore } from './notesNavStore';
import { useActiveNotesStore } from './notesDataStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { useAppRuntimeStore, wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { NotesList } from './NotesList';
import { NoteEditor } from './NoteEditor';
import { AppScreen, NavBar } from '@/system';
import { Share, EllipsisVertical, Trash2 } from 'lucide-react';
import { ShareSheet } from './ShareSheet';

const PAGE_COMPONENTS: Record<string, React.ComponentType> = {
  list: NotesList,
  editor: NoteEditor,
};

/** iOS push/pop slide — 350ms, ease-out */
const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

export function NotesApp() {
  const { isViewingOther } = usePerspective();
  const stack = useNotesNavStore((s) => s.stack);
  const activeNoteId = useNotesNavStore((s) => s.activeNoteId);
  const shareSheetOpen = useNotesNavStore((s) => s.shareSheetOpen);
  const pop = useNotesNavStore((s) => s.pop);
  const reset = useNotesNavStore((s) => s.reset);
  const goHome = useAppRuntimeStore((s) => s.goHome);
  const deleteNote = useActiveNotesStore((s) => s.deleteNote);
  const prevLengthRef = useRef(stack.length);
  const [menuOpen, setMenuOpen] = useState(false);

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
    setMenuOpen(false);
    if (activeNoteId) {
      deleteNote(activeNoteId);
    }
    pop();
  }, [activeNoteId, deleteNote, pop]);

  // Close menu when navigating away from editor
  useEffect(() => {
    if (currentPage !== 'editor') setMenuOpen(false);
  }, [currentPage]);

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
        rightButtons={isViewingOther ? [] : [
          {
            icon: <Share size={20} strokeWidth={1.6} />,
            onClick: () => useNotesNavStore.getState().openShareSheet(),
            testId: 'notes-share-btn',
          },
          {
            icon: <EllipsisVertical size={22} strokeWidth={1.5} />,
            onClick: () => setMenuOpen((v) => !v),
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
            key={currentPage}
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

        {/* Ellipsis dropdown menu */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <div
                className="absolute inset-0 z-40"
                onClick={() => setMenuOpen(false)}
              />
              <motion.div
                className="absolute z-50"
                style={{
                  top: 44,
                  right: 8,
                  backgroundColor: 'var(--color-secondarySystemBackground)',
                  borderRadius: 14,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                  overflow: 'hidden',
                  minWidth: 200,
                }}
                initial={{ opacity: 0, scale: 0.85, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.85, y: -8 }}
                transition={{ duration: 0.18 }}
              >
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-4"
                  style={{
                    minHeight: 44,
                    fontSize: 'var(--font-size-body)',
                    color: '#FF3B30',
                  }}
                  onClick={handleDelete}
                  data-testid="notes-delete-option"
                >
                  <Trash2 size={18} strokeWidth={1.8} />
                  <span>删除备忘录</span>
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Share sheet */}
        <AnimatePresence>
          {shareSheetOpen && activeNoteId && (
            <ShareSheet noteId={activeNoteId} />
          )}
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}

