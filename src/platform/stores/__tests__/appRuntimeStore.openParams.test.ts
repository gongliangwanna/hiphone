import { describe, expect, it, beforeEach } from 'vitest';
import { useAppRuntimeStore } from '../appRuntimeStore';

describe('appRuntimeStore.openParams', () => {
  beforeEach(() => {
    useAppRuntimeStore.setState({ openParams: {} });
  });

  it('openParams defaults to empty record', () => {
    expect(useAppRuntimeStore.getState().openParams).toEqual({});
  });

  it('openParams can be set per appId', () => {
    useAppRuntimeStore.setState({
      openParams: { todo: { action: 'add', text: 'buy milk' } },
    });
    expect(useAppRuntimeStore.getState().openParams.todo).toEqual({
      action: 'add',
      text: 'buy milk',
    });
  });
});
