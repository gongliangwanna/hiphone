import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { AIPresetsPage } from '../AIPresetsPage';
import { useAIConfigStore } from '@/platform/stores/aiConfigStore';
import { useSettingsNavStore } from '../../settingsNavStore';

function seedTwoPresets() {
  useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
  const aId = useAIConfigStore.getState().createEmptyPreset('日常 OR');
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: s.presets.map((p) =>
      p.id === aId ? { ...p, provider: 'openrouter', model: 'claude' } : p,
    ),
  }));
  const bId = useAIConfigStore.getState().createEmptyPreset('便宜 SF');
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: s.presets.map((p) =>
      p.id === bId ? { ...p, provider: 'siliconflow', model: 'qwen' } : p,
    ),
  }));
  useAIConfigStore.getState().setActivePreset(aId);
  return { aId, bId };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AIPresetsPage — list', () => {
  beforeEach(() => {
    seedTwoPresets();
  });

  it('renders all preset names', () => {
    render(<AIPresetsPage />);
    expect(screen.getByText('日常 OR')).toBeInTheDocument();
    expect(screen.getByText('便宜 SF')).toBeInTheDocument();
  });

  it('renders provider · model summary line', () => {
    render(<AIPresetsPage />);
    expect(screen.getByText(/openrouter.*claude/)).toBeInTheDocument();
    expect(screen.getByText(/siliconflow.*qwen/)).toBeInTheDocument();
  });

  it('marks the active preset row with data-active', () => {
    const { aId } = seedTwoPresets();
    render(<AIPresetsPage />);
    expect(screen.getByTestId(`preset-row-${aId}`)).toHaveAttribute('data-active', 'true');
  });
});

describe('AIPresetsPage — rename', () => {
  beforeEach(() => seedTwoPresets());

  it('calls window.prompt and updates name on confirm', () => {
    const promptSpy = vi.spyOn(window, 'prompt').mockReturnValue('新名字');
    render(<AIPresetsPage />);
    fireEvent.click(screen.getByText('日常 OR'));
    expect(promptSpy).toHaveBeenCalled();
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('新名字');
  });

  it('no-ops on cancel (prompt returns null)', () => {
    vi.spyOn(window, 'prompt').mockReturnValue(null);
    render(<AIPresetsPage />);
    fireEvent.click(screen.getByText('日常 OR'));
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('日常 OR');
  });
});

describe('AIPresetsPage — delete', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('deletes a non-active preset when delete button is clicked', () => {
    const { bId } = seedTwoPresets();
    render(<AIPresetsPage />);
    fireEvent.click(screen.getByTestId(`preset-delete-${bId}`));
    const presets = useAIConfigStore.getState().presets;
    expect(presets.find((p) => p.id === bId)).toBeUndefined();
  });

  it('hides delete button when only one preset remains', () => {
    useAIConfigStore.setState((s) => ({ ...s, presets: [], activePresetId: '' }));
    const id = useAIConfigStore.getState().createEmptyPreset('Solo');
    useAIConfigStore.getState().setActivePreset(id);
    render(<AIPresetsPage />);
    expect(screen.queryByTestId(`preset-delete-${id}`)).toBeNull();
  });
});

describe('AIPresetsPage — new empty preset', () => {
  beforeEach(() => {
    seedTwoPresets();
    useSettingsNavStore.getState().reset();
    useSettingsNavStore.getState().push('aiPresets');
  });

  it('creates a new preset, switches to it, and pops back', () => {
    render(<AIPresetsPage />);
    const beforeLen = useAIConfigStore.getState().presets.length;
    fireEvent.click(screen.getByTestId('preset-create-empty'));
    const after = useAIConfigStore.getState();
    expect(after.presets).toHaveLength(beforeLen + 1);
    const newPreset = after.presets[after.presets.length - 1]!;
    expect(after.activePresetId).toBe(newPreset.id);
    expect(after.apiKey).toBe('');
    const stack = useSettingsNavStore.getState().stack;
    expect(stack[stack.length - 1]?.page).not.toBe('aiPresets');
  });
});
