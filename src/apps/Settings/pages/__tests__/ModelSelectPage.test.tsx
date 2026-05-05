import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModelSelectPage } from '../ModelSelectPage';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../../settingsNavStore';

function seed() {
  useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
  const id = useAIConfigStore.getState().createEmptyPreset('日常 OR');
  useAIConfigStore.getState().setActivePreset(id);
}

beforeEach(() => {
  useSettingsNavStore.getState().reset();
  seed();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ModelSelectPage — OpenRouter provider routing', () => {
  it('lets OpenRouter strictly pin routing to Cerebras', () => {
    render(<ModelSelectPage />);

    expect(screen.getByText('厂商')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Cerebras/ }));

    expect(useAIConfigStore.getState().openRouterProviderSlug).toBe('cerebras');
  });

  it('hides OpenRouter provider routing for non-OpenRouter providers', () => {
    render(<ModelSelectPage />);

    fireEvent.click(screen.getByRole('button', { name: /硅基流动/ }));

    expect(screen.queryByText('厂商')).toBeNull();
  });
});
