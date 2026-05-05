# Multilingual M1 i18n Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first multilingual milestone: locale types, dictionary lookup, global locale persistence, root provider, Settings language switcher, user-app SDK surface, and focused tests.

**Architecture:** `useSystemStore.locale` is the single device-wide source of truth. React UI reads locale through `I18nProvider`/`useI18n`, non-React code uses pure i18n helpers, and sandboxed user apps get locale through `@hiphone/i18n`. This milestone intentionally migrates only the Display settings page text needed for the language switcher; full Shell/System/App prompt migration is covered by later milestones from the spec.

**Tech Stack:** React 19, TypeScript, Zustand persisted with `idbStorage`, Vitest, Testing Library, existing `@hiphone/*` user-app SDK registry.

---

## User Requirements And Decisions

- First built-in locales: `zh-CN` and `en-US`.
- Locale framework must be extensible for future languages.
- Locale preference is global for the whole device, not per owner/character.
- Default locale is `zh-CN`; do not auto-detect browser language in M1.
- First language switcher lives in `设置 > 显示与亮度`.
- Switching locale must not clear app state, histories, memories, or user data.
- User-app SDK must expose current locale and platform translation helpers through `@hiphone/i18n`.

## File Map

- Create `src/platform/i18n/locales.ts`: locale type, supported locale list, display labels, normalization.
- Create `src/platform/i18n/messages/zh-CN/settings.ts`: Chinese Settings messages for M1.
- Create `src/platform/i18n/messages/zh-CN/system.ts`: Chinese platform/system messages for M1.
- Create `src/platform/i18n/messages/en-US/settings.ts`: English Settings messages for M1.
- Create `src/platform/i18n/messages/en-US/system.ts`: English platform/system messages for M1.
- Create `src/platform/i18n/messages/index.ts`: merged dictionaries keyed by locale.
- Create `src/platform/i18n/dictionary.ts`: translation lookup, fallback, interpolation, non-React `t`.
- Create `src/platform/i18n/format.ts`: locale-aware date and number formatting helpers.
- Create `src/platform/i18n/I18nProvider.tsx`: context provider and `<html lang>` sync.
- Create `src/platform/i18n/useI18n.ts`: React hook for consuming provider state.
- Create `src/platform/i18n/index.ts`: public i18n exports.
- Create `src/platform/i18n/AGENTS.md`: i18n directory rules and pitfalls.
- Create `src/platform/i18n/__tests__/dictionary.test.ts`: locale/dictionary/format tests.
- Create `src/platform/i18n/__tests__/I18nProvider.test.tsx`: provider and hook tests.
- Modify `src/platform/stores/systemStore.ts`: add persisted `locale` and `setLocale`.
- Modify `src/platform/stores/__tests__/systemStore.test.ts`: cover default locale and normalization.
- Modify `src/App.tsx`: wrap device tree with `I18nProvider`.
- Modify `src/apps/Settings/pages/DisplayPage.tsx`: use i18n strings and add language selector.
- Create `src/apps/Settings/pages/__tests__/DisplayPage.test.tsx`: verify language switcher and re-render.
- Create `src/platform/userApp/sdk/i18n.ts`: sandbox SDK locale helpers.
- Modify `src/platform/userApp/sdk/index.ts`: register `@hiphone/i18n`.
- Modify `src/platform/userApp/sdk/__tests__/index.test.ts`: verify SDK resolver.

## Task 1: Locale Types, Messages, Dictionary, And Format Helpers

**Files:**
- Create: `src/platform/i18n/locales.ts`
- Create: `src/platform/i18n/messages/zh-CN/settings.ts`
- Create: `src/platform/i18n/messages/zh-CN/system.ts`
- Create: `src/platform/i18n/messages/en-US/settings.ts`
- Create: `src/platform/i18n/messages/en-US/system.ts`
- Create: `src/platform/i18n/messages/index.ts`
- Create: `src/platform/i18n/dictionary.ts`
- Create: `src/platform/i18n/format.ts`
- Create: `src/platform/i18n/index.ts`
- Test: `src/platform/i18n/__tests__/dictionary.test.ts`

- [ ] **Step 1: Write failing tests for locale normalization, fallback, interpolation, and formatting**

