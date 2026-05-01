import { describe, it, expect, beforeEach } from 'vitest';
import { useAIConfigStore, type ApiPreset } from '../aiConfigStore';

function resetStore() {
  useAIConfigStore.setState((s) => ({
    ...s,
    presets: [],
    activePresetId: '',
  }));
}

describe('aiConfigStore — preset state shape', () => {
  beforeEach(resetStore);

  it('exposes presets array and activePresetId', () => {
    const s = useAIConfigStore.getState();
    expect(Array.isArray(s.presets)).toBe(true);
    expect(typeof s.activePresetId).toBe('string');
  });

  it('ApiPreset has expected keys', () => {
    const sample: ApiPreset = {
      id: 'p1',
      name: 'demo',
      provider: 'openrouter',
      apiKey: 'k',
      apiEndpoint: '',
      model: '',
      fetchedModels: [],
    };
    expect(Object.keys(sample).sort()).toEqual(
      ['apiEndpoint', 'apiKey', 'fetchedModels', 'id', 'model', 'name', 'provider'].sort(),
    );
  });
});

describe('createEmptyPreset', () => {
  beforeEach(resetStore);

  it('appends a new preset with empty connection fields and returns its id', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('我的预设');
    const { presets } = useAIConfigStore.getState();
    expect(presets).toHaveLength(1);
    expect(presets[0]!.id).toBe(id);
    expect(presets[0]!.name).toBe('我的预设');
    expect(presets[0]!.provider).toBe('openrouter');
    expect(presets[0]!.apiKey).toBe('');
    expect(presets[0]!.apiEndpoint).toBe('');
    expect(presets[0]!.model).toBe('');
    expect(presets[0]!.fetchedModels).toEqual([]);
  });

  it('falls back to "预设 N" when name is blank', () => {
    useAIConfigStore.getState().createEmptyPreset('   ');
    const { presets } = useAIConfigStore.getState();
    expect(presets[0]!.name).toBe('预设 1');
  });
});

describe('setActivePreset', () => {
  beforeEach(resetStore);

  it('mirrors active preset fields onto top-level state', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.setState((s) => ({
      ...s,
      presets: s.presets.map((p) =>
        p.id === id
          ? { ...p, provider: 'siliconflow', apiKey: 'k1', apiEndpoint: 'https://api.example', model: 'm1', fetchedModels: [] }
          : p,
      ),
    }));

    useAIConfigStore.getState().setActivePreset(id);

    const s = useAIConfigStore.getState();
    expect(s.activePresetId).toBe(id);
    expect(s.provider).toBe('siliconflow');
    expect(s.apiKey).toBe('k1');
    expect(s.apiEndpoint).toBe('https://api.example');
    expect(s.model).toBe('m1');
    expect(s.fetchedModels).toEqual([]);
  });

  it('clears transient model-list error/loading on switch', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.setState((s) => ({ ...s, modelListError: 'old err', modelListLoading: true }));
    useAIConfigStore.getState().setActivePreset(id);
    const s = useAIConfigStore.getState();
    expect(s.modelListError).toBeNull();
    expect(s.modelListLoading).toBe(false);
  });

  it('does nothing if id does not exist', () => {
    useAIConfigStore.getState().createEmptyPreset('A');
    const before = useAIConfigStore.getState().activePresetId;
    useAIConfigStore.getState().setActivePreset('nonexistent');
    expect(useAIConfigStore.getState().activePresetId).toBe(before);
  });
});
