import { beforeEach, describe, expect, it } from 'vitest';
import { appRegistry } from '@/platform/appRegistry';
import { registerBuiltins } from '../registerBuiltins';

describe('registerBuiltins', () => {
  beforeEach(() => {
    appRegistry.list().forEach((e) => appRegistry.unregister(e.id));
  });

  it('registers all current builtin apps', () => {
    registerBuiltins();
    const ids = appRegistry.list().map((e) => e.id).sort();
    expect(ids).toEqual([
      'ai-app-builder',
      'app-store',
      'calendar',
      'camera',
      'gomoku',
      'maps',
      'music',
      'music-dock',
      'notes',
      'photos',
      'presence',
      'safari',
      'safari-dock',
      'settings',
      'weather',
      'xingyu',
    ]);
  });

  it('perspectiveAware flags match current AppScene semantics', () => {
    registerBuiltins();
    expect(appRegistry.get('settings')?.perspectiveAware).toBe(true);
    expect(appRegistry.get('xingyu')?.perspectiveAware).toBe(true);
    expect(appRegistry.get('notes')?.perspectiveAware).toBe(true);

    expect(appRegistry.get('weather')?.perspectiveAware).toBe(false);
    expect(appRegistry.get('calendar')?.perspectiveAware).toBe(false);
  });

  it('globalData flags match current AppScene semantics', () => {
    registerBuiltins();
    expect(appRegistry.get('weather')?.globalData).toBe(true);
    expect(appRegistry.get('maps')?.globalData).toBe(true);
    expect(appRegistry.get('music')?.globalData).toBe(true);
    expect(appRegistry.get('music-dock')?.globalData).toBe(true);

    expect(appRegistry.get('settings')?.globalData).toBe(false);
    expect(appRegistry.get('calendar')?.globalData).toBe(false);
    expect(appRegistry.get('camera')?.globalData).toBe(false);
  });

  it('all entries are type=builtin', () => {
    registerBuiltins();
    expect(appRegistry.list().every((e) => e.type === 'builtin')).toBe(true);
  });

  it('is idempotent on repeated calls', () => {
    registerBuiltins();
    const first = appRegistry.list().length;
    registerBuiltins();
    expect(appRegistry.list().length).toBe(first);
  });
});
