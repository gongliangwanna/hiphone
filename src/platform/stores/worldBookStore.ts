import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';

/**
 * World Book — 一组纯文本设定，所有启用的条目会全量注入 system prompt。
 * 一期不做关键词匹配 / 不做角色绑定 / 全局生效。
 * 详见 docs/plan/2026-04-11-1302-世界书配置-S1.md
 */

export interface WorldBookEntry {
  id: string;
  title: string;
  content: string;
  enabled: boolean;
  order: number;
}

export interface WorldBook {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  entries: WorldBookEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldBookState {
  books: WorldBook[];
  editingBookId: string | null;
  editingEntryId: string | null;

  // 世界书 CRUD
  addBook: (name?: string) => string;
  updateBook: (
    id: string,
    patch: Partial<Omit<WorldBook, 'id' | 'entries' | 'createdAt'>>,
  ) => void;
  removeBook: (id: string) => void;
  toggleBook: (id: string) => void;

  // 条目 CRUD
  addEntry: (bookId: string, title?: string) => string;
  updateEntry: (
    bookId: string,
    entryId: string,
    patch: Partial<Omit<WorldBookEntry, 'id'>>,
  ) => void;
  removeEntry: (bookId: string, entryId: string) => void;
  toggleEntry: (bookId: string, entryId: string) => void;

  // 编辑 handoff（非持久化）
  setEditingBook: (id: string | null) => void;
  setEditingEntry: (id: string | null) => void;

  // Prompt 注入
  buildSystemPromptChunk: () => string;
}

let nextId = 1;
function genId(prefix: string): string {
  return `${prefix}-${Date.now()}-${nextId++}`;
}

const DEFAULT_BOOK: WorldBook = {
  id: 'wb-default',
  name: '我的世界书',
  description: '用来记录世界观、设定、规则等长期不变的背景知识。',
  enabled: true,
  entries: [],
  createdAt: 0,
  updatedAt: 0,
};

export const useWorldBookStore = create<WorldBookState>()(
  persist(
    (set, get) => ({
      books: [DEFAULT_BOOK],
      editingBookId: null,
      editingEntryId: null,

      addBook: (name) => {
        const id = genId('wb');
        const now = Date.now();
        const book: WorldBook = {
          id,
          name: name ?? '未命名世界书',
          description: '',
          enabled: true,
          entries: [],
          createdAt: now,
          updatedAt: now,
        };
        set((s) => ({ books: [...s.books, book] }));
        return id;
      },

      updateBook: (id, patch) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id ? { ...b, ...patch, updatedAt: Date.now() } : b,
          ),
        })),

      removeBook: (id) =>
        set((s) => ({
          books: s.books.filter((b) => b.id !== id),
          editingBookId: s.editingBookId === id ? null : s.editingBookId,
          editingEntryId: s.editingBookId === id ? null : s.editingEntryId,
        })),

      toggleBook: (id) =>
        set((s) => ({
          books: s.books.map((b) =>
            b.id === id ? { ...b, enabled: !b.enabled, updatedAt: Date.now() } : b,
          ),
        })),

      addEntry: (bookId, title) => {
        const id = genId('wbe');
        set((s) => ({
          books: s.books.map((b) => {
            if (b.id !== bookId) return b;
            const maxOrder = b.entries.reduce((m, e) => Math.max(m, e.order), 0);
            const entry: WorldBookEntry = {
              id,
              title: title ?? '新条目',
              content: '',
              enabled: true,
              order: maxOrder + 10,
            };
            return { ...b, entries: [...b.entries, entry], updatedAt: Date.now() };
          }),
        }));
        return id;
      },

      updateEntry: (bookId, entryId, patch) =>
        set((s) => ({
          books: s.books.map((b) => {
            if (b.id !== bookId) return b;
            return {
              ...b,
              entries: b.entries.map((e) =>
                e.id === entryId ? { ...e, ...patch } : e,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),

      removeEntry: (bookId, entryId) =>
        set((s) => ({
          books: s.books.map((b) => {
            if (b.id !== bookId) return b;
            return {
              ...b,
              entries: b.entries.filter((e) => e.id !== entryId),
              updatedAt: Date.now(),
            };
          }),
          editingEntryId:
            s.editingEntryId === entryId ? null : s.editingEntryId,
        })),

      toggleEntry: (bookId, entryId) =>
        set((s) => ({
          books: s.books.map((b) => {
            if (b.id !== bookId) return b;
            return {
              ...b,
              entries: b.entries.map((e) =>
                e.id === entryId ? { ...e, enabled: !e.enabled } : e,
              ),
              updatedAt: Date.now(),
            };
          }),
        })),

      setEditingBook: (id) => set({ editingBookId: id }),
      setEditingEntry: (id) => set({ editingEntryId: id }),

      buildSystemPromptChunk: () => {
        const { books } = get();
        const lines: string[] = [];
        for (const book of books) {
          if (!book.enabled) continue;
          const activeEntries = book.entries
            .filter((e) => e.enabled && (e.title.trim() || e.content.trim()))
            .sort((a, b) => a.order - b.order);
          for (const entry of activeEntries) {
            const title = entry.title.trim() || '未命名条目';
            const content = entry.content.trim();
            lines.push(`## ${title}\n${content}`);
          }
        }
        if (lines.length === 0) return '';
        return `[世界书]\n${lines.join('\n\n')}`;
      },
    }),
    {
      name: 'hiPhone-world-books',
      storage: idbStorage,
      partialize: (s) => ({ books: s.books }),
    },
  ),
);
