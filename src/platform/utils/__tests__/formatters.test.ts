import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatByteSize, formatRelativeTime } from '../formatters';

describe('formatByteSize', () => {
  it('formats 0 as "—"', () => {
    expect(formatByteSize(0)).toBe('—');
  });
  it('formats < 1024 as "N B"', () => {
    expect(formatByteSize(512)).toBe('512 B');
  });
  it('formats KB with 1 decimal', () => {
    expect(formatByteSize(2048)).toBe('2.0 KB');
    expect(formatByteSize(1536)).toBe('1.5 KB');
  });
  it('formats MB with 1 decimal', () => {
    expect(formatByteSize(2.3 * 1024 * 1024)).toBe('2.3 MB');
  });
  it('handles huge values (GB)', () => {
    expect(formatByteSize(2 * 1024 * 1024 * 1024)).toMatch(/GB/);
  });
});

describe('formatRelativeTime', () => {
  const NOW = new Date('2026-04-19T12:00:00Z').getTime();

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "今天" for timestamps within today', () => {
    expect(formatRelativeTime(NOW - 1000)).toBe('今天');
    expect(formatRelativeTime(NOW - 3_600_000)).toBe('今天');
  });
  it('returns "昨天" for 1 day ago', () => {
    expect(formatRelativeTime(NOW - 24 * 3_600_000 - 60_000)).toBe('昨天');
  });
  it('returns "N 天前" for 2-6 days ago', () => {
    expect(formatRelativeTime(NOW - 3 * 24 * 3_600_000)).toBe('3 天前');
    expect(formatRelativeTime(NOW - 6 * 24 * 3_600_000)).toBe('6 天前');
  });
  it('returns "上周" for 7-13 days ago', () => {
    expect(formatRelativeTime(NOW - 8 * 24 * 3_600_000)).toBe('上周');
  });
  it('returns "M 月 D 日" for older same-year dates', () => {
    const jan15 = new Date('2026-01-15T12:00:00Z').getTime();
    expect(formatRelativeTime(jan15)).toBe('1 月 15 日');
  });
  it('returns "YYYY 年 M 月 D 日" for different year', () => {
    const lastYear = new Date('2025-06-10T12:00:00Z').getTime();
    expect(formatRelativeTime(lastYear)).toBe('2025 年 6 月 10 日');
  });
  it('returns "—" for 0 or invalid', () => {
    expect(formatRelativeTime(0)).toBe('—');
  });
});