Create `src/platform/i18n/__tests__/dictionary.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  normalizeLocale,
} from '../locales';
import {
  createTranslator,
  getLocaleDisplayName,
  translate,
} from '../dictionary';
import { formatDate, formatNumber } from '../format';

describe('locales', () => {
  it('defines zh-CN and en-US with zh-CN as the default', () => {
    expect(SUPPORTED_LOCALES).toEqual(['zh-CN', 'en-US']);
    expect(DEFAULT_LOCALE).toBe('zh-CN');
    expect(LOCALE_LABELS['zh-CN'].nativeName).toBe('简体中文');
    expect(LOCALE_LABELS['en-US'].nativeName).toBe('English');
  });

  it('normalizes unsupported locale values to zh-CN', () => {
    expect(isSupportedLocale('zh-CN')).toBe(true);
    expect(isSupportedLocale('en-US')).toBe(true);
    expect(isSupportedLocale('ja-JP')).toBe(false);
    expect(normalizeLocale('en-US')).toBe('en-US');
    expect(normalizeLocale('ja-JP')).toBe(DEFAULT_LOCALE);
    expect(normalizeLocale(undefined)).toBe(DEFAULT_LOCALE);
  });
});

describe('dictionary', () => {
  it('translates M1 settings keys in both built-in locales', () => {
    expect(translate('zh-CN', 'settings.display.brightness')).toBe('亮度');
    expect(translate('en-US', 'settings.display.brightness')).toBe('Brightness');
  });

  it('falls back to zh-CN when a locale is unsupported', () => {
    expect(translate('ja-JP', 'settings.display.language')).toBe('语言');
  });

  it('interpolates named variables', () => {
    expect(
      translate('en-US', 'system.language.current', { language: 'English' }),
    ).toBe('Current language: English');
  });

  it('keeps missing variables visible and warns in development-style calls', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(translate('en-US', 'system.language.current')).toBe(
      'Current language: {language}',
    );
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[i18n] Missing variable "language"'),
    );
    warn.mockRestore();
  });

  it('returns the key when no locale contains the message', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(translate('en-US', 'missing.key')).toBe('missing.key');
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('[i18n] Missing message key "missing.key"'),
    );
    warn.mockRestore();
  });

  it('creates a stable translator for a locale', () => {
    const t = createTranslator('en-US');
    expect(t('settings.display.textSize')).toBe('Text Size');
  });

  it('returns locale display names in the requested interface locale', () => {
    expect(getLocaleDisplayName('zh-CN', 'zh-CN')).toBe('简体中文');
    expect(getLocaleDisplayName('zh-CN', 'en-US')).toBe('Simplified Chinese');
    expect(getLocaleDisplayName('en-US', 'zh-CN')).toBe('英语');
    expect(getLocaleDisplayName('en-US', 'en-US')).toBe('English');
  });
});

describe('format helpers', () => {
  it('formats numbers with the requested locale', () => {
    expect(formatNumber(1234.5, 'en-US')).toBe('1,234.5');
  });

  it('formats dates with explicit options', () => {
    expect(
      formatDate('2026-05-05T00:00:00Z', 'en-US', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    ).toBe('05/05/2026');
  });
});
```

- [ ] **Step 2: Run the failing i18n test**

Run:

```bash
pnpm vitest run src/platform/i18n/__tests__/dictionary.test.ts
```

Expected: FAIL because `src/platform/i18n/*` does not exist yet.

- [ ] **Step 3: Implement locale types**

Create `src/platform/i18n/locales.ts`:

```ts
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export const LOCALE_LABELS: Record<
  Locale,
  {
    nativeName: string;
    englishName: string;
    chineseName: string;
    interfaceLanguageName: string;
  }
> = {
  'zh-CN': {
    nativeName: '简体中文',
    englishName: 'Simplified Chinese',
    chineseName: '简体中文',
    interfaceLanguageName: '简体中文',
  },
  'en-US': {
    nativeName: 'English',
    englishName: 'English',
    chineseName: '英语',
    interfaceLanguageName: 'English',
  },
};

export function isSupportedLocale(value: unknown): value is Locale {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(value)
  );
}

export function normalizeLocale(value: unknown): Locale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}
```

- [ ] **Step 4: Add M1 message dictionaries**

Create `src/platform/i18n/messages/zh-CN/settings.ts`:

```ts
export const settingsZhCN = {
  'settings.display.brightness': '亮度',
  'settings.display.textSize': '文字大小',
  'settings.display.appearance': '外观',
  'settings.display.darkMode.light': '浅色',
  'settings.display.darkMode.dark': '深色',
  'settings.display.darkMode.auto': '自动',
  'settings.display.language': '语言',
  'settings.display.languageFooter': '语言会影响系统界面、工具型 AI 输出和新生成的提示词。',
  'settings.display.languageOption.zh-CN': '简体中文',
  'settings.display.languageOption.en-US': 'English',
  'settings.display.languageCurrent': '当前语言',
} as const;
```

