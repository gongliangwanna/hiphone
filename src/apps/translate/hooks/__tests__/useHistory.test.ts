import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHistory, HISTORY_CAP } from '../useHistory';
import type { HistoryEntry } from '../useHistory';
import { CURATED_LANGUAGES } from '../../constants/languages';

const ZH = CURATED_LANGUAGES.find((l) => l.code === 'zh')!;
const EN = CURATED_LANGUAGES.find((l) => l.code === 'en')!;
const JA = CURATED_LANGUAGES.find((l) => l.code === 'ja')!;

const storageMap = new Map<string, unknown>();
const setMock = vi.fn(async (k: string, v: unknown) => {
  storageMap.set(k, v);
});
vi.mock('@hiphone/storage', () => ({
  get: vi.fn(async (k: string) => storageMap.get(k)),
  set: (k: string, v: unknown) => setMock(k, v),
}));

const toastErrorMock = vi.fn();
vi.mock('@hiphone/toast', () => ({
  error: (...args: unknown[]) => toastErrorMock(...args),
  show: vi.fn(),
}));

describe('useHistory', () => {
  beforeEach(() => {
    storageMap.clear();
    setMock.mockReset();
    setMock.mockImplementation(async (k: string, v: unknown) => {
      storageMap.set(k, v);
    });
    toastErrorMock.mockReset();
  });

  it('starts empty and marks loaded after initial fetch', async () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.history).toEqual([]);
    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
  });

  it('addEntry adds new entry to head', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.addEntry({
        sourceText: '你好',
        targetText: 'Hello',
        sourceLang: ZH,
        targetLang: EN,
      });
    });
    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0]!.sourceText).toBe('你好');
    expect(result.current.history[0]!.targetText).toBe('Hello');
  });

  it('addEntry dedupes by (sourceText, srcCode, tgtCode), promotes & keeps id', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let firstId = '';
    await act(async () => {
      const e = await result.current.addEntry({
        sourceText: '你好',
        targetText: 'Hello',
        sourceLang: ZH,
        targetLang: EN,
      });
      firstId = e.id;
    });
    await act(async () => {
      await result.current.addEntry({
        sourceText: '世界',
        targetText: 'World',
        sourceLang: ZH,
        targetLang: EN,
      });
    });
    await act(async () => {
      const e = await result.current.addEntry({
        sourceText: '你好',
        targetText: 'Hi there',
        sourceLang: ZH,
        targetLang: EN,
      });
      expect(e.id).toBe(firstId); // promoted, same id
    });
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]!.id).toBe(firstId);
    expect(result.current.history[0]!.targetText).toBe('Hi there'); // updated
  });

  it('caps history at HISTORY_CAP, FIFO drops oldest', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      for (let i = 0; i < HISTORY_CAP + 5; i++) {
        await result.current.addEntry({
          sourceText: `text-${i}`,
          targetText: `out-${i}`,
          sourceLang: ZH,
          targetLang: EN,
        });
      }
    });
    expect(result.current.history).toHaveLength(HISTORY_CAP);
    expect(result.current.history[0]!.sourceText).toBe(`text-${HISTORY_CAP + 4}`);
    // oldest 5 dropped
    expect(result.current.history.find((e) => e.sourceText === 'text-0')).toBeUndefined();
  });

  it('deleteHistory removes by id and persists', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let id = '';
    await act(async () => {
      const e = await result.current.addEntry({
        sourceText: 'a',
        targetText: 'A',
        sourceLang: ZH,
        targetLang: EN,
      });
      id = e.id;
    });
    await act(async () => {
      await result.current.deleteHistory(id);
    });
    expect(result.current.history).toEqual([]);
    expect(storageMap.get('history')).toEqual([]);
  });

  it('toggleFavorite adds and removes from favorites', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    let entry!: HistoryEntry;
    await act(async () => {
      entry = await result.current.addEntry({
        sourceText: 'a',
        targetText: 'A',
        sourceLang: ZH,
        targetLang: EN,
      });
    });
    expect(result.current.isFavorited(entry.id)).toBe(false);
    await act(async () => {
      await result.current.toggleFavorite(entry);
    });
    expect(result.current.isFavorited(entry.id)).toBe(true);
    expect(result.current.favorites).toHaveLength(1);
    await act(async () => {
      await result.current.toggleFavorite(entry);
    });
    expect(result.current.isFavorited(entry.id)).toBe(false);
    expect(result.current.favorites).toHaveLength(0);
  });

  it('different language pairs are distinct entries (no dedup)', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => {
      await result.current.addEntry({
        sourceText: '你好',
        targetText: 'Hello',
        sourceLang: ZH,
        targetLang: EN,
      });
      await result.current.addEntry({
        sourceText: '你好',
        targetText: 'こんにちは',
        sourceLang: ZH,
        targetLang: JA,
      });
    });
    expect(result.current.history).toHaveLength(2);
  });

  it('hydrates from storage on mount', async () => {
    storageMap.set('history', [
      {
        id: 'preset',
        sourceText: 'x',
        targetText: 'X',
        sourceLang: ZH,
        targetLang: EN,
        ts: 1,
      },
    ]);
    storageMap.set('favorites', [
      {
        id: 'preset',
        sourceText: 'x',
        targetText: 'X',
        sourceLang: ZH,
        targetLang: EN,
        ts: 1,
        favoritedAt: 2,
      },
    ]);
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.history).toHaveLength(1);
    expect(result.current.favorites).toHaveLength(1);
    expect(result.current.isFavorited('preset')).toBe(true);
  });

  it('toasts "保存失败" when storage.set rejects (spec §3.8)', async () => {
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    setMock.mockRejectedValueOnce(new Error('quota exceeded'));
    await act(async () => {
      await result.current.addEntry({
        sourceText: 'a',
        targetText: 'A',
        sourceLang: ZH,
        targetLang: EN,
      });
    });
    expect(toastErrorMock).toHaveBeenCalledWith('保存失败');
    expect(result.current.history).toHaveLength(1);
  });
});
