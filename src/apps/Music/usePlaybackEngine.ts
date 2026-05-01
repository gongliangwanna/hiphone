/**
 * Real audio playback engine for Music app.
 * Uses HTML5 Audio element to play full-length MP3s.
 * Lazily resolves play URLs via getPlayUrl when a song starts.
 *
 * Key behaviors:
 *  - Stops previous audio *immediately* on song change
 *  - Shows buffering spinner while resolving / loading
 *  - Auto-skips on failure with a toast showing the failed song name
 */
import { useEffect } from 'react';
import { useMusicDataStore, getSongFromCache } from './musicDataStore';
import { getPlayUrl } from './itunesApi';

class AudioEngine {
  private audio: HTMLAudioElement;
  private currentUrl = '';
  private currentSongId = '';
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private resolveAbort: AbortController | null = null;
  // True while the progress timer is writing audio.currentTime back to the
  // store, so the seek-sync subscriber can ignore engine-driven updates.
  // Critical when the tab is backgrounded: setInterval is throttled to ~1Hz
  // while audio keeps advancing, making the per-tick progress delta look like
  // a user seek and triggering audio.currentTime= writes that flush the
  // decode pipeline (audible as choppy/intermittent playback).
  isApplyingTick = false;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('ended', () => {
      this.stopProgressTimer();
      useMusicDataStore.getState().skipNext();
    });

    this.audio.addEventListener('error', () => {
      this.stopProgressTimer();
      this.handlePlaybackFail();
    });

    this.audio.addEventListener('waiting', () => {
      useMusicDataStore.getState().setBuffering(true);
    });

    this.audio.addEventListener('playing', () => {
      useMusicDataStore.getState().setBuffering(false);
    });

    this.audio.addEventListener('canplay', () => {
      useMusicDataStore.getState().setBuffering(false);
    });

    // Update song duration from audio metadata (Meting songs have duration=0)
    this.audio.addEventListener('loadedmetadata', () => {
      const dur = this.audio.duration;
      if (!Number.isFinite(dur) || dur <= 0) return;
      const songId = this.currentSongId;
      const song = songId ? getSongFromCache(songId) : null;
      if (song && (song.duration === 0 || Math.abs(song.duration - dur) > 2)) {
        useMusicDataStore.getState().addSongs([{ ...song, duration: dur }]);
      }
    });
  }

  async playSong(songId: string) {
    if (this.currentSongId === songId && this.currentUrl) {
      // Same song, just resume
      this.audio.play().catch(() => {});
      this.startProgressTimer();
      return;
    }

    // ── Immediately stop previous audio ──
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load(); // release previous buffer
    this.stopProgressTimer();

    // Abort any in-flight URL resolution
    if (this.resolveAbort) {
      this.resolveAbort.abort();
    }
    this.resolveAbort = new AbortController();
    const { signal } = this.resolveAbort;

    this.currentSongId = songId;
    this.currentUrl = '';

    const song = getSongFromCache(songId);
    let url = song?.previewUrl || '';

    if (!url) {
      // Show buffering while resolving URL
      useMusicDataStore.getState().setBuffering(true);
      try {
        url = await getPlayUrl(songId, song?.title, song?.artist);
      } catch (_) {
        url = '';
      }

      // Check if we were aborted (user skipped during resolve)
      if (signal.aborted) return;

      if (!url) {
        useMusicDataStore.getState().setBuffering(false);
        this.handlePlaybackFail();
        return;
      }

      // Cache the resolved URL in the store
      if (song) {
        useMusicDataStore.getState().addSongs([{ ...song, previewUrl: url }]);
      }

      // Re-check we're still the active song
      if (useMusicDataStore.getState().currentSongId !== songId) return;
    }

    // Show buffering until audio actually starts playing
    useMusicDataStore.getState().setBuffering(true);
    this.currentUrl = url;
    this.audio.src = url;
    this.audio.play().catch(() => {
      this.handlePlaybackFail();
    });
    this.startProgressTimer();
  }

  pause() {
    this.audio.pause();
    this.stopProgressTimer();
  }

  seek(seconds: number) {
    if (Number.isFinite(seconds) && this.audio.duration) {
      this.audio.currentTime = Math.min(seconds, this.audio.duration);
    }
  }

  stop() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.currentUrl = '';
    this.currentSongId = '';
    this.stopProgressTimer();
    useMusicDataStore.getState().setBuffering(false);
    if (this.resolveAbort) {
      this.resolveAbort.abort();
      this.resolveAbort = null;
    }
  }

  private handlePlaybackFail() {
    const state = useMusicDataStore.getState();
    const failedSong = this.currentSongId
      ? getSongFromCache(this.currentSongId)
      : null;

    if (failedSong) {
      state.showFailedToast(failedSong.title);
    }

    // Auto-skip to next song
    if (state.isPlaying && state.queue.length > 1) {
      state.skipNext();
    } else {
      useMusicDataStore.setState({ isPlaying: false, isBuffering: false });
    }
  }

  private startProgressTimer() {
    this.stopProgressTimer();
    this.progressTimer = setInterval(() => {
      if (!this.audio.paused && Number.isFinite(this.audio.currentTime)) {
        this.isApplyingTick = true;
        useMusicDataStore.getState().setProgress(this.audio.currentTime);
        this.isApplyingTick = false;
      }
    }, 66);
  }

  private stopProgressTimer() {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }
}

const engine = new AudioEngine();

/**
 * Hook that drives audio playback. Mount once in MusicApp.
 */
export function usePlaybackEngine() {
  const isPlaying = useMusicDataStore((s) => s.isPlaying);
  const currentSongId = useMusicDataStore((s) => s.currentSongId);

  useEffect(() => {
    if (!currentSongId) {
      engine.stop();
      return;
    }

    if (isPlaying) {
      engine.playSong(currentSongId);
    } else {
      engine.pause();
    }
  }, [isPlaying, currentSongId]);

  // Handle seek from UI
  useEffect(() => {
    const unsub = useMusicDataStore.subscribe((state, prevState) => {
      if (engine.isApplyingTick) return;
      if (
        state.currentSongId === prevState.currentSongId &&
        state.isPlaying === prevState.isPlaying &&
        state.progress !== prevState.progress
      ) {
        engine.seek(state.progress);
      }
    });
    return unsub;
  }, []);
}

/** Expose engine for direct seek control */
export function seekAudio(seconds: number) {
  engine.seek(seconds);
}
