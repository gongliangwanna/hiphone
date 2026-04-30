import { beforeEach, describe, expect, it } from 'vitest';
import { useSettingsNavStore } from './settingsNavStore';

describe('settingsNavStore', () => {
  beforeEach(() => {
    useSettingsNavStore.getState().reset();
  });

  it('keeps existing string page pushes working', () => {
    useSettingsNavStore.getState().push('about');

    expect(useSettingsNavStore.getState().stack).toEqual([
      { page: 'home' },
      { page: 'about' },
    ]);
  });

  it('supports route params for app detail pages', () => {
    useSettingsNavStore
      .getState()
      .push({ page: 'appDetail', params: { appId: 'settings' } });

    expect(useSettingsNavStore.getState().stack.at(-1)).toEqual({
      page: 'appDetail',
      params: { appId: 'settings' },
    });
  });
});
