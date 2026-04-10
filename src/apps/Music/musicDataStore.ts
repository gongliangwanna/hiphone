import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { songs, getSongById } from './data';
import type { Song } from './data';

interface MusicDataState {
  /** Currently playing song ID */
  currentSongId: string | null;
  /** Playback state */
  isPlaying: boolean;
  /** Current progress in seconds */
  progress: number;
  /** Play queue (song IDs) */
  queue: string[];
  /** Shuffle enabled */
  shuffle: boolean;
  /** Repeat mode: 'off' | 'all' | 'one' */
  repeat: 'off' | 'all' | 'one';

  playSong: (songId: string, queue?: string[]) => void;
  togglePlay: () => void;
  skipNext: () => void;
  skipPrev: () => void;
  setProgress: (progress: number) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
}

export const useMusicDataStore = create<MusicDataState>()(
  persist(
    (set, get) => ({
      currentSongId: 's1',
      isPlaying: false,
      progress: 0,
      queue: songs.map((s) => s.id),
      shuffle: false,
      repeat: 'off',

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
        const idx = queue.indexOf(currentSongId);
        let nextIdx: number;
        if (shuffle) {
          nextIdx = Math.floor(Math.random() * queue.length);
        } else if (idx < queue.length - 1) {
          nextIdx = idx + 1;
        } else if (repeat === 'all') {
          nextIdx = 0;
        } else {
          return;
        }
        set({ currentSongId: queue[nextIdx], progress: 0 });
      },

      skipPrev: () => {
        const { currentSongId, queue, progress } = get();
        if (!currentSongId || queue.length === 0) return;
        // If more than 3 seconds in, restart current song
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
    }),
    {
      name: 'hiPhone-music',
      partialize: (s) => ({
        currentSongId: s.currentSongId,
        queue: s.queue,
        shuffle: s.shuffle,
        repeat: s.repeat,
      }),
    },
  ),
);

/** Get the current song object */
export function useCurrentSong(): Song | undefined {
  const id = useMusicDataStore((s) => s.currentSongId);
  return id ? getSongById(id) : undefined;
}
