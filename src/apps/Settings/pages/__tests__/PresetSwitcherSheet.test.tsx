import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { PresetSwitcherSheet } from '../PresetSwitcherSheet';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';

function seed() {
  useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
  const a = useAIConfigStore.getState().createEmptyPreset('A');
  const b = useAIConfigStore.getState().createEmptyPreset('B');
  useAIConfigStore.getState().setActivePreset(a);
  return { a, b };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PresetSwitcherSheet', () => {
  beforeEach(() => seed());

  it('renders all presets and active checkmark', () => {
    const { a } = seed();
    render(<PresetSwitcherSheet onClose={() => {}} />);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByTestId(`switcher-row-${a}`)).toHaveAttribute('data-active', 'true');
  });

  it('switches active and closes on row click', () => {
    const onClose = vi.fn();
    const { b } = seed();
    render(<PresetSwitcherSheet onClose={onClose} />);
    fireEvent.click(screen.getByTestId(`switcher-row-${b}`));
    expect(useAIConfigStore.getState().activePresetId).toBe(b);
    expect(onClose).toHaveBeenCalled();
  });

  it('"new from current" calls prompt and creates preset', () => {
    vi.spyOn(window, 'prompt').mockReturnValue('副本');
    const onClose = vi.fn();
    render(<PresetSwitcherSheet onClose={onClose} />);
    const beforeLen = useAIConfigStore.getState().presets.length;
    fireEvent.click(screen.getByTestId('switcher-create-from-current'));
    expect(useAIConfigStore.getState().presets).toHaveLength(beforeLen + 1);
    expect(useAIConfigStore.getState().presets.at(-1)!.name).toBe('副本');
    expect(onClose).toHaveBeenCalled();
  });

  it('cancelling prompt does not create preset', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<PresetSwitcherSheet onClose={() => {}} />);
    const beforeLen = useAIConfigStore.getState().presets.length;
    fireEvent.click(screen.getByTestId('switcher-create-from-current'));
    expect(useAIConfigStore.getState().presets).toHaveLength(beforeLen);
  });
});
