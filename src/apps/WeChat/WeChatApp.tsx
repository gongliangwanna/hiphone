import { useEffect, useRef, useCallback, useMemo } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useWeChatNavStore } from './wechatStore';
import type { WeChatTab } from './wechatStore';
import { useAppRuntimeStore, wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { AppScreen, NavBar } from '@/system';
import { chatList } from './data';
import { TabBar } from './TabBar';
import { ChatsTab } from './tabs/ChatsTab';
import { ContactsTab } from './tabs/ContactsTab';
import { DiscoverTab } from './tabs/DiscoverTab';
import { MeTab } from './tabs/MeTab';
import { ChatDetail } from './pages/ChatDetail';

const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

const TAB_TITLES: Record<WeChatTab, string> = {
  chats: '微信',
  contacts: '通讯录',
  discover: '发现',
  me: '我',
};

export function WeChatApp() {
  const activeTab = useWeChatNavStore((s) => s.activeTab);
  const page = useWeChatNavStore((s) => s.page);
  const activeChatId = useWeChatNavStore((s) => s.activeChatId);
  const setTab = useWeChatNavStore((s) => s.setTab);
  const pushPage = useWeChatNavStore((s) => s.pushPage);
  const popPage = useWeChatNavStore((s) => s.popPage);
  const reset = useWeChatNavStore((s) => s.reset);
  const goHome = useAppRuntimeStore((s) => s.goHome);

  const prevPageRef = useRef(page);

  useEffect(() => {
    if (wasAppKilled('wechat')) {
      reset();
      clearAppKilled('wechat');
    }
  }, [reset]);

  // Track direction for slide animation
  const direction = page !== null && prevPageRef.current === null ? 1 : -1;
  useEffect(() => {
    prevPageRef.current = page;
  }, [page]);

  const handleOpenChat = useCallback(
    (chatId: string) => pushPage('chat-detail', chatId),
    [pushPage],
  );

  const handleBack = useCallback(() => {
    if (page) {
      popPage();
    } else {
      goHome();
    }
  }, [page, popPage, goHome]);

  const totalUnread = useMemo(
    () => chatList.reduce((sum, c) => sum + c.unread, 0),
    [],
  );

  const isAtRoot = page === null;

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <div className="relative flex min-h-0 flex-1 flex-col" data-testid="wechat-app">
        <AnimatePresence initial={false}>
          {isAtRoot ? (
            <motion.div
              key="tab-root"
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: 'var(--color-systemBackground)' }}
              initial={{ x: `${-30}%` }}
              animate={{ x: '0%' }}
              exit={{ x: `${-30}%` }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              {/* NavBar */}
              <NavBar
                title={TAB_TITLES[activeTab]}
                rightButtons={
                  activeTab === 'chats'
                    ? [
                        { icon: <SearchNavIcon />, onClick: () => {}, testId: 'wechat-search' },
                        { icon: <AddNavIcon />, onClick: () => {}, testId: 'wechat-add' },
                      ]
                    : activeTab === 'contacts'
                      ? [{ icon: <AddContactIcon />, onClick: () => {}, testId: 'wechat-add-contact' }]
                      : undefined
                }
              />

              {/* Tab content */}
              <div className="min-h-0 flex-1 overflow-hidden">
                {activeTab === 'chats' && <ChatsTab onOpenChat={handleOpenChat} />}
                {activeTab === 'contacts' && <ContactsTab />}
                {activeTab === 'discover' && <DiscoverTab />}
                {activeTab === 'me' && <MeTab />}
              </div>

              {/* TabBar */}
              <TabBar
                activeTab={activeTab}
                onTabChange={setTab}
                unreadChats={totalUnread}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`page-${page}-${activeChatId}`}
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{
                backgroundColor: 'var(--color-secondarySystemBackground)',
                willChange: 'transform',
              }}
              initial={{ x: `${direction * 100}%` }}
              animate={{ x: '0%' }}
              exit={{ x: `${direction * -30}%` }}
              transition={{ duration: SLIDE_MS / 1000, ease: SLIDE_EASE }}
            >
              {page === 'chat-detail' && activeChatId && (
                <ChatDetail chatId={activeChatId} onBack={handleBack} />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}

/* ── NavBar action icons (SF Symbol stroke style) ── */

function SearchNavIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="9.5" cy="9.5" r="6.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14.5 14.5L19 19" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AddNavIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M11 6.5v9M6.5 11h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AddContactIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <circle cx="10" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 20c0-3.9 3.1-7 7-7s7 3.1 7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M18 5v6M15 8h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
