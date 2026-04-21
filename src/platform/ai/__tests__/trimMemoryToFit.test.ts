import { describe, it, expect } from 'vitest';
import { trimMemoryToFit } from '../promptAssembly';
import type { MemoryEntry } from '../characterMemoryStore';

function mem(overrides: Partial<MemoryEntry>): MemoryEntry {
  return {
    id: 'x',
    characterId: 'char-001',
    role: 'user',
    speakerId: 'me',
    content: 'x',
    source: 'xingyu',
    createdAt: 0,
    ...overrides,
  };
}

describe('trimMemoryToFit', () => {
  const makeEntries = (count: number, contentSize: number): MemoryEntry[] =>
    Array.from({ length: count }, (_, i) =>
      mem({
        id: `e-${i}`,
        content: 'x'.repeat(contentSize),
        createdAt: i,
      }),
    );

  it('empty input → empty output', () => {
    expect(trimMemoryToFit([], 1000, 3)).toEqual([]);
  });

  it('fits in budget → unchanged', () => {
    const entries = makeEntries(5, 10);
    const out = trimMemoryToFit(entries, 100_000, 3);
    expect(out).toEqual(entries);
  });

  it('overflows → drops from the oldest end', () => {
    const entries = makeEntries(10, 400);
    const out = trimMemoryToFit(entries, 500, 3);
    expect(out.length).toBeLessThan(10);
    expect(out.slice(-3).map((e) => e.id)).toEqual(['e-7', 'e-8', 'e-9']);
  });

  it('never trims below keepRecent count', () => {
    const entries = makeEntries(5, 1000);
    const out = trimMemoryToFit(entries, 10, 3);
    expect(out.length).toBeGreaterThanOrEqual(3);
  });
});
