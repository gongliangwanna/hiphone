import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Song } from '../data';

vi.mock('../itunesApi', () => ({
  fetchFeaturedFromMeting: vi.fn(),
  searchTracks: vi.fn(),
  lookupAlbum: vi.fn(),
  fetchLyrics: vi.fn(),
}));

const { fetchFeaturedFromMeting } = await import('../itunesApi');
const { useMusicDataStore } = await import('../musicDataStore');

const mockedFetchFeatured = vi.mocked(fetchFeaturedFromMeting);

function makeSongs(prefix: string, count = 8): Song[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    title: `${prefix} song ${index + 1}`,
    artist: `${prefix} artist`,
    album: `${prefix} album`,
    albumId: `${prefix}-album-${index + 1}`,
    duration: 180 + index,
    artworkUrl: `https://example.com/${prefix}-${index + 1}.jpg`,
    previewUrl: `https://example.com/${prefix}-${index + 1}.m4a`,
  }));
}

function resetMusicDataStore() {
  useMusicDataStore.setState({
    currentSongId: null,
    isPlaying: false,
    progress: 0,
    queue: [],
    shuffle: false,
    repeat: 'off',
    isBuffering: false,
    failedSongName: null,
    songMap: {},
    albumMap: {},
    featuredIds: [],
    featuredFetchedDate: null,
    searchResultIds: [],
    searchQuery: '',
    isLoadingFeatured: false,
    isSearching: false,
    albumSongIds: {},
    lyricsCache: {},
    isLoadingLyrics: false,
  });
}

describe('musicDataStore daily featured refresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-30T10:00:00+08:00'));
    mockedFetchFeatured.mockReset();
    resetMusicDataStore();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores the local fetch date and skips duplicate requests on the same day', async () => {
    mockedFetchFeatured.mockResolvedValue(makeSongs('today'));

    await useMusicDataStore.getState().fetchFeatured();
    await useMusicDataStore.getState().fetchFeatured();

    const state = useMusicDataStore.getState();
    expect(mockedFetchFeatured).toHaveBeenCalledTimes(1);
    expect(state.featuredFetchedDate).toBe('2026-04-30');
    expect(state.featuredIds).toHaveLength(8);
  });

  it('refreshes cached featured content when the local date changes', async () => {
    const oldSongs = makeSongs('old', 4);
    useMusicDataStore.setState({
      featuredFetchedDate: '2026-04-29',
      featuredIds: oldSongs.map((song) => song.id),
      queue: oldSongs.map((song) => song.id),
      songMap: Object.fromEntries(oldSongs.map((song) => [song.id, song])),
    });
    mockedFetchFeatured.mockResolvedValue(makeSongs('new', 5));

    await useMusicDataStore.getState().fetchFeatured();

    const state = useMusicDataStore.getState();
    expect(mockedFetchFeatured).toHaveBeenCalledTimes(1);
    expect(state.featuredFetchedDate).toBe('2026-04-30');
    expect(state.featuredIds).toHaveLength(5);
    expect(state.featuredIds.every((id) => id.startsWith('new-'))).toBe(true);
    expect(state.queue).toEqual(state.featuredIds);
  });

  it('uses a different stable order for the same songs on different dates', async () => {
    const songs = makeSongs('daily', 12);
    mockedFetchFeatured.mockResolvedValue(songs);

    await useMusicDataStore.getState().fetchFeatured();
    const firstOrder = useMusicDataStore.getState().featuredIds;

    vi.setSystemTime(new Date('2026-05-01T10:00:00+08:00'));
    useMusicDataStore.setState({ featuredFetchedDate: '2026-04-30' });
    await useMusicDataStore.getState().fetchFeatured();
    const secondOrder = useMusicDataStore.getState().featuredIds;

    expect(firstOrder).toHaveLength(12);
    expect(secondOrder).toHaveLength(12);
    expect(new Set(secondOrder)).toEqual(new Set(firstOrder));
    expect(secondOrder).not.toEqual(firstOrder);
  });
});
