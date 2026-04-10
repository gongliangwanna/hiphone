import { useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AppScreen } from '@/system';
import { useSafariStore, extractDomain } from './safariStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';

/* ── Favorites for start page ── */
const FAVORITES = [
  { name: 'Apple', url: 'https://www.apple.com', icon: '🍎' },
  { name: 'Google', url: 'https://www.google.com', icon: '🔍' },
  { name: 'Wikipedia', url: 'https://zh.wikipedia.org', icon: '📚' },
  { name: '百度', url: 'https://www.baidu.com', icon: '🔎' },
  { name: 'GitHub', url: 'https://github.com', icon: '🐙' },
  { name: 'YouTube', url: 'https://www.youtube.com', icon: '▶️' },
];

/* ── Constants ── */
const TOOLBAR_HEIGHT = 44;

export function SafariApp() {
  const view = useSafariStore((s) => s.view);
  const reset = useSafariStore((s) => s.reset);

  useEffect(() => {
    if (wasAppKilled('safari') || wasAppKilled('safari-dock')) {
      reset();
      clearAppKilled('safari');
      clearAppKilled('safari-dock');
    }
  }, [reset]);

  return (
    <AppScreen backgroundColor="var(--color-systemBackground)">
      <div className="relative flex min-h-0 flex-1 flex-col" data-testid="safari-app">
        <AnimatePresence initial={false} mode="popLayout">
          {view === 'browse' ? (
            <motion.div
              key="browse"
              className="absolute inset-0 flex min-h-0 flex-col"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <BrowseView />
            </motion.div>
          ) : (
            <motion.div
              key="tabs"
              className="absolute inset-0 flex min-h-0 flex-col"
              style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.25 }}
            >
              <TabGridView />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Browse View — Web content + URL bar + toolbar
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function BrowseView() {
  const tabs = useSafariStore((s) => s.tabs);
  const activeTabId = useSafariStore((s) => s.activeTabId);
  const isEditing = useSafariStore((s) => s.isEditing);
  const editText = useSafariStore((s) => s.editText);
  const setEditing = useSafariStore((s) => s.setEditing);
  const setEditText = useSafariStore((s) => s.setEditText);
  const navigateTo = useSafariStore((s) => s.navigateTo);
  const goBack = useSafariStore((s) => s.goBack);
  const goForward = useSafariStore((s) => s.goForward);
  const setView = useSafariStore((s) => s.setView);
  const setTabError = useSafariStore((s) => s.setTabError);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canGoBack = activeTab?.url !== null;
  const canGoForward = activeTab
    ? activeTab.historyIndex < activeTab.history.length - 1
    : false;

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleUrlBarClick = useCallback(() => {
    setEditing(true);
  }, [setEditing]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      navigateTo(editText);
    },
    [navigateTo, editText],
  );

  const handleCancel = useCallback(() => {
    setEditing(false);
  }, [setEditing]);

  const handleIframeError = useCallback(() => {
    if (activeTab) {
      setTabError(activeTab.id, true);
    }
  }, [activeTab, setTabError]);

  const handleFavoriteClick = useCallback(
    (url: string) => {
      navigateTo(url);
    },
    [navigateTo],
  );

  const showStartPage = !activeTab?.url;
  const displayDomain = activeTab?.url ? extractDomain(activeTab.url) : '';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ── Web content area ── */}
      <div className="min-h-0 flex-1 overflow-hidden">
        {showStartPage ? (
          <StartPage onFavoriteClick={handleFavoriteClick} />
        ) : activeTab?.hasError ? (
          <ErrorPage url={activeTab.url!} />
        ) : (
          <iframe
            key={activeTab?.url}
            src={activeTab?.url ?? undefined}
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms"
            title="Web content"
            onError={handleIframeError}
            data-testid="safari-iframe"
          />
        )}
      </div>

      {/* ── Full-screen URL editing overlay ── */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col"
            style={{ backgroundColor: 'var(--color-systemBackground)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {/* Top bar with input + cancel */}
            <div
              className="flex items-center gap-2 px-3"
              style={{
                paddingTop: 8,
                paddingBottom: 8,
                borderBottom: '0.5px solid var(--color-separator)',
              }}
            >
              <form onSubmit={handleSubmit} className="min-w-0 flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="搜索或输入网站名称"
                  className="w-full rounded-lg border-0 px-3 py-2 text-sm outline-none"
                  style={{
                    backgroundColor: 'var(--color-tertiarySystemFill)',
                    color: 'var(--color-label)',
                    fontSize: 16,
                    height: 36,
                  }}
                  data-testid="safari-url-input"
                />
              </form>
              <button
                onClick={handleCancel}
                className="shrink-0 px-1 text-base"
                style={{
                  color: 'var(--color-systemBlue)',
                  minWidth: 44,
                  minHeight: 44,
                }}
                data-testid="safari-cancel-edit"
              >
                取消
              </button>
            </div>

            {/* Suggestions area (simple — show favorites) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3">
              {editText.trim() ? (
                <div
                  className="flex items-center gap-3 rounded-lg px-3 py-3"
                  style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
                  onClick={() => navigateTo(editText)}
                >
                  <SearchIcon size={18} />
                  <span
                    className="text-sm"
                    style={{ color: 'var(--color-label)' }}
                  >
                    搜索"{editText}"
                  </span>
                </div>
              ) : (
                <div>
                  <p
                    className="mb-3 text-xs font-semibold uppercase"
                    style={{ color: 'var(--color-secondaryLabel)' }}
                  >
                    个人收藏
                  </p>
                  {FAVORITES.map((fav) => (
                    <button
                      key={fav.url}
                      className="flex w-full items-center gap-3 px-2 py-2.5"
                      onClick={() => handleFavoriteClick(fav.url)}
                    >
                      <span className="text-lg">{fav.icon}</span>
                      <div className="text-left">
                        <p
                          className="text-sm"
                          style={{ color: 'var(--color-label)' }}
                        >
                          {fav.name}
                        </p>
                        <p
                          className="text-xs"
                          style={{ color: 'var(--color-secondaryLabel)' }}
                        >
                          {extractDomain(fav.url)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom bar: URL capsule + toolbar ── */}
      <div
        className="shrink-0"
        style={{
          borderTop: '0.5px solid var(--color-separator)',
          backgroundColor: 'var(--color-secondarySystemBackground)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* URL capsule bar */}
        <div className="flex items-center justify-center px-4 py-1.5">
          <button
            onClick={handleUrlBarClick}
            className="flex w-full items-center justify-center rounded-full px-4"
            style={{
              height: 36,
              backgroundColor: 'var(--color-tertiarySystemFill)',
              maxWidth: 400,
            }}
            data-testid="safari-url-bar"
          >
            {showStartPage ? (
              <span
                className="text-sm"
                style={{ color: 'var(--color-secondaryLabel)' }}
              >
                搜索或输入网站名称
              </span>
            ) : (
              <span
                className="truncate text-sm"
                style={{ color: 'var(--color-label)' }}
              >
                {displayDomain}
              </span>
            )}
          </button>
        </div>

        {/* Toolbar */}
        <div
          className="flex items-center justify-around px-4"
          style={{ height: TOOLBAR_HEIGHT }}
        >
          <ToolbarButton
            onClick={goBack}
            disabled={!canGoBack}
            testId="safari-back"
          >
            <BackIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={goForward}
            disabled={!canGoForward}
            testId="safari-forward"
          >
            <ForwardIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {}}
            testId="safari-share"
          >
            <ShareIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {}}
            testId="safari-bookmarks"
          >
            <BookmarkIcon />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setView('tabs')}
            testId="safari-tabs-btn"
          >
            <TabsIcon />
          </ToolbarButton>
        </div>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Start Page — Favorites grid + frequent visits
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function StartPage({
  onFavoriteClick,
}: {
  onFavoriteClick: (url: string) => void;
}) {
  return (
    <div
      className="h-full overflow-y-auto px-5 pt-8"
      style={{ backgroundColor: 'var(--color-systemBackground)' }}
      data-testid="safari-start-page"
    >
      {/* Favorites section */}
      <p
        className="mb-4 text-lg font-semibold"
        style={{ color: 'var(--color-label)' }}
      >
        个人收藏
      </p>
      <div className="mb-8 grid grid-cols-4 gap-4">
        {FAVORITES.map((fav) => (
          <button
            key={fav.url}
            className="flex flex-col items-center gap-1.5"
            onClick={() => onFavoriteClick(fav.url)}
            data-testid={`safari-fav-${fav.name}`}
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                width: 52,
                height: 52,
                backgroundColor: 'var(--color-secondarySystemBackground)',
                fontSize: 24,
              }}
            >
              {fav.icon}
            </div>
            <span
              className="max-w-full truncate text-xs"
              style={{ color: 'var(--color-label)' }}
            >
              {fav.name}
            </span>
          </button>
        ))}
      </div>

      {/* Frequently visited section */}
      <p
        className="mb-4 text-lg font-semibold"
        style={{ color: 'var(--color-label)' }}
      >
        经常访问的网站
      </p>
      <div
        className="flex items-center justify-center rounded-xl py-8"
        style={{ backgroundColor: 'var(--color-secondarySystemBackground)' }}
      >
        <span
          className="text-sm"
          style={{ color: 'var(--color-secondaryLabel)' }}
        >
          暂无经常访问的网站
        </span>
      </div>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Error Page — When iframe can't load a site
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ErrorPage({ url }: { url: string }) {
  return (
    <div
      className="flex h-full flex-col items-center justify-center px-8"
      style={{ backgroundColor: 'var(--color-systemBackground)' }}
      data-testid="safari-error-page"
    >
      <div className="mb-4" style={{ color: 'var(--color-secondaryLabel)' }}>
        <GlobeIcon size={48} />
      </div>
      <p
        className="mb-2 text-center text-base font-semibold"
        style={{ color: 'var(--color-label)' }}
      >
        无法打开页面
      </p>
      <p
        className="mb-1 text-center text-sm"
        style={{ color: 'var(--color-secondaryLabel)' }}
      >
        Safari 无法打开页面，因为此网站不允许在框架中显示。
      </p>
      <p
        className="text-center text-xs"
        style={{ color: 'var(--color-tertiaryLabel)' }}
      >
        {extractDomain(url)}
      </p>
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Tab Grid View — Grid of all open tabs
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function TabGridView() {
  const tabs = useSafariStore((s) => s.tabs);
  const activeTabId = useSafariStore((s) => s.activeTabId);
  const switchTab = useSafariStore((s) => s.switchTab);
  const closeTab = useSafariStore((s) => s.closeTab);
  const createTab = useSafariStore((s) => s.createTab);
  const setView = useSafariStore((s) => s.setView);

  const handleDone = useCallback(() => {
    setView('browse');
  }, [setView]);

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      data-testid="safari-tab-grid"
    >
      {/* Header */}
      <div
        className="flex shrink-0 items-center justify-between px-4"
        style={{
          height: 52,
          borderBottom: '0.5px solid var(--color-separator)',
        }}
      >
        <button
          onClick={createTab}
          className="flex items-center justify-center"
          style={{
            color: 'var(--color-systemBlue)',
            minWidth: 44,
            minHeight: 44,
          }}
          data-testid="safari-new-tab"
        >
          <PlusIcon />
        </button>
        <span
          className="text-base font-semibold"
          style={{ color: 'var(--color-label)' }}
        >
          {tabs.length}个标签页
        </span>
        <button
          onClick={handleDone}
          className="text-base"
          style={{
            color: 'var(--color-systemBlue)',
            minWidth: 44,
            minHeight: 44,
            lineHeight: '44px',
          }}
          data-testid="safari-done"
        >
          完成
        </button>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <div className="grid grid-cols-2 gap-3">
          {tabs.map((tab) => (
            <TabCard
              key={tab.id}
              tab={tab}
              isActive={tab.id === activeTabId}
              onSelect={() => switchTab(tab.id)}
              onClose={() => closeTab(tab.id)}
            />
          ))}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div
        className="flex shrink-0 items-center justify-center px-4"
        style={{
          height: TOOLBAR_HEIGHT,
          borderTop: '0.5px solid var(--color-separator)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <button
          onClick={createTab}
          className="flex items-center justify-center"
          style={{
            color: 'var(--color-systemBlue)',
            minWidth: 44,
            minHeight: 44,
          }}
        >
          <PlusIcon />
        </button>
      </div>
    </div>
  );
}

/* ── Tab Card ── */

function TabCard({
  tab,
  isActive,
  onSelect,
  onClose,
}: {
  tab: { id: string; title: string; url: string | null; hasError: boolean };
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      className="relative overflow-hidden rounded-xl"
      style={{
        backgroundColor: 'var(--color-tertiarySystemBackground)',
        border: isActive
          ? '2.5px solid var(--color-systemBlue)'
          : '0.5px solid var(--color-separator)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}
      layout
      data-testid={`safari-tab-card-${tab.id}`}
    >
      {/* Close button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute left-1 top-1 z-10 flex items-center justify-center rounded-full"
        style={{
          width: 22,
          height: 22,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
        data-testid={`safari-close-tab-${tab.id}`}
      >
        <CloseIcon size={10} />
      </button>

      {/* Card content (click to select) */}
      <button
        onClick={onSelect}
        className="flex w-full flex-col"
      >
        {/* Title bar */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ borderBottom: '0.5px solid var(--color-separator)' }}
        >
          <GlobeIcon size={14} />
          <span
            className="flex-1 truncate text-left text-xs"
            style={{ color: 'var(--color-label)' }}
          >
            {tab.title}
          </span>
        </div>

        {/* Preview area */}
        <div
          className="flex items-center justify-center"
          style={{
            height: 140,
            backgroundColor: tab.url
              ? 'var(--color-systemBackground)'
              : 'var(--color-secondarySystemBackground)',
          }}
        >
          {tab.url ? (
            tab.hasError ? (
              <span
                className="text-xs"
                style={{ color: 'var(--color-tertiaryLabel)' }}
              >
                无法加载
              </span>
            ) : (
              <span
                className="text-xs"
                style={{ color: 'var(--color-secondaryLabel)' }}
              >
                {extractDomain(tab.url)}
              </span>
            )
          ) : (
            <span
              className="text-2xl"
              style={{ color: 'var(--color-tertiaryLabel)' }}
            >
              起始页
            </span>
          )}
        </div>
      </button>
    </motion.div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Toolbar Button
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function ToolbarButton({
  children,
  onClick,
  disabled = false,
  testId,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center"
      style={{
        minWidth: 44,
        minHeight: 44,
        color: disabled
          ? 'var(--color-quaternaryLabel)'
          : 'var(--color-systemBlue)',
        opacity: disabled ? 0.5 : 1,
      }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SF Symbol Style Icons
   All icons: stroke style, round linecap/linejoin, 1.5-2px strokeWidth
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/** SF Symbol: chevron.left */
function BackIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M14 4L7 11L14 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SF Symbol: chevron.right */
function ForwardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M8 4L15 11L8 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SF Symbol: square.and.arrow.up */
function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M7 9V18a1 1 0 001 1h8a1 1 0 001-1V9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 2v10M8 5l3-3 3 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SF Symbol: book */
function BookmarkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <path
        d="M4 3h14a1 1 0 011 1v15l-4-2.5L11 19l-4-2.5L3 19V4a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 8h8M7 12h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SF Symbol: square.on.square (tabs) */
function TabsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
      <rect
        x="3"
        y="6"
        width="12"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 6V5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 01-2 2h-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** SF Symbol: plus */
function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
      <path
        d="M11 4v14M4 11h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SF Symbol: xmark (small close) */
function CloseIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path
        d="M2 2l8 8M10 2l-8 8"
        stroke="white"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SF Symbol: magnifyingglass */
function SearchIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <circle
        cx="9.5"
        cy="9.5"
        r="6.5"
        stroke="var(--color-secondaryLabel)"
        strokeWidth="1.6"
      />
      <path
        d="M14.5 14.5L19 19"
        stroke="var(--color-secondaryLabel)"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** SF Symbol: globe */
function GlobeIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 22 22"
      fill="none"
      style={{ color: 'var(--color-secondaryLabel)' }}
    >
      <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="11" cy="11" rx="4" ry="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 11h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4 6h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M4 16h14" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
