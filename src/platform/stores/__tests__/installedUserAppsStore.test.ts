import { beforeEach, describe, expect, it } from 'vitest';
import {
  useInstalledUserAppsStore,
  type InstalledUserApp,
} from '../installedUserAppsStore';

const sample: InstalledUserApp = {
  id: 'my-todo',
  name: '待办',
  iconDataUrl: null,
  page: 1,
  perspectiveAware: false,
};

describe('installedUserAppsStore', () => {
  beforeEach(() => {
    useInstalledUserAppsStore.setState({ apps: [] });
  });

  it('add appends a new entry', () => {
    useInstalledUserAppsStore.getState().add(sample);
    expect(useInstalledUserAppsStore.getState().apps).toEqual([sample]);
  });

  it('add with an existing id replaces instead of duplicating', () => {
    useInstalledUserAppsStore.getState().add(sample);
    useInstalledUserAppsStore.getState().add({ ...sample, name: '新待办' });
    const apps = useInstalledUserAppsStore.getState().apps;
    expect(apps.length).toBe(1);
    expect(apps[0]!.name).toBe('新待办');
  });

  it('remove by id deletes the entry', () => {
    useInstalledUserAppsStore.getState().add(sample);
    useInstalledUserAppsStore.getState().remove('my-todo');
    expect(useInstalledUserAppsStore.getState().apps).toEqual([]);
  });

  it('remove non-existent id is a no-op', () => {
    useInstalledUserAppsStore.getState().add(sample);
    useInstalledUserAppsStore.getState().remove('nope');
    expect(useInstalledUserAppsStore.getState().apps).toEqual([sample]);
  });

  it('replaceAll overwrites the entire list', () => {
    useInstalledUserAppsStore.getState().add(sample);
    useInstalledUserAppsStore.getState().replaceAll([
      { ...sample, id: 'a' },
      { ...sample, id: 'b' },
    ]);
    expect(useInstalledUserAppsStore.getState().apps.map((a) => a.id)).toEqual(['a', 'b']);
  });
});
