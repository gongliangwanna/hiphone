import { useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Share,
  BookOpen,
  Plus,
  X,
  Search,
  Globe,
  Lock,
} from 'lucide-react';
import { AppScreen } from '@/system';
import { Material } from '@/system/Material/Material';
import { useSafariStore, extractDomain } from './safariStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import './safari.css';

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
  const isLoading = useSafariStore((s) => s.isLoading);
  const setLoading = useSafariStore((s) => s.setLoading);

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

  const handleIframeLoad = useCallback(() => {
    setLoading(false);
  }, [setLoading]);

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
            onLoad={handleIframeLoad}
            data-testid="safari-iframe"
          />
        )}
      </div>

      {/* ── Full-screen URL editing overlay ── */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            className="absolute inset-0 z-50 flex flex-col"
            style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
          >
            {/* Top bar with input + cancel */}
            <Material
              variant="chrome"
              className="flex items-center gap-2 px-4"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
                paddingBottom: 8,
                borderBottom: '0.5px solid var(--color-separator)',
              }}
            >
              <form onSubmit={handleSubmit} className="min-w-0 flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="搜索或输入网站名称"
                  className="w-full rounded-xl border-0 py-2 pl-9 pr-3 outline-none"
                  style={{
                    backgroundColor: 'var(--color-tertiarySystemFill)',
                    color: 'var(--color-label)',
                    fontSize: 17,
                    height: 40,
                  }}
                  data-testid="safari-url-input"
                />
                <div className="absolute left-3 top-0 bottom-0 flex items-center pointer-events-none">
                  <Search size={16} strokeWidth={2} style={{ color: 'var(--color-secondaryLabel)' }} />
                </div>
              </form>
              <button
                onClick={handleCancel}
                className="shrink-0 px-1 text-[17px]"
                style={{
                  color: 'var(--color-systemBlue)',
                  minWidth: 44,
                  minHeight: 44,
                }}
                data-testid="safari-cancel-edit"
              >
                取消
              </button>
            </Material>

            {/* Suggestions area (simple — show favorites) */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6">
              {editText.trim() ? (
                <div
                  className="flex items-center gap-3 rounded-2xl px-4 py-3.5 shadow-sm"
                  style={{ backgroundColor: 'var(--color-secondarySystemGroupedBackground)' }}
                  onClick={() => navigateTo(editText)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: 'var(--color-tertiarySystemFill)' }}>
                    <Search size={16} strokeWidth={2} style={{ color: 'var(--color-secondaryLabel)' }} />
                  </div>
                  <span
                    className="text-[17px]"
                    style={{ color: 'var(--color-label)' }}
                  >
                    搜索 "{editText}"
                  </span>
                </div>
              ) : (
                <div className="mx-auto max-w-[500px]">
                  <p
                    className="mb-3 text-lg font-bold"
                    style={{ color: 'var(--color-label)' }}
                  >
                    个人收藏
                  </p>
                  <div
                    className="grid grid-cols-4 gap-x-4 gap-y-6 rounded-2xl px-4 py-6"
                    style={{ backgroundColor: 'var(--color-secondarySystemGroupedBackground)' }}
                  >
                    {FAVORITES.map((fav) => (
                      <button
                        key={fav.url}
                        className="flex flex-col items-center gap-2"
                        onClick={() => handleFavoriteClick(fav.url)}
                      >
                        <div
                          className="flex items-center justify-center rounded-xl shadow-sm"
                          style={{
                            width: 56,
                            height: 56,
                            backgroundColor: 'var(--color-tertiarySystemGroupedBackground)',
                            fontSize: 28,
                          }}
                        >
                          {fav.icon}
                        </div>
                        <span
                          className="max-w-full truncate text-[11px]"
                          style={{ color: 'var(--color-secondaryLabel)' }}
                        >
                          {fav.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom bar: URL capsule + toolbar ── */}
      <Material
        variant="chrome"
        className="shrink-0 flex flex-col"
        style={{
          borderTop: '0.5px solid rgba(0, 0, 0, 0.06)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.88), rgba(244,244,248,0.95))',
          boxShadow: '0 -2px 20px rgba(0,0,0,0.04)',
        }}
      >
        {/* URL capsule bar */}
        <div className="flex items-center justify-center px-4 pt-3 pb-2">
          <button
            onClick={handleUrlBarClick}
            className={`relative flex w-full items-center justify-center rounded-[14px] px-4 overflow-hidden ${
              isLoading ? 'safari-url-capsule-loading' : ''
            }`}
            style={{
              height: 44,
              maxWidth: 500,
              background: 'linear-gradient(to bottom, #fafafa, #eeeff1)',
              boxShadow: isLoading
                ? undefined
                : 'inset 0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(255,255,255,0.8)',
            }}
            data-testid="safari-url-bar"
          >
            {showStartPage ? (
              <span className="relative z-[1] text-[15px]" style={{ color: 'var(--color-secondaryLabel)' }}>
                搜索或输入网站名称
              </span>
            ) : (
              <div className="relative z-[1] flex items-center gap-1.5">
                <Lock size={12} strokeWidth={2} style={{ color: '#34c759' }} />
                <span
                  className="truncate text-[15px] font-medium tracking-wide"
                  style={{ color: 'var(--color-label)' }}
                >
                  {displayDomain}
                </span>
              </div>
            )}
          </button>
        </div>

        {/* Toolbar */}
        <div
          className="flex items-center justify-between px-6 pb-2"
          style={{ height: TOOLBAR_HEIGHT }}
        >
          <ToolbarButton
            onClick={goBack}
            disabled={!canGoBack}
            testId="safari-back"
          >
            <ChevronLeft size={22} strokeWidth={2.5} />
          </ToolbarButton>
          <ToolbarButton
            onClick={goForward}
            disabled={!canGoForward}
            testId="safari-forward"
          >
            <ChevronRight size={22} strokeWidth={2.5} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {}}
            testId="safari-share"
          >
            <Share size={20} strokeWidth={1.8} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => {}}
            testId="safari-bookmarks"
          >
            <BookOpen size={20} strokeWidth={1.8} />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setView('tabs')}
            testId="safari-tabs-btn"
          >
            <span
              className="flex items-center justify-center rounded-lg text-[13px] font-bold"
              style={{
                width: 28,
                height: 26,
                background: 'rgba(0, 122, 255, 0.07)',
                border: '1.5px solid rgba(0, 122, 255, 0.2)',
                color: 'var(--color-systemBlue)',
              }}
            >
              {tabs.length}
            </span>
          </ToolbarButton>
        </div>
      </Material>
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
      className="h-full overflow-y-auto px-5 pt-12 pb-24"
      style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
      data-testid="safari-start-page"
    >
      <div className="mx-auto max-w-[500px]">
        {/* Favorites section */}
        <p
          className="mb-3 text-lg font-bold"
          style={{ color: 'var(--color-label)' }}
        >
          个人收藏
        </p>
        <div
          className="mb-8 grid grid-cols-4 gap-x-4 gap-y-6 rounded-2xl px-4 py-6"
          style={{ backgroundColor: 'var(--color-secondarySystemGroupedBackground)' }}
        >
          {FAVORITES.map((fav) => (
            <button
              key={fav.url}
              className="flex flex-col items-center gap-2"
              onClick={() => onFavoriteClick(fav.url)}
              data-testid={`safari-fav-${fav.name}`}
            >
              <div
                className="flex items-center justify-center rounded-xl shadow-sm"
                style={{
                  width: 56,
                  height: 56,
                  backgroundColor: 'var(--color-tertiarySystemGroupedBackground)',
                  fontSize: 28,
                }}
              >
                {fav.icon}
              </div>
              <span
                className="max-w-full truncate text-[11px]"
                style={{ color: 'var(--color-secondaryLabel)' }}
              >
                {fav.name}
              </span>
            </button>
          ))}
        </div>

        {/* Frequently visited section */}
        <p
          className="mb-3 text-lg font-bold"
          style={{ color: 'var(--color-label)' }}
        >
          经常访问的网站
        </p>
        <div
          className="flex items-center justify-center rounded-2xl py-12"
          style={{ backgroundColor: 'var(--color-secondarySystemGroupedBackground)' }}
        >
          <span
            className="text-sm"
            style={{ color: 'var(--color-tertiaryLabel)' }}
          >
            暂无经常访问的网站
          </span>
        </div>
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
      className="flex h-full flex-col items-center justify-center px-8 pb-20"
      style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
      data-testid="safari-error-page"
    >
      <div className="mb-6">
        <Globe size={64} strokeWidth={1.2} style={{ color: 'var(--color-tertiaryLabel)' }} />
      </div>
      <p
        className="mb-3 text-center text-xl font-bold"
        style={{ color: 'var(--color-label)' }}
      >
        无法打开页面
      </p>
      <p
        className="mb-6 text-center text-[15px] leading-relaxed"
        style={{ color: 'var(--color-secondaryLabel)' }}
      >
        Safari 无法打开页面，因为此网站不允许在框架中显示。
      </p>
      <div 
        className="rounded-xl px-4 py-2"
        style={{ backgroundColor: 'var(--color-secondarySystemGroupedBackground)' }}
      >
        <p
          className="text-center text-sm font-medium"
          style={{ color: 'var(--color-secondaryLabel)' }}
        >
          {extractDomain(url)}
        </p>
      </div>
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
      style={{ backgroundColor: 'var(--color-systemGroupedBackground)' }}
      data-testid="safari-tab-grid"
    >
      {/* Header */}
      <Material
        variant="chrome"
        className="absolute top-0 z-10 flex w-full shrink-0 items-center justify-between px-4"
        style={{
          height: 52,
          paddingTop: 'env(safe-area-inset-top, 0px)',
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
          <Plus size={22} strokeWidth={2} />
        </button>
        <span
          className="text-base font-semibold"
          style={{ color: 'var(--color-label)' }}
        >
          {tabs.length}个标签页
        </span>
        <button
          onClick={handleDone}
          className="text-base font-semibold"
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
      </Material>

      {/* Grid */}
      <div
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        style={{
          paddingTop: 'calc(52px + env(safe-area-inset-top, 0px) + 16px)',
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 60px)',
        }}
      >
        <div className="grid grid-cols-2 gap-4">
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
      <Material
        variant="chrome"
        className="absolute bottom-0 z-10 flex w-full shrink-0 items-center justify-center px-4"
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
          <Plus size={22} strokeWidth={2} />
        </button>
      </Material>
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
      className="relative overflow-visible"
      layout
      data-testid={`safari-tab-card-${tab.id}`}
    >
      {/* Close button - Top Right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        className="absolute -right-2 -top-2 z-20 flex items-center justify-center rounded-full shadow-md"
        style={{
          width: 24,
          height: 24,
          backgroundColor: 'var(--color-tertiarySystemGroupedBackground)',
          border: '0.5px solid var(--color-separator)',
        }}
        data-testid={`safari-close-tab-${tab.id}`}
      >
        <X size={10} strokeWidth={2} color="var(--color-secondaryLabel)" />
      </button>

      {/* Card content (click to select) */}
      <button
        onClick={onSelect}
        className="flex w-full flex-col overflow-hidden rounded-2xl shadow-sm"
        style={{
          backgroundColor: 'var(--color-secondarySystemGroupedBackground)',
          border: isActive
            ? '2.5px solid var(--color-systemBlue)'
            : '0.5px solid var(--color-separator)',
        }}
      >
        {/* Title bar */}
        <div
          className="flex w-full items-center gap-2 px-3 py-2.5"
          style={{ borderBottom: '0.5px solid var(--color-separator)' }}
        >
          <Globe size={14} strokeWidth={1.8} />
          <span
            className="flex-1 truncate text-left text-xs font-medium"
            style={{ color: 'var(--color-label)' }}
          >
            {tab.title}
          </span>
        </div>

        {/* Preview area */}
        <div
          className="flex w-full items-center justify-center"
          style={{
            height: 160,
            backgroundColor: tab.url
              ? 'var(--color-systemBackground)'
              : 'var(--color-systemGroupedBackground)',
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
              className="text-2xl font-bold"
              style={{ color: 'var(--color-quaternaryLabel)' }}
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
      className="flex items-center justify-center rounded-[10px] transition-all duration-150 active:scale-[0.92] active:bg-black/[0.06]"
      style={{
        minWidth: 44,
        minHeight: 38,
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