Create `src/platform/i18n/messages/zh-CN/system.ts`:

```ts
export const systemZhCN = {
  'system.language.current': '当前语言：{language}',
  'system.nav.back': '返回',
} as const;
```

Create `src/platform/i18n/messages/en-US/settings.ts`:

```ts
export const settingsEnUS = {
  'settings.display.brightness': 'Brightness',
  'settings.display.textSize': 'Text Size',
  'settings.display.appearance': 'Appearance',
  'settings.display.darkMode.light': 'Light',
  'settings.display.darkMode.dark': 'Dark',
  'settings.display.darkMode.auto': 'Automatic',
  'settings.display.language': 'Language',
  'settings.display.languageFooter': 'Language affects the system interface, tool-style AI output, and newly generated prompts.',
  'settings.display.languageOption.zh-CN': 'Simplified Chinese',
  'settings.display.languageOption.en-US': 'English',
  'settings.display.languageCurrent': 'Current Language',
} as const;
```

Create `src/platform/i18n/messages/en-US/system.ts`:

```ts
export const systemEnUS = {
  'system.language.current': 'Current language: {language}',
  'system.nav.back': 'Back',
} as const;
```

Create `src/platform/i18n/messages/index.ts`:

```ts
import type { Locale } from '../locales';
import { settingsZhCN } from './zh-CN/settings';
import { systemZhCN } from './zh-CN/system';
import { settingsEnUS } from './en-US/settings';
import { systemEnUS } from './en-US/system';

export type MessageDictionary = Record<string, string>;

export const messages: Record<Locale, MessageDictionary> = {
  'zh-CN': {
    ...settingsZhCN,
    ...systemZhCN,
  },
  'en-US': {
    ...settingsEnUS,
    ...systemEnUS,
  },
};
```

- [ ] **Step 5: Implement dictionary lookup and interpolation**

Create `src/platform/i18n/dictionary.ts`:

```ts
import {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  type Locale,
  normalizeLocale,
} from './locales';
import { messages } from './messages';

export type I18nValue = string | number;
export type I18nVars = Record<string, I18nValue>;
export type Translator = (key: string, vars?: I18nVars) => string;

const TOKEN_RE = /\{([a-zA-Z0-9_]+)\}/g;

function warn(message: string): void {
  if (typeof console !== 'undefined') {
    console.warn(message);
  }
}

function interpolate(template: string, vars: I18nVars | undefined, key: string): string {
  return template.replace(TOKEN_RE, (match, name: string) => {
    const value = vars?.[name];
    if (value === undefined || value === null) {
      warn(`[i18n] Missing variable "${name}" for key "${key}".`);
      return match;
    }
    return String(value);
  });
}

export function translate(
  localeLike: unknown,
  key: string,
  vars?: I18nVars,
): string {
  const locale = normalizeLocale(localeLike);
  const template = messages[locale][key] ?? messages[DEFAULT_LOCALE][key];
  if (template === undefined) {
    warn(`[i18n] Missing message key "${key}" for locale "${locale}".`);
    return key;
  }
  return interpolate(template, vars, key);
}

export function createTranslator(localeLike: unknown): Translator {
  const locale = normalizeLocale(localeLike);
  return (key, vars) => translate(locale, key, vars);
}

export function getLocaleDisplayName(localeLike: unknown, interfaceLocaleLike: unknown): string {
  const locale = normalizeLocale(localeLike);
  const interfaceLocale = normalizeLocale(interfaceLocaleLike);
  const labels = LOCALE_LABELS[locale];
  return interfaceLocale === 'zh-CN' ? labels.chineseName : labels.englishName;
}
```

- [ ] **Step 6: Implement format helpers and barrel export**

Create `src/platform/i18n/format.ts`:

```ts
import { type Locale, normalizeLocale } from './locales';

export function formatDate(
  value: Date | number | string,
  localeLike: unknown,
  options?: Intl.DateTimeFormatOptions,
): string {
  const locale: Locale = normalizeLocale(localeLike);
  return new Intl.DateTimeFormat(locale, options).format(new Date(value));
}

export function formatNumber(
  value: number,
  localeLike: unknown,
  options?: Intl.NumberFormatOptions,
): string {
  const locale: Locale = normalizeLocale(localeLike);
  return new Intl.NumberFormat(locale, options).format(value);
}
```

