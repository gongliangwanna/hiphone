import { describe, expect, it, beforeEach } from 'vitest';
import { getAppsWithUserInstalled } from '../apps.data';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

describe('getAppsWithUserInstalled', () => {
  beforeEach(() => {
    useInstalledUserAppsStore.setState({ apps: [] });
  });

  it('includes builtin apps when no user apps installed', () => {
    const apps = getAppsWithUserInstalled();
    expect(apps.some((a) => a.id === 'settings')).toBe(true);
  });

  it('appends user apps after builtin', () => {
    useInstalledUserAppsStore.setState({
      apps: [
        {
          id: 'my-todo',
          name: '待办',
          iconDataUrl: 'data:image/png;base64,xxx',
          page: 1,
          perspectiveAware: false,
        },
      ],
    });
    const apps = getAppsWithUserInstalled();
    const mine = apps.find((a) => a.id === 'my-todo');
    expect(mine).toBeDefined();
    expect(mine?.icon).toBe('data:image/png;base64,xxx');
  });

  it('uses default icon when user app has no iconDataUrl', () => {
    useInstalledUserAppsStore.setState({
      apps: [
        { id: 'x', name: 'X', iconDataUrl: null, page: 1, perspectiveAware: false },
      ],
    });
    const apps = getAppsWithUserInstalled();
    expect(apps.find((a) => a.id === 'x')?.icon).toMatch(/resource|svg|default/i);
  });
});
