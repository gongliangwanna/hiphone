import type { WeChatTab } from './wechatStore';

interface TabBarProps {
  activeTab: WeChatTab;
  onTabChange: (tab: WeChatTab) => void;
  unreadChats: number;
}

const WECHAT_GREEN = '#07C160';
const INACTIVE_COLOR = '#999';

interface TabDef {
  key: WeChatTab;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

const tabs: TabDef[] = [
  {
    key: 'chats',
    label: '微信',
    icon: (active) => <ChatIcon color={active ? WECHAT_GREEN : INACTIVE_COLOR} />,
  },
  {
    key: 'contacts',
    label: '通讯录',
    icon: (active) => <ContactsIcon color={active ? WECHAT_GREEN : INACTIVE_COLOR} />,
  },
  {
    key: 'discover',
    label: '发现',
    icon: (active) => <DiscoverIcon color={active ? WECHAT_GREEN : INACTIVE_COLOR} />,
  },
  {
    key: 'me',
    label: '我',
    icon: (active) => <MeIcon color={active ? WECHAT_GREEN : INACTIVE_COLOR} />,
  },
];

export function TabBar({ activeTab, onTabChange, unreadChats }: TabBarProps) {
  return (
    <div
      className="flex items-center justify-around shrink-0"
      style={{
        height: 50,
        borderTop: '0.5px solid var(--color-separator)',
        backgroundColor: 'var(--color-secondarySystemBackground)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            className="relative flex flex-col items-center justify-center"
            style={{
              flex: 1,
              minHeight: 44,
              gap: 2,
            }}
            onClick={() => onTabChange(tab.key)}
          >
            <div className="relative">
              {tab.icon(isActive)}
              {tab.key === 'chats' && unreadChats > 0 && (
                <span
                  className="absolute flex items-center justify-center"
                  style={{
                    top: -4,
                    right: -8,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    backgroundColor: '#F44336',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 600,
                    paddingInline: 4,
                  }}
                >
                  {unreadChats > 99 ? '99+' : unreadChats}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 10,
                color: isActive ? WECHAT_GREEN : INACTIVE_COLOR,
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── SF Symbol style tab icons ── */

function ChatIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2h-4l-4 4-4-4H4a2 2 0 01-2-2V6a2 2 0 012-2z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="11" r="1" fill={color} />
      <circle cx="12" cy="11" r="1" fill={color} />
      <circle cx="16" cy="11" r="1" fill={color} />
    </svg>
  );
}

function ContactsIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="8" r="3.5" stroke={color} strokeWidth="1.6" />
      <path
        d="M2 20c0-3.3 2.7-6 6-6h2c3.3 0 6 2.7 6 6"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9" r="2.5" stroke={color} strokeWidth="1.6" />
      <path
        d="M18 14h1c2.5 0 4.5 2 4.5 4.5"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DiscoverIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="1.6" />
      <path
        d="M14.5 9.5l-5.5 2 2 5.5 5.5-2-2-5.5z"
        stroke={color}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MeIcon({ color }: { color: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke={color} strokeWidth="1.6" />
      <path
        d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7"
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}
