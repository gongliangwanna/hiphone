import { beforeEach, describe, expect, it } from 'vitest';
import {
  canonicalizeAppId,
  useAppProfileStore,
} from '../appProfileStore';

describe('appProfileStore', () => {
  beforeEach(() => {
    useAppProfileStore.setState({ profiles: {} });
  });

  it('canonicalizes legacy Dock aliases', () => {
    expect(canonicalizeAppId('safari-dock')).toBe('safari');
    expect(canonicalizeAppId('music-dock')).toBe('music');
    expect(canonicalizeAppId('settings')).toBe('settings');
  });

  it('saves and reads custom display profile by canonical app id', () => {
    useAppProfileStore.getState().setName('music-dock', '我的音乐');
    useAppProfileStore.getState().setIcon('music', {
      dataUrl: 'data:image/png;base64,icon',
      crop: {
        sourceWidth: 1200,
        sourceHeight: 800,
        scale: 1.25,
        offsetX: -40,
        offsetY: 12,
      },
    });

    expect(useAppProfileStore.getState().getProfile('music')).toMatchObject({
      appId: 'music',
      customName: '我的音乐',
      customIconDataUrl: 'data:image/png;base64,icon',
      iconCrop: {
        sourceWidth: 1200,
        sourceHeight: 800,
        scale: 1.25,
        offsetX: -40,
        offsetY: 12,
      },
    });
  });

  it('trims empty names and leaves current profile unchanged', () => {
    useAppProfileStore.getState().setName('safari', '浏览器 Pro');
    useAppProfileStore.getState().setName('safari', '   ');

    expect(useAppProfileStore.getState().getProfile('safari')?.customName).toBe(
      '浏览器 Pro',
    );
  });

  it('restores default by removing the profile override', () => {
    useAppProfileStore.getState().setName('settings', '控制台');
    useAppProfileStore.getState().restoreDefault('settings');

    expect(useAppProfileStore.getState().getProfile('settings')).toBeUndefined();
  });
});
