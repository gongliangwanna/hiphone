import { useEffect, useRef, type ComponentType } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSettingsNavStore } from './settingsNavStore';
import { useAppRuntimeStore, wasAppKilled, clearAppKilled } from '@/platform/stores/appRuntimeStore';
import { SettingsHome } from './SettingsHome';
import { AboutPage } from './AboutPage';
import { WallpaperPage } from './WallpaperPage';
import { AISettingsPage } from './pages/AISettingsPage';
import { AIToolsPage } from './pages/AIToolsPage';
import { AIBuilderModelPage } from './pages/AIBuilderModelPage';
import { PersonaPage } from './pages/PersonaPage';
import { SystemPromptEditPage, PostHistoryEditPage } from './pages/PromptEditPage';
import { DisplayPage } from './pages/DisplayPage';
import { CharactersPage } from './pages/CharactersPage';
import { CharacterEditPage } from './pages/CharacterEditPage';
import { DisclaimerPage } from './pages/DisclaimerPage';
import { WorldBooksPage } from './pages/WorldBooksPage';
import { WorldBookEditPage } from './pages/WorldBookEditPage';
import { WorldBookEntryEditPage } from './pages/WorldBookEntryEditPage';
import { PromptViewerPage } from './pages/PromptViewerPage';
import { HeartbeatSettingsPage } from './pages/HeartbeatSettingsPage';
import { ModelSelectPage } from './pages/ModelSelectPage';
import { DeveloperToolsPage } from './pages/DeveloperToolsPage';
import { StoragePage } from './pages/StoragePage';
import { AppScreen, NavBar } from '@/system';

const PAGE_TITLES: Record<string, string> = {
  home: '设置',
  // Device
  about: '关于本机',
  wallpaper: '壁纸',
  display: '显示与亮度',
  storage: '存储',
  // AI
  persona: '我的身份',
  aiSettings: 'AI 设置',
  aiTools: 'AI 工具',
  aiBuilderModel: '工坊代码模型',
  characters: '角色管理',
  characterEdit: '编辑角色',
  systemPromptEdit: '系统提示词',
  postHistoryEdit: '历史后置指令',
  worldBooks: '世界书',
  worldBookEdit: '编辑世界书',
  worldBookEntryEdit: '编辑条目',
  promptViewer: '记忆结构',
  modelSelect: '选择模型',
  heartbeat: '心跳系统',
  disclaimer: '免责声明',
  developerTools: '开发者工具',
};

type SettingsPageProps = { params?: Record<string, string> };

const asPage = (
  Component: ComponentType,
): ComponentType<SettingsPageProps> =>
  function PageAdapter() {
    return <Component />;
  };

const SettingsHomePage = asPage(SettingsHome);

const PAGE_COMPONENTS: Record<string, ComponentType<SettingsPageProps>> = {
  home: SettingsHomePage,
  about: asPage(AboutPage),
  wallpaper: asPage(WallpaperPage),
  display: asPage(DisplayPage),
  storage: asPage(StoragePage),
  persona: asPage(PersonaPage),
  aiSettings: asPage(AISettingsPage),
  aiTools: asPage(AIToolsPage),
  aiBuilderModel: asPage(AIBuilderModelPage),
  characters: asPage(CharactersPage),
  characterEdit: asPage(CharacterEditPage),
  systemPromptEdit: asPage(SystemPromptEditPage),
  postHistoryEdit: asPage(PostHistoryEditPage),
  worldBooks: asPage(WorldBooksPage),
  worldBookEdit: asPage(WorldBookEditPage),
  worldBookEntryEdit: asPage(WorldBookEntryEditPage),
  promptViewer: asPage(PromptViewerPage),
  modelSelect: asPage(ModelSelectPage),
  heartbeat: asPage(HeartbeatSettingsPage),
  disclaimer: asPage(DisclaimerPage),
  developerTools: asPage(DeveloperToolsPage),
};

/** iOS push/pop slide — 350ms, ease-out */
const SLIDE_MS = 350;
const SLIDE_EASE = [0.32, 0.72, 0, 1] as const;

export function SettingsApp() {
  const stack = useSettingsNavStore((s) => s.stack);
  const pop = useSettingsNavStore((s) => s.pop);
  const reset = useSettingsNavStore((s) => s.reset);
  const goHome = useAppRuntimeStore((s) => s.goHome);
  const prevLengthRef = useRef(stack.length);

  // Only reset navigation if the app was killed (swiped away in switcher).
  // Going home just backgrounds the app — it should resume on next open.
  useEffect(() => {
    if (wasAppKilled('settings')) {
      reset();
      clearAppKilled('settings');
    }
  }, [reset]);

  const currentItem = stack[stack.length - 1] ?? { page: 'home' as const };
  const currentPage = currentItem.page;
  const title = PAGE_TITLES[currentPage] ?? '设置';
  const showBack = stack.length > 1;

  // +1 = forward (push), -1 = backward (pop)
  const direction = stack.length > prevLengthRef.current ? 1 : -1;
  useEffect(() => {
    prevLengthRef.current = stack.length;
  }, [stack.length]);

  const handleBack = () => {
    if (stack.length <= 1) {
      reset();
      goHome();
    } else {
      pop();
    }
  };

  const PageComponent = PAGE_COMPONENTS[currentPage] ?? SettingsHomePage;
  const routeKey = `${currentPage}:${currentItem.params?.appId ?? ''}`;
  const header =
    currentPage === 'home' && !showBack ? (
      <NavBar title={title} variant="largeTitle" />
    ) : (
      <NavBar title={title} showBack={showBack} onBack={handleBack} />
    );

  return (
    <AppScreen backgroundColor="var(--color-secondarySystemBackground)">
      <div
        className="relative flex-1 overflow-hidden"
        data-testid="settings-app"
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={routeKey}
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
            {header}
            <div className="min-h-0 flex-1 overflow-hidden">
              <PageComponent params={currentItem.params} />
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </AppScreen>
  );
}
