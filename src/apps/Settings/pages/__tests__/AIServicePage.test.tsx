import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AIServicePage } from '../AIServicePage';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../../settingsNavStore';

function seed() {
  useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
  const a = useAIConfigStore.getState().createEmptyPreset('日常 OR');
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: s.presets.map((p) => (p.id === a ? { ...p, model: 'claude' } : p)),
  }));
  useAIConfigStore.getState().createEmptyPreset('便宜 SF');
  useAIConfigStore.getState().setActivePreset(a);
  return { a };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AIServicePage — preset row', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
    seed();
  });

  it('renders active preset name in the top picker', () => {
    render(<AIServicePage />);
    expect(screen.getByTestId('preset-picker-name')).toHaveTextContent('日常 OR');
  });

  it('opens switcher sheet when picker is clicked', () => {
    render(<AIServicePage />);
    fireEvent.click(screen.getByTestId('preset-picker-button'));
    expect(screen.getByText('切换预设')).toBeInTheDocument();
  });

  it('manage button pushes aiPresets', () => {
    render(<AIServicePage />);
    fireEvent.click(screen.getByTestId('preset-manage-button'));
    const stack = useSettingsNavStore.getState().stack;
    expect(stack.at(-1)?.page).toBe('aiPresets');
  });
});
