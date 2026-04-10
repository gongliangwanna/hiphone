import { useMemo } from 'react';
import { useNotesDataStore } from './notesDataStore';
import { useNotesNavStore } from './notesNavStore';
import { format, isToday, isThisYear } from 'date-fns';

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
                className="flex w-full flex-col justify-center text-left"
                style={{
                  minHeight: 64,
                  padding: '10px 16px',
                  borderBottom:
                    i < notes.length - 1
                      ? '0.5px solid var(--color-separator)'
                      : 'none',
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
                  className="truncate"
                  style={{
                    fontSize: 'var(--font-size-subhead)',
                    color: 'var(--color-secondaryLabel)',
                    lineHeight: 1.4,
                    marginTop: 2,
                  }}
                >
                  {formatNoteDate(note.updatedAt)}
                  {'  '}
                  {note.body.slice(0, 50) || '无其他文本'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compose FAB */}
      <button
        type="button"
        className="absolute flex items-center justify-center"
        style={{
          bottom: 20,
          right: 20,
          width: 50,
          height: 50,
          borderRadius: 'var(--radius-button)',
          backgroundColor: 'var(--color-systemYellow)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
        onClick={() => push('editor', null)}
        data-testid="notes-compose"
      >
        <ComposeIcon />
      </button>
    </div>
  );
}

/** SF Symbol: magnifyingglass */
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
      <circle
        cx="8.5"
        cy="8.5"
        r="6"
        stroke="var(--color-secondaryLabel)"
        strokeWidth="1.8"
      />
      <line
        x1="13"
        y1="13"
        x2="18"
        y2="18"
        stroke="var(--color-secondaryLabel)"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SF Symbol: square.and.pencil */
function ComposeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect
        x="3"
        y="5"
        width="15"
        height="16"
        rx="2"
        stroke="white"
        strokeWidth="1.8"
      />
      <path
        d="M14 3l4 4-9 9H5v-4l9-9z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
