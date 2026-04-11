import { ChevronRight, Plus } from 'lucide-react';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useSettingsNavStore } from '../settingsNavStore';

export function WorldBooksPage() {
  const books = useWorldBookStore((s) => s.books);
  const addBook = useWorldBookStore((s) => s.addBook);
  const setEditingBook = useWorldBookStore((s) => s.setEditingBook);
  const push = useSettingsNavStore((s) => s.push);

  const handleAdd = () => {
    const id = addBook();
    setEditingBook(id);
    push('worldBookEdit');
  };

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* 世界书列表 */}
      <div
        className="mx-4 mt-3 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {books.length === 0 ? (
          <div
            className="px-4 py-3"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            还没有世界书。
          </div>
        ) : (
          books.map((book, i) => {
            const activeCount = book.entries.filter((e) => e.enabled).length;
            const subtitle = book.description
              ? book.description
              : `${book.entries.length} 条条目${activeCount < book.entries.length ? `（${activeCount} 启用）` : ''}`;
            return (
              <div
                key={book.id}
                className="flex items-center gap-3 px-4"
                style={{
                  minHeight: 60,
                  borderBottom:
                    i === books.length - 1
                      ? 'none'
                      : '0.5px solid var(--color-separator)',
                  cursor: 'pointer',
                }}
                onClick={() => {
                  setEditingBook(book.id);
                  push('worldBookEdit');
                }}
              >
                {/* 状态圆点 */}
                <div
                  className="flex-shrink-0 rounded-full"
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: book.enabled
                      ? 'var(--color-systemGreen)'
                      : 'var(--color-systemGray4)',
                  }}
                />
                {/* 主体 */}
                <div className="min-w-0 flex-1">
                  <div
                    style={{
                      fontSize: 'var(--font-size-body)',
                      fontWeight: 500,
                      color: 'var(--color-label)',
                    }}
                  >
                    {book.name}
                  </div>
                  <div
                    className="truncate"
                    style={{
                      fontSize: 'var(--font-size-caption1)',
                      color: 'var(--color-secondaryLabel)',
                    }}
                  >
                    {subtitle}
                  </div>
                </div>
                <ChevronRight size={16} color="var(--color-tertiaryLabel)" />
              </div>
            );
          })
        )}
      </div>

      {/* 新建按钮 */}
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <button
          onClick={handleAdd}
          className="flex w-full items-center gap-3 px-4"
          style={{ minHeight: 44 }}
        >
          <Plus size={20} color="var(--color-systemBlue)" />
          <span
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-systemBlue)',
            }}
          >
            新建世界书
          </span>
        </button>
      </div>

      {/* 说明 */}
      <div
        className="mx-4"
        style={{
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
        }}
      >
        启用的世界书里，所有启用的条目会在每次 AI 对话时注入到系统提示词中。条目越多占用上下文越多，请自行控制规模。
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
