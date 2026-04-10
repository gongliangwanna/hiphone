/**
 * Real audio playback engine for Music app.
 * Uses HTML5 Audio element to play iTunes 30-second AAC previews.
 */
import { useEffect } from 'react';
import { useMusicDataStore, getSongFromCache } from './musicDataStore';

class AudioEngine {
  private audio: HTMLAudioElement;
  private currentUrl = '';
  private progressTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.audio = new Audio();
    this.audio.preload = 'auto';

    this.audio.addEventListener('ended', () => {
      this.stopProgressTimer();
      useMusicDataStore.getState().skipNext();
    });

    this.audio.addEventListener('error', () => {
      // If audio fails to load, skip to next
      this.stopProgressTimer();
      const state = useMusicDataStore.getState();
      if (state.isPlaying) {
        state.skipNext();
      }
    });
  }

  play(previewUrl: string) {
    if (this.currentUrl !== previewUrl) {
      this.audio.src = previewUrl;
      this.currentUrl = previewUrl;
    }
    this.audio.play().catch(() => {
      // Autoplay may be blocked; user gesture will retry
    });
    this.startProgressTimer();
  }

  pause() {
    this.audio.pause();
    this.stopProgressTimer();
  }

  resume() {
    this.audio.play().catch(() => {});
    this.startProgressTimer();
  }

  seek(seconds: number) {
    if (Number.isFinite(seconds) && this.audio.duration) {
      this.audio.currentTime = Math.min(seconds, this.audio.duration);
    }
  }

  stop() {
    this.audio.pause();
    this.audio.currentTime = 0;
    this.currentUrl = '';
    this.stopProgressTimer();
  }

  private startProgressTimer() {
    this.stopProgressTimer();
    // Use setInterval at ~15fps for smooth progress updates
    this.progressTimer = setInterval(() => {
      if (!this.audio.paused && Number.isFinite(this.audio.currentTime)) {
        useMusicDataStore.getState().setProgress(this.audio.currentTime);
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

  // Handle song change or play/pause
  useEffect(() => {
    if (!currentSongId) {
      engine.stop();
      return;
    }

    const song = getSongFromCache(currentSongId);
    if (!song?.previewUrl) {
      engine.stop();
      return;
    }

    if (isPlaying) {
      engine.play(song.previewUrl);
    } else {
      engine.pause();
    }

    return () => {
      // Don't stop on cleanup - let audio continue across re-renders
    };
  }, [isPlaying, currentSongId]);

  // Handle seek from UI
  useEffect(() => {
    const unsub = useMusicDataStore.subscribe((state, prevState) => {
      // Detect manual seek: progress changed but not by the normal timer increment
      if (
        state.currentSongId === prevState.currentSongId &&
        state.isPlaying === prevState.isPlaying &&
        Math.abs(state.progress - prevState.progress) > 1
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
