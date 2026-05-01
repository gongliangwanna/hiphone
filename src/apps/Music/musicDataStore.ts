import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { idbStorage } from '@/platform/storage/idbStorage';
import type { Song, Album, LrcLine } from './data';
import { searchTracks, fetchFeaturedFromMeting, lookupAlbum, fetchLyrics } from './itunesApi';

interface MusicDataState {
  // ── Playback ──
  currentSongId: string | null;
  isPlaying: boolean;
  progress: number;
  queue: string[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';
  isBuffering: boolean;
  /** Name of song that just failed to load (shown as toast, cleared after timeout) */
  failedSongName: string | null;

  // ── Song / Album cache ──
  songMap: Record<string, Song>;
  albumMap: Record<string, Album>;

  // ── Content (fetched from API) ──
  featuredIds: string[];
  featuredFetchedDate: string | null;
  searchResultIds: string[];
  searchQuery: string;
  isLoadingFeatured: boolean;
  isSearching: boolean;
  albumSongIds: Record<string, string[]>; // albumId → song IDs
  lyricsCache: Record<string, LrcLine[]>; // songId → parsed lyrics
  isLoadingLyrics: boolean;

  // ── Playback actions ──
  playSong: (songId: string, queue?: string[]) => void;
  togglePlay: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  setProgress: (progress: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setBuffering: (v: boolean) => void;
  showFailedToast: (name: string) => void;

  // ── Data actions ──
  addSongs: (songs: Song[]) => void;
  fetchFeatured: () => Promise<void>;
  search: (query: string) => Promise<void>;
  fetchAlbum: (albumId: string) => Promise<void>;
  loadLyrics: (songId: string) => Promise<void>;
}

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysSinceEpoch(dateKey: string): number {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return 0;
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function orderSongsForDate(songs: Song[], dateKey: string): Song[] {
  if (songs.length <= 1) return songs;
  const offset = daysSinceEpoch(dateKey) % songs.length;
  return [...songs.slice(offset), ...songs.slice(0, offset)];
}

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((id, index) => id === b[index]);
}

export const useMusicDataStore = create<MusicDataState>()(
  persist(
    (set, get) => ({
      // Playback
      currentSongId: null,
      isPlaying: false,
      progress: 0,
      queue: [],
      shuffle: false,
      repeat: 'off',
      isBuffering: false,
      failedSongName: null,

      // Caches
      songMap: {},
      albumMap: {},

      // Content
      featuredIds: [],
      featuredFetchedDate: null,
      searchResultIds: [],
      searchQuery: '',
      isLoadingFeatured: false,
      isSearching: false,
      albumSongIds: {},
      lyricsCache: {},
      isLoadingLyrics: false,

      // ── Playback actions ──

      playSong: (songId, queue) =>
        set({
          currentSongId: songId,
          isPlaying: true,
          progress: 0,
          ...(queue ? { queue } : {}),
        }),

      togglePlay: () => set((s) => ({ isPlaying: !s.isPlaying })),

      skipNext: () => {
        const { currentSongId, queue, repeat, shuffle } = get();
        if (!currentSongId || queue.length === 0) return;

        if (repeat === 'one') {
          set({ progress: 0 });
          return;
        }

        const idx = queue.indexOf(currentSongId);
        let nextIdx: number;
        if (shuffle) {
          nextIdx = Math.floor(Math.random() * queue.length);
        } else if (idx < queue.length - 1) {
          nextIdx = idx + 1;
        } else if (repeat === 'all') {
          nextIdx = 0;
        } else {
          set({ isPlaying: false });
          return;
        }
        set({ currentSongId: queue[nextIdx], progress: 0 });
      },

      skipPrev: () => {
        const { currentSongId, queue, progress } = get();
        if (!currentSongId || queue.length === 0) return;
        if (progress > 3) {
          set({ progress: 0 });
          return;
        }
        const idx = queue.indexOf(currentSongId);
        const prevIdx = idx > 0 ? idx - 1 : queue.length - 1;
        set({ currentSongId: queue[prevIdx], progress: 0 });
      },

      setProgress: (progress) => set({ progress }),
      setBuffering: (v) => set({ isBuffering: v }),
      showFailedToast: (name) => {
        set({ failedSongName: name });
        setTimeout(() => set({ failedSongName: null }), 2500);
      },
      toggleShuffle: () => set((s) => ({ shuffle: !s.shuffle })),
      cycleRepeat: () =>
        set((s) => ({
          repeat: s.repeat === 'off' ? 'all' : s.repeat === 'all' ? 'one' : 'off',
        })),

      // ── Data actions ──

      addSongs: (songs) =>
        set((s) => {
          const songMap = { ...s.songMap };
          for (const song of songs) {
            songMap[song.id] = song;
          }
          return { songMap };
        }),

      fetchFeatured: async () => {
        const today = getLocalDateKey();
        const { featuredIds, featuredFetchedDate, isLoadingFeatured } = get();
        if (isLoadingFeatured) return;
        if (featuredIds.length > 0 && featuredFetchedDate === today) return;

        const previousFeaturedIds = featuredIds;

        set({ isLoadingFeatured: true });
        try {
          // Load from NetEase playlists via Meting (client-side, has CORS)
          const songs = orderSongsForDate(await fetchFeaturedFromMeting(50), today);
          if (songs.length === 0) return;

          const songMap: Record<string, Song> = { ...get().songMap };
          const ids: string[] = [];
          for (const song of songs) {
            songMap[song.id] = song;
            ids.push(song.id);
          }

          set((s) => ({
            songMap: { ...s.songMap, ...songMap },
            featuredIds: ids,
            featuredFetchedDate: today,
            queue: s.queue.length === 0 || sameIds(s.queue, previousFeaturedIds) ? ids : s.queue,
          }));
        } finally {
          set({ isLoadingFeatured: false });
        }
      },

      search: async (query) => {
        if (!query.trim()) {
          set({ searchResultIds: [], searchQuery: '' });
          return;
        }

        set({ isSearching: true, searchQuery: query });
        try {
          const songs = await searchTracks(query, 25);
          const songMap: Record<string, Song> = {};
          const ids: string[] = [];
          for (const song of songs) {
            songMap[song.id] = song;
            ids.push(song.id);
          }

          set((s) => ({
            songMap: { ...s.songMap, ...songMap },
            searchResultIds: ids,
          }));
        } finally {
          set({ isSearching: false });
        }
      },

      fetchAlbum: async (albumId) => {
        if (get().albumSongIds[albumId]) return; // already fetched

        // Find album name/artist from any cached song with this albumId
        const cachedSong = Object.values(get().songMap).find(
          (s) => s.albumId === albumId,
        );

        const result = await lookupAlbum(
          albumId,
          cachedSong?.album,
          cachedSong?.artist,
        );
        if (!result) return;

        const songMap: Record<string, Song> = {};
        const songIds: string[] = [];
        for (const song of result.songs) {
          songMap[song.id] = song;
          songIds.push(song.id);
        }

        set((s) => ({
          songMap: { ...s.songMap, ...songMap },
          albumMap: { ...s.albumMap, [albumId]: result.album },
          albumSongIds: { ...s.albumSongIds, [albumId]: songIds },
        }));
      },

      loadLyrics: async (songId) => {
        if (get().lyricsCache[songId]) return; // already loaded
        set({ isLoadingLyrics: true });
        try {
          const song = get().songMap[songId];
          const lines = await fetchLyrics(songId, song?.lrcUrl);
          set((s) => ({
            lyricsCache: { ...s.lyricsCache, [songId]: lines },
          }));
        } finally {
          set({ isLoadingLyrics: false });
        }
      },
    }),
    {
      name: 'hiPhone-music',
      storage: idbStorage,
      version: 4, // bump to invalidate stale artwork URLs
      partialize: (s) => ({
        currentSongId: s.currentSongId,
        queue: s.queue,
        shuffle: s.shuffle,
        repeat: s.repeat,
        songMap: s.songMap,
        albumMap: s.albumMap,
        featuredIds: s.featuredIds,
        featuredFetchedDate: s.featuredFetchedDate,
        albumSongIds: s.albumSongIds,
      }),
      migrate: () => ({}), // discard old data on version mismatch
    },
  ),
);

/** Get the current song object */
export function useCurrentSong(): Song | undefined {
  const id = useMusicDataStore((s) => s.currentSongId);
  const songMap = useMusicDataStore((s) => s.songMap);
  return id ? songMap[id] : undefined;
}

/** Get a song by ID from cache */
export function getSongFromCache(id: string): Song | undefined {
  return useMusicDataStore.getState().songMap[id];
}
