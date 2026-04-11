import { useMemo } from 'react';
import { useNotesDataStore } from './notesDataStore';
import { useNotesNavStore } from './notesNavStore';
import { format, isToday, isThisYear } from 'date-fns';
import { Material } from '@/system';

function formatNoteDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (isToday(date)) return format(date, 'HH:mm');
  if (isThisYear(date)) return format(date, 'M月d日');
  return format(date, 'yyyy/M/d');
}

export function NotesList() {
  const allNotes = useNotesDataStore((s) => s.notes);
  const searchQuery = useNotesDataStore((s) => s.searchQuery);
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
  const setSearchQuery = useNotesDataStore((s) => s.setSearchQuery);
  const push = useNotesNavStore((s) => s.push);

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
          <SearchIcon />
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
      <div className="flex-1 overflow-auto">
        {notes.length === 0 ? (
          <div
            className="flex h-full items-center justify-center"
            style={{
              color: 'var(--color-secondaryLabel)',
              fontSize: 'var(--font-size-footnote)',
            }}
          >
            没有备忘录
          </div>
        ) : (
          <div>
            {notes.map((note, i) => (
              <button
                key={note.id}
                type="button"
                className="flex w-full flex-col justify-center text-left relative"
                style={{
                  minHeight: 64,
                  padding: '10px 16px',
                }}
                onClick={() => push('editor', note.id)}
                data-testid={`note-cell-${note.id}`}
              >
                <span
                  className="truncate"
                  style={{
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 'var(--font-weight-semibold)',
                    color: 'var(--color-label)',
                    lineHeight: 1.3,
                  }}
                >
                  {note.title || '新建备忘录'}
                </span>
                <span
                  className="truncate flex gap-2"
                  style={{
                    fontSize: 'var(--font-size-subhead)',
                    color: 'var(--color-secondaryLabel)',
                    lineHeight: 1.4,
                    marginTop: 2,
                  }}
                >
                  <span>{formatNoteDate(note.updatedAt)}</span>
                  <span style={{ opacity: 0.6 }}>{note.body.slice(0, 50) || '无附加文本'}</span>
                </span>
                {i < notes.length - 1 && (
                  <div
                    className="absolute bottom-0 right-0"
                    style={{
                      left: 16,
                      height: 0.5,
                      backgroundColor: 'var(--color-separator)',
                    }}
                  />
                )}
              </button>
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
          <ComposeIcon />
        </button>
      </Material>
    </div>
  );
}

/** SF Symbol: magnifyingglass */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondaryLabel)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

/** SF Symbol: square.and.pencil */
function ComposeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
