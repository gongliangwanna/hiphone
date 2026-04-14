import { useMemo, useState, useCallback } from 'react';
import { useActiveNotesStore } from './notesDataStore';
import { useNotesNavStore } from './notesNavStore';
import { usePerspective } from '@/platform/hooks/usePerspective';
import { Material } from '@/system';
import { Search, SquarePen, FileText } from 'lucide-react';
import { SwipeableNoteRow } from './SwipeableNoteRow';

export function NotesList() {
  const allNotes = useActiveNotesStore((s) => s.notes);
  const searchQuery = useActiveNotesStore((s) => s.searchQuery);
  const notes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let result = allNotes;
    if (q) {
      result = result.filter(
        (n) => n.title.toLowerCase().includes(q) || n.body.toLowerCase().includes(q),
      );
    }
    return [...result].sort((a, b) => b.updatedAt - a.updatedAt);
  }, [allNotes, searchQuery]);
  const setSearchQuery = useActiveNotesStore((s) => s.setSearchQuery);
  const deleteNote = useActiveNotesStore((s) => s.deleteNote);
  const push = useNotesNavStore((s) => s.push);
  const { isViewingOther } = usePerspective();
  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const handleScrollCapture = useCallback(() => {
    if (openRowId) setOpenRowId(null);
  }, [openRowId]);

  return (
    <div className="relative flex h-full flex-col">
      {/* Search bar */}
      <div style={{ padding: '0 16px 12px' }}>
        <div
          className="flex items-center gap-2"
          style={{
            backgroundColor: 'rgba(118, 118, 128, 0.12)',
            borderRadius: 10,
            padding: '8px 12px',
          }}
        >
          <Search size={16} strokeWidth={2} color="var(--color-secondaryLabel)" />
          <input
            type="text"
            placeholder="搜索"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent outline-none"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
            }}
            data-testid="notes-search"
          />
        </div>
      </div>

      {/* Notes list */}
      <div className="flex-1 overflow-auto" onScrollCapture={handleScrollCapture}>
        {notes.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-2"
            style={{ color: 'var(--color-secondaryLabel)' }}
          >
            <FileText size={48} strokeWidth={1} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 'var(--font-size-body)', fontWeight: 'var(--font-weight-semibold)' }}>
              没有备忘录
            </span>
            {!isViewingOther && (
              <span style={{ fontSize: 'var(--font-size-footnote)' }}>
                点击右下角按钮开始创作
              </span>
            )}
          </div>
        ) : (
          <div>
            {notes.map((note, i) => (
              <SwipeableNoteRow
                key={note.id}
                note={note}
                isOpen={openRowId === note.id}
                isLast={i === notes.length - 1}
                swipeable={!isViewingOther}
                onOpen={() => setOpenRowId(note.id)}
                onCloseRequest={() => setOpenRowId(null)}
                onTap={() => push('editor', note.id)}
                onDelete={() => {
                  deleteNote(note.id);
                  setOpenRowId(null);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom toolbar */}
      <Material
        variant="chrome"
        className="flex items-center justify-between px-4 shrink-0 relative"
        style={{
          height: 49,
          paddingBottom: 'var(--app-safe-bottom, 0px)',
          borderTop: '0.5px solid var(--color-separator)',
        }}
      >
        {/* Placeholder left button to balance the center text */}
        <div style={{ width: 44 }} />
        
        <span
          style={{
            fontSize: 'var(--font-size-caption1)',
            color: 'var(--color-label)',
          }}
        >
          {notes.length} 个备忘录
        </span>

        {!isViewingOther ? (
          <button
            type="button"
            className="flex items-center justify-center"
            style={{
              minWidth: 44,
              minHeight: 44,
              color: 'var(--color-systemYellow)',
            }}
            onClick={() => push('editor', null)}
            data-testid="notes-compose"
          >
            <SquarePen size={24} strokeWidth={1.5} />
          </button>
        ) : (
          <div style={{ width: 44 }} />
        )}
      </Material>
    </div>
  );
}

