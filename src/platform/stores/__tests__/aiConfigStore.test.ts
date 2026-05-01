import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useAIConfigStore, type ApiPreset } from '../aiConfigStore';
import * as providers from '@/platform/ai/providers';

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

describe('createPresetFromCurrent', () => {
  beforeEach(resetStore);

  it('snapshots current top-level fields into a new preset and switches active', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.setState((s) => ({
      ...s,
      presets: s.presets.map((p) =>
        p.id === aId ? { ...p, apiKey: 'k1', model: 'm1' } : p,
      ),
    }));
    useAIConfigStore.getState().setActivePreset(aId);

    const newId = useAIConfigStore.getState().createPresetFromCurrent('副本');
    const s = useAIConfigStore.getState();
    expect(s.presets).toHaveLength(2);
    const copy = s.presets.find((p) => p.id === newId)!;
    expect(copy.name).toBe('副本');
    expect(copy.apiKey).toBe('k1');
    expect(copy.model).toBe('m1');
    expect(s.activePresetId).toBe(newId);
    expect(s.presets.find((p) => p.id === aId)!.apiKey).toBe('k1');
  });

  it('uses fallback name when blank', () => {
    useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(useAIConfigStore.getState().presets[0]!.id);
    useAIConfigStore.getState().createPresetFromCurrent('  ');
    const s = useAIConfigStore.getState();
    expect(s.presets[1]!.name).toBe('预设 2');
  });
});

describe('renamePreset', () => {
  beforeEach(resetStore);

  it('updates name', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().renamePreset(id, '新名字');
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('新名字');
  });

  it('falls back to "预设 N" for blank name', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().renamePreset(id, '   ');
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('预设 1');
  });

  it('no-op for unknown id', () => {
    useAIConfigStore.getState().createEmptyPreset('A');
    expect(() => useAIConfigStore.getState().renamePreset('nope', 'X')).not.toThrow();
    expect(useAIConfigStore.getState().presets[0]!.name).toBe('A');
  });
});

describe('deletePreset', () => {
  beforeEach(resetStore);

  it('deletes a non-active preset', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    expect(useAIConfigStore.getState().deletePreset(bId)).toBe(true);
    expect(useAIConfigStore.getState().presets.map((p) => p.id)).toEqual([aId]);
    expect(useAIConfigStore.getState().activePresetId).toBe(aId);
  });

  it('switches to next preset when deleting active', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    useAIConfigStore.getState().deletePreset(aId);
    expect(useAIConfigStore.getState().activePresetId).toBe(bId);
  });

  it('switches to previous preset when deleting active and no next exists', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(bId);
    useAIConfigStore.getState().deletePreset(bId);
    expect(useAIConfigStore.getState().activePresetId).toBe(aId);
  });

  it('refuses to delete the last preset and returns false', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    expect(useAIConfigStore.getState().deletePreset(id)).toBe(false);
    expect(useAIConfigStore.getState().presets).toHaveLength(1);
  });
});

describe('setApiKey/Endpoint/Model write through to active preset', () => {
  beforeEach(resetStore);

  it('setApiKey updates active preset and top-level mirror', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    useAIConfigStore.getState().setApiKey('NEW');
    const s = useAIConfigStore.getState();
    expect(s.apiKey).toBe('NEW');
    expect(s.presets[0]!.apiKey).toBe('NEW');
  });

  it('setApiEndpoint write-through', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    useAIConfigStore.getState().setApiEndpoint('https://x');
    expect(useAIConfigStore.getState().presets[0]!.apiEndpoint).toBe('https://x');
  });

  it('setModel write-through', () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    useAIConfigStore.getState().setModel('gpt-4o');
    expect(useAIConfigStore.getState().presets[0]!.model).toBe('gpt-4o');
  });

  it('only modifies active preset, leaves others intact', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    useAIConfigStore.getState().setApiKey('only-A');
    const bPreset = useAIConfigStore.getState().presets.find((p) => p.id === bId)!;
    expect(bPreset.apiKey).toBe('');
  });
});

describe('setProvider write through', () => {
  beforeEach(resetStore);

  it('writes provider into active preset, does not touch other presets', () => {
    const aId = useAIConfigStore.getState().createEmptyPreset('A');
    const bId = useAIConfigStore.getState().createEmptyPreset('B');
    useAIConfigStore.getState().setActivePreset(aId);
    useAIConfigStore.getState().setProvider('siliconflow');
    const s = useAIConfigStore.getState();
    expect(s.provider).toBe('siliconflow');
    expect(s.presets.find((p) => p.id === aId)!.provider).toBe('siliconflow');
    expect(s.presets.find((p) => p.id === bId)!.provider).toBe('openrouter');
  });

  it('no longer references providerConfigs', () => {
    const s = useAIConfigStore.getState() as unknown as Record<string, unknown>;
    expect(s.providerConfigs).toBeUndefined();
  });
});

describe('fetchModels persists to active preset', () => {
  beforeEach(resetStore);
  afterEach(() => vi.restoreAllMocks());

  it('updates active preset fetchedModels when fetch succeeds', async () => {
    const id = useAIConfigStore.getState().createEmptyPreset('A');
    useAIConfigStore.getState().setActivePreset(id);
    useAIConfigStore.getState().setApiKey('test-key');
    const fakeModels = [{ id: 'm1', name: 'Model 1', contextLength: 4096 }];
    const adapter = providers.getAdapter('openrouter')!;
    vi.spyOn(adapter, 'fetchModels').mockResolvedValue(fakeModels);

    await useAIConfigStore.getState().fetchModels();
    const s = useAIConfigStore.getState();
    expect(s.fetchedModels).toEqual(fakeModels);
    expect(s.presets.find((p) => p.id === id)!.fetchedModels).toEqual(fakeModels);
  });
});
