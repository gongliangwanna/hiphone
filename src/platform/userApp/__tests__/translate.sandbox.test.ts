/**
 * Sandbox-level smoke for the translate user-app: compile → register →
 * render → click translate → see result.
 *
 * Mocks @hiphone/ai's complete() so the test doesn't hit a real LLM.
 * Mocks @hiphone/storage so the test doesn't need IDB.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { appRegistry } from '@/platform/appRegistry';
import { mountBuiltinUserApps } from '../builtinUserApps';

// Mock the AI surface so complete() returns predictably without provider
// config. The mock has to reach the SDK module that user-app code resolves
// through, which is `src/platform/userApp/sdk/ai.ts`.
const completeMock = vi.fn();
vi.mock('@/platform/userApp/sdk/ai', async () => {
  const actual = await vi.importActual<typeof import('@/platform/userApp/sdk/ai')>(
    '@/platform/userApp/sdk/ai',
  );
  return {
    ...actual,
    complete: (...args: unknown[]) => completeMock(...args),
  };
});

// Mock storage SDK so tests don't need IDB and can inspect written values.
const storageMap = new Map<string, unknown>();
vi.mock('@/platform/userApp/sdk/storage', async () => ({
  get: vi.fn(async (k: string) => storageMap.get(k)),
  set: vi.fn(async (k: string, v: unknown) => {
    storageMap.set(k, v);
  }),
  remove: vi.fn(async (k: string) => {
    storageMap.delete(k);
  }),
  list: vi.fn(async () => Array.from(storageMap.keys())),
  globalGet: vi.fn(),
  globalSet: vi.fn(),
}));

describe('translate user-app — sandbox smoke', () => {
  beforeEach(() => {
    appRegistry.unregister('translate');
    completeMock.mockReset();
    storageMap.clear();
  });

  it('compiles, registers, and renders without throwing', async () => {
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('builtin');

    expect(() => render(React.createElement(entry!.component))).not.toThrow();
    cleanup();
  });

  it('typing + clicking 翻译 calls AI and updates target panel', async () => {
    completeMock.mockResolvedValueOnce('Hello');
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate')!;
    render(React.createElement(entry.component));

    const textarea = screen.getByPlaceholderText(/输入要翻译的文本/);
    fireEvent.change(textarea, { target: { value: '你好' } });

    const translateBtn = screen.getByRole('button', { name: '翻译' });
    fireEvent.click(translateBtn);

    expect(completeMock).toHaveBeenCalledTimes(1);
    const firstCall = completeMock.mock.calls[0]!;
    const messages = firstCall[0] as Array<{ role: string; content: string }>;
    expect(messages[1]!.content).toBe('你好');

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeTruthy();
    });
    cleanup();
  });

  it('opening source picker → choosing 中文 → translating uses 中文 as source', async () => {
    completeMock.mockResolvedValueOnce('Hello');
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate')!;
    render(React.createElement(entry.component));

    // Default source is "自动检测"; tap to open picker, pick 中文.
    fireEvent.click(screen.getByLabelText(/源语言/));
    // The picker is now open — find the curated 中文 row and click it.
    // Multiple rows may share the substring "中" — use exact native text.
    fireEvent.click(screen.getByText('中文'));

    fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), {
      target: { value: '你好' },
    });
    fireEvent.click(screen.getByRole('button', { name: '翻译' }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const messages = completeMock.mock.calls[0]![0] as Array<{ role: string; content: string }>;
    // System prompt should contain "中文" as the source language name.
    expect(messages[0]!.content).toContain('中文');
    expect(messages[0]!.content).not.toContain('Detect the source language automatically.');
    cleanup();
  });

  it('custom language flow: 自定义 → 输入 Klingon → 翻译用 Klingon 作为源', async () => {
    completeMock.mockResolvedValueOnce('Qapla\'!');
    await mountBuiltinUserApps();
    const entry = appRegistry.get('translate')!;
    render(React.createElement(entry.component));

    fireEvent.click(screen.getByLabelText(/源语言/));
    fireEvent.click(screen.getByText(/自定义/));
    // Two-stage drawer — input is now visible.
    const input = screen.getByPlaceholderText(/古希腊语|文言文|输入语种/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Klingon' } });
    fireEvent.click(screen.getByText('确认'));

    fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), {
      target: { value: 'hello' },
    });
    fireEvent.click(screen.getByRole('button', { name: '翻译' }));

    expect(completeMock).toHaveBeenCalledTimes(1);
    const messages = completeMock.mock.calls[0]![0] as Array<{ role: string; content: string }>;
    expect(messages[0]!.content).toContain('Klingon');
    cleanup();
  });

  it('successful translate writes a history entry', async () => {
    completeMock.mockResolvedValueOnce('Hello');
    await mountBuiltinUserApps();
    render(React.createElement(appRegistry.get('translate')!.component));

    fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), {
      target: { value: '你好' },
    });
    fireEvent.click(screen.getByRole('button', { name: '翻译' }));

    await waitFor(() => expect(screen.getByText('Hello')).toBeTruthy());
    await waitFor(() => {
      const stored = storageMap.get('history') as
        | Array<{ sourceText: string; targetText: string }>
        | undefined;
      expect(stored).toBeDefined();
      expect(stored![0]!.sourceText).toBe('你好');
      expect(stored![0]!.targetText).toBe('Hello');
    });
    cleanup();
  });

  it('opening history sheet shows past entry; clicking it restores source text', async () => {
    // Pre-seed storage so hook hydrates on mount
    storageMap.set('history', [
      {
        id: 'preset-1',
        sourceText: 'preset-source',
        targetText: 'preset-target',
        sourceLang: { code: 'zh', name: '中文', native: '中文' },
        targetLang: { code: 'en', name: '英语', native: 'English' },
        ts: Date.now(),
      },
    ]);
    await mountBuiltinUserApps();
    render(React.createElement(appRegistry.get('translate')!.component));

    // Wait for the history button to appear (hydration complete)
    await waitFor(() => expect(screen.getByTestId('open-history')).toBeTruthy());
    fireEvent.click(screen.getByTestId('open-history'));
    await waitFor(() => expect(screen.getByText('preset-source')).toBeTruthy());

    fireEvent.click(screen.getByLabelText('恢复此条历史'));
    // Sheet closes, source textarea shows preset-source
    const ta = screen.getByPlaceholderText(/输入要翻译的文本/) as HTMLTextAreaElement;
    await waitFor(() => expect(ta.value).toBe('preset-source'));
    cleanup();
  });

  it('changing target language while translate is in-flight abandons the in-flight (no stale lang pair in history)', async () => {
    // Issue 2 analysis: onPickLang calls reset() which increments tokenRef,
    // causing the in-flight translate to discard its result via token check
    // (myToken !== tokenRef.current → return early, status stays loading/idle,
    // never becomes 'success'). Therefore the history-write effect never fires
    // with a stale language pair. This test documents that invariant.
    let resolveAi: (s: string) => void = () => {};
    completeMock.mockImplementationOnce(
      () => new Promise<string>((r) => { resolveAi = r; }),
    );
    await mountBuiltinUserApps();
    render(React.createElement(appRegistry.get('translate')!.component));

    // Type and click translate (default: auto → en).
    fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), {
      target: { value: '你好' },
    });
    fireEvent.click(screen.getByRole('button', { name: '翻译' }));
    // AI is now in-flight (pending resolveAi).

    // While in-flight, change target language to 日本語. This calls
    // onPickLang → reset() → tokenRef++ → supersedes the in-flight request.
    fireEvent.click(screen.getByLabelText(/目标语言/));
    fireEvent.click(screen.getByText('日本語'));

    // Now resolve the AI — but it should be discarded (token superseded).
    resolveAi('Hello');

    // Give microtasks and effects time to settle.
    await new Promise((r) => setTimeout(r, 50));

    // History should NOT have been written with stale 'en' result because
    // reset() cleared status back to idle before success could fire.
    const stored = storageMap.get('history') as Array<{ targetLang: { code: string } }> | undefined;
    expect(stored).toBeUndefined();
    cleanup();
  });

  it('star button toggles favorite for current translation', async () => {
    completeMock.mockResolvedValueOnce('Hello');
    await mountBuiltinUserApps();
    render(React.createElement(appRegistry.get('translate')!.component));

    fireEvent.change(screen.getByPlaceholderText(/输入要翻译的文本/), {
      target: { value: '你好' },
    });
    fireEvent.click(screen.getByRole('button', { name: '翻译' }));
    await waitFor(() => expect(screen.getByText('Hello')).toBeTruthy());
    await waitFor(() => expect(storageMap.get('history')).toBeDefined());

    // Star button is rendered after history entry attached; aria label is "收藏"
    const star = await screen.findByLabelText('收藏');
    fireEvent.click(star);
    await waitFor(() => {
      const favs = storageMap.get('favorites') as unknown[] | undefined;
      expect(favs?.length).toBe(1);
    });
    cleanup();
  });
});
