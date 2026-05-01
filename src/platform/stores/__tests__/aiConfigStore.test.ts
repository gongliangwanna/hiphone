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
