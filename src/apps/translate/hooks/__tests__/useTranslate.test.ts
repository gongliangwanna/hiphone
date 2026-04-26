import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { buildTranslateMessages, useTranslate } from '../useTranslate';
import { AUTO_LANG, CURATED_LANGUAGES } from '../../constants/languages';

vi.mock('@hiphone/ai', () => ({
  complete: vi.fn(),
  AIUnavailableError: class extends Error {},
}));
const aiMock = await import('@hiphone/ai');

const ZH = CURATED_LANGUAGES.find((l) => l.code === 'zh')!;
const EN = CURATED_LANGUAGES.find((l) => l.code === 'en')!;

describe('buildTranslateMessages', () => {
  it('emits system + user pair, source name in system prompt', () => {
    const msgs = buildTranslateMessages('你好', ZH, EN);
    expect(msgs).toHaveLength(2);
    expect(msgs[0].role).toBe('system');
    expect(msgs[0].content).toContain('中文');
    expect(msgs[0].content).toContain('英语');
    expect(msgs[0].content).not.toContain('Detect the source language');
    expect(msgs[1].role).toBe('user');
    expect(msgs[1].content).toBe('你好');
  });

  it('appends auto-detect instruction when source is the auto sentinel', () => {
    const msgs = buildTranslateMessages('hi', AUTO_LANG, EN);
    expect(msgs[0].content).toContain('Detect the source language');
    expect(msgs[0].content).toContain('英语');
  });
});

describe('useTranslate', () => {
  beforeEach(() => {
    vi.mocked(aiMock.complete).mockReset();
  });

  it('starts idle, loading on translate, success when complete resolves', async () => {
    vi.mocked(aiMock.complete).mockResolvedValueOnce('Hello');
    const { result } = renderHook(() => useTranslate());
    expect(result.current.status).toBe('idle');
    await act(async () => {
      await result.current.translate('你好', ZH, EN);
    });
    expect(result.current.status).toBe('success');
    expect(result.current.targetText).toBe('Hello');
    expect(result.current.error).toBeNull();
  });

  it('on error, status=error and error is captured', async () => {
    const err = new Error('network down');
    vi.mocked(aiMock.complete).mockRejectedValueOnce(err);
    const { result } = renderHook(() => useTranslate());
    await act(async () => {
      await result.current.translate('hi', AUTO_LANG, EN);
    });
    expect(result.current.status).toBe('error');
    expect(result.current.error?.message).toBe('network down');
    expect(result.current.targetText).toBe(''); // not overwritten
  });

  it('superseded translate calls discard their result', async () => {
    let resolveFirst: (s: string) => void = () => {};
    vi.mocked(aiMock.complete).mockImplementationOnce(
      () => new Promise<string>((r) => { resolveFirst = r; }),
    );
    vi.mocked(aiMock.complete).mockResolvedValueOnce('Second');
    const { result } = renderHook(() => useTranslate());
    let firstPromise!: Promise<void>;
    act(() => {
      firstPromise = result.current.translate('a', ZH, EN);
    });
    await act(async () => {
      await result.current.translate('b', ZH, EN);
    });
    // Resolve the first call AFTER the second already won — its result
    // must be silently discarded.
    await act(async () => {
      resolveFirst('First (stale)');
      await firstPromise;
    });
    expect(result.current.targetText).toBe('Second');
  });

  it('empty input clears output and returns to idle without calling complete', async () => {
    const { result } = renderHook(() => useTranslate());
    await act(async () => {
      await result.current.translate('   ', ZH, EN);
    });
    expect(aiMock.complete).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
    expect(result.current.targetText).toBe('');
  });

  it('reset clears output, error, and status', async () => {
    vi.mocked(aiMock.complete).mockResolvedValueOnce('Hello');
    const { result } = renderHook(() => useTranslate());
    await act(async () => {
      await result.current.translate('你好', ZH, EN);
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current.status).toBe('idle');
    expect(result.current.targetText).toBe('');
    expect(result.current.error).toBeNull();
  });
});
