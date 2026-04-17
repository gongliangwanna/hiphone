import { useEffect } from 'react';
import { Device } from './shell/Device';
import { MusicPlaybackHost } from './apps/Music/MusicPlaybackHost';
import { startHeartbeatScheduler } from './platform/ai/heartbeatAgent';
import { registerBuiltins } from './apps/registerBuiltins';

// Register all builtin apps into the Registry at module load.
// Safe to run at module scope: registerBuiltins is idempotent.
registerBuiltins();

export function App() {
  useEffect(() => {
    startHeartbeatScheduler();
  }, []);

  return (
    <>
      {/* Always-on audio engine: drives playback from the music store so the
          widget's play/pause/skip buttons work even when Music.app is not
          in the foreground. Renders nothing. */}
      <MusicPlaybackHost />
      <Device />
    </>
  );
}
