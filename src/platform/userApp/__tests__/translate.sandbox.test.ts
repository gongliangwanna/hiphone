/**
 * Sandbox-level smoke for the translate user-app: compile → register →
 * render → click translate → see result.
 *
 * Mocks @hiphone/ai's complete() so the test doesn't hit a real LLM.
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

describe('translate user-app — sandbox smoke', () => {
  beforeEach(() => {
    appRegistry.unregister('translate');
    completeMock.mockReset();
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
});
