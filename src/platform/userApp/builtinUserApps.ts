/**
 * Built-in user apps: ship with hiPhone, run through the user-app
 * sandbox pipeline (compile → sandbox → register), but cannot be
 * uninstalled and don't appear in App Store's "installed" list.
 *
 * Source files for each app live under src/apps/<id>/ as real .tsx/.ts
 * files (IDE highlight + tsc + ESLint friendly), and are pulled in here
 * as raw strings via Vite's ?raw query so the sandbox can compile them.
 */

import { appRegistry } from '@/platform/appRegistry';
import { compileTsx } from './compiler';
import { createUserAppRuntime } from './moduleResolver';
import { resolveModule } from './sdk';
import { wrapUserComponent } from './sdk/wrap';

// Translate app source files (S3 — core translate flow; S4 adds sheets + custom lang entry;
// S5 adds history + favorites).
import translateAppSrc from '@/apps/translate/TranslateApp.tsx?raw';
import translateLangBarSrc from '@/apps/translate/selectors/LangBar.tsx?raw';
import translateLangSheetSrc from '@/apps/translate/selectors/LangSheet.tsx?raw';
import translateCustomLangInputSrc from '@/apps/translate/selectors/CustomLangInput.tsx?raw';
import translateSourcePanelSrc from '@/apps/translate/panels/SourcePanel.tsx?raw';
import translateTargetPanelSrc from '@/apps/translate/panels/TargetPanel.tsx?raw';
import translateUseTranslateSrc from '@/apps/translate/hooks/useTranslate.ts?raw';
import translateLanguagesSrc from '@/apps/translate/constants/languages.ts?raw';
import translateUseHistorySrc from '@/apps/translate/hooks/useHistory.ts?raw';
import translateRecentRowSrc from '@/apps/translate/recents/RecentRow.tsx?raw';
import translateRecentsSheetSrc from '@/apps/translate/recents/RecentsSheet.tsx?raw';
import translateFavoritesSheetSrc from '@/apps/translate/recents/FavoritesSheet.tsx?raw';

export interface BuiltinUserApp {
  id: string;
  name: string;
  files: Record<string, string>;
  entry: string;
  perspectiveAware: boolean;
  globalData: boolean;
}

export const BUILTIN_USER_APPS: BuiltinUserApp[] = [
  {
    id: 'translate',
    name: '翻译',
    entry: 'TranslateApp.tsx',
    files: {
      'TranslateApp.tsx': translateAppSrc,
      'selectors/LangBar.tsx': translateLangBarSrc,
      'selectors/LangSheet.tsx': translateLangSheetSrc,
      'selectors/CustomLangInput.tsx': translateCustomLangInputSrc,
      'panels/SourcePanel.tsx': translateSourcePanelSrc,
      'panels/TargetPanel.tsx': translateTargetPanelSrc,
      'hooks/useTranslate.ts': translateUseTranslateSrc,
      'constants/languages.ts': translateLanguagesSrc,
      'hooks/useHistory.ts': translateUseHistorySrc,
      'recents/RecentRow.tsx': translateRecentRowSrc,
      'recents/RecentsSheet.tsx': translateRecentsSheetSrc,
      'recents/FavoritesSheet.tsx': translateFavoritesSheetSrc,
    },
    perspectiveAware: true,
    globalData: false,
  },
];

export async function mountBuiltinUserApps(): Promise<void> {
  for (const app of BUILTIN_USER_APPS) {
    try {
      const compiledMap: Record<string, string> = {};
      for (const [path, source] of Object.entries(app.files)) {
        compiledMap[path] = await compileTsx(source, `${app.id}/${path}`);
      }
      const RawComponent = createUserAppRuntime(
        compiledMap,
        app.entry,
        resolveModule,
        app.id,
      );
      const WrappedComponent = wrapUserComponent(RawComponent);
      appRegistry.register({
        id: app.id,
        name: app.name,
        type: 'builtin',
        component: WrappedComponent,
        perspectiveAware: app.perspectiveAware,
        globalData: app.globalData,
      });
    } catch (err) {
      console.error(`[builtinUserApps] failed to mount "${app.id}":`, err);
    }
  }
}
