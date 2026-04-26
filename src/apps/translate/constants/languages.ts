/**
 * Curated language list for the translate app.
 *
 * `code` is loosely ISO 639-1 (with two-letter exceptions like 'zh' for
 * Mandarin). It's only used as an opaque identifier for storage dedup keys
 * and to pick a label — the AI prompt sends the human-readable `name`,
 * not the code.
 *
 * `auto` is a sentinel: when `sourceLang.code === 'auto'`, the prompt
 * appends a "detect source" instruction.
 */

export interface Language {
  /** Stable identifier; ISO 639-1 where it exists, otherwise hand-picked. */
  code: string;
  /** Display string shown in UI AND injected into the AI prompt. */
  name: string;
  /** Native form, used in the language picker UI. */
  native: string;
}

export const AUTO_LANG: Language = {
  code: 'auto',
  name: '自动检测',
  native: '自动检测',
};

export const CURATED_LANGUAGES: readonly Language[] = [
  { code: 'zh', name: '中文', native: '中文' },
  { code: 'en', name: '英语', native: 'English' },
  { code: 'ja', name: '日语', native: '日本語' },
  { code: 'ko', name: '韩语', native: '한국어' },
  { code: 'fr', name: '法语', native: 'Français' },
  { code: 'es', name: '西班牙语', native: 'Español' },
  { code: 'de', name: '德语', native: 'Deutsch' },
  { code: 'it', name: '意大利语', native: 'Italiano' },
  { code: 'ru', name: '俄语', native: 'Русский' },
  { code: 'ar', name: '阿拉伯语', native: 'العربية' },
] as const;

export const DEFAULT_SOURCE_LANG: Language = AUTO_LANG;
export const DEFAULT_TARGET_LANG: Language = CURATED_LANGUAGES[1]!; // 英语
