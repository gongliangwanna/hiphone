import { Trash2 } from 'lucide-react';
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

export function WorldBookEntryEditPage() {
  const bookId = useWorldBookStore((s) => s.editingBookId);
  const entryId = useWorldBookStore((s) => s.editingEntryId);
  const books = useWorldBookStore((s) => s.books);
  const updateEntry = useWorldBookStore((s) => s.updateEntry);
  const removeEntry = useWorldBookStore((s) => s.removeEntry);
  const pop = useSettingsNavStore((s) => s.pop);

  const book = books.find((b) => b.id === bookId);
  const entry = book?.entries.find((e) => e.id === entryId);

  if (!book || !entry) {
    return (
      <div
        className="flex h-full items-center justify-center"
        style={{
          backgroundColor: 'var(--color-secondarySystemBackground)',
          color: 'var(--color-secondaryLabel)',
          fontSize: 'var(--font-size-body)',
        }}
      >
        条目不存在
      </div>
    );
  }

  const patch = (p: Partial<typeof entry>) => updateEntry(book.id, entry.id, p);

  const handleRemoveEntry = () => {
    const title = entry.title.trim() || '未命名条目';
    if (!confirm(`确定删除「${title}」？此操作无法撤销。`)) return;
    removeEntry(book.id, entry.id);
    pop();
  };

  return (
    <div
      className="h-full overflow-auto"
      style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
    >
      {/* 标题 */}
      <SectionHeader title="标题" />
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <div
          className="flex items-center px-4"
          style={{ minHeight: 44 }}
        >
          <input
            type="text"
            value={entry.title}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder="比如：北境设定"
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
      </div>

      {/* 内容 */}
      <SectionHeader title="内容" />
      <div className="mx-4 mb-2">
        <TextArea
          value={entry.content}
          onChange={(v) => patch({ content: v })}
          placeholder="这条设定的具体内容……"
          rows={8}
          autoGrow
        />
      </div>
      <div
        className="mx-4 mb-5"
        style={{
          fontSize: 'var(--font-size-footnote)',
          color: 'var(--color-secondaryLabel)',
        }}
      >
        启用的条目会作为系统提示词的一部分注入到 AI 对话里。
      </div>

      {/* 启用 */}
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
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
            启用本条目
          </span>
          <Toggle value={entry.enabled} onChange={(v) => patch({ enabled: v })} />
        </div>
      </div>

      {/* 删除条目 */}
      <div
        className="mx-4 mb-5 overflow-hidden"
        style={{
          backgroundColor: 'var(--color-tertiarySystemBackground)',
          borderRadius: 'var(--radius-group)',
        }}
      >
        <button
          onClick={handleRemoveEntry}
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
            删除条目
          </span>
        </button>
      </div>

      <div style={{ height: 40 }} />
    </div>
  );
}
