import { describe, expect, it } from 'vitest';
import {
  CURATED_LANGUAGES,
  AUTO_LANG,
  DEFAULT_SOURCE_LANG,
  DEFAULT_TARGET_LANG,
} from '../languages';

describe('CURATED_LANGUAGES', () => {
  it('has exactly 10 entries (spec 2.3)', () => {
    expect(CURATED_LANGUAGES).toHaveLength(10);
  });

  it('every entry has code, name, native', () => {
    for (const lang of CURATED_LANGUAGES) {
      expect(lang.code).toBeTruthy();
      expect(lang.name).toBeTruthy();
      expect(lang.native).toBeTruthy();
    }
  });

  it('codes are unique', () => {
    const codes = CURATED_LANGUAGES.map((l) => l.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('does NOT collide with the auto sentinel', () => {
    expect(CURATED_LANGUAGES.find((l) => l.code === AUTO_LANG.code)).toBeUndefined();
  });

  it('default source is auto, default target is 英语', () => {
    expect(DEFAULT_SOURCE_LANG.code).toBe('auto');
    expect(DEFAULT_TARGET_LANG.code).toBe('en');
  });
});
