import { useEffect } from 'react';
import { Device } from './shell/Device';
import { MusicPlaybackHost } from './apps/Music/MusicPlaybackHost';
import { startHeartbeatScheduler } from './platform/ai/heartbeatAgent';
import { registerBuiltins } from './apps/registerBuiltins';
import { mountFakeUserAppIfDev } from './platform/userApp/devIcon';

// Register all builtin apps into the Registry at module load.
// Safe to run at module scope: registerBuiltins is idempotent.
registerBuiltins();

export function App() {
  useEffect(() => {
    startHeartbeatScheduler();
    // DEV-only: mount the hardcoded fake user app so the [DEV] icon
    // on the springboard works. Production builds skip this entirely
    // via import.meta.env.DEV tree-shaking.
    mountFakeUserAppIfDev();
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
