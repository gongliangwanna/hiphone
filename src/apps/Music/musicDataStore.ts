import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Song, Album } from './data';
import { searchTracks, lookupAlbum } from './itunesApi';

interface MusicDataState {
  // ── Playback ──
  currentSongId: string | null;
  isPlaying: boolean;
  progress: number;
  queue: string[];
  shuffle: boolean;
  repeat: 'off' | 'all' | 'one';

  // ── Song / Album cache ──
  songMap: Record<string, Song>;
  albumMap: Record<string, Album>;

  // ── Content (fetched from API) ──
  featuredIds: string[];
  searchResultIds: string[];
  searchQuery: string;
  isLoadingFeatured: boolean;
  isSearching: boolean;
  albumSongIds: Record<string, string[]>; // albumId → song IDs

  // ── Playback actions ──
  playSong: (songId: string, queue?: string[]) => void;
  togglePlay: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  setProgress: (progress: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;

  // ── Data actions ──
  addSongs: (songs: Song[]) => void;
  fetchFeatured: () => Promise<void>;
  search: (query: string) => Promise<void>;
  fetchAlbum: (albumId: string) => Promise<void>;
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

      // Caches
      songMap: {},
      albumMap: {},

      // Content
      featuredIds: [],
      searchResultIds: [],
      searchQuery: '',
      isLoadingFeatured: false,
      isSearching: false,
      albumSongIds: {},

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
        const { featuredIds, isLoadingFeatured } = get();
        if (featuredIds.length > 0 || isLoadingFeatured) return;

        set({ isLoadingFeatured: true });
        try {
          const songs = await searchTracks('top hits 2024', 50);
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
            queue: s.queue.length === 0 ? ids : s.queue,
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

        const result = await lookupAlbum(albumId);
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
    }),
    {
      name: 'hiPhone-music',
      partialize: (s) => ({
        currentSongId: s.currentSongId,
        queue: s.queue,
        shuffle: s.shuffle,
        repeat: s.repeat,
        songMap: s.songMap,
        albumMap: s.albumMap,
        featuredIds: s.featuredIds,
        albumSongIds: s.albumSongIds,
      }),
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
