import { describe, it, expect, beforeEach } from 'vitest';
import { useSafariStore } from '../safariStore';

beforeEach(() => {
  useSafariStore.getState().reset();
});

describe('safariStore — isLoading', () => {
  it('defaults to false', () => {
    expect(useSafariStore.getState().isLoading).toBe(false);
  });

  it('setLoading sets isLoading', () => {
    useSafariStore.getState().setLoading(true);
    expect(useSafariStore.getState().isLoading).toBe(true);
    useSafariStore.getState().setLoading(false);
    expect(useSafariStore.getState().isLoading).toBe(false);
  });

  it('navigateTo sets isLoading to true', () => {
    useSafariStore.getState().navigateTo('https://apple.com');
    expect(useSafariStore.getState().isLoading).toBe(true);
  });

  it('reset clears isLoading', () => {
    useSafariStore.getState().setLoading(true);
    useSafariStore.getState().reset();
    expect(useSafariStore.getState().isLoading).toBe(false);
  });
});

describe('safariStore — searchHistory', () => {
  it('defaults to empty array', () => {
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });

  it('navigateTo with search query adds to searchHistory', () => {
    useSafariStore.getState().navigateTo('apple news');
    expect(useSafariStore.getState().searchHistory).toContain('apple news');
  });

  it('navigateTo with URL does not add to searchHistory', () => {
    useSafariStore.getState().navigateTo('https://apple.com');
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });

  it('searchHistory deduplicates entries', () => {
    useSafariStore.getState().navigateTo('apple news');
    useSafariStore.getState().navigateTo('apple news');
    const history = useSafariStore.getState().searchHistory;
    expect(history.filter((h) => h === 'apple news')).toHaveLength(1);
  });

  it('searchHistory keeps max 10 entries', () => {
    for (let i = 0; i < 12; i++) {
      useSafariStore.getState().navigateTo(`query ${i}`);
    }
    expect(useSafariStore.getState().searchHistory).toHaveLength(10);
    expect(useSafariStore.getState().searchHistory[0]).toBe('query 11');
  });

  it('clearSearchHistory empties the array', () => {
    useSafariStore.getState().navigateTo('test query');
    useSafariStore.getState().clearSearchHistory();
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });

  it('reset clears searchHistory', () => {
    useSafariStore.getState().navigateTo('test');
    useSafariStore.getState().reset();
    expect(useSafariStore.getState().searchHistory).toEqual([]);
  });
});
