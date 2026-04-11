import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMusicNavStore } from './musicStore';
import { wasAppKilled, clearAppKilled, useAppRuntimeStore } from '@/platform/stores/appRuntimeStore';
import { AppScreen } from '@/system';
import { MusicTabBar } from './TabBar';
import { MiniPlayer } from './MiniPlayer';
import { NowPlaying } from './NowPlaying';
import { HomeTab } from './tabs/HomeTab';
import { BrowseTab } from './tabs/BrowseTab';
import { RadioTab } from './tabs/RadioTab';
import { LibraryTab } from './tabs/LibraryTab';
import { AlbumDetail } from './pages/AlbumDetail';
import { useMusicDataStore } from './musicDataStore';
import { FailedSongToast } from './FailedSongToast';

const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

export function MusicApp() {
  const activeTab = useMusicNavStore((s) => s.activeTab);
  const page = useMusicNavStore((s) => s.page);
  const showNowPlaying = useMusicNavStore((s) => s.showNowPlaying);
  const setTab = useMusicNavStore((s) => s.setTab);
  const reset = useMusicNavStore((s) => s.reset);
  const currentSongId = useMusicDataStore((s) => s.currentSongId);

  // NOTE: the playback engine is mounted globally in `App.tsx` via
  // `<MusicPlaybackHost />` so widget controls keep working with the app
  // closed. Do NOT re-mount `usePlaybackEngine()` here or the engine will
  // get double-subscribed and issue duplicate play/pause calls.
  const setStatusBarStyle = useAppRuntimeStore((s) => s.setStatusBarStyle);

  // Music app has dark background — needs white status bar text
  useEffect(() => {
    setStatusBarStyle('light');
    return () => setStatusBarStyle('dark');
  }, [setStatusBarStyle]);

  const prevPageRef = useRef(page);

  useEffect(() => {
    if (wasAppKilled('music') || wasAppKilled('music-dock')) {
      reset();
      clearAppKilled('music');
      clearAppKilled('music-dock');
    }
  }, [reset]);

  const direction = page !== null && prevPageRef.current === null ? 1 : -1;
  useEffect(() => {
    prevPageRef.current = page;
  }, [page]);

  const isAtRoot = page === null;

  return (
    <AppScreen backgroundColor="#000">
      <div className="relative flex min-h-0 flex-1 flex-col" data-testid="music-app">
        <AnimatePresence initial={false}>
          {isAtRoot ? (
            <motion.div
              key="tab-root"
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: '#000' }}
              initial={{ x: '-30%' }}
              animate={{ x: '0%' }}
              exit={{ x: '-30%' }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              {/* Tab content */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {activeTab === 'home' && <HomeTab />}
                {activeTab === 'browse' && <BrowseTab />}
                {activeTab === 'radio' && <RadioTab />}
                {activeTab === 'library' && <LibraryTab />}
              </div>

              {/* Mini Player + TabBar */}
              <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col justify-end">
                {currentSongId && (
                  <div style={{ paddingBottom: 8 }}>
                    <MiniPlayer />
                  </div>
                )}
                <MusicTabBar activeTab={activeTab} onTabChange={setTab} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`page-${page}`}
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: '#000', willChange: 'transform' }}
              initial={{ x: `${direction * 100}%` }}
              animate={{ x: '0%' }}
              exit={{ x: `${direction * -30}%` }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              {page === 'album-detail' && <AlbumDetail />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Now Playing overlay */}
        <AnimatePresence>
          {showNowPlaying && <NowPlaying />}
        </AnimatePresence>

        {/* Toast for failed songs (visible when NowPlaying is closed) */}
        {!showNowPlaying && <FailedSongToast />}
      </div>
    </AppScreen>
  );
}