Create `src/platform/i18n/index.ts`:

```ts
export {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  isSupportedLocale,
  normalizeLocale,
  type Locale,
} from './locales';
export {
  createTranslator,
  getLocaleDisplayName,
  translate,
  type I18nVars,
  type Translator,
} from './dictionary';
export { formatDate, formatNumber } from './format';
export { I18nProvider } from './I18nProvider';
export { useI18n } from './useI18n';
```

- [ ] **Step 7: Run the dictionary test**

Run:

```bash
pnpm vitest run src/platform/i18n/__tests__/dictionary.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git add src/platform/i18n/locales.ts \
        src/platform/i18n/messages \
        src/platform/i18n/dictionary.ts \
        src/platform/i18n/format.ts \
        src/platform/i18n/index.ts \
        src/platform/i18n/__tests__/dictionary.test.ts
git commit -m "feat(i18n): add locale dictionary foundation"
```

## Task 2: Persist Global Locale In System Store

**Files:**
- Modify: `src/platform/stores/systemStore.ts`
- Modify: `src/platform/stores/__tests__/systemStore.test.ts`

- [ ] **Step 1: Write failing system store locale tests**

Modify `src/platform/stores/__tests__/systemStore.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { DEFAULT_LOCALE } from '@/platform/i18n/locales';
import { useSystemStore } from '../systemStore';

describe('systemStore', () => {
  beforeEach(() => {
    useSystemStore.setState({
      isLocked: true,
      brightness: 0.8,
      volume: 0.5,
      wallpaperId: 'ios-26-stock-01',
      customWallpapers: [],
      textSize: 1,
      darkMode: 'light',
      silentMode: false,
      locale: DEFAULT_LOCALE,
    });
  });

  it('starts locked', () => {
    expect(useSystemStore.getState().isLocked).toBe(true);
  });

  it('unlock sets isLocked to false', () => {
    useSystemStore.getState().unlock();
    expect(useSystemStore.getState().isLocked).toBe(false);
  });

  it('lock sets isLocked to true', () => {
    useSystemStore.getState().unlock();
    useSystemStore.getState().lock();
    expect(useSystemStore.getState().isLocked).toBe(true);
  });

  it('setBrightness clamps to 0-1', () => {
    useSystemStore.getState().setBrightness(1.5);
    expect(useSystemStore.getState().brightness).toBe(1);
    useSystemStore.getState().setBrightness(-0.5);
    expect(useSystemStore.getState().brightness).toBe(0);
    useSystemStore.getState().setBrightness(0.6);
    expect(useSystemStore.getState().brightness).toBe(0.6);
  });

  it('setVolume clamps to 0-1', () => {
    useSystemStore.getState().setVolume(2);
    expect(useSystemStore.getState().volume).toBe(1);
    useSystemStore.getState().setVolume(-1);
    expect(useSystemStore.getState().volume).toBe(0);
  });

  it('setWallpaper updates wallpaperId', () => {
    useSystemStore.getState().setWallpaper('ios-26-stock-03');
    expect(useSystemStore.getState().wallpaperId).toBe('ios-26-stock-03');
  });

  it('defaults locale to zh-CN', () => {
    expect(useSystemStore.getState().locale).toBe(DEFAULT_LOCALE);
  });

  it('setLocale accepts supported locales', () => {
    useSystemStore.getState().setLocale('en-US');
    expect(useSystemStore.getState().locale).toBe('en-US');
    useSystemStore.getState().setLocale('zh-CN');
    expect(useSystemStore.getState().locale).toBe('zh-CN');
  });

  it('setLocale falls back for unsupported values', () => {
    useSystemStore.getState().setLocale('ja-JP');
    expect(useSystemStore.getState().locale).toBe(DEFAULT_LOCALE);
  });
});
```

- [ ] **Step 2: Run the failing store test**

Run:

```bash
pnpm vitest run src/platform/stores/__tests__/systemStore.test.ts
```

Expected: FAIL with TypeScript/runtime errors for missing `locale` and `setLocale`.

- [ ] **Step 3: Add locale state and action**

Modify `src/platform/stores/systemStore.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_LOCALE,
  type Locale,
  normalizeLocale,
} from '@/platform/i18n/locales';
import { idbStorage } from '@/platform/storage/idbStorage';
```

Add to `SystemState`:

