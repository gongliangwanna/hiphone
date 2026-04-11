import { beforeEach, describe, expect, it } from 'vitest';
import { useWorldBookStore } from '../worldBookStore';

function resetStore() {
  useWorldBookStore.setState({
    books: [
      {
        id: 'wb-default',
        name: '我的世界书',
        description: '',
        enabled: true,
        entries: [],
        createdAt: 0,
        updatedAt: 0,
      },
    ],
    editingBookId: null,
    editingEntryId: null,
  });
}

describe('worldBookStore', () => {
  beforeEach(() => {
    resetStore();
  });

  describe('initial state', () => {
    it('has one default empty book', () => {
      const { books } = useWorldBookStore.getState();
      expect(books).toHaveLength(1);
      expect(books[0]!.name).toBe('我的世界书');
      expect(books[0]!.entries).toEqual([]);
      expect(books[0]!.enabled).toBe(true);
    });
  });

  describe('book CRUD', () => {
    it('addBook appends and returns id', () => {
      const id = useWorldBookStore.getState().addBook('测试书');
      const { books } = useWorldBookStore.getState();
      expect(books).toHaveLength(2);
      expect(books[1]!.id).toBe(id);
      expect(books[1]!.name).toBe('测试书');
      expect(books[1]!.enabled).toBe(true);
    });

    it('addBook with no name uses default', () => {
      const id = useWorldBookStore.getState().addBook();
      const book = useWorldBookStore.getState().books.find((b) => b.id === id)!;
      expect(book.name).toBe('未命名世界书');
    });

    it('updateBook patches fields and bumps updatedAt', () => {
      const before = Date.now();
      useWorldBookStore.getState().updateBook('wb-default', {
        name: '新名字',
        description: '新描述',
      });
      const book = useWorldBookStore.getState().books[0]!;
      expect(book.name).toBe('新名字');
      expect(book.description).toBe('新描述');
      expect(book.updatedAt).toBeGreaterThanOrEqual(before);
    });

    it('updateBook does not touch entries', () => {
      useWorldBookStore.getState().addEntry('wb-default', '条目 1');
      useWorldBookStore.getState().updateBook('wb-default', { name: '新' });
      const book = useWorldBookStore.getState().books[0]!;
      expect(book.entries).toHaveLength(1);
      expect(book.entries[0]!.title).toBe('条目 1');
    });

    it('removeBook deletes the book', () => {
      const id = useWorldBookStore.getState().addBook('临时');
      useWorldBookStore.getState().removeBook(id);
      const { books } = useWorldBookStore.getState();
      expect(books.find((b) => b.id === id)).toBeUndefined();
    });

    it('removeBook clears editing handoff if it was the one being edited', () => {
      const id = useWorldBookStore.getState().addBook('临时');
      useWorldBookStore.getState().setEditingBook(id);
      useWorldBookStore.getState().removeBook(id);
      expect(useWorldBookStore.getState().editingBookId).toBeNull();
    });

    it('toggleBook flips enabled', () => {
      useWorldBookStore.getState().toggleBook('wb-default');
      expect(useWorldBookStore.getState().books[0]!.enabled).toBe(false);
      useWorldBookStore.getState().toggleBook('wb-default');
      expect(useWorldBookStore.getState().books[0]!.enabled).toBe(true);
    });
  });

  describe('entry CRUD', () => {
    it('addEntry appends with increasing order and returns id', () => {
      const id1 = useWorldBookStore.getState().addEntry('wb-default', '第一条');
      const id2 = useWorldBookStore.getState().addEntry('wb-default', '第二条');
      const book = useWorldBookStore.getState().books[0]!;
      expect(book.entries).toHaveLength(2);
      expect(book.entries[0]!.id).toBe(id1);
      expect(book.entries[1]!.id).toBe(id2);
      expect(book.entries[1]!.order).toBeGreaterThan(book.entries[0]!.order);
    });

    it('addEntry with no title uses default', () => {
      useWorldBookStore.getState().addEntry('wb-default');
      const book = useWorldBookStore.getState().books[0]!;
      expect(book.entries[0]!.title).toBe('新条目');
    });

    it('updateEntry patches a single entry', () => {
      const id = useWorldBookStore.getState().addEntry('wb-default', '旧');
      useWorldBookStore
        .getState()
        .updateEntry('wb-default', id, { title: '新', content: '正文' });
      const entry = useWorldBookStore.getState().books[0]!.entries[0]!;
      expect(entry.title).toBe('新');
      expect(entry.content).toBe('正文');
    });

    it('removeEntry removes only that entry', () => {
      const id1 = useWorldBookStore.getState().addEntry('wb-default', 'A');
      const id2 = useWorldBookStore.getState().addEntry('wb-default', 'B');
      useWorldBookStore.getState().removeEntry('wb-default', id1);
      const book = useWorldBookStore.getState().books[0]!;
      expect(book.entries).toHaveLength(1);
      expect(book.entries[0]!.id).toBe(id2);
    });

    it('removeEntry clears editingEntryId if it was being edited', () => {
      const id = useWorldBookStore.getState().addEntry('wb-default', 'X');
      useWorldBookStore.getState().setEditingEntry(id);
      useWorldBookStore.getState().removeEntry('wb-default', id);
      expect(useWorldBookStore.getState().editingEntryId).toBeNull();
    });

    it('toggleEntry flips enabled', () => {
      const id = useWorldBookStore.getState().addEntry('wb-default', 'X');
      expect(useWorldBookStore.getState().books[0]!.entries[0]!.enabled).toBe(true);
      useWorldBookStore.getState().toggleEntry('wb-default', id);
      expect(useWorldBookStore.getState().books[0]!.entries[0]!.enabled).toBe(false);
    });
  });

  describe('editing handoff', () => {
    it('setEditingBook / setEditingEntry updates state', () => {
      useWorldBookStore.getState().setEditingBook('wb-default');
      useWorldBookStore.getState().setEditingEntry('e1');
      expect(useWorldBookStore.getState().editingBookId).toBe('wb-default');
      expect(useWorldBookStore.getState().editingEntryId).toBe('e1');
    });

    it('setEditingBook(null) clears', () => {
      useWorldBookStore.getState().setEditingBook('wb-default');
      useWorldBookStore.getState().setEditingBook(null);
      expect(useWorldBookStore.getState().editingBookId).toBeNull();
    });
  });

  describe('buildSystemPromptChunk', () => {
    it('returns empty string when no enabled entries exist', () => {
      expect(useWorldBookStore.getState().buildSystemPromptChunk()).toBe('');
    });

    it('returns empty string when book is disabled even if entries are enabled', () => {
      const id = useWorldBookStore.getState().addEntry('wb-default', '条目');
      useWorldBookStore
        .getState()
        .updateEntry('wb-default', id, { content: '内容' });
      useWorldBookStore.getState().toggleBook('wb-default'); // disable
      expect(useWorldBookStore.getState().buildSystemPromptChunk()).toBe('');
    });

    it('skips entries that are disabled', () => {
      const id = useWorldBookStore.getState().addEntry('wb-default', '条目');
      useWorldBookStore
        .getState()
        .updateEntry('wb-default', id, { content: '内容' });
      useWorldBookStore.getState().toggleEntry('wb-default', id);
      expect(useWorldBookStore.getState().buildSystemPromptChunk()).toBe('');
    });

    it('skips entries with empty title and empty content', () => {
      useWorldBookStore.getState().addEntry('wb-default', '');
      useWorldBookStore
        .getState()
        .updateEntry('wb-default', useWorldBookStore.getState().books[0]!.entries[0]!.id, {
          title: '',
          content: '',
        });
      expect(useWorldBookStore.getState().buildSystemPromptChunk()).toBe('');
    });

    it('returns single formatted entry', () => {
      const id = useWorldBookStore.getState().addEntry('wb-default', '北境');
      useWorldBookStore
        .getState()
        .updateEntry('wb-default', id, { content: '北境是七大家族的领土。' });
      const chunk = useWorldBookStore.getState().buildSystemPromptChunk();
      expect(chunk).toBe('[世界书]\n## 北境\n北境是七大家族的领土。');
    });

    it('joins multiple entries with double newline, sorted by order', () => {
      const idA = useWorldBookStore.getState().addEntry('wb-default', 'A');
      const idB = useWorldBookStore.getState().addEntry('wb-default', 'B');
      useWorldBookStore.getState().updateEntry('wb-default', idA, {
        content: 'aaa',
        order: 30,
      });
      useWorldBookStore.getState().updateEntry('wb-default', idB, {
        content: 'bbb',
        order: 10,
      });
      const chunk = useWorldBookStore.getState().buildSystemPromptChunk();
      expect(chunk).toBe('[世界书]\n## B\nbbb\n\n## A\naaa');
    });

    it('combines entries from multiple enabled books', () => {
      const id1 = useWorldBookStore.getState().addEntry('wb-default', '条目1');
      useWorldBookStore
        .getState()
        .updateEntry('wb-default', id1, { content: '内容1' });

      const book2Id = useWorldBookStore.getState().addBook('第二本');
      const id2 = useWorldBookStore.getState().addEntry(book2Id, '条目2');
      useWorldBookStore.getState().updateEntry(book2Id, id2, { content: '内容2' });

      const chunk = useWorldBookStore.getState().buildSystemPromptChunk();
      expect(chunk).toContain('[世界书]');
      expect(chunk).toContain('## 条目1\n内容1');
      expect(chunk).toContain('## 条目2\n内容2');
    });

    it('uses fallback title for empty-title entries with content', () => {
      const id = useWorldBookStore.getState().addEntry('wb-default');
      useWorldBookStore
        .getState()
        .updateEntry('wb-default', id, { title: '', content: '有内容' });
      const chunk = useWorldBookStore.getState().buildSystemPromptChunk();
      expect(chunk).toBe('[世界书]\n## 未命名条目\n有内容');
    });
  });
});
