import { useEffect } from 'react';
import { Device } from './shell/Device';
import { MusicPlaybackHost } from './apps/Music/MusicPlaybackHost';
import { startHeartbeatScheduler } from './platform/ai/heartbeatAgent';
import { registerBuiltins } from './apps/registerBuiltins';
import { loadInstalledApps } from './platform/userApp/installer';
import { mountFakeUserAppIfDev } from './platform/userApp/devIcon';
import { installDevApi } from './platform/userApp/devInstall';

// Register all builtin apps into the Registry at module load.
// Safe to run at module scope: registerBuiltins is idempotent.
registerBuiltins();

export function App() {
  useEffect(() => {
    startHeartbeatScheduler();
    // Rebuild installedUserAppsStore + appRegistry from IDB on every startup.
    void loadInstalledApps();
    if (import.meta.env.DEV) {
      // Expose globalThis.__hiphoneInstall for DevTools manual testing.
      installDevApi();
      // Mount the hardcoded fake user app so the [DEV] icon on the springboard works.
      void mountFakeUserAppIfDev();
    }
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