```ts
  /** Device-wide interface language */
  locale: Locale;
```

Add action to `SystemState`:

```ts
  setLocale: (locale: Locale | string) => void;
```

Add default state:

```ts
      locale: DEFAULT_LOCALE,
```

Add action implementation:

```ts
      setLocale: (locale) => set({ locale: normalizeLocale(locale) }),
```

Add `locale` to `partialize`:

```ts
        locale: state.locale,
```

- [ ] **Step 4: Run the store test**

Run:

```bash
pnpm vitest run src/platform/stores/__tests__/systemStore.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

Run:

```bash
git add src/platform/stores/systemStore.ts \
        src/platform/stores/__tests__/systemStore.test.ts
git commit -m "feat(system): persist device locale"
```

## Task 3: React I18n Provider And Root Wiring

**Files:**
- Create: `src/platform/i18n/I18nProvider.tsx`
- Create: `src/platform/i18n/useI18n.ts`
- Create: `src/platform/i18n/__tests__/I18nProvider.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing provider tests**

Create `src/platform/i18n/__tests__/I18nProvider.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_LOCALE } from '../locales';
import { I18nProvider } from '../I18nProvider';
import { useI18n } from '../useI18n';
import { useSystemStore } from '@/platform/stores/systemStore';

function Probe() {
  const { locale, setLocale, t } = useI18n();
  return (
    <div>
      <div data-testid="locale">{locale}</div>
      <div data-testid="label">{t('settings.display.language')}</div>
      <button onClick={() => setLocale('en-US')}>English</button>
    </div>
  );
}

describe('I18nProvider', () => {
  beforeEach(() => {
    useSystemStore.setState({ locale: DEFAULT_LOCALE });
    document.documentElement.lang = '';
  });

  it('provides the current locale and translator', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    expect(screen.getByTestId('locale')).toHaveTextContent('zh-CN');
    expect(screen.getByTestId('label')).toHaveTextContent('语言');
    expect(document.documentElement.lang).toBe('zh-CN');
  });

  it('updates subscribers and html lang when locale changes through the provider', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'English' }));

    expect(screen.getByTestId('locale')).toHaveTextContent('en-US');
    expect(screen.getByTestId('label')).toHaveTextContent('Language');
    expect(document.documentElement.lang).toBe('en-US');
  });

  it('updates when systemStore locale changes externally', () => {
    render(
      <I18nProvider>
        <Probe />
      </I18nProvider>,
    );

    act(() => {
      useSystemStore.getState().setLocale('en-US');
    });

    expect(screen.getByTestId('label')).toHaveTextContent('Language');
  });
});
```

- [ ] **Step 2: Run the failing provider test**

Run:

```bash
pnpm vitest run src/platform/i18n/__tests__/I18nProvider.test.tsx
```

Expected: FAIL because provider and hook files do not exist.

- [ ] **Step 3: Implement provider and hook**

Create `src/platform/i18n/I18nProvider.tsx`:

```tsx
import {
  createContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import { useSystemStore } from '@/platform/stores/systemStore';
import { createTranslator, type Translator } from './dictionary';
import type { Locale } from './locales';

export interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale | string) => void;
  t: Translator;
}

export const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSystemStore((s) => s.locale);
  const setLocale = useSystemStore((s) => s.setLocale);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale,
      t: createTranslator(locale),
    }),
    [locale, setLocale],
  );

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}
```

Create `src/platform/i18n/useI18n.ts`:

```ts
import { useContext } from 'react';
import { I18nContext } from './I18nProvider';

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error('useI18n must be used within I18nProvider.');
  }
  return value;
}
```

- [ ] **Step 4: Wrap the root app**

Modify `src/App.tsx`:

```tsx
import { I18nProvider } from './platform/i18n';
```

Replace the returned fragment with:

```tsx
  return (
    <I18nProvider>
      {/* Always-on audio engine: drives playback from the music store so the
          widget's play/pause/skip buttons work even when Music.app is not
          in the foreground. Renders nothing. */}
      <MusicPlaybackHost />
      <Device />
    </I18nProvider>
  );
```

- [ ] **Step 5: Run provider tests**

Run:

```bash
pnpm vitest run src/platform/i18n/__tests__/I18nProvider.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run App typecheck slice**

Run:

```bash
pnpm typecheck
```

Expected: PASS or unrelated pre-existing failures only. If unrelated failures exist, capture the first unrelated file path in the implementation notes and keep this task limited to i18n files.

- [ ] **Step 7: Commit Task 3**

Run:

```bash
git add src/platform/i18n/I18nProvider.tsx \
        src/platform/i18n/useI18n.ts \
        src/platform/i18n/index.ts \
        src/platform/i18n/__tests__/I18nProvider.test.tsx \
        src/App.tsx
