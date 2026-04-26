import { useEffect, useState, useCallback, useRef } from 'react';
import { get, set } from '@hiphone/storage';
import { error as toastError } from '@hiphone/toast';
import type { Language } from '../constants/languages';

export const HISTORY_CAP = 50;
const HISTORY_KEY = 'history';
const FAVORITES_KEY = 'favorites';

export interface HistoryEntry {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: Language;
  targetLang: Language;
  ts: number;
}

export interface FavoriteEntry extends HistoryEntry {
  favoritedAt: number;
}

export interface UseHistoryResult {
  history: HistoryEntry[];
  favorites: FavoriteEntry[];
  loaded: boolean;
  addEntry: (input: {
    sourceText: string;
    targetText: string;
    sourceLang: Language;
    targetLang: Language;
  }) => Promise<HistoryEntry>;
  deleteHistory: (id: string) => Promise<void>;
  isFavorited: (id: string) => boolean;
  toggleFavorite: (entry: HistoryEntry) => Promise<void>;
}

function dedupeKey(text: string, src: Language, tgt: Language): string {
  return `${text}|${src.code}|${tgt.code}`;
}

function genId(): string {
  // crypto.randomUUID 沙箱可用（spec §2.5 navigator/crypto 未遮蔽）
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useHistory(): UseHistoryResult {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Load from storage on mount. Failures logged but don't block UI.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [h, f] = await Promise.all([get(HISTORY_KEY), get(FAVORITES_KEY)]);
        if (cancelled) return;
        if (Array.isArray(h)) setHistory(h as HistoryEntry[]);
        if (Array.isArray(f)) setFavorites(f as FavoriteEntry[]);
      } catch (e) {
        console.warn('[translate] history load failed', e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Read history via ref to avoid stale closures in addEntry.
  // Also updated eagerly inside persist* so back-to-back calls within
  // a single React render batch see the latest value.
  const historyRef = useRef(history);
  historyRef.current = history;
  const favoritesRef = useRef(favorites);
  favoritesRef.current = favorites;

  // Always write through current state — guards against in-flight set
  // batches racing each other.
  const persistHistory = useCallback(async (next: HistoryEntry[]) => {
    historyRef.current = next; // keep ref in sync for back-to-back calls
    setHistory(next);
    try {
      await set(HISTORY_KEY, next);
    } catch (e) {
      console.warn('[translate] history save failed', e);
      toastError('保存失败');
    }
  }, []);

  const persistFavorites = useCallback(async (next: FavoriteEntry[]) => {
    favoritesRef.current = next; // keep ref in sync for back-to-back calls
    setFavorites(next);
    try {
      await set(FAVORITES_KEY, next);
    } catch (e) {
      console.warn('[translate] favorites save failed', e);
      toastError('保存失败');
    }
  }, []);

  const addEntry = useCallback(
    async (input: {
      sourceText: string;
      targetText: string;
      sourceLang: Language;
      targetLang: Language;
    }) => {
      const key = dedupeKey(input.sourceText, input.sourceLang, input.targetLang);
      const existing = historyRef.current.find(
        (e) => dedupeKey(e.sourceText, e.sourceLang, e.targetLang) === key,
      );
      const ts = Date.now();
      let entry: HistoryEntry;
      let next: HistoryEntry[];
      if (existing) {
        // Promote: keep id (favorite linkage), refresh ts + targetText.
        entry = { ...existing, targetText: input.targetText, ts };
        next = [entry, ...historyRef.current.filter((e) => e.id !== existing.id)];
      } else {
        entry = { id: genId(), ...input, ts };
        next = [entry, ...historyRef.current].slice(0, HISTORY_CAP);
      }
      await persistHistory(next);
      return entry;
    },
    [persistHistory],
  );

  const deleteHistory = useCallback(
    async (id: string) => {
      const next = historyRef.current.filter((e) => e.id !== id);
      await persistHistory(next);
    },
    [persistHistory],
  );

  const isFavorited = useCallback((id: string) => favoritesRef.current.some((f) => f.id === id), []);

  const toggleFavorite = useCallback(
    async (entry: HistoryEntry) => {
      const idx = favoritesRef.current.findIndex((f) => f.id === entry.id);
      const next: FavoriteEntry[] =
        idx >= 0
          ? favoritesRef.current.filter((f) => f.id !== entry.id)
          : [{ ...entry, favoritedAt: Date.now() }, ...favoritesRef.current];
      await persistFavorites(next);
    },
    [persistFavorites],
  );

  return { history, favorites, loaded, addEntry, deleteHistory, isFavorited, toggleFavorite };
}
