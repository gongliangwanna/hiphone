import { beforeEach, describe, expect, it } from 'vitest';
import { useAppProfileStore } from '@/platform/stores/appProfileStore';
import { useInstalledUserAppsStore } from '@/platform/stores/installedUserAppsStore';
import {
  getResolvedAppMetadata,
  listResolvedAppMetadata,
  resolveAppDisplayName,
} from '../appMetadataResolver';
import { apps as catalogApps, dock } from '../appCatalog';

describe('appMetadataResolver', () => {
  beforeEach(() => {
    useAppProfileStore.setState({ profiles: {} });
    useInstalledUserAppsStore.setState({ apps: [] });
  });

  it('lists all apps by canonical id and kind', () => {
    const apps = listResolvedAppMetadata();

    expect(apps.find((app) => app.id === 'settings')?.kind).toBe('system');
    expect(apps.find((app) => app.id === 'gomoku')?.kind).toBe('preinstalled');
    expect(apps.find((app) => app.id === 'xingyu')?.kind).toBe('preinstalled');
    expect(apps.filter((app) => app.id === 'music')).toHaveLength(1);
    expect(apps.find((app) => app.id === 'music-dock')).toBeUndefined();
  });

  it('applies custom name and icon without changing original metadata', () => {
    useAppProfileStore.getState().setName('safari-dock', '网页');
    useAppProfileStore.getState().setIcon('safari', {
      dataUrl: 'data:image/png;base64,custom',
      crop: {
        sourceWidth: 400,
        sourceHeight: 400,
        scale: 1,
        offsetX: 0,
        offsetY: 0,
      },
    });

    const safari = getResolvedAppMetadata('safari');

    expect(safari?.originalName).toBe('Safari');
    expect(safari?.displayName).toBe('网页');
    expect(safari?.displayIcon).toBe('data:image/png;base64,custom');
    expect(resolveAppDisplayName('safari-dock')).toBe('网页');
  });

  it('keeps dock-only preinstalled apps categorized by product kind', () => {
    expect(catalogApps.find((app) => app.id === 'xingyu')).toBeUndefined();
    expect(dock.find((app) => app.id === 'xingyu')?.isDock).toBe(true);

    expect(getResolvedAppMetadata('xingyu')).toMatchObject({
      id: 'xingyu',
      kind: 'preinstalled',
    });
  });

  it('uses the generated bitmap icon for Presence instead of the old SVG', () => {
    const presence = catalogApps.find((app) => app.id === 'presence');

    expect(presence?.icon).toBe('/resource/icons/popular-cn/presence.png');
    expect(presence?.icon).not.toContain('.svg');
  });

  it('includes installed user apps with user kind', () => {
    useInstalledUserAppsStore.getState().replaceAll([
      {
        id: 'todo-app',
        name: '待办',
        iconDataUrl: null,
        page: 1,
        perspectiveAware: false,
        version: '1.0.0',
        installedAt: 1,
        sizeBytes: 2048,
      },
    ]);

    expect(getResolvedAppMetadata('todo-app')).toMatchObject({
      id: 'todo-app',
      kind: 'user',
      originalName: '待办',
      displayName: '待办',
    });
  });
});