git commit -m "feat(i18n): provide locale context"
```

## Task 4: Settings Display Language Switcher

**Files:**
- Modify: `src/apps/Settings/pages/DisplayPage.tsx`
- Create: `src/apps/Settings/pages/__tests__/DisplayPage.test.tsx`

- [ ] **Step 1: Write failing DisplayPage tests**

Create `src/apps/Settings/pages/__tests__/DisplayPage.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nProvider } from '@/platform/i18n';
import { DEFAULT_LOCALE } from '@/platform/i18n/locales';
import { useSystemStore } from '@/platform/stores/systemStore';
import { DisplayPage } from '../DisplayPage';

function renderDisplayPage() {
  return render(
    <I18nProvider>
      <DisplayPage />
    </I18nProvider>,
  );
}

describe('DisplayPage i18n', () => {
  beforeEach(() => {
    useSystemStore.setState({
      brightness: 0.8,
      textSize: 1,
      darkMode: 'light',
      locale: DEFAULT_LOCALE,
    });
  });

  it('renders Display controls in zh-CN by default', () => {
    renderDisplayPage();

    expect(screen.getByText('亮度')).toBeTruthy();
    expect(screen.getByText('文字大小')).toBeTruthy();
    expect(screen.getByText('外观')).toBeTruthy();
    expect(screen.getByText('语言')).toBeTruthy();
    expect(screen.getByRole('button', { name: /简体中文/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /English/ })).toBeTruthy();
  });

  it('switches the page copy to en-US', () => {
    renderDisplayPage();

    fireEvent.click(screen.getByRole('button', { name: /English/ }));

    expect(useSystemStore.getState().locale).toBe('en-US');
    expect(screen.getByText('Brightness')).toBeTruthy();
    expect(screen.getByText('Text Size')).toBeTruthy();
    expect(screen.getByText('Appearance')).toBeTruthy();
    expect(screen.getByText('Language')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Simplified Chinese/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the failing DisplayPage test**

Run:

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/DisplayPage.test.tsx
```

Expected: FAIL because `DisplayPage` still uses hard-coded Chinese and has no language section.

- [ ] **Step 3: Update DisplayPage to use i18n and add locale buttons**

Modify `src/apps/Settings/pages/DisplayPage.tsx`:

```tsx
import { Check, Sun, Moon, SunMoon } from 'lucide-react';
import { useSystemStore, type DarkMode } from '@/platform/stores/systemStore';
import { LOCALE_LABELS, SUPPORTED_LOCALES } from '@/platform/i18n/locales';
import { useI18n } from '@/platform/i18n';
import { Slider, List, ListSection } from '@/system';

const DARK_MODES: { value: DarkMode; labelKey: string; icon: typeof Sun }[] = [
  { value: 'light', labelKey: 'settings.display.darkMode.light', icon: Sun },
  { value: 'dark', labelKey: 'settings.display.darkMode.dark', icon: Moon },
  { value: 'auto', labelKey: 'settings.display.darkMode.auto', icon: SunMoon },
];

export function DisplayPage() {
  const brightness = useSystemStore((s) => s.brightness);
  const textSize = useSystemStore((s) => s.textSize);
  const darkMode = useSystemStore((s) => s.darkMode);
  const setBrightness = useSystemStore((s) => s.setBrightness);
  const setTextSize = useSystemStore((s) => s.setTextSize);
  const setDarkMode = useSystemStore((s) => s.setDarkMode);
  const { locale, setLocale, t } = useI18n();

  return (
    <div className="h-full">
      <List>
        <ListSection title={t('settings.display.brightness')}>
          <div className="px-4 py-3">
            <Slider
              value={brightness}
              min={0}
              max={1}
              step={0.05}
              onChange={setBrightness}
              leftIcon={<Sun size={16} />}
              rightIcon={<Sun size={22} />}
            />
          </div>
        </ListSection>

        <ListSection title={t('settings.display.textSize')}>
          <div className="px-4 py-3">
            <Slider
              value={textSize}
              min={0.8}
              max={1.4}
              step={0.05}
              onChange={setTextSize}
              leftIcon={<span style={{ fontSize: 12, fontWeight: 600 }}>A</span>}
              rightIcon={<span style={{ fontSize: 22, fontWeight: 600 }}>A</span>}
              showValue
              valueFormatter={(v) => `${Math.round(v * 100)}%`}
            />
          </div>
        </ListSection>

        <ListSection title={t('settings.display.appearance')}>
          <div className="flex">
            {DARK_MODES.map((m, idx) => {
              const selected = darkMode === m.value;
              const Icon = m.icon;
              return (
                <button
                  key={m.value}
                  onClick={() => setDarkMode(m.value)}
                  className="flex flex-1 flex-col items-center gap-2 py-4"
                  style={{
                    borderRight: idx < 2 ? '0.5px solid var(--color-separator)' : 'none',
                    color: selected ? 'var(--color-systemBlue)' : 'var(--color-label)',
                    backgroundColor: selected ? 'var(--color-systemGray6)' : 'transparent',
                    transition: 'all 0.2s',
                  }}
                >
                  <Icon size={24} />
                  <span style={{ fontSize: 'var(--font-size-caption1)' }}>
                    {t(m.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </ListSection>

        <ListSection
          title={t('settings.display.language')}
          footer={t('settings.display.languageFooter')}
        >
          <div className="flex flex-col">
            {SUPPORTED_LOCALES.map((option, idx) => {
              const selected = locale === option;
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setLocale(option)}
                  className="flex min-h-[48px] items-center justify-between px-4 text-left"
                  style={{
                    borderTop: idx === 0 ? 'none' : '0.5px solid var(--color-separator)',
                    color: 'var(--color-label)',
                  }}
                >
                  <span style={{ fontSize: 'var(--font-size-body)' }}>
                    {t(`settings.display.languageOption.${option}`)}
                  </span>
                  <span className="flex items-center gap-2" style={{ color: 'var(--color-systemBlue)' }}>
                    <span style={{ fontSize: 'var(--font-size-footnote)' }}>
                      {LOCALE_LABELS[option].nativeName}
                    </span>
                    {selected ? <Check size={18} strokeWidth={2.4} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </ListSection>
      </List>
    </div>
  );
}
```

- [ ] **Step 4: Run DisplayPage tests**

Run:

```bash
pnpm vitest run src/apps/Settings/pages/__tests__/DisplayPage.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Run related Settings test**

Run:

```bash
pnpm vitest run src/apps/Settings/SettingsApp.test.tsx src/apps/Settings/pages/__tests__/DisplayPage.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Task 4**

Run:

```bash
git add src/apps/Settings/pages/DisplayPage.tsx \
        src/apps/Settings/pages/__tests__/DisplayPage.test.tsx
git commit -m "feat(settings): add language switcher"
```

## Task 5: User App SDK `@hiphone/i18n`

**Files:**
- Create: `src/platform/userApp/sdk/i18n.ts`
- Modify: `src/platform/userApp/sdk/index.ts`
- Modify: `src/platform/userApp/sdk/__tests__/index.test.ts`

- [ ] **Step 1: Write failing SDK resolver test**

Append to `src/platform/userApp/sdk/__tests__/index.test.ts`:

```ts
describe('@hiphone/i18n', () => {
  it('resolves locale helpers for sandboxed user apps', () => {
    const mod = resolveModule('@hiphone/i18n') as Record<string, unknown>;
    expect(typeof mod.useLocale).toBe('function');
    expect(typeof mod.getLocale).toBe('function');
    expect(typeof mod.t).toBe('function');
    expect(typeof mod.formatDate).toBe('function');
    expect(typeof mod.formatNumber).toBe('function');
  });
});
```

- [ ] **Step 2: Run the failing SDK test**

Run:

```bash
pnpm vitest run src/platform/userApp/sdk/__tests__/index.test.ts
```

Expected: FAIL because `@hiphone/i18n` is not in `moduleMap`.

- [ ] **Step 3: Implement SDK module**

Create `src/platform/userApp/sdk/i18n.ts`:

```ts
import { useSystemStore } from '@/platform/stores/systemStore';
import {
  DEFAULT_LOCALE,
  type Locale,
  formatDate as formatPlatformDate,
  formatNumber as formatPlatformNumber,
  translate,
} from '@/platform/i18n';

export type { Locale };

export function getLocale(): Locale {
  return useSystemStore.getState().locale ?? DEFAULT_LOCALE;
}

export function useLocale(): Locale {
  return useSystemStore((s) => s.locale);
}

export function t(
  key: string,
  vars?: Record<string, string | number>,
): string {
  return translate(getLocale(), key, vars);
}

export function formatDate(
  value: Date | number | string,
  options?: Intl.DateTimeFormatOptions,
): string {
  return formatPlatformDate(value, getLocale(), options);
}

export function formatNumber(
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  return formatPlatformNumber(value, getLocale(), options);
}
```

- [ ] **Step 4: Register SDK module**

Modify `src/platform/userApp/sdk/index.ts`:

```ts
import * as hiphoneI18n from './i18n';
```

Add to `moduleMap`:

```ts
  '@hiphone/i18n': hiphoneI18n,
```

- [ ] **Step 5: Run SDK tests**

Run:

```bash
pnpm vitest run src/platform/userApp/sdk/__tests__/index.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

Run:

```bash
git add src/platform/userApp/sdk/i18n.ts \
        src/platform/userApp/sdk/index.ts \
        src/platform/userApp/sdk/__tests__/index.test.ts
git commit -m "feat(user-app): expose i18n sdk"
```

## Task 6: i18n Directory Documentation

**Files:**
- Create: `src/platform/i18n/AGENTS.md`

- [ ] **Step 1: Write the i18n directory rules**

Create `src/platform/i18n/AGENTS.md`:

```md
# src/platform/i18n 规范

## 不变量

1. `useSystemStore.locale` 是设备级唯一语言配置源；不要在 App 内另建全局语言 store。
2. 第一版只内置 `zh-CN` 和 `en-US`。新增 locale 时必须同时补齐 `locales.ts`、两端字典测试和缺 key 测试。
3. UI 文案和 prompt 模板必须走 i18n 字典；用户生成内容、角色资料、聊天历史、世界书和测试 seed 不强制翻译。
4. 非 React 代码优先显式传入 locale；只有 SDK 或平台边界 helper 才能直接读取 `useSystemStore.getState().locale`。
5. `@hiphone/i18n` 只暴露平台通用 key；用户 App 业务文案应在 App 内自建小字典。

## 踩坑

1. 缺 key 在开发时会 warn，生产会回退 `zh-CN`；不要用空字符串掩盖缺失。
2. Prompt 的工具 type、param 字段名和 JSON wire format 不能翻译，只翻译解释性文本。
3. 切换语言不迁移历史数据；旧摘要、旧记忆、旧聊天内容保持原语言。
```

- [ ] **Step 2: Commit Task 6**

Run:

```bash
git add src/platform/i18n/AGENTS.md
git commit -m "docs(i18n): document locale conventions"
```

## Task 7: M1 Verification

**Files:**
- Verify only; no file edits expected unless a command fails for an M1-owned reason.

- [ ] **Step 1: Run focused M1 tests**

Run:

```bash
pnpm vitest run \
  src/platform/i18n/__tests__/dictionary.test.ts \
  src/platform/i18n/__tests__/I18nProvider.test.tsx \
  src/platform/stores/__tests__/systemStore.test.ts \
  src/apps/Settings/pages/__tests__/DisplayPage.test.tsx \
  src/platform/userApp/sdk/__tests__/index.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS or unrelated pre-existing failures only. If it fails in files touched by M1, fix those files and rerun. If it fails elsewhere, record the first unrelated failure in the final implementation note.

- [ ] **Step 3: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS or unrelated pre-existing failures only. If it fails in files touched by M1, fix those files and rerun. If it fails elsewhere, record the first unrelated failure in the final implementation note.

- [ ] **Step 4: Inspect final diff scope**

Run:

```bash
git status --short
git diff --stat HEAD
```

Expected: only M1 i18n, systemStore, App root, DisplayPage, SDK, and tests are changed after the last commit. Existing unrelated untracked `.playwright-cli/` and `output/playwright/` may remain ignored by this work.

## Self-Review Checklist

- Spec coverage: This M1 plan implements the spec's M1 milestone only: i18n core, global locale, Provider, Settings entry, SDK skeleton, and basic tests. Full Shell/System/Catalog migration is M2, App UI migration is M3, prompt migration is M4, and hardcoded Chinese scan is M5.
- Placeholder scan: This plan contains concrete file paths, commands, expected outcomes, and implementation snippets for each M1-owned file.
- Type consistency: `Locale`, `DEFAULT_LOCALE`, `normalizeLocale`, `translate`, `formatDate`, `formatNumber`, `I18nProvider`, `useI18n`, and `@hiphone/i18n` signatures are used consistently across tasks.

