import { useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useXYNav } from './xingYuNavStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { AppScreen } from '@/system';
import { XYTabBar } from './TabBar';
import { T } from './theme';
import { ChatListTab } from './tabs/ChatListTab';
import { ContactsTab } from './tabs/ContactsTab';
import { MomentsTab } from './tabs/MomentsTab';
import { ProfileTab } from './tabs/ProfileTab';
import { ChatDetail } from './pages/ChatDetail';
import { IdolProfile } from './pages/IdolProfile';
import { Settings } from './pages/Settings';

const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

export function XingYuApp() {
  const activeTab = useXYNav((s) => s.activeTab);
  const page = useXYNav((s) => s.page);
  const setTab = useXYNav((s) => s.setTab);
  const reset = useXYNav((s) => s.reset);

  const prevPageRef = useRef(page);

  useEffect(() => {
    if (wasAppKilled('xingyu')) {
      reset();
      clearAppKilled('xingyu');
    }
  }, [reset]);

  const direction = page !== null && prevPageRef.current === null ? 1 : -1;
  useEffect(() => {
    prevPageRef.current = page;
  }, [page]);

  const isAtRoot = page === null;

  return (
    <AppScreen backgroundColor={T.bg}>
      <div className="relative flex min-h-0 flex-1 flex-col" data-testid="xingyu-app">
        <AnimatePresence initial={false}>
          {isAtRoot ? (
            <motion.div
              key="tab-root"
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: T.bg }}
              initial={{ x: '-30%' }}
              animate={{ x: '0%' }}
              exit={{ x: '-30%' }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              <div className="min-h-0 flex-1 overflow-hidden">
                {activeTab === 'chat' && <ChatListTab />}
                {activeTab === 'contacts' && <ContactsTab />}
                {activeTab === 'moments' && <MomentsTab />}
                {activeTab === 'profile' && <ProfileTab />}
              </div>
              <XYTabBar active={activeTab} onChange={setTab} />
            </motion.div>
          ) : (
            <motion.div
              key={`page-${page}`}
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: T.bg, willChange: 'transform' }}
              initial={{ x: `${direction * 100}%` }}
              animate={{ x: '0%' }}
              exit={{ x: `${direction * -30}%` }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              {page === 'chat-detail' && <ChatDetail />}
              {page === 'idol-profile' && <IdolProfile />}
              {page === 'settings' && <Settings />}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}
