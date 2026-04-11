import { Device } from './shell/Device';
import { MusicPlaybackHost } from './apps/Music/MusicPlaybackHost';

export function App() {
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
