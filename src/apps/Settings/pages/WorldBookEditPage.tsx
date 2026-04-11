import { ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useWorldBookStore } from '@/platform/stores/worldBookStore';
import { useSettingsNavStore } from '../settingsNavStore';
import { TextArea, Toggle } from '@/system';

function SectionHeader({ title }: { title: string }) {
  return (
    <div
      className="px-4 pb-1 pt-2"
      style={{
        fontSize: 'var(--font-size-footnote)',
        color: 'var(--color-secondaryLabel)',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </div>
  );
}

export function WorldBookEditPage() {
  const bookId = useWorldBookStore((s) => s.editingBookId);
  const books = useWorldBookStore((s) => s.books);
  const updateBook = useWorldBookStore((s) => s.updateBook);
  const toggleBook = useWorldBookStore((s) => s.toggleBook);
  const removeBook = useWorldBookStore((s) => s.removeBook);
  const addEntry = useWorldBookStore((s) => s.addEntry);
  const setEditingEntry = useWorldBookStore((s) => s.setEditingEntry);
  const push = useSettingsNavStore((s) => s.push);
  const pop = useSettingsNavStore((s) => s.pop);

  const book = books.find((b) => b.id === bookId);

  if (!book) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          backgroundColor: 'var(--color-secondarySystemBackground)',
          color: 'var(--color-secondaryLabel)',
          fontSize: 'var(--font-size-body)',
        }}
      >
        世界书不存在
      </div>
    );
  }

  const patch = (p: Partial<typeof book>) => updateBook(book.id, p);

  const handleAddEntry = () => {
    const id = addEntry(book.id);
    setEditingEntry(id);
    push('worldBookEntryEdit');
  };

  const handleRemoveBook = () => {
    if (!confirm(`确定删除《${book.name}》？此操作无法撤销。`)) return;
    removeBook(book.id);
    pop();
  };

  // 条目按 order 升序
  const sortedEntries = [...book.entries].sort((a, b) => a.order - b.order);

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* 基本信息 */}
      <SectionHeader title="基本信息" />
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {/* 名称 */}
        <div
          className="flex items-center gap-2 px-4"
          style={{
            minHeight: 44,
            borderBottom: '0.5px solid var(--color-separator)',
          }}
        >
          <span
            className="flex-shrink-0"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
              width: 60,
            }}
          >
            名称
          </span>
          <input
            type="text"
            value={book.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder="世界书名称"
            className="min-w-0 flex-1"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
            }}
          />
        </div>

        {/* 启用 */}
        <div
          className="flex items-center justify-between px-4"
          style={{ minHeight: 44 }}
        >
          <span
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-label)',
            }}
          >
            启用
          </span>
          <Toggle value={book.enabled} onChange={() => toggleBook(book.id)} />
        </div>
      </div>

      {/* 描述 */}
      <SectionHeader title="描述（仅自己看）" />
      <div className="mx-4 mb-5">
        <TextArea
          value={book.description}
          onChange={(v) => patch({ description: v })}
          placeholder="给自己看的备注，不会发送给 AI"
          rows={2}
          autoGrow
        />
      </div>

      {/* 条目列表 */}
      <SectionHeader title={`条目 (${sortedEntries.length})`} />
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        {sortedEntries.length === 0 ? (
          <div
            className="px-4 py-3"
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-secondaryLabel)',
            }}
          >
            还没有条目，点击下方「添加条目」开始。
          </div>
        ) : (
          sortedEntries.map((entry, i) => (
            <div
              key={entry.id}
              className="flex items-center gap-3 px-4"
              style={{
                minHeight: 54,
                borderBottom:
                  i === sortedEntries.length - 1
                    ? 'none'
                    : '0.5px solid var(--color-separator)',
                cursor: 'pointer',
              }}
              onClick={() => {
                setEditingEntry(entry.id);
                push('worldBookEntryEdit');
              }}
            >
              {/* 状态小圆点 */}
              <div
                className="flex-shrink-0 rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  backgroundColor: entry.enabled
                    ? 'var(--color-systemGreen)'
                    : 'var(--color-systemGray4)',
                }}
              />
              {/* 标题 + 内容预览 */}
              <div className="min-w-0 flex-1">
                <div
                  style={{
                    fontSize: 'var(--font-size-body)',
                    fontWeight: 500,
                    color: 'var(--color-label)',
                  }}
                >
                  {entry.title || '未命名条目'}
                </div>
                {entry.content && (
                  <div
                    className="truncate"
                    style={{
                      fontSize: 'var(--font-size-caption1)',
                      color: 'var(--color-secondaryLabel)',
                    }}
                  >
                    {entry.content.slice(0, 40)}
                  </div>
                )}
              </div>
              <ChevronRight size={16} color="var(--color-tertiaryLabel)" />
            </div>
          ))
        )}
      </div>

      {/* 添加条目 */}
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <button
          onClick={handleAddEntry}
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
            添加条目
          </span>
        </button>
      </div>

      {/* 删除世界书 */}
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <button
          onClick={handleRemoveBook}
          className="flex w-full items-center justify-center gap-2 px-4"
          style={{ minHeight: 44 }}
        >
          <Trash2 size={18} color="var(--color-systemRed)" />
          <span
            style={{
              fontSize: 'var(--font-size-body)',
              color: 'var(--color-systemRed)',
            }}
          >
            删除世界书
          </span>
        </button>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
