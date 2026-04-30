import { describe, expect, it, beforeEach } from 'vitest';
import { apps, dock, getAppInfoById, getAppsWithUserInstalled } from '../apps.data';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';

describe('getAppsWithUserInstalled', () => {
  beforeEach(() => {
    useInstalledUserAppsStore.setState({ apps: [] });
    useAppProfileStore.setState({ profiles: {} });
  });

  it('only exposes implemented builtin apps on the default desktop', () => {
    const visibleIds = new Set([...apps, ...dock].map((a) => a.id));

    expect(visibleIds).not.toContain('messages');
    expect(visibleIds).not.toContain('reminders');
    expect(visibleIds).not.toContain('alipay');
    expect(visibleIds).not.toContain('phone');
    expect(visibleIds).not.toContain('messages-dock');
    expect(visibleIds).not.toContain('music-dock');
    expect(visibleIds).not.toContain('safari-dock');

    for (const id of [
      'calendar',
      'photos',
      'camera',
      'weather',
      'maps',
      'notes',
      'settings',
      'app-store',
      'music',
      'safari',
      'translate',
      'xingyu',
      'gomoku',
      'ai-app-builder',
    ]) {
      expect(visibleIds).toContain(id);
    }
  });

  it('keeps settings and music in the Dock, not the home-screen grid', () => {
    expect(apps.map((a) => a.id)).not.toContain('settings');
    expect(apps.map((a) => a.id)).not.toContain('music');
    expect(dock.map((a) => a.id)).toEqual(['settings', 'safari', 'music', 'xingyu']);
  });

  it('keeps XingYu in the Dock, not the home-screen grid', () => {
    expect(apps.map((a) => a.id)).not.toContain('xingyu');
    expect(dock.map((a) => a.id)).toContain('xingyu');
  });

  it('includes builtin apps when no user apps installed', () => {
    const apps = getAppsWithUserInstalled();
    expect(apps.some((a) => a.id === 'calendar')).toBe(true);
    expect(apps.some((a) => a.id === 'settings')).toBe(false);
    expect(apps.some((a) => a.id === 'safari')).toBe(false);
    expect(apps.some((a) => a.id === 'music')).toBe(false);
    expect(apps.some((a) => a.id === 'xingyu')).toBe(false);
  });

  it('filters desktop apps already represented in dock by canonical id', () => {
    useInstalledUserAppsStore.setState({
      apps: [
        {
          id: 'safari-dock',
          name: 'Safari Duplicate',
          iconDataUrl: 'data:image/png;base64,duplicate',
          page: 1,
          perspectiveAware: false,
          version: '1.0.0',
          installedAt: 1_700_000_000_000,
          sizeBytes: 0,
        },
      ],
    });

    const ids = getAppsWithUserInstalled().map((app) => app.id);

    expect(ids).not.toContain('safari-dock');
    expect(ids).not.toContain('safari');
    expect(ids).not.toContain('music-dock');
    expect(ids).not.toContain('music');
  });

  it('applies custom profile name and icon to lookup app infos', () => {
    useAppProfileStore.getState().setName('settings', '控制台');
    useAppProfileStore.getState().setIcon('settings', {
      dataUrl: 'data:image/png;base64,custom',
      crop: {
        sourceWidth: 400,
        sourceHeight: 400,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
    });

    expect(getAppInfoById('settings')).toMatchObject({
      id: 'settings',
      name: '控制台',
      icon: 'data:image/png;base64,custom',
    });
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
          version: '1.0.0',
          installedAt: 1_700_000_000_000,
          sizeBytes: 0,
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
        {
          id: 'x',
          name: 'X',
          iconDataUrl: null,
          page: 1,
          perspectiveAware: false,
          version: '1.0.0',
          installedAt: 1_700_000_000_000,
          sizeBytes: 0,
        },
      ],
    });
    const apps = getAppsWithUserInstalled();
    expect(apps.find((a) => a.id === 'x')?.icon).toMatch(/resource|svg|default/i);
  });
});
