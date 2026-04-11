import { usePlaybackEngine } from './usePlaybackEngine';

/**
 * Null-rendering host that keeps the music playback engine mounted at the
 * application root.
 *
 * # Why this exists
 *
 * Previously `usePlaybackEngine()` was only called inside `MusicApp.tsx`.
 * That worked when the user was inside the app, but broke two flows:
 *
 *   1. **Widget playback controls.** The springboard's music widget sends
 *      `togglePlay()` / `skipNext()` etc. to the music store. When Music.app
 *      is not open, the playback-engine hook is unmounted, so nobody
 *      reacts to the store change and no audio plays.
 *   2. **Background continuation.** Closing the Music app would drop all
 *      subscriptions to `isPlaying` / `currentSongId`. The audio element
 *      kept playing (it's a module-level singleton), but any subsequent
 *      state change couldn't drive it until the app remounted.
 *
 * Rendering this component once from `App.tsx` guarantees the hook is
 * always-on regardless of which app is foregrounded.
 *
 * The component renders nothing — it exists purely for its hook side-effect.
 */
export function MusicPlaybackHost() {
  usePlaybackEngine();
  return null;
}
