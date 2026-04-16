// src/platform/storage/__tests__/calculateStorageUsage.test.ts
import { describe, it, expect } from 'vitest';
import { formatBytes, classifyKvKey, STORAGE_CATEGORIES } from '../calculateStorageUsage';

describe('formatBytes', () => {
  it('returns "0 KB" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 KB');
  });

  it('returns "< 1 KB" for small non-zero values', () => {
    expect(formatBytes(500)).toBe('< 1 KB');
  });

  it('returns whole KB for values under 1 MB', () => {
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(512000)).toBe('500 KB');
  });

  it('returns one-decimal MB for values >= 1 MB', () => {
    expect(formatBytes(1048576)).toBe('1.0 MB');
    expect(formatBytes(2621440)).toBe('2.5 MB');
  });
});

describe('classifyKvKey', () => {
  it('classifies character-related keys', () => {
    expect(classifyKvKey('hiPhone-characters')).toBe('characters');
    expect(classifyKvKey('hiPhone-persona')).toBe('characters');
    expect(classifyKvKey('hiPhone-world-books')).toBe('characters');
  });

  it('classifies notes keys (including per-entity)', () => {
    expect(classifyKvKey('hiPhone-notes')).toBe('notes');
    expect(classifyKvKey('hiPhone-notes::char-abc')).toBe('notes');
  });

  it('classifies calendar key', () => {
    expect(classifyKvKey('hiPhone-calendar')).toBe('calendar');
  });

  it('classifies everything else as other', () => {
    expect(classifyKvKey('hiPhone-ai-config')).toBe('other');
    expect(classifyKvKey('hiPhone-springboard')).toBe('other');
    expect(classifyKvKey('hiPhone-music')).toBe('other');
    expect(classifyKvKey('hiPhone-system')).toBe('other');
    expect(classifyKvKey('hiPhone-gomoku')).toBe('other');
  });
});

describe('STORAGE_CATEGORIES', () => {
  it('has 6 categories with required fields', () => {
    expect(STORAGE_CATEGORIES).toHaveLength(6);
    for (const cat of STORAGE_CATEGORIES) {
      expect(cat).toHaveProperty('key');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('icon');
    }
  });
});
