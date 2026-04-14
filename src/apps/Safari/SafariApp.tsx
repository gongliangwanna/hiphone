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
import { spring, duration, ease } from '@/platform/design-tokens/motion';
import { useSafariStore, extractDomain } from './safariStore';
import { wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import './safari.css';

/* ── Favorites for start page ── */
const FAVORITES = [
  { name: 'Apple', url: 'https://www.apple.com', gradient: 'linear-gradient(145deg, #555, #2d2d2d)', letter: '' },
  { name: 'Google', url: 'https://www.google.com', gradient: 'linear-gradient(145deg, #4285f4, #2b6bcb)', letter: 'G' },
  { name: 'Wikipedia', url: 'https://zh.wikipedia.org', gradient: 'linear-gradient(145deg, #737373, #4a4a4a)', letter: 'W' },
  { name: '百度', url: 'https://www.baidu.com', gradient: 'linear-gradient(145deg, #2932e1, #1a24b8)', letter: '百' },
  { name: 'GitHub', url: 'https://github.com', gradient: 'linear-gradient(145deg, #3a3a3a, #1a1a1a)', letter: '' },
  { name: 'YouTube', url: 'https://www.youtube.com', gradient: 'linear-gradient(145deg, #ff2020, #cc0000)', letter: '' },
];

/* ── FavIcon — branded favicon with gradient background ──
   Brand logos (Apple, GitHub, YouTube) use inline SVGs because lucide-react
   does not include brand/corporate icons. Acknowledged exception to the
   lucide-react-only icon rule. */
function FavIcon({ fav }: { fav: (typeof FAVORITES)[number] }) {
  return (
    <div
      className="flex items-center justify-center rounded-[14px] text-white"
      style={{
        width: 52,
        height: 52,
        background: fav.gradient,
        boxShadow: '0 2px 8px rgba(0,0,0,0.12), inset 0 -1px 2px rgba(0,0,0,0.06)',
      }}
    >
      {fav.letter ? (
        <span className="text-[22px] font-bold">{fav.letter}</span>
      ) : fav.name === 'Apple' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M18.7 19.5c-.9 1.1-1.9 2.1-3.4 2.1-1.5 0-2-.9-3.6-.9-1.7 0-2.3.9-3.7.9-1.5 0-2.6-1.1-3.5-2.2C2.4 16.6 1.2 12.3 3.5 9.5c1.1-1.4 2.8-2.2 4.5-2.2 1.5 0 2.6 1 3.5 1s2.2-1.2 3.9-1c.7 0 2.5.3 3.7 2.1-3.2 1.9-2.7 6.8.6 8.1zM14.5 5.3c.9-1.1 1.5-2.6 1.3-4.3-1.3.1-2.8.9-3.7 2-.8.9-1.5 2.5-1.3 3.9 1.4.1 2.8-.7 3.7-1.6z" />
        </svg>
      ) : fav.name === 'GitHub' ? (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
        </svg>
      ) : (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
          <path d="M23 9.7s-.2-1.7-.9-2.4c-.8-.9-1.7-.9-2.2-.9C16.8 6 12 6 12 6s-4.8 0-7.9.4c-.4 0-1.4 0-2.2.9C1.2 8 1 9.7 1 9.7S.8 11.7.8 13.6v1.8c0 2 .2 3.9.2 3.9s.2 1.7.9 2.4c.8.9 1.9.8 2.4.9 1.7.2 7.7.2 7.7.2s4.8 0 7.9-.3c.4-.1 1.4-.1 2.2-.9.7-.7.9-2.4.9-2.4s.2-2 .2-3.9v-1.8c0-2-.2-3.9-.2-3.9zM9.5 16.2V8.8l6 3.7-6 3.7z" />
        </svg>
      )}
    </div>
  );
}

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
              transition={{ duration: duration.fast / 1000, ease: ease.standard }}
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
              transition={{ type: 'spring', ...spring.snappy }}
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
            transition={{ duration: duration.base / 1000, ease: ease.standard }}
          >
            <Material
              variant="chrome"
              className="flex items-center gap-0"
              style={{
                paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
                paddingBottom: 10,
                paddingLeft: 16,
                paddingRight: 16,
                borderBottom: '0.5px solid rgba(0, 0, 0, 0.06)',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0.92), rgba(248,248,250,0.96))',
                boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
              }}
            >
              <form onSubmit={handleSubmit} className="relative min-w-0 flex-1">
                <div className="pointer-events-none absolute left-3 top-0 bottom-0 flex items-center">
                  <Search size={16} strokeWidth={2} style={{ color: 'var(--color-secondaryLabel)' }} />
                </div>
                <input
                  ref={inputRef}
                  type="text"
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  placeholder="搜索或输入网站名称"
                  className="w-full rounded-[14px] border-0 py-[11px] pl-9 pr-9 outline-none text-[16px] tracking-[0.1px]"
                  style={{
                    background: 'linear-gradient(to bottom, #fafafa, #eeeff1)',
                    color: 'var(--color-label)',
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.08), inset 0 0 0 0.5px rgba(0,0,0,0.04), 0 1px 2px rgba(255,255,255,0.8)',
                  }}
                  data-testid="safari-url-input"
                />
                {editText && (
                  <button
                    type="button"
                    onClick={() => setEditText('')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 flex h-11 w-11 items-center justify-center"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: '#c7c7cc' }}>
                      <X size={10} strokeWidth={2.5} color="white" />
                    </span>
                  </button>
                )}
              </form>
              <button
                onClick={handleCancel}
                className="ml-2.5 shrink-0 rounded-[20px] px-3.5 py-[7px] text-[15px] font-medium transition-all duration-150 active:scale-95"
                style={{
                  color: 'var(--color-systemBlue)',
                  backgroundColor: 'rgba(0, 0, 0, 0.05)',
                  boxShadow: '0 0.5px 2px rgba(0,0,0,0.04)',
                }}
                data-testid="safari-cancel-edit"
              >
                取消
              </button>
            </Material>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5">
              {editText.trim() ? (
                <SearchSuggestions editText={editText} onSelect={navigateTo} />
              ) : (
                <EmptySearchState onFavoriteClick={handleFavoriteClick} />
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
                  className="truncate text-[15px] font-medium tracking-[0.2px]"
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
   EmptySearchState — Favorites grid + search history (used in editing overlay)
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function EmptySearchState({ onFavoriteClick }: { onFavoriteClick: (url: string) => void }) {
  const searchHistory = useSafariStore((s) => s.searchHistory);
  const navigateTo = useSafariStore((s) => s.navigateTo);

  return (
    <div className="mx-auto max-w-[500px]">
      <p className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-secondaryLabel)' }}>
        个人收藏
      </p>
      <div
        className="mb-6 grid grid-cols-4 gap-x-2.5 gap-y-3.5 rounded-2xl px-3.5 py-[18px]"
        style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)' }}
      >
        {FAVORITES.map((fav) => (
          <button key={fav.url} className="flex flex-col items-center gap-1.5" onClick={() => onFavoriteClick(fav.url)}>
            <FavIcon fav={fav} />
            <span className="max-w-full truncate text-[11px] font-medium" style={{ color: 'var(--color-label)' }}>{fav.name}</span>
          </button>
        ))}
      </div>

      {searchHistory.length > 0 && (
        <>
          <p className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-secondaryLabel)' }}>
            最近搜索
          </p>
          <div className="overflow-hidden rounded-2xl" style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)' }}>
            {searchHistory.map((query, i) => (
              <button
                key={query}
                className="flex w-full items-center gap-3.5 px-4 py-3 text-left active:bg-black/[0.03]"
                style={{ borderTop: i > 0 ? '0.5px solid rgba(0,0,0,0.06)' : undefined }}
                onClick={() => navigateTo(query)}
              >
                <Search size={16} strokeWidth={2} style={{ color: 'var(--color-secondaryLabel)' }} />
                <span className="flex-1 text-[16px]" style={{ color: 'var(--color-systemBlue)' }}>{query}</span>
                <ChevronRight size={14} strokeWidth={2} style={{ color: 'var(--color-quaternaryLabel)' }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SearchSuggestions — shown when text is entered in URL overlay
   ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

function SearchSuggestions({ editText, onSelect }: { editText: string; onSelect: (input: string) => void }) {
  const trimmed = editText.trim();
  const matchedFav = FAVORITES.find(
    (f) => f.name.toLowerCase().includes(trimmed.toLowerCase()) || f.url.toLowerCase().includes(trimmed.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-[500px] space-y-2">
      <button
        className="flex w-full items-center gap-3.5 rounded-[14px] px-4 py-3 active:bg-black/[0.03]"
        style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)' }}
        onClick={() => onSelect(trimmed)}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: 'linear-gradient(135deg, #007aff, #5ac8fa)' }}>
          <Search size={16} strokeWidth={2} color="white" />
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-[16px]" style={{ color: 'var(--color-label)' }}>{trimmed}</p>
          <p className="text-[12px]" style={{ color: 'var(--color-secondaryLabel)' }}>DuckDuckGo 搜索</p>
        </div>
        <ChevronRight size={16} strokeWidth={2} style={{ color: 'var(--color-quaternaryLabel)' }} />
      </button>

      {matchedFav && (
        <button
          className="flex w-full items-center gap-3.5 rounded-[14px] px-4 py-3 active:bg-black/[0.03]"
          style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)' }}
          onClick={() => onSelect(matchedFav.url)}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]" style={{ background: matchedFav.gradient }}>
            {matchedFav.letter ? (
              <span className="text-xs font-bold text-white">{matchedFav.letter}</span>
            ) : (
              <Globe size={16} strokeWidth={1.8} color="white" />
            )}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-[16px]" style={{ color: 'var(--color-label)' }}>{matchedFav.name}</p>
            <p className="text-[12px]" style={{ color: 'var(--color-secondaryLabel)' }}>{extractDomain(matchedFav.url)} — 个人收藏</p>
          </div>
          <ChevronRight size={16} strokeWidth={2} style={{ color: 'var(--color-quaternaryLabel)' }} />
        </button>
      )}
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
          className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-secondaryLabel)' }}
        >
          个人收藏
        </p>
        <div
          className="mb-8 grid grid-cols-4 gap-x-2.5 gap-y-3.5 rounded-2xl px-3.5 py-[18px]"
          style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)' }}
        >
          {FAVORITES.map((fav) => (
            <button
              key={fav.url}
              className="flex flex-col items-center gap-1.5"
              onClick={() => onFavoriteClick(fav.url)}
              data-testid={`safari-fav-${fav.name}`}
            >
              <FavIcon fav={fav} />
              <span
                className="max-w-full truncate text-[11px] font-medium"
                style={{ color: 'var(--color-label)' }}
              >
                {fav.name}
              </span>
            </button>
          ))}
        </div>

        {/* Frequently visited section */}
        <p
          className="mb-2.5 pl-1 text-[13px] font-semibold uppercase tracking-wider"
          style={{ color: 'var(--color-secondaryLabel)' }}
        >
          经常访问的网站
        </p>
        <div
          className="flex items-center justify-center rounded-2xl py-12"
          style={{ backgroundColor: 'rgba(255,255,255,0.85)', boxShadow: '0 1px 4px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.04)' }}
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
        className="absolute -right-4 -top-4 z-20 flex h-11 w-11 items-center justify-center"
        data-testid={`safari-close-tab-${tab.id}`}
      >
        <span
          className="flex items-center justify-center rounded-full shadow-md"
          style={{
            width: 24,
            height: 24,
            backgroundColor: 'var(--color-tertiarySystemGroupedBackground)',
            border: '0.5px solid var(--color-separator)',
          }}
        >
          <X size={10} strokeWidth={2} color="var(--color-secondaryLabel)" />
        </span>
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

