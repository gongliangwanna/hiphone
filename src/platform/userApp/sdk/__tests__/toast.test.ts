import { beforeEach, describe, expect, it } from 'vitest';
import { show, warn, error } from '../toast';
import { useToastStore } from '@/system';

describe('@hiphone/toast', () => {
  beforeEach(() => {
    useToastStore.setState({ message: null, visible: false });
  });

  it('show() forwards the message to useToastStore', () => {
    show('hello');
    const state = useToastStore.getState();
    expect(state.message).toBe('hello');
    expect(state.visible).toBe(true);
  });

  it('warn() prefixes with ⚠️', () => {
    warn('careful');
    expect(useToastStore.getState().message).toBe('⚠️ careful');
  });

  it('error() prefixes with ❌', () => {
    error('boom');
    expect(useToastStore.getState().message).toBe('❌ boom');
  });

  it('subsequent show() replaces the prior message', () => {
    show('first');
    show('second');
    expect(useToastStore.getState().message).toBe('second');
  });
});
