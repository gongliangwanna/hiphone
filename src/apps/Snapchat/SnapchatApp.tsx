import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSnapchatNavStore } from './snapchatNavStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { AppScreen } from '@/system';
import { SnapchatTabBar } from './TabBar';
import { ChatTab } from './tabs/ChatTab';
import { MapTab } from './tabs/MapTab';
import { CameraTab } from './tabs/CameraTab';
import { CommunityTab } from './tabs/CommunityTab';
import { SpotlightTab } from './tabs/SpotlightTab';
import { ChatDetail } from './pages/ChatDetail';
import { SnapViewer } from './SnapViewer';

const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

export function SnapchatApp() {
  const activeTab = useSnapchatNavStore((s) => s.activeTab);
  const page = useSnapchatNavStore((s) => s.page);
  const viewingSnapId = useSnapchatNavStore((s) => s.viewingSnapId);
  const setTab = useSnapchatNavStore((s) => s.setTab);
  const reset = useSnapchatNavStore((s) => s.reset);

  const prevPageRef = useRef(page);

  useEffect(() => {
    if (wasAppKilled('snapchat')) {
      reset();
      clearAppKilled('snapchat');
    }
  }, [reset]);

  const direction = page !== null && prevPageRef.current === null ? 1 : -1;
  useEffect(() => {
    prevPageRef.current = page;
  }, [page]);

  const isAtRoot = page === null;

  return (
    <AppScreen backgroundColor="#fff">
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        data-testid="snapchat-app"
      >
        <AnimatePresence initial={false}>
          {isAtRoot ? (
            <motion.div
              key="tab-root"
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: '#fff' }}
              initial={{ x: '-30%' }}
              animate={{ x: '0%' }}
              exit={{ x: '-30%' }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              <div className="min-h-0 flex-1 overflow-hidden">
                {activeTab === 'chat' && <ChatTab />}
                {activeTab === 'map' && <MapTab />}
                {activeTab === 'camera' && <CameraTab />}
                {activeTab === 'community' && <CommunityTab />}
                {activeTab === 'spotlight' && <SpotlightTab />}
              </div>
              <SnapchatTabBar activeTab={activeTab} onTabChange={setTab} />
            </motion.div>
          ) : (
            <motion.div
              key={`page-${page}`}
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: '#fff', willChange: 'transform' }}
              initial={{ x: `${direction * 100}%` }}
              animate={{ x: '0%' }}
              exit={{ x: `${direction * -30}%` }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              {page === 'chat-detail' && <ChatDetail />}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Snap viewer overlay */}
        <AnimatePresence>
          {viewingSnapId && <SnapViewer />}
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}
