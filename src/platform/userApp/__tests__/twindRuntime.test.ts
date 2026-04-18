import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('twindRuntime', () => {
  beforeEach(() => {
    // vi.resetModules clears the internal "installed" flag between tests so
    // each test starts from a fresh state.
    vi.resetModules();
    vi.doUnmock('@tailwindcss/browser');
  });

  it('ensureTwindInstalled imports @tailwindcss/browser exactly once across many calls', async () => {
    const importMock = vi.fn(() => Promise.resolve({}));
    vi.doMock('@tailwindcss/browser', () => {
      importMock();
      return {};
    });

    const { ensureTwindInstalled } = await import('../twindRuntime');

    // Fire 5 concurrent calls
    await Promise.all([
      ensureTwindInstalled(),
      ensureTwindInstalled(),
      ensureTwindInstalled(),
      ensureTwindInstalled(),
      ensureTwindInstalled(),
    ]);
    // Plus one sequential call
    await ensureTwindInstalled();

    expect(importMock).toHaveBeenCalledTimes(1);
  });

  it('swallows import failures (console.warn) and allows retry on next call', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // First call: simulate a rejected import
    let attempt = 0;
    vi.doMock('@tailwindcss/browser', () => {
      attempt++;
      if (attempt === 1) throw new Error('network fail');
      return {};
    });

    const { ensureTwindInstalled } = await import('../twindRuntime');

    await ensureTwindInstalled(); // should not throw
    expect(warnSpy).toHaveBeenCalled();

    // Next call should retry (installed flag reset on failure)
    await ensureTwindInstalled();
    expect(attempt).toBe(2);

    warnSpy.mockRestore();
  });
});
