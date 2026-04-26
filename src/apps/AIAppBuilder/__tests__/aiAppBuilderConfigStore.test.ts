import { describe, it, expect, beforeEach } from 'vitest';
import { useAIAppBuilderConfigStore } from '../aiAppBuilderConfigStore';

describe('aiAppBuilderConfigStore', () => {
  beforeEach(() => {
    useAIAppBuilderConfigStore.setState({ modelOverride: null });
  });

  it('starts with no override (modelOverride === null)', () => {
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toBeNull();
  });

  it('setOverride stores the partial override', () => {
    useAIAppBuilderConfigStore.getState().setOverride({
      provider: 'anthropic',
      model: 'claude-opus-4',
    });
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toEqual({
      provider: 'anthropic',
      model: 'claude-opus-4',
    });
  });

  it('setOverride(null) clears the override', () => {
    useAIAppBuilderConfigStore.getState().setOverride({ model: 'x' });
    useAIAppBuilderConfigStore.getState().setOverride(null);
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toBeNull();
  });

  it('successive setOverride calls replace, not merge', () => {
    const s = useAIAppBuilderConfigStore.getState();
    s.setOverride({ provider: 'a', model: 'm1' });
    s.setOverride({ model: 'm2' });
    expect(useAIAppBuilderConfigStore.getState().modelOverride).toEqual({ model: 'm2' });
  });
});
